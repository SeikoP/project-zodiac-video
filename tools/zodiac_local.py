#!/usr/bin/env python3
"""Import and run RENDER_READY exports from zodiac-video-pipeline."""

from __future__ import annotations

import argparse
import contextlib
import contextvars
import difflib
import json
import math
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath


class PipelineError(Exception):
    """A package, runtime, or local-tool prerequisite is invalid."""


class AlignmentMismatchError(PipelineError):
    """ASR differs from approved narration, with coverage metadata for retry policy."""

    def __init__(
        self,
        message: str,
        *,
        expected: list[str],
        heard: list[str],
        coverage_gap: bool,
    ) -> None:
        super().__init__(message)
        self.expected = expected
        self.heard = heard
        self.coverage_gap = bool(coverage_gap)


MAX_ZIP_ENTRIES = 5000
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_COMPRESSION_RATIO = 250
LEGACY_EXPECTED_DEPENDENCIES = {
    "@remotion/captions": "4.0.530",
    "@remotion/cli": "4.0.530",
    "@remotion/media": "4.0.530",
    "remotion": "4.0.530",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@remotion/layout-utils": "4.0.530",
    "@fontsource/be-vietnam-pro": "5.3.0",
    "ajv": "8.20.0",
}
EXPECTED_DEPENDENCIES = {
    **LEGACY_EXPECTED_DEPENDENCIES,
    "@fontsource/patrick-hand": "5.3.0",
}
EXPECTED_DEV_DEPENDENCIES = {
    "@types/node": "24.0.0",
    "@types/react": "19.0.0",
    "typescript": "5.8.0",
}
LEGACY_EXPECTED_SCRIPTS = {
    "prepare:runtime": "node scripts/render.mjs --prepare-only",
    "studio": "npm run prepare:runtime && remotion studio src/index.ts --props=../.runtime/render-props.json",
    "render": "node scripts/render.mjs",
    "test": "node --test tests/*.test.mjs",
    "typecheck": "tsc --noEmit",
    "compile:style": "node scripts/compile-style-token.mjs",
}
EXPECTED_SCRIPTS = {
    "prepare:runtime": "node scripts/render.mjs --prepare-only",
    "studio": "node scripts/render.mjs --studio",
    "render": "node scripts/render.mjs",
    "test": "node --test tests/*.test.mjs",
    "typecheck": "tsc --noEmit",
    "compile:style": "node scripts/compile-style-token.mjs",
}
PACKAGE_FORMAT_V3 = "zodiac-job@3"
PACKAGE_FORMAT_V4 = "zodiac-job@4"
RUNTIME_FORMAT = "zodiac-runtime@1"
RUNTIME_ID = "zodiac-remotion"
RUNTIME_VERSION = "1.20.0"
BUNDLED_RUNTIMES = Path(__file__).resolve().parents[1] / "runtime"
SUPPORTED_TYPESCRIPT_VERSIONS = {"5.8.0", "5.8.2"}
DEFAULT_TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
DEFAULT_TTS_VOICE = "Hải Đăng"
DEFAULT_TTS_BACKEND = "onnx"
DEFAULT_TTS_PRECISION = "fp32"
DEFAULT_TTS_FRAME_CAP = "on"
DEFAULT_TTS_MAX_CHARS = 256
DEFAULT_SPEECH_RATE_WARNING_WPS = 3.8
ASR_SCENE_BOUNDARY_TOLERANCE_MS = 250.0
MAX_VISUAL_GAP_WORDS = 15
MAX_VISUAL_GAP_SECONDS = 5.0
AUDIO_PREVIEW_SECONDS = 10.0
AUDIO_PREVIEW_DEFAULT_VOLUME = 1.0
DEFAULT_MUSIC_VOLUME = 1.0
DEFAULT_SCENE_GAP_MS = 350.0
DEFAULT_SENTENCE_PAUSE_MS = 320.0
DEFAULT_PLAYBACK_RATE = 0.95
SUPPORTED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}
# Bundled background track; resolved from the repo so it works from any cwd.
BUNDLED_MUSIC = Path(__file__).resolve().parents[1] / "assets" / "music" / "background.mp3"


def default_music_path() -> Path | None:
    """Bundled background track when it exists, otherwise None (no music)."""
    return BUNDLED_MUSIC if BUNDLED_MUSIC.is_file() else None


def _safe_relative_path(raw_name: str) -> PurePosixPath:
    normalized = raw_name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        "\x00" in normalized
        or path.is_absolute()
        or re.match(r"^[A-Za-z]:", normalized)
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise PipelineError(f"unsafe ZIP path: {raw_name!r}")
    return path


def safe_extract_zip(archive_path: Path, destination: Path) -> None:
    """Extract a ZIP after rejecting traversal, links, duplicates, and ZIP bombs."""
    archive_path = Path(archive_path)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    seen: set[str] = set()
    total_size = 0

    try:
        with zipfile.ZipFile(archive_path) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ZIP_ENTRIES:
                raise PipelineError(f"ZIP has more than {MAX_ZIP_ENTRIES} entries.")

            for info in entries:
                rel = _safe_relative_path(info.filename.rstrip("/"))
                key = rel.as_posix().casefold()
                if key in seen:
                    raise PipelineError(f"duplicate ZIP path: {info.filename!r}")
                seen.add(key)

                mode = info.external_attr >> 16
                kind = stat.S_IFMT(mode)
                if kind == stat.S_IFLNK:
                    raise PipelineError(f"ZIP symbolic links are not allowed: {info.filename!r}")
                if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                    raise PipelineError(f"ZIP special files are not allowed: {info.filename!r}")
                if info.flag_bits & 0x1:
                    raise PipelineError("encrypted ZIP members are not supported.")

                target = destination.joinpath(*rel.parts)
                resolved = target.resolve()
                if not resolved.is_relative_to(root):
                    raise PipelineError(f"unsafe ZIP path: {info.filename!r}")
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue

                if info.file_size > MAX_FILE_BYTES:
                    raise PipelineError(f"ZIP member is too large: {info.filename!r}")
                total_size += info.file_size
                if total_size > MAX_TOTAL_BYTES:
                    raise PipelineError("ZIP expands beyond the 512 MiB safety limit.")
                if info.file_size > 1_000_000 and (
                    info.compress_size == 0
                    or info.file_size / info.compress_size > MAX_COMPRESSION_RATIO
                ):
                    raise PipelineError(f"suspicious compression ratio: {info.filename!r}")

                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info, "r") as source, target.open("xb") as output:
                    copied = 0
                    while chunk := source.read(1024 * 1024):
                        copied += len(chunk)
                        if copied > info.file_size or copied > MAX_FILE_BYTES:
                            raise PipelineError(f"ZIP member exceeded declared size: {info.filename!r}")
                        output.write(chunk)
                    if copied != info.file_size:
                        raise PipelineError(f"ZIP member size mismatch: {info.filename!r}")
    except PipelineError:
        raise
    except (OSError, zipfile.BadZipFile, RuntimeError, EOFError, NotImplementedError) as exc:
        raise PipelineError(f"cannot safely read ZIP: {exc}") from exc


def _load_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PipelineError(f"cannot read {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise PipelineError(f"{label} must contain a JSON object.")
    return value


def _package_root(extracted: Path) -> Path:
    candidates = list(extracted.rglob("production.json"))
    if not candidates:
        raise PipelineError("RENDER_READY video package is missing production.json.")
    if len(candidates) != 1:
        raise PipelineError("ZIP must contain exactly one production.json.")
    return candidates[0].parent


_RUNTIME_TEXT_SUFFIXES = {
    ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".mts",
    ".ts", ".tsx", ".txt", ".yaml", ".yml",
}


def _canonical_runtime_file_bytes(file_path: Path) -> bytes:
    """Normalize text line endings so runtime integrity is checkout-platform agnostic."""
    data = file_path.read_bytes()
    if file_path.suffix.lower() in _RUNTIME_TEXT_SUFFIXES or file_path.name.endswith(".d.ts"):
        data = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return data


def _renderer_tree_sha256(renderer_root: Path) -> str:
    """Hash immutable renderer source/config; ignore installed/generated runtime state."""
    import hashlib

    renderer_root = Path(renderer_root).resolve()
    digest = hashlib.sha256()
    ignored_dirs = {"node_modules", ".cache", "generated"}
    ignored_files = {"package-lock.json"}
    files = [
        path
        for path in renderer_root.rglob("*")
        if path.is_file()
        and path.name not in ignored_files
        and not any(part in ignored_dirs for part in path.relative_to(renderer_root).parts)
    ]
    for file_path in sorted(files, key=lambda item: item.relative_to(renderer_root).as_posix()):
        relative = file_path.relative_to(renderer_root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(_canonical_runtime_file_bytes(file_path))
        digest.update(b"\0")
    return digest.hexdigest()


def _bundled_runtime_root(runtime_ref: dict) -> Path:
    runtime_id = runtime_ref.get("id")
    version = runtime_ref.get("version")
    if not isinstance(runtime_id, str) or not isinstance(version, str):
        raise PipelineError("PACKAGE_MANIFEST_INVALID: runtime id/version must be strings.")
    root = BUNDLED_RUNTIMES / runtime_id / version
    if not root.is_dir():
        raise PipelineError(
            f"RUNTIME_MISSING: {runtime_id}@{version} is not bundled with this Zodiac Studio."
        )
    return root


def _load_package_manifest(root: Path) -> dict | None:
    """Load/validate thin-package metadata; absence means legacy v2 mode."""
    root = Path(root).resolve()
    path = root / "package-manifest.json"
    if not path.is_file():
        return None
    manifest = _load_json(path, "package-manifest.json")
    package_format = manifest.get("format")
    if package_format not in {PACKAGE_FORMAT_V3, PACKAGE_FORMAT_V4} or manifest.get("production_contract") != "2.0":
        raise PipelineError(
            "PACKAGE_MANIFEST_INVALID: expected zodiac-job@3/@4 with production_contract 2.0."
        )

    runtime_ref = manifest.get("runtime")
    producer = manifest.get("producer")
    runtime_keys = ("id", "version", "sha256") if package_format == PACKAGE_FORMAT_V3 else ("id", "version")
    runtime_valid = (
        isinstance(runtime_ref, dict)
        and all(isinstance(runtime_ref.get(key), str) and runtime_ref[key].strip() for key in runtime_keys)
    )
    if package_format == PACKAGE_FORMAT_V3:
        runtime_valid = runtime_valid and bool(re.fullmatch(r"[0-9a-f]{64}", runtime_ref.get("sha256", "")))
        design_ref = manifest.get("design")
        design_valid = (
            isinstance(design_ref, dict)
            and all(isinstance(design_ref.get(key), str) and design_ref[key].strip() for key in ("id", "version", "sha256"))
            and bool(re.fullmatch(r"[0-9a-f]{64}", design_ref.get("sha256", "")))
        )
    else:
        design_valid = (
            isinstance(runtime_ref, dict)
            and "design" not in manifest
            and "sha256" not in runtime_ref
        )

    producer_valid = (
        isinstance(producer, dict)
        and producer.get("plugin") == "zodiac-video-pipeline"
        and isinstance(producer.get("version"), str)
        and bool(producer["version"].strip())
    )
    if not runtime_valid or not design_valid or not producer_valid:
        raise PipelineError("PACKAGE_MANIFEST_INVALID: runtime/design/producer references are incomplete.")

    forbidden_names = ["renderer", "library", "references", "node_modules", ".authoring"]
    if package_format == PACKAGE_FORMAT_V4:
        forbidden_names.extend([
            "FINAL_VALIDATION.json",
            "handoff-manifest.json",
        ])
        required_v4 = (
            "production.json",
            "narration.txt",
            "design.md",
            "publish/publish.json",
            "publish/publish-copy.txt",
        )
        missing_v4 = [name for name in required_v4 if not (root / name).is_file()]
        if missing_v4 or not (root / "assets").is_dir():
            missing = missing_v4 + ([] if (root / "assets").is_dir() else ["assets/"])
            raise PipelineError(
                "PACKAGE_MANIFEST_INVALID: zodiac-job@4 is missing " + ", ".join(missing) + "."
            )
    forbidden = [name for name in forbidden_names if (root / name).exists()]
    if forbidden:
        code = "PACKAGE_V4_BLOAT" if package_format == PACKAGE_FORMAT_V4 else "PACKAGE_V3_BLOAT"
        raise PipelineError(
            code + ": thin packages must not contain " + ", ".join(forbidden) + "."
        )

    bundled = _bundled_runtime_root(runtime_ref)
    runtime_manifest = _load_json(bundled / "runtime-manifest.json", "runtime-manifest.json")
    if (
        runtime_manifest.get("format") != RUNTIME_FORMAT
        or runtime_manifest.get("id") != runtime_ref["id"]
        or runtime_manifest.get("version") != runtime_ref["version"]
    ):
        code = "BUNDLED_RUNTIME_CORRUPT" if package_format == PACKAGE_FORMAT_V4 else "RUNTIME_HASH_MISMATCH"
        raise PipelineError(code + ": bundled runtime metadata does not match the requested runtime.")

    actual_hash = _renderer_tree_sha256(bundled / "renderer")
    if runtime_manifest.get("sha256") != actual_hash:
        code = "BUNDLED_RUNTIME_CORRUPT" if package_format == PACKAGE_FORMAT_V4 else "RUNTIME_HASH_MISMATCH"
        raise PipelineError(code + ": bundled renderer source does not match its runtime manifest.")
    if package_format == PACKAGE_FORMAT_V3 and runtime_ref["sha256"] != actual_hash:
        raise PipelineError(
            "RUNTIME_HASH_MISMATCH: requested runtime hash does not match bundled renderer source."
        )
    return manifest


def _validate_import_boundary(root: Path) -> None:
    """Reject local-runtime artifacts only at the incoming zodiac-job@4 ZIP boundary."""
    root = Path(root).resolve()
    manifest = _load_package_manifest(root)
    if manifest is None or manifest.get("format") != PACKAGE_FORMAT_V4:
        return
    forbidden = [
        name
        for name in (".runtime", "out", "voice.wav")
        if (root / name).exists()
    ]
    if forbidden:
        raise PipelineError(
            "PACKAGE_V4_BLOAT: incoming zodiac-job@4 must not contain "
            + ", ".join(forbidden)
            + "."
        )


def _validate_package_manifest_design(manifest: dict | None, token: dict, source_hash: str) -> None:
    if manifest is None or manifest.get("format") == PACKAGE_FORMAT_V4:
        return
    design = manifest["design"]
    if (
        design.get("id") != token.get("id")
        or design.get("version") != str(token.get("version"))
        or design.get("sha256") != source_hash
    ):
        raise PipelineError(
            "PACKAGE_MANIFEST_INVALID: design reference must match design.md and compiled source_hash."
        )


def _workspace_root_for_job(root: Path) -> Path:
    root = Path(root).resolve()
    if root.parent.name == "jobs":
        return root.parent.parent
    return root.parent / ".zodiac-work"


def _verify_cached_runtime(runtime_root: Path, runtime_ref: dict) -> None:
    manifest = _load_json(runtime_root / "runtime-manifest.json", "cached runtime-manifest.json")
    actual_hash = _renderer_tree_sha256(runtime_root / "renderer")
    expected_hash = runtime_ref.get("sha256")
    if not isinstance(expected_hash, str) or not expected_hash:
        bundled = _bundled_runtime_root(runtime_ref)
        expected_hash = _load_json(
            bundled / "runtime-manifest.json",
            "runtime-manifest.json",
        ).get("sha256")
    if (
        manifest.get("id") != runtime_ref.get("id")
        or manifest.get("version") != runtime_ref.get("version")
        or manifest.get("sha256") != expected_hash
        or actual_hash != expected_hash
    ):
        raise PipelineError(
            "RUNTIME_HASH_MISMATCH: cached runtime differs from the exact local runtime reference."
        )


def resolve_renderer_root(package_root: Path, *, materialize: bool = True) -> Path:
    """Return legacy package renderer or exact shared v3/v4 runtime renderer."""
    root = Path(package_root).resolve()
    manifest = _load_package_manifest(root)
    if manifest is None:
        return root / "renderer"
    runtime_ref = manifest["runtime"]
    bundled = _bundled_runtime_root(runtime_ref)
    if not materialize:
        return bundled / "renderer"

    workspace = _workspace_root_for_job(root)
    runtime_root = workspace / "runtimes" / runtime_ref["id"] / runtime_ref["version"]
    if not runtime_root.exists():
        runtime_root.parent.mkdir(parents=True, exist_ok=True)
        scratch = runtime_root.with_name(runtime_root.name + f".tmp-{os.getpid()}")
        if scratch.exists():
            shutil.rmtree(scratch)
        shutil.copytree(bundled, scratch)
        try:
            os.replace(scratch, runtime_root)
        except OSError:
            if not runtime_root.exists():
                raise
            shutil.rmtree(scratch, ignore_errors=True)
    _verify_cached_runtime(runtime_root, runtime_ref)
    return runtime_root / "renderer"


def _renderer_environment(package_root: Path) -> dict[str, str]:
    env = dict(os.environ)
    env["ZODIAC_PACKAGE_ROOT"] = str(Path(package_root).resolve())
    return env


def _validate_handoff_boundary(root: Path) -> None:
    """Accept the structured plugin handoff; retain README literal only for legacy packages."""
    manifest_path = root / "handoff-manifest.json"
    if manifest_path.is_file():
        manifest = _load_json(manifest_path, "handoff-manifest.json")
        statuses = manifest.get("status")
        if (
            not isinstance(manifest.get("package_id"), str)
            or not manifest["package_id"].strip()
            or not isinstance(manifest.get("plugin_version"), str)
            or not manifest["plugin_version"].strip()
            or not isinstance(statuses, list)
            or not any(
                status in {"LOCAL_RUNTIME_PENDING", "RENDER_READY"}
                for status in statuses
            )
        ):
            raise PipelineError(
                "handoff-manifest.json must identify the package/plugin and declare "
                "LOCAL_RUNTIME_PENDING or RENDER_READY."
            )
        return

    try:
        readme_text = (root / "README.md").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read README.md or structured handoff manifest: {exc}") from exc
    if "PLUGIN SIDE COMPLETE" not in readme_text:
        raise PipelineError(
            "package handoff is missing: add handoff-manifest.json or the legacy "
            "README.md marker PLUGIN SIDE COMPLETE."
        )


def _asset_file(root: Path, asset_id: str, entry: dict) -> Path:
    raw = entry.get("path")
    if not isinstance(raw, str) or not raw:
        raise PipelineError(f"asset {asset_id!r} has no path.")
    rel = _safe_relative_path(raw)
    if not rel.parts or rel.parts[0] != "assets" or rel.suffix.lower() != ".svg":
        raise PipelineError(f"asset {asset_id!r} must resolve to an SVG under assets/: {raw}")
    path = root.joinpath(*rel.parts).resolve()
    if not path.is_relative_to((root / "assets").resolve()) or not path.is_file():
        raise PipelineError(f"asset file is missing or escapes assets/: {raw}")
    if entry.get("format") != "image/svg+xml":
        raise PipelineError(f"asset {asset_id!r} must declare format image/svg+xml.")
    try:
        content = path.read_text(encoding="utf-8")
        if "<!DOCTYPE" in content.upper() or "<!ENTITY" in content.upper():
            raise PipelineError(f"SVG declarations are not allowed in {raw}.")
        tree = ET.fromstring(content)
    except PipelineError:
        raise
    except (OSError, UnicodeDecodeError, ET.ParseError) as exc:
        raise PipelineError(f"asset SVG is unreadable or invalid: {raw} ({exc})") from exc
    if tree.tag.split("}")[-1] != "svg":
        raise PipelineError(f"asset is not an SVG document: {raw}")
    metadata_label = re.compile(
        r"\b(?:animation-ready|derived state|scene module|prop master|"
        r"(?:virgo|viewer|gemini|narrator) (?:master|state))\b",
        re.IGNORECASE,
    )
    for element in tree.iter():
        tag = element.tag.split("}")[-1].lower()
        if tag in {"script", "foreignobject", "image"}:
            raise PipelineError(f"unsupported active or raster SVG element <{tag}> in {raw}.")
        if (
            tag == "rect"
            and str(element.attrib.get("width", "")).strip() == "100%"
            and str(element.attrib.get("height", "")).strip() == "100%"
        ):
            raise PipelineError(
                f"PRODUCTION_ASSET_DIRTY: full-artboard background is not allowed in {raw}."
            )
        if tag == "text":
            label = " ".join("".join(element.itertext()).split())
            if metadata_label.search(label):
                raise PipelineError(
                    f"PRODUCTION_ASSET_DIRTY: asset-library metadata label remains in {raw}: {label!r}."
                )
        for key, value in element.attrib.items():
            if key.split("}")[-1].lower() in {"href", "src"} or "url(" in value.lower():
                raise PipelineError(f"external SVG links are not allowed in {raw}.")
    return path


def _normalize_token(value: str) -> str:
    value = unicodedata.normalize("NFC", str(value)).lower()
    return "".join(
        char
        for char in value
        if not unicodedata.category(char).startswith(("P", "S")) and not char.isspace()
    )


def _normalize_words(value: str) -> str:
    value = unicodedata.normalize("NFC", str(value)).lower()
    chars = []
    for char in value:
        category = unicodedata.category(char)
        chars.append(" " if char.isspace() or category.startswith(("P", "S")) else char)
    return " ".join("".join(chars).split())


def _normalized_word_tokens(value: str) -> list[str]:
    return _normalize_words(value).split()


def canonical_narration_text(production: dict) -> str:
    """Serialize approved scene voices exactly as the package/runtime contract expects."""
    scenes = production.get("scenes")
    if not isinstance(scenes, list):
        raise PipelineError("production.json scenes must be a list before narration serialization.")
    voices: list[str] = []
    for scene in scenes:
        voice = scene.get("voice") if isinstance(scene, dict) else None
        if not isinstance(voice, str):
            raise PipelineError("every scene must have string voice text before narration serialization.")
        voices.append(voice)
    return "\n".join(voices)


def _find_anchor_word_index_for_progression(
    words: list[str],
    anchor_text: str,
    occurrence: int | None = None,
) -> tuple[int | None, bool]:
    """Best-effort anchor lookup for density only; semantic validation lives elsewhere."""
    anchor = _normalized_word_tokens(anchor_text)
    if not anchor:
        return None, False
    matches = [
        index
        for index in range(len(words) - len(anchor) + 1)
        if words[index:index + len(anchor)] == anchor
    ]
    if not matches:
        return None, False
    if occurrence is None:
        return matches[0], True
    if (
        not isinstance(occurrence, int)
        or isinstance(occurrence, bool)
        or occurrence < 1
        or occurrence > len(matches)
    ):
        return None, False
    return matches[occurrence - 1], True


def _story_change_positions_words(scene: dict) -> tuple[list[int], bool]:
    words = _normalized_word_tokens(scene.get("voice", ""))
    positions: list[int] = []
    complete = True
    for event in scene.get("events", []):
        if (
            event.get("target") == "camera"
            or event.get("state_before") == event.get("state_after")
        ):
            continue
        trigger = event.get("trigger", {})
        if trigger.get("source") == "scene_start":
            positions.append(0)
        elif trigger.get("source") == "voice_anchor":
            position, resolved = _find_anchor_word_index_for_progression(
                words,
                str(trigger.get("text", "")),
                trigger.get("occurrence"),
            )
            if resolved and position is not None:
                positions.append(position)
            else:
                complete = False
    return sorted(set(positions)), complete


def _validate_visual_progression_proxy(scene: dict) -> None:
    words = _normalized_word_tokens(scene.get("voice", ""))
    if not words:
        return
    positions, complete = _story_change_positions_words(scene)
    if not complete:
        # Anchor semantics are owned by the editor/renderer. Do not replace their
        # stable missing/ambiguous/occurrence error codes with a density error.
        return
    if not positions:
        raise PipelineError(
            f"VISUAL_PROGRESSION_DENSITY: scene {scene.get('id')} has no meaningful visual change."
        )
    checkpoints = [0, *positions, len(words)]
    max_gap = max(
        right - left
        for left, right in zip(checkpoints, checkpoints[1:])
    )
    if max_gap > MAX_VISUAL_GAP_WORDS:
        raise PipelineError(
            f"VISUAL_PROGRESSION_DENSITY: scene {scene.get('id')} has "
            f"{max_gap} words without a meaningful visual change; "
            f"max {MAX_VISUAL_GAP_WORDS} words before local timing."
        )


def _validate_measured_visual_progression(scene: dict, row: dict, fps: int) -> None:
    captions = row["captions"]
    caption_words = [_normalize_token(cue["text"]) for cue in captions]
    positions: list[int] = []
    for event in scene.get("events", []):
        if (
            event.get("target") == "camera"
            or event.get("state_before") == event.get("state_after")
        ):
            continue
        trigger = event.get("trigger", {})
        if trigger.get("source") == "scene_start":
            positions.append(row["start_frame"])
            continue
        if trigger.get("source") != "voice_anchor":
            continue
        anchor = _normalized_word_tokens(str(trigger.get("text", "")))
        matches = [
            index
            for index in range(len(caption_words) - len(anchor) + 1)
            if caption_words[index:index + len(anchor)] == anchor
        ]
        if not matches:
            # Runtime/editor anchor validation owns this semantic error. Keeping
            # timing loadable lets the editor present and repair the bad anchor.
            return
        occurrence = trigger.get("occurrence")
        if occurrence is None:
            match_index = matches[0]
        elif (
            not isinstance(occurrence, int)
            or isinstance(occurrence, bool)
            or occurrence < 1
            or occurrence > len(matches)
        ):
            return
        else:
            match_index = matches[occurrence - 1]
        positions.append(math.floor(captions[match_index]["startMs"] * fps / 1000))

    if not positions:
        raise PipelineError(
            f"VISUAL_PROGRESSION_TIMING: scene {scene.get('id')} has no measured visual changes."
        )
    points = [row["start_frame"], *sorted(set(positions)), row["start_frame"] + row["duration_frames"]]
    max_gap_frames = max(
        right - left
        for left, right in zip(points, points[1:])
    )
    limit = MAX_VISUAL_GAP_SECONDS * fps
    if max_gap_frames > limit:
        raise PipelineError(
            f"VISUAL_PROGRESSION_TIMING: scene {scene.get('id')} has a "
            f"{max_gap_frames / fps:.2f}s gap without a meaningful visual change; "
            f"max {MAX_VISUAL_GAP_SECONDS:.1f}s."
        )


def _design_token(root: Path) -> tuple[dict, str]:
    import hashlib

    path = root / "design.md"
    try:
        markdown = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read design.md: {exc}") from exc

    fence = chr(96) * 3
    match = re.search(
        r"<!-- STYLE_TOKEN_BEGIN -->\s*"
        + re.escape(fence)
        + r"json\s*([\s\S]*?)\s*"
        + re.escape(fence)
        + r"\s*<!-- STYLE_TOKEN_END -->",
        markdown,
    )
    if not match:
        raise PipelineError("design.md is missing the marked STYLE_TOKEN JSON block.")
    try:
        token = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise PipelineError(f"design.md STYLE_TOKEN JSON is invalid: {exc}") from exc

    required = {
        "id",
        "version",
        "palette_roles",
        "character_construction",
        "shape_language",
        "caption_emphasis",
        "safe_zone",
        "motion_grammar",
    }
    if not isinstance(token, dict) or not required.issubset(token):
        raise PipelineError("design.md STYLE_TOKEN is missing required v2 fields.")

    canonical = json.dumps(token, ensure_ascii=False, separators=(",", ":"))
    return token, hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _read_renderer_source(renderer_root: Path, relative: str) -> str:
    path = renderer_root / relative
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(
            f"PACKAGE_RENDERER_STALE: cannot read renderer/{relative}: {exc}"
        ) from exc
    if not text.strip():
        raise PipelineError(
            f"PACKAGE_RENDERER_STALE: renderer/{relative} is empty."
        )
    return text


def _validate_renderer_source_contract(
    renderer_root: Path,
    *,
    require_isolated_layout: bool = False,
    require_overlay_layout: bool = False,
) -> None:
    """Reject placeholder/stale renderer trees before local runtime work."""
    render_script = _read_renderer_source(renderer_root, "scripts/render.mjs")
    render_requirements = {
        "render-props.json": r"render-props\.json",
        "runtime props write": r"\bwriteFile\b",
        "Remotion invocation": r"\bspawnSync\b",
        "composition id": r"ZodiacVideo",
        "MP4 output": r"zodiac-story\.mp4",
    }
    missing = [
        label
        for label, pattern in render_requirements.items()
        if re.search(pattern, render_script) is None
    ]
    if missing:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/scripts/render.mjs is not the "
            "canonical local renderer; missing " + ", ".join(missing) + "."
        )

    root_source = _read_renderer_source(renderer_root, "src/Root.tsx")
    if (
        "calculateMetadata" not in root_source
        or "total_duration_frames" not in root_source
    ):
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/src/Root.tsx must derive "
            "duration from runtime total_duration_frames via calculateMetadata."
        )

    composition = _read_renderer_source(
        renderer_root,
        "src/ZodiacComposition.tsx",
    )
    composition_requirements = {
        "all production scenes": r"production\.scenes\.map",
        "runtime scene timing": r"timing\.scenes",
        "scene Sequence": r"\bSequence\b",
        "local voice": r"voice\.wav",
        "entity rendering": r"scene\.entities",
        "event rendering": r"scene\.events",
    }
    missing = [
        label
        for label, pattern in composition_requirements.items()
        if re.search(pattern, composition) is None
    ]
    if missing:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/src/ZodiacComposition.tsx is "
            "a reduced/stale renderer; missing " + ", ".join(missing) + "."
        )
    if not all(
        token in composition
        for token in ('width: "fit-content"', "maxWidth", 'translateX(-50%)')
    ):
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/src/ZodiacComposition.tsx "
            "must use the compact caption box contract."
        )
    if require_isolated_layout and not all(
        token in composition
        for token in ("canonicalContentZone", "contentFrameStyle", 'overflow: "hidden"')
    ):
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/src/ZodiacComposition.tsx "
            "must implement the legacy isolated content frame contract."
        )
    if require_overlay_layout:
        required_overlay = (
            "captionOverlayTop",
            "fullCanvasContentStyle",
            'overflow: "visible"',
        )
        if not all(token in composition for token in required_overlay):
            raise PipelineError(
                "PACKAGE_RENDERER_STALE: renderer/src/ZodiacComposition.tsx "
                "must implement the full-canvas collision-aware caption overlay contract."
            )
        if "contentFrameStyle()" in composition:
            raise PipelineError(
                "PACKAGE_RENDERER_STALE: canonical overlay packages must not clip "
                "visuals into the legacy content frame."
            )

    types_source = _read_renderer_source(renderer_root, "src/types.ts")
    if re.search(r"\bProduction\s*=\s*any\b", types_source):
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/src/types.ts uses Production = any."
        )
    for required_type in ("Production", "ProductionScene", "RuntimeTiming"):
        if re.search(
            rf"\b(?:export\s+)?type\s+{required_type}\b",
            types_source,
        ) is None:
            raise PipelineError(
                "PACKAGE_RENDERER_STALE: renderer/src/types.ts is missing "
                f"{required_type}."
            )

    runtime_contract = _read_renderer_source(
        renderer_root,
        "src/runtime-contract.mjs",
    )
    if "resolveProductionEvents" not in runtime_contract:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: renderer/src/runtime-contract.mjs "
            "cannot resolve production events."
        )


def _validate_publish_document(root: Path, production: dict) -> dict:
    publish_dir = root / "publish"
    copy_path = publish_dir / "publish-copy.txt"
    json_path = publish_dir / "publish.json"
    if not copy_path.is_file():
        raise PipelineError("publish/publish-copy.txt is required.")
    if not json_path.is_file():
        raise PipelineError("publish/publish.json is required.")

    try:
        copy_text = copy_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read publish-copy.txt: {exc}") from exc

    for heading in ("COVER IDENTITY:", "HOOK:", "TIKTOK CAPTION:", "HASHTAGS:"):
        if heading not in copy_text:
            raise PipelineError(
                f"publish-copy.txt is missing required section {heading}"
            )

    publish = _load_json(json_path, "publish/publish.json")
    cover = publish.get("cover")
    identity = cover.get("identity") if isinstance(cover, dict) else None
    if (
        not isinstance(cover, dict)
        or cover.get("layout") != "tilted_top_hook"
        or not isinstance(identity, dict)
        or not all(
            isinstance(identity.get(key), str) and identity[key].strip()
            for key in ("sign_id", "label", "glyph")
        )
        or not isinstance(cover.get("hook"), str)
        or not cover["hook"].strip()
    ):
        raise PipelineError(
            "COVER_IDENTITY_MISSING: publish cover needs sign_id, label, "
            "glyph, hook, and layout=tilted_top_hook."
        )

    scene_id = cover.get("source_scene_id")
    scene = next(
        (
            item
            for item in production.get("scenes", [])
            if item.get("id") == scene_id
        ),
        None,
    )
    if scene is None:
        raise PipelineError(
            f"publish cover source_scene_id does not resolve: {scene_id!r}."
        )
    entities = {
        entity.get("id"): entity
        for entity in scene.get("entities", [])
        if isinstance(entity, dict)
    }
    visuals = cover.get("visuals")
    if not isinstance(visuals, list) or not visuals:
        raise PipelineError("publish cover must reuse at least one production visual.")
    for visual in visuals:
        if not isinstance(visual, dict):
            raise PipelineError("publish cover visuals must be objects.")
        entity_id = visual.get("entity_id")
        state_id = visual.get("state_id")
        entity = entities.get(entity_id)
        if not isinstance(entity, dict) or state_id not in entity.get("states", {}):
            raise PipelineError(
                f"publish cover visual does not resolve: {entity_id}.{state_id}."
            )

    if not isinstance(publish.get("caption"), str) or not publish["caption"].strip():
        raise PipelineError("publish.json caption must be non-empty.")
    hashtags = publish.get("hashtags")
    if (
        not isinstance(hashtags, list)
        or not hashtags
        or not all(isinstance(tag, str) and tag.startswith("#") for tag in hashtags)
    ):
        raise PipelineError("publish.json hashtags must be a non-empty hashtag list.")

    if identity["label"] not in copy_text or cover["hook"] not in copy_text:
        raise PipelineError(
            "publish-copy.txt must contain the selected cover identity and hook."
        )
    return publish


def _validate_renderer_package_contract(
    renderer_root: Path,
    *,
    expected_scripts: dict,
    accepted_dependencies: tuple[dict, ...],
    required_test: str,
    require_isolated_layout: bool = False,
    require_overlay_layout: bool = False,
) -> None:
    renderer = _load_json(renderer_root / "package.json", "renderer/package.json")
    if renderer.get("name") != "zodiac-remotion-renderer":
        raise PipelineError("renderer/package.json is not the Zodiac Remotion renderer scaffold.")
    if renderer.get("dependencies") not in accepted_dependencies:
        raise PipelineError("renderer dependencies do not match the pinned Zodiac renderer contract.")
    dev_dependencies = renderer.get("devDependencies")
    expected_dev = dict(EXPECTED_DEV_DEPENDENCIES)
    if (
        isinstance(dev_dependencies, dict)
        and dev_dependencies.get("typescript") in SUPPORTED_TYPESCRIPT_VERSIONS
    ):
        expected_dev["typescript"] = dev_dependencies["typescript"]
    if dev_dependencies != expected_dev:
        raise PipelineError("renderer development dependencies do not match the Zodiac renderer contract.")
    if renderer.get("scripts") != expected_scripts:
        raise PipelineError("renderer scripts do not match the Zodiac renderer contract.")

    required_renderer = (
        "src/index.ts",
        "src/Root.tsx",
        "src/ZodiacComposition.tsx",
        "src/PrimitiveSvg.tsx",
        "src/types.ts",
        "src/runtime-contract.mjs",
        "scripts/render.mjs",
        "scripts/generate-sfx.mjs",
        "scripts/style-token.mjs",
        "scripts/compile-style-token.mjs",
        "schemas/production.schema.json",
        required_test,
    )
    for required in required_renderer:
        if not (renderer_root / required).is_file():
            raise PipelineError(f"renderer source is incomplete: missing renderer/{required}.")
    _validate_renderer_source_contract(
        renderer_root,
        require_isolated_layout=require_isolated_layout,
        require_overlay_layout=require_overlay_layout,
    )


def _validate_publish_renderer_contract(renderer_root: Path) -> None:
    """Require cover rendering only at final publish/renderer readiness."""
    render_script = _read_renderer_source(renderer_root, "scripts/render.mjs")
    render_requirements = {
        "cover composition id": r"ZodiacCover",
        "cover PNG output": r"cover\.png",
        "publish copy output": r"publish-copy\.txt",
        "publish metadata output": r"publish\.json",
    }
    missing = [
        label
        for label, pattern in render_requirements.items()
        if re.search(pattern, render_script) is None
    ]
    if missing:
        raise PipelineError(
            "PACKAGE_PUBLISH_RENDERER_STALE: renderer/scripts/render.mjs "
            "is missing " + ", ".join(missing) + "."
        )

    root_source = _read_renderer_source(renderer_root, "src/Root.tsx")
    if "Still" not in root_source or "ZodiacCover" not in root_source:
        raise PipelineError(
            "PACKAGE_PUBLISH_RENDERER_STALE: renderer/src/Root.tsx "
            "must register the ZodiacCover Still."
        )

    cover_source = _read_renderer_source(renderer_root, "src/ZodiacCover.tsx")
    cover_requirements = {
        "tilted hook card": r"rotate\(-?\d+(?:\.\d+)?deg\)",
        "cover identity": r"publish\.cover\.identity",
        "cover hook": r"publish\.cover\.hook",
        "scene reuse": r"production\.scenes\.find",
        "state reuse": r"entity\.states",
    }
    missing = [
        label
        for label, pattern in cover_requirements.items()
        if re.search(pattern, cover_source) is None
    ]
    if missing:
        raise PipelineError(
            "PACKAGE_PUBLISH_RENDERER_STALE: renderer/src/ZodiacCover.tsx "
            "is missing " + ", ".join(missing) + "."
        )


def validate_package(package_root: Path) -> dict:
    """Validate the creative package without requiring final publish metadata."""
    root = Path(package_root).resolve()
    return validate_production_document(
        root,
        _load_json(root / "production.json", "production.json"),
    )


def validate_publish_contract(package_root: Path) -> dict:
    """Validate final publish metadata, cover identity, and cover renderer."""
    root = Path(package_root).resolve()
    production = validate_package(root)
    publish = _validate_publish_document(root, production)
    _validate_publish_renderer_contract(resolve_renderer_root(root, materialize=False))
    return publish


def _runtime_semver(runtime_ref: dict) -> tuple[int, int, int]:
    raw = runtime_ref.get("version", "")
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", raw)
    if not match:
        raise PipelineError(f"PACKAGE_MANIFEST_INVALID: runtime version is not semver: {raw!r}")
    return tuple(int(part) for part in match.groups())


def _uses_semantic_runtime(package_manifest: dict | None) -> bool:
    if package_manifest is None:
        return False
    runtime_ref = package_manifest["runtime"]
    return (
        runtime_ref.get("id") == RUNTIME_ID
        and _runtime_semver(runtime_ref) >= (1, 15, 0)
    )


def _uses_performance_runtime(package_manifest: dict | None) -> bool:
    if package_manifest is None:
        return False
    runtime_ref = package_manifest["runtime"]
    return (
        runtime_ref.get("id") == RUNTIME_ID
        and _runtime_semver(runtime_ref) >= (1, 16, 0)
    )


def _uses_runtime_owned_animation_defaults(package_manifest: dict | None) -> bool:
    """Runtime >=1.18 materializes omitted motion/performance fields after schema validation."""
    if package_manifest is None:
        return False
    runtime_ref = package_manifest["runtime"]
    return (
        runtime_ref.get("id") == RUNTIME_ID
        and _runtime_semver(runtime_ref) >= (1, 18, 0)
    )


_MECHANICAL_ACTION = re.compile(
    r"(?:^|_)(open|close|fold|unfold|zip|unzip|unlock|lock|insert|remove|pick|place|hold|release|hand|turn_page|drawer|curtain|door|lid|flap|notify|notification|screen_change|lamp_on|lamp_off|light_on|light_off|wear|remove_mask)(?:_|$)",
    re.IGNORECASE,
)
_STRONG_ARTICULATION_ACTION = re.compile(
    r"(?:^|_)(open|close|fold|unfold|zip|unzip|insert|remove|pick|place|hold|release|turn_page|drawer|curtain|door|lid|flap|wear|remove_mask)(?:_|$)",
    re.IGNORECASE,
)


def _validate_asset_lineage(asset_id: str, entry: dict) -> None:
    lineage = entry.get("lineage")
    if not isinstance(lineage, dict):
        raise PipelineError(
            f"ASSET_LINEAGE_INVALID: asset {asset_id!r} requires lineage metadata."
        )
    allowed = {
        "mode",
        "source_library",
        "source_master",
        "semantic_intent",
        "mutated_groups",
        "preserved_groups",
    }
    if set(lineage) - allowed:
        raise PipelineError(
            f"ASSET_LINEAGE_INVALID: asset {asset_id!r} has unsupported lineage fields."
        )
    if lineage.get("mode") not in {
        "direct_copy",
        "derived_copy",
        "semantic_variant",
        "composite",
    }:
        raise PipelineError(
            f"ASSET_LINEAGE_INVALID: asset {asset_id!r} has invalid lineage mode."
        )
    if lineage.get("source_library") != "zodiac-paper-doodle-asset-library-v3":
        raise PipelineError(
            f"ASSET_LINEAGE_INVALID: asset {asset_id!r} must derive from the canonical v3 library."
        )
    source_master = lineage.get("source_master")
    valid_master = (
        isinstance(source_master, str)
        and bool(source_master.strip())
    ) or (
        isinstance(source_master, list)
        and bool(source_master)
        and all(isinstance(value, str) and value.strip() for value in source_master)
    )
    if not valid_master:
        raise PipelineError(
            f"ASSET_LINEAGE_INVALID: asset {asset_id!r} needs source_master provenance."
        )
    if not isinstance(lineage.get("semantic_intent"), str) or not lineage["semantic_intent"].strip():
        raise PipelineError(
            f"ASSET_LINEAGE_INVALID: asset {asset_id!r} needs semantic_intent."
        )
    for key in ("mutated_groups", "preserved_groups"):
        value = lineage.get(key)
        if value is not None and (
            not isinstance(value, list)
            or any(not isinstance(item, str) or not item.strip() for item in value)
        ):
            raise PipelineError(
                f"ASSET_LINEAGE_INVALID: asset {asset_id!r} {key} must be a string list."
            )


def _validate_semantic_animation_scene(scene: dict, entity_map: dict[str, dict]) -> None:
    for event in scene.get("events", []):
        if event.get("target") == "camera":
            continue
        action = str(event.get("action", ""))
        if not _MECHANICAL_ACTION.search(action):
            continue
        mechanism = event.get("mechanism")
        if not isinstance(mechanism, dict):
            raise PipelineError(
                f"SEMANTIC_ANIMATION_GATE: mechanical event requires mechanism declaration: {event.get('id')}"
            )
        mode = mechanism.get("mode")
        if mode == "child_entities":
            parts = mechanism.get("parts")
            if (
                not isinstance(parts, list)
                or not parts
                or any(not isinstance(part, str) or part not in entity_map for part in parts)
            ):
                raise PipelineError(
                    f"SEMANTIC_ANIMATION_GATE: child_entities must reference scene entities: {event.get('id')}"
                )
        elif mode == "whole_asset":
            if _STRONG_ARTICULATION_ACTION.search(action):
                raise PipelineError(
                    f"SEMANTIC_ANIMATION_GATE: strong articulation action cannot use whole_asset: {event.get('id')}"
                )
            justification = mechanism.get("justification")
            if not isinstance(justification, str) or len(justification.strip()) < 20:
                raise PipelineError(
                    f"SEMANTIC_ANIMATION_GATE: whole_asset needs a concrete justification: {event.get('id')}"
                )
        else:
            raise PipelineError(
                f"SEMANTIC_ANIMATION_GATE: unsupported mechanism mode: {event.get('id')}"
            )


_PERFORMANCE_PHASES = {"anticipation", "action", "reaction", "hold", "settle"}
_PERFORMANCE_RESERVED_FOCUS = {"audience", "self", "offscreen_left", "offscreen_right"}


def _validate_performance_animation_scene(
    scene: dict,
    entity_map: dict[str, dict],
    *,
    allow_runtime_defaults: bool = False,
) -> None:
    prior_event_ids: set[str] = set()
    for event in scene.get("events", []):
        event_id = event.get("id")
        performance = event.get("performance")
        if performance is None and allow_runtime_defaults:
            if isinstance(event_id, str):
                prior_event_ids.add(event_id)
            continue
        if not isinstance(performance, dict):
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: event requires performance metadata: {event_id}"
            )
        allowed = {
            "intent",
            "phase",
            "energy",
            "focus",
            "anticipation_frames",
            "hold_frames",
            "settle_frames",
            "cause_event_id",
        }
        if set(performance) - allowed:
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: unsupported performance fields: {event_id}"
            )

        intent = performance.get("intent")
        if allow_runtime_defaults:
            if intent is not None and (
                not isinstance(intent, str) or not intent.strip()
            ):
                raise PipelineError(
                    f"PERFORMANCE_ANIMATION_GATE: performance intent must be non-empty when provided: {event_id}"
                )
        elif not isinstance(intent, str) or not intent.strip():
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: performance intent is required: {event_id}"
            )

        phase = performance.get("phase")
        if allow_runtime_defaults:
            if phase is not None and phase not in _PERFORMANCE_PHASES:
                raise PipelineError(
                    f"PERFORMANCE_ANIMATION_GATE: unsupported performance phase: {event_id}"
                )
        elif phase not in _PERFORMANCE_PHASES:
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: unsupported performance phase: {event_id}"
            )

        energy = performance.get("energy")
        if allow_runtime_defaults:
            if energy is not None and (
                not isinstance(energy, (int, float))
                or isinstance(energy, bool)
                or not 0 <= energy <= 1
            ):
                raise PipelineError(
                    f"PERFORMANCE_ANIMATION_GATE: energy must be within 0..1: {event_id}"
                )
        elif (
            not isinstance(energy, (int, float))
            or isinstance(energy, bool)
            or not 0 <= energy <= 1
        ):
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: energy must be within 0..1: {event_id}"
            )

        timing_fields = (
            ("anticipation_frames", 24),
            ("hold_frames", 90),
            ("settle_frames", 45),
        )
        for key, maximum in timing_fields:
            value = performance.get(key)
            if allow_runtime_defaults and value is None:
                continue
            if (
                not isinstance(value, int)
                or isinstance(value, bool)
                or value < 0
                or value > maximum
            ):
                raise PipelineError(
                    f"PERFORMANCE_ANIMATION_GATE: invalid {key}: {event_id}"
                )

        focus = performance.get("focus")
        if focus is not None and (
            not isinstance(focus, str)
            or (
                focus not in _PERFORMANCE_RESERVED_FOCUS
                and focus not in entity_map
            )
        ):
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: invalid focus target: {event_id}"
            )
        if focus == event.get("target"):
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: use focus=self for the acting entity: {event_id}"
            )

        cause = performance.get("cause_event_id")
        effective_phase = phase or ("reaction" if cause else "action")
        if effective_phase == "reaction" and not cause:
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: reaction needs cause_event_id: {event_id}"
            )
        if cause is not None and (
            not isinstance(cause, str) or cause not in prior_event_ids
        ):
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: cause_event_id must reference an earlier event: {event_id}"
            )

        authored_timing = [
            performance.get(key)
            for key, _maximum in timing_fields
        ]
        timing_is_complete = all(value is not None for value in authored_timing)
        if (
            event.get("target") != "camera"
            and event.get("state_before") != event.get("state_after")
            and timing_is_complete
            and sum(authored_timing) == 0
        ):
            raise PipelineError(
                f"PERFORMANCE_ANIMATION_GATE: story-changing event needs anticipation, hold, or settle timing: {event_id}"
            )
        if isinstance(event_id, str):
            prior_event_ids.add(event_id)


def _validate_performance_renderer_contract(renderer_root: Path) -> None:
    required = (
        "src/performance-animation.mjs",
        "src/performance-animation.d.mts",
        "tests/performance-animation-gate.test.mjs",
        "tests/caption-semantic.test.mjs",
    )
    for relative in required:
        if not (renderer_root / relative).is_file():
            raise PipelineError(
                f"PACKAGE_RENDERER_STALE: performance runtime is missing renderer/{relative}."
            )
    render_script = _read_renderer_source(renderer_root, "scripts/render.mjs")
    composition = _read_renderer_source(renderer_root, "src/ZodiacComposition.tsx")
    schema_text = _read_renderer_source(renderer_root, "schemas/production.schema.json")
    if "validatePerformanceAnimation" not in render_script or "validatePerformanceTiming" not in render_script:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: performance runtime does not execute Performance Animation Gate."
        )
    if '"performance"' not in schema_text or '"segmentation"' not in schema_text:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: performance runtime schema is incomplete."
        )
    if "performanceMotionValues" not in composition:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: composition does not consume performance metadata."
        )
    if "targetWords:" in composition or "maxWords:" in composition:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: performance runtime still uses fixed-word caption slicing."
        )


def _validate_semantic_validation_receipt(root: Path) -> None:
    path = root / "FINAL_VALIDATION.json"
    if not path.is_file():
        raise PipelineError(
            "FINAL_VALIDATION_STALE: semantic runtime packages require FINAL_VALIDATION.json."
        )
    receipt = _load_json(path, "FINAL_VALIDATION.json")
    expected_pass = (
        "package_compatibility_gate",
        "narration_scene_voice_identity",
        "caption_design_lock",
        "handoff_boundary",
        "asset_lineage",
        "semantic_animation_gate",
    )
    if receipt.get("status") != "PASS" or any(receipt.get(key) != "PASS" for key in expected_pass):
        raise PipelineError(
            "FINAL_VALIDATION_STALE: semantic package gates are not all PASS."
        )
    if receipt.get("interaction_choreography") not in {"PASS", "NOT_APPLICABLE"}:
        raise PipelineError(
            "FINAL_VALIDATION_STALE: interaction_choreography must be PASS or NOT_APPLICABLE."
        )
    production_path = root / "production.json"
    if receipt.get("production_sha256") != file_sha256(production_path):
        raise PipelineError(
            "FINAL_VALIDATION_STALE: production_sha256 does not match production.json."
        )


def _validate_semantic_renderer_contract(renderer_root: Path) -> None:
    required = (
        "src/semantic-animation.mjs",
        "tests/semantic-animation-gate.test.mjs",
    )
    for relative in required:
        if not (renderer_root / relative).is_file():
            raise PipelineError(
                f"PACKAGE_RENDERER_STALE: semantic runtime is missing renderer/{relative}."
            )
    render_script = _read_renderer_source(renderer_root, "scripts/render.mjs")
    schema_text = _read_renderer_source(renderer_root, "schemas/production.schema.json")
    type_text = _read_renderer_source(renderer_root, "src/types.ts")
    if "validateSemanticAnimation" not in render_script:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: semantic runtime does not execute Semantic Animation Gate."
        )
    for marker in ('"mechanism"', '"lineage"'):
        if marker not in schema_text:
            raise PipelineError(
                f"PACKAGE_RENDERER_STALE: semantic runtime schema is missing {marker}."
            )
    if "EventMechanism" not in type_text or "AssetLineage" not in type_text:
        raise PipelineError(
            "PACKAGE_RENDERER_STALE: semantic runtime TypeScript contract is incomplete."
        )


def validate_production_document(root: Path, production: dict) -> dict:
    """Validate an in-memory v2 production document against its package root."""
    root = Path(root).resolve()
    if production.get("version") != "2.0":
        raise PipelineError("production.json must use Zodiac production contract version 2.0.")

    video = production.get("video")
    if (
        not isinstance(video, dict)
        or video.get("width") != 1080
        or video.get("height") != 1920
        or not isinstance(video.get("fps"), int)
        or isinstance(video.get("fps"), bool)
        or video["fps"] <= 0
    ):
        raise PipelineError("production.json video must be 1080x1920 with a positive integer fps.")

    visual = production.get("visual_system")
    caption_style = production.get("caption_style")
    assets = production.get("assets")
    primitives = production.get("primitives")
    scenes = production.get("scenes")
    if not isinstance(visual, dict) or not isinstance(caption_style, dict):
        raise PipelineError("production.json needs visual_system and caption_style.")
    if not isinstance(assets, dict) or not isinstance(primitives, dict):
        raise PipelineError("production.json must contain assets and primitives registries.")
    if not isinstance(scenes, list) or not scenes:
        raise PipelineError("production.json must contain at least one scene.")

    token, source_hash = _design_token(root)
    package_manifest = _load_package_manifest(root)
    _validate_package_manifest_design(package_manifest, token, source_hash)
    semantic_runtime = _uses_semantic_runtime(package_manifest)
    performance_runtime = _uses_performance_runtime(package_manifest)
    runtime_owned_animation_defaults = _uses_runtime_owned_animation_defaults(package_manifest)
    compiled = visual.get("style_token")
    if not isinstance(compiled, dict) or compiled.get("id") != token.get("id"):
        raise PipelineError("production.json style_token must match design.md.")
    if compiled.get("source_hash") != source_hash:
        raise PipelineError("production.json style token is stale; run npm run compile:style in renderer/.")
    font_family = caption_style.get("font_family")
    font_weight = caption_style.get("font_weight")
    legacy_caption = font_family == "Be Vietnam Pro" and font_weight == 500
    overlay_caption = font_family == "Patrick Hand" and font_weight == 400
    if package_manifest is not None and not overlay_caption:
        raise PipelineError(
            "PACKAGE_MANIFEST_INVALID: zodiac-job@3 requires the canonical Patrick Hand overlay caption contract."
        )
    if (
        not (legacy_caption or overlay_caption)
        or not isinstance(caption_style.get("font_size_px"), int)
        or not isinstance(caption_style.get("min_font_size_px"), int)
    ):
        raise PipelineError(
            "caption_style must use either legacy Be Vietnam Pro 500 or "
            "canonical Patrick Hand 400 with a declared size range."
        )
    safe_area = caption_style.get("safe_area")
    safe_area_numeric = (
        isinstance(safe_area, dict)
        and all(
            isinstance(safe_area.get(key), (int, float))
            and not isinstance(safe_area.get(key), bool)
            for key in ("x", "y", "width", "height")
        )
    )
    if legacy_caption:
        if (
            caption_style["font_size_px"] > 64
            or caption_style["min_font_size_px"] > 48
            or not safe_area_numeric
            or safe_area["x"] < 80
            or safe_area["y"] < 1280
            or safe_area["width"] > 900
            or safe_area["height"] > 220
            or safe_area["y"] + safe_area["height"] > 1620
        ):
            raise PipelineError(
                "legacy caption_style must use the compact lower-third contract "
                "(font <=64px, y>=1280, width<=900, height<=220)."
            )
    else:
        if (
            caption_style["font_size_px"] < 72
            or caption_style["font_size_px"] > 96
            or caption_style["min_font_size_px"] < 56
            or caption_style["min_font_size_px"] > caption_style["font_size_px"]
            or not safe_area_numeric
            or safe_area["x"] < 56
            or safe_area["y"] < 900
            or safe_area["width"] > 968
            or safe_area["height"] > 640
            or safe_area["y"] + safe_area["height"] > 1680
        ):
            raise PipelineError(
                "canonical caption_style must use the large collision-aware overlay "
                "(Patrick Hand 72-96px default range, min >=56px, overlay envelope "
                "inside the TikTok-safe canvas)."
            )

    caption_token = token.get("caption_emphasis")
    if (
        not isinstance(caption_token, dict)
        or caption_style.get("font_family") != caption_token.get("font_family")
        or caption_style.get("font_weight") != caption_token.get("font_weight")
        or caption_style.get("font_size_px") != caption_token.get("font_size_px")
        or caption_style.get("min_font_size_px") != caption_token.get("min_font_size_px")
        or caption_style.get("max_lines") != caption_token.get("max_lines")
        or safe_area != token.get("safe_zone")
        or (
            caption_token.get("ghost_frame") is True
            and caption_style.get("background") != "transparent"
        )
    ):
        raise PipelineError(
            "caption_style must match design.md caption_emphasis/safe_zone, "
            "including transparent background for ghost-frame captions."
        )

    layout_zones = compiled.get("layout_zones")
    isolated_layout = legacy_caption and isinstance(layout_zones, dict)
    overlay_layout = overlay_caption and not isinstance(layout_zones, dict)
    if isolated_layout:
        content_zone = layout_zones.get("content")
        caption_zone = layout_zones.get("caption")
        if (
            not isinstance(content_zone, dict)
            or not isinstance(caption_zone, dict)
            or not all(
                isinstance(content_zone.get(key), (int, float))
                and not isinstance(content_zone.get(key), bool)
                for key in ("x", "y", "width", "height")
            )
            or not all(
                isinstance(caption_zone.get(key), (int, float))
                and not isinstance(caption_zone.get(key), bool)
                for key in ("x", "y", "width", "height")
            )
        ):
            raise PipelineError("layout_zones must define numeric content and caption frames.")
        content_bottom = content_zone["y"] + content_zone["height"]
        if (
            content_zone["x"] < 0
            or content_zone["y"] < 0
            or content_zone["x"] + content_zone["width"] > video["width"]
            or content_bottom > video["height"]
            or caption_zone != safe_area
            or caption_zone["y"] - content_bottom < 80
        ):
            raise PipelineError(
                "layout_zones content/caption frames overlap or do not match caption_style.safe_area."
            )

    style_id = compiled.get("id")
    referenced_asset_paths: set[str] = set()
    for asset_id, entry in assets.items():
        if not isinstance(entry, dict):
            raise PipelineError(f"asset registry entry {asset_id!r} must be an object.")
        asset_path = _asset_file(root, asset_id, entry)
        referenced_asset_paths.add(asset_path.relative_to(root).as_posix())
        if entry.get("style_id") != style_id:
            raise PipelineError(
                f"asset {asset_id!r} style_id does not match the compiled design token."
            )
        if semantic_runtime:
            _validate_asset_lineage(asset_id, entry)

    voices = []
    scene_ids: set[str] = set()
    event_ids: set[str] = set()
    motion_presets = visual.get("motion_presets", {})
    transition_presets = visual.get("transition_presets", {})
    sfx_profiles = visual.get("sfx_profiles", {})

    for scene in scenes:
        if not isinstance(scene, dict):
            raise PipelineError("every production scene must be an object.")
        scene_id = scene.get("id")
        if not isinstance(scene_id, str) or not scene_id or scene_id in scene_ids:
            raise PipelineError(f"invalid or duplicate scene id: {scene_id!r}")
        scene_ids.add(scene_id)

        voice = scene.get("voice")
        if not isinstance(voice, str) or not voice.strip():
            raise PipelineError(f"scene {scene_id} has no voice text.")
        voices.append(voice)

        if scene.get("timing") != {"mode": "from_voice"}:
            raise PipelineError(f"scene {scene_id} must use timing.mode=from_voice.")

        entities = scene.get("entities")
        events = scene.get("events")
        if not isinstance(entities, list) or not isinstance(events, list) or not events:
            raise PipelineError(
                f"scene {scene_id} needs entities and at least one visual event."
            )

        entity_map = {}
        for entity in entities:
            if not isinstance(entity, dict) or not isinstance(entity.get("id"), str):
                raise PipelineError(f"scene {scene_id} contains an invalid entity.")
            entity_id = entity["id"]
            if entity_id in entity_map:
                raise PipelineError(f"scene {scene_id} has duplicate entity {entity_id}.")

            states = entity.get("states")
            initial_state = entity.get("initial_state")
            if not isinstance(states, dict) or initial_state not in states:
                raise PipelineError(f"entity {entity_id} has no valid initial_state.")

            for state_id, state in states.items():
                if not isinstance(state, dict):
                    raise PipelineError(f"state {entity_id}.{state_id} must be an object.")
                has_asset = bool(state.get("asset"))
                has_primitive = bool(state.get("primitive"))
                if has_asset == has_primitive:
                    raise PipelineError(
                        f"state {entity_id}.{state_id} must reference exactly one asset or primitive."
                    )

                if has_asset:
                    if state["asset"] not in assets:
                        raise PipelineError(
                            f"state {entity_id}.{state_id} refers to missing asset {state['asset']!r}."
                        )
                elif state["primitive"] not in primitives:
                    raise PipelineError(
                        f"state {entity_id}.{state_id} refers to missing primitive {state['primitive']!r}."
                    )

                transform = state.get("transform")
                if (
                    not isinstance(transform, dict)
                    or not all(
                        isinstance(transform.get(key), (int, float))
                        for key in ("x", "y", "width", "height")
                    )
                    or transform["width"] <= 0
                    or transform["height"] <= 0
                    or not isinstance(state.get("layer"), (int, float))
                    or not isinstance(state.get("visible"), bool)
                ):
                    raise PipelineError(
                        f"state {entity_id}.{state_id} has an invalid transform/layer/visible value."
                    )
            entity_map[entity_id] = entity

        current_states = {
            entity_id: entity["initial_state"]
            for entity_id, entity in entity_map.items()
        }
        meaningful_change = False
        if semantic_runtime:
            _validate_semantic_animation_scene(scene, entity_map)
        if performance_runtime:
            _validate_performance_animation_scene(
                scene,
                entity_map,
                allow_runtime_defaults=runtime_owned_animation_defaults,
            )

        for event in events:
            if not isinstance(event, dict):
                raise PipelineError(f"scene {scene_id} contains an invalid event.")

            event_id = event.get("id")
            if not isinstance(event_id, str) or not event_id or event_id in event_ids:
                raise PipelineError(
                    f"event IDs must be unique and non-empty: {event_id!r}"
                )
            event_ids.add(event_id)

            target = event.get("target")
            trigger = event.get("trigger")
            motion = event.get("motion")
            if (
                not isinstance(trigger, dict)
                or trigger.get("source") not in {"scene_start", "voice_anchor"}
                or (
                    trigger.get("source") == "voice_anchor"
                    and not str(trigger.get("text", "")).strip()
                )
            ):
                raise PipelineError(f"event {event_id} has an invalid trigger.")

            if motion is None and runtime_owned_animation_defaults:
                pass
            elif (
                not isinstance(motion, dict)
                or motion.get("preset") not in motion_presets
                or not isinstance(motion.get("duration_frames"), int)
                or isinstance(motion.get("duration_frames"), bool)
                or motion["duration_frames"] < 1
            ):
                raise PipelineError(
                    f"event {event_id} has an invalid motion preset/duration."
                )

            if event.get("sfx") and event["sfx"] not in sfx_profiles:
                raise PipelineError(
                    f"event {event_id} refers to missing SFX profile {event['sfx']!r}."
                )

            if target == "camera":
                continue
            if target not in entity_map:
                raise PipelineError(
                    f"event {event_id} targets missing entity {target!r}."
                )
            if event.get("state_before") != current_states[target]:
                raise PipelineError(
                    f"event {event_id} state_before does not follow prior state."
                )

            after = event.get("state_after")
            if after not in entity_map[target]["states"]:
                raise PipelineError(f"event {event_id} state_after is not declared.")
            if after != current_states[target]:
                meaningful_change = True
            current_states[target] = after

        if not meaningful_change:
            raise PipelineError(
                f"scene {scene_id} needs a non-camera story-changing state event."
            )

        transition = scene.get("transition")
        if (
            not isinstance(transition, dict)
            or transition.get("type") not in transition_presets
            or not isinstance(transition.get("duration_frames"), int)
            or transition["duration_frames"] < 0
        ):
            raise PipelineError(f"scene {scene_id} has an invalid transition.")

        captions = scene.get("captions")
        if performance_runtime:
            valid_captions = (
                isinstance(captions, dict)
                and captions.get("source") == "voice"
                and captions.get("segmentation") == "semantic"
                and isinstance(captions.get("max_lines"), int)
                and not isinstance(captions.get("max_lines"), bool)
                and 1 <= captions["max_lines"] <= 2
                and all(
                    key not in captions
                    or (
                        isinstance(captions[key], int)
                        and not isinstance(captions[key], bool)
                        and 1 <= captions[key] <= 32
                    )
                    for key in ("page_target_words", "max_words")
                )
            )
        else:
            valid_captions = (
                isinstance(captions, dict)
                and captions.get("source") == "voice"
                and all(
                    isinstance(captions.get(key), int)
                    and not isinstance(captions.get(key), bool)
                    for key in ("page_target_words", "max_words", "max_lines")
                )
                and 3 <= captions["page_target_words"] <= 7
                and 3 <= captions["max_words"] <= 7
                and 1 <= captions["max_lines"] <= 2
            )
        if not valid_captions:
            raise PipelineError(f"scene {scene_id} has an invalid v2 caption policy.")

        _validate_visual_progression_proxy(scene)

    narration_path = root / "narration.txt"
    try:
        narration = narration_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read narration.txt: {exc}") from exc

    if narration.endswith("\n"):
        narration = narration[:-1]
    if narration != canonical_narration_text(production):
        raise PipelineError(
            "narration.txt must exactly match canonical ordered scene.voice serialization."
        )

    local_first_v4 = package_manifest is not None and package_manifest.get("format") == PACKAGE_FORMAT_V4
    if not local_first_v4:
        _validate_handoff_boundary(root)
        if semantic_runtime:
            _validate_semantic_validation_receipt(root)

    if package_manifest is not None:
        actual_assets = {
            path.relative_to(root).as_posix()
            for path in _tree_files(root, "assets")
        }
        extra_assets = sorted(actual_assets - referenced_asset_paths)
        if extra_assets:
            raise PipelineError(
                "PACKAGE_V3_BLOAT: assets/ contains files not referenced by production.assets: "
                + ", ".join(extra_assets[:8])
            )
        renderer_root = resolve_renderer_root(root, materialize=False)
        _validate_renderer_package_contract(
            renderer_root,
            expected_scripts=EXPECTED_SCRIPTS,
            accepted_dependencies=(EXPECTED_DEPENDENCIES,),
            required_test="tests/shared-runtime.test.mjs",
            require_overlay_layout=True,
        )
        if semantic_runtime:
            _validate_semantic_renderer_contract(renderer_root)
        if performance_runtime:
            _validate_performance_renderer_contract(renderer_root)
    else:
        renderer_root = root / "renderer"
        _validate_renderer_package_contract(
            renderer_root,
            expected_scripts=LEGACY_EXPECTED_SCRIPTS,
            accepted_dependencies=(LEGACY_EXPECTED_DEPENDENCIES, EXPECTED_DEPENDENCIES),
            required_test="tests/pipeline-contract.test.mjs",
            require_isolated_layout=isolated_layout,
            require_overlay_layout=overlay_layout,
        )
    return production


def validate_timing(package_root: Path, timing: dict | Path) -> dict:
    """Validate scene frames and one measured caption token per spoken word."""
    root = Path(package_root).resolve()
    production = validate_package(root)
    if isinstance(timing, Path):
        timing = _load_json(timing, "timing.json")

    if timing.get("fps") != production["video"]["fps"]:
        raise PipelineError("timing.json fps must match production.json.")

    rows = timing.get("scenes")
    scenes = production["scenes"]
    if not isinstance(rows, list) or len(rows) != len(scenes):
        raise PipelineError(
            "timing.json must contain one ordered row per production scene."
        )

    cursor = 0
    fps = timing["fps"]
    for scene, row in zip(scenes, rows):
        if not isinstance(row, dict) or row.get("scene_id") != scene["id"]:
            raise PipelineError(
                f"timing.json scene order/id mismatch at {scene['id']}."
            )

        start_frame = row.get("start_frame")
        duration_frames = row.get("duration_frames")
        if (
            not isinstance(start_frame, int)
            or isinstance(start_frame, bool)
            or start_frame < 0
            or not isinstance(duration_frames, int)
            or isinstance(duration_frames, bool)
            or duration_frames < 1
        ):
            raise PipelineError(
                f"scene {scene['id']} needs non-negative start_frame and positive duration_frames."
            )

        if start_frame != cursor:
            raise PipelineError(
                "scene frame ranges must be continuous and ordered from measured voice timing."
            )
        cursor = start_frame + duration_frames

        captions = row.get("captions")
        if not isinstance(captions, list) or not captions:
            raise PipelineError(
                f"word-level measured caption tokens are required for {scene['id']}."
            )

        prior_end = -1.0
        caption_text = []
        for cue in captions:
            if not isinstance(cue, dict):
                raise PipelineError(f"invalid caption token in {scene['id']}.")
            text_value = cue.get("text")
            begin = cue.get("startMs")
            end_value = cue.get("endMs")
            if (
                not isinstance(text_value, str)
                or not text_value.strip()
                or re.search(r"\s", text_value.strip())
                or not isinstance(begin, (int, float))
                or isinstance(begin, bool)
                or not math.isfinite(begin)
                or not isinstance(end_value, (int, float))
                or isinstance(end_value, bool)
                or not math.isfinite(end_value)
                or end_value <= begin
            ):
                raise PipelineError(
                    f"invalid word-level caption token in {scene['id']}."
                )

            if begin < prior_end:
                raise PipelineError(
                    f"caption word timings overlap or are out of order in {scene['id']}."
                )
            if (
                begin < (start_frame * 1000 / fps) - 100
                or end_value > (cursor * 1000 / fps) + 100
            ):
                raise PipelineError(
                    f"caption word falls outside measured scene timing in {scene['id']}."
                )
            prior_end = end_value
            caption_text.append(text_value)

        if _normalize_words(" ".join(caption_text)) != _normalize_words(scene["voice"]):
            raise PipelineError(
                f"caption word tokens do not exactly cover scene.voice in {scene['id']}."
            )

        _validate_measured_visual_progression(scene, row, fps)

    if timing.get("total_duration_frames") != cursor:
        raise PipelineError(
            "total_duration_frames must equal the final measured scene boundary."
        )
    return timing


def validate_voice(path: Path) -> None:
    path = Path(path)
    if not path.is_file():
        raise PipelineError(f"voice WAV is missing: {path}")
    try:
        with wave.open(str(path), "rb") as wav:
            if wav.getcomptype() != "NONE" or wav.getnframes() < 1 or wav.getframerate() < 1 or wav.getnchannels() < 1:
                raise PipelineError("voice.wav must contain non-empty uncompressed PCM audio.")
    except (wave.Error, EOFError, OSError) as exc:
        raise PipelineError(f"voice.wav is not a readable PCM WAV file: {exc}") from exc


def concatenate_wavs(
    inputs: list[Path],
    output: Path,
    *,
    gap_ms: float = 0.0,
) -> None:
    """Concatenate PCM WAV files and optionally insert silence between items."""
    if not inputs:
        raise PipelineError("no scene WAV files were generated.")
    try:
        gap_ms = float(gap_ms)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("scene gap must be a finite non-negative number.") from None
    if not math.isfinite(gap_ms) or gap_ms < 0 or gap_ms > 5000:
        raise PipelineError("scene gap must be between 0 and 5000 ms.")

    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    params = None
    with wave.open(str(output), "wb") as destination:
        for index, source_path in enumerate(inputs):
            try:
                with wave.open(str(source_path), "rb") as source:
                    if source.getcomptype() != "NONE":
                        raise PipelineError(f"scene WAV is compressed: {source_path}")
                    current = source.getparams()
                    if params is None:
                        params = current
                        destination.setnchannels(current.nchannels)
                        destination.setsampwidth(current.sampwidth)
                        destination.setframerate(current.framerate)
                        destination.setcomptype("NONE", "not compressed")
                    elif current[:3] != params[:3]:
                        raise PipelineError("scene WAV files do not share one PCM format.")
                    destination.writeframes(source.readframes(source.getnframes()))
                    if index < len(inputs) - 1 and gap_ms > 0:
                        silent_frames = round(current.framerate * gap_ms / 1000.0)
                        if current.sampwidth == 1:
                            silent_sample = b"\x80"
                        else:
                            silent_sample = b"\x00" * current.sampwidth
                        destination.writeframes(
                            silent_sample * current.nchannels * silent_frames
                        )
            except (wave.Error, EOFError, OSError) as exc:
                raise PipelineError(f"cannot read scene WAV {source_path}: {exc}") from exc


def _expected_caption_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for raw in text.split():
        if _normalize_token(raw):
            tokens.append(raw)
        elif tokens:
            tokens[-1] += raw
    return tokens


def _sentence_pause_after_indices(text: str) -> set[int]:
    """Token indices after which Studio inserts an explicit sentence pause."""
    tokens = _expected_caption_tokens(text)
    pauses: set[int] = set()
    for index, token in enumerate(tokens[:-1]):
        visible = token.rstrip('”"’\'»)]}')
        if re.search(r"(?:[.!?…]+)$", visible):
            pauses.add(index)
    return pauses


_VI_DIGIT_WORDS = {
    "0": "không",
    "1": "một",
    "2": "hai",
    "3": "ba",
    "4": "bốn",
    "5": "năm",
    "6": "sáu",
    "7": "bảy",
    "8": "tám",
    "9": "chín",
}


def _vi_under_thousand_words(value: int, *, force_hundreds: bool = False) -> list[str]:
    if value < 0 or value >= 1000:
        raise ValueError("value must be between 0 and 999")
    if value == 0:
        return ["không"] if not force_hundreds else []

    words: list[str] = []
    hundreds, remainder = divmod(value, 100)
    tens, ones = divmod(remainder, 10)

    if hundreds:
        words.extend([_VI_DIGIT_WORDS[str(hundreds)], "trăm"])
    elif force_hundreds and remainder:
        words.extend(["không", "trăm"])

    if tens == 0:
        if ones:
            if hundreds or force_hundreds:
                words.append("linh")
            words.append(_VI_DIGIT_WORDS[str(ones)])
        return words

    if tens == 1:
        words.append("mười")
    else:
        words.extend([_VI_DIGIT_WORDS[str(tens)], "mươi"])

    if ones:
        if tens >= 2 and ones == 1:
            words.append("mốt")
        elif tens >= 2 and ones == 4:
            words.append("tư")
        elif tens >= 1 and ones == 5:
            words.append("lăm")
        else:
            words.append(_VI_DIGIT_WORDS[str(ones)])
    return words


def _vi_integer_words(raw_digits: str) -> list[str]:
    """Canonical Vietnamese reading for an unsigned integer token."""
    digits = str(raw_digits).lstrip("0") or "0"
    if digits == "0":
        return ["không"]

    groups: list[int] = []
    while digits:
        groups.append(int(digits[-3:]))
        digits = digits[:-3]

    scale_names = {
        0: [],
        1: ["nghìn"],
        2: ["triệu"],
        3: ["tỷ"],
        4: ["nghìn", "tỷ"],
        5: ["triệu", "tỷ"],
        6: ["tỷ", "tỷ"],
    }
    if len(groups) - 1 > max(scale_names):
        # Very large identifiers are safer as individual digits than guessed
        # Vietnamese large-number grammar.
        return [_VI_DIGIT_WORDS[ch] for ch in raw_digits]

    words: list[str] = []
    highest = len(groups) - 1
    for index in range(highest, -1, -1):
        group = groups[index]
        if group == 0:
            continue
        force_hundreds = bool(words) and group < 100
        words.extend(
            _vi_under_thousand_words(
                group,
                force_hundreds=force_hundreds,
            )
        )
        words.extend(scale_names[index])
    return words


def _alignment_units(raw_token: str) -> list[str]:
    """Canonical comparison units; preserves Whisper numeric compaction."""
    raw = unicodedata.normalize("NFC", str(raw_token)).strip().lower()
    numeric = re.fullmatch(r"([0-9]+)\s*(%)?", raw)
    if numeric:
        units = _vi_integer_words(numeric.group(1))
        if numeric.group(2):
            units.extend(["phần", "trăm"])
        return units
    normalized = _normalize_token(raw)
    return [normalized] if normalized else []


def _alignment_coverage_gap(
    expected_tokens: list[str],
    measured_words: list[dict],
) -> bool:
    """True only when ASR evidence suggests approved words have no counterpart.

    Substitutions of the same/greater heard span are treated as transcription
    variants, not as proof that TTS omitted audio. This prevents expensive TTS
    regeneration for cases such as Xử/Sử, 8%/tám phần trăm, or word splitting.
    """
    expected_units = [
        unit
        for token in expected_tokens
        for unit in _alignment_units(token)
    ]
    heard_units = [
        unit
        for item in measured_words
        for unit in _alignment_units(item.get("heard", ""))
    ]
    matcher = difflib.SequenceMatcher(
        a=expected_units,
        b=heard_units,
        autojunk=False,
    )
    for tag, _i1, _i2, _j1, _j2 in matcher.get_opcodes():
        # A replacement is ambiguous ASR evidence: Whisper may substitute,
        # merge, or split spoken words. Only an actual delete proves that an
        # approved unit has no measured counterpart at all.
        if tag == "delete":
            return True
    return False


def _expanded_measured_alignment_words(measured_words: list[dict]) -> list[dict]:
    """Expand compact ASR forms while retaining a measured time span."""
    expanded: list[dict] = []
    for item in measured_words:
        units = _alignment_units(item.get("heard", ""))
        if not units:
            continue
        start_ms = float(item["startMs"])
        end_ms = float(item["endMs"])
        width = (end_ms - start_ms) / len(units)
        for index, unit in enumerate(units):
            begin = start_ms + width * index
            end = end_ms if index == len(units) - 1 else start_ms + width * (index + 1)
            expanded.append(
                {
                    "heard": unit,
                    "startMs": begin,
                    "endMs": end,
                    "confidence": item.get("confidence"),
                }
            )
    return expanded


def _reconcile_asr_variant(
    expected_tokens: list[str],
    measured_words: list[dict],
) -> list[dict] | None:
    """Map transcription variants back to approved tokens without hiding omissions.

    Reconciliation is allowed only when every approved token has measured audio
    coverage. Equal-length substitutions reuse measured word spans; one-to-many
    ASR splits share the measured replacement span. Missing approved words and
    standalone ASR insertions are rejected.
    """
    expected_units: list[str] = []
    for token in expected_tokens:
        units = _alignment_units(token)
        if len(units) != 1:
            return None
        expected_units.append(units[0])

    measured = _expanded_measured_alignment_words(measured_words)
    heard_units = [str(item["heard"]) for item in measured]
    matcher = difflib.SequenceMatcher(
        a=expected_units,
        b=heard_units,
        autojunk=False,
    )
    output: list[dict | None] = [None] * len(expected_tokens)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        expected_count = i2 - i1
        heard_count = j2 - j1
        if tag == "equal":
            for offset in range(expected_count):
                source = measured[j1 + offset]
                output[i1 + offset] = {
                    "text": expected_tokens[i1 + offset],
                    "startMs": source["startMs"],
                    "endMs": source["endMs"],
                    "timestampMs": source["startMs"],
                    "confidence": source.get("confidence"),
                    "alignment_source": "asr_exact",
                }
            continue

        if tag != "replace" or expected_count < 1 or heard_count < 1:
            return None

        if expected_count == heard_count:
            for offset in range(expected_count):
                source = measured[j1 + offset]
                output[i1 + offset] = {
                    "text": expected_tokens[i1 + offset],
                    "startMs": source["startMs"],
                    "endMs": source["endMs"],
                    "timestampMs": source["startMs"],
                    "confidence": source.get("confidence"),
                    "alignment_source": "asr_variant",
                }
            continue

        span_start = float(measured[j1]["startMs"])
        span_end = float(measured[j2 - 1]["endMs"])
        weights = [
            max(1, len(_normalize_token(expected_tokens[index])))
            for index in range(i1, i2)
        ]
        total_weight = sum(weights)
        cursor = span_start
        confidences = [
            item.get("confidence")
            for item in measured[j1:j2]
            if item.get("confidence") is not None
        ]
        confidence = min(confidences) if confidences else None
        for relative, weight in enumerate(weights):
            fraction = weight / total_weight
            end = span_end if relative == len(weights) - 1 else cursor + (
                (span_end - span_start) * fraction
            )
            index = i1 + relative
            output[index] = {
                "text": expected_tokens[index],
                "startMs": cursor,
                "endMs": end,
                "timestampMs": cursor,
                "confidence": confidence,
                "alignment_source": "asr_variant_split",
            }
            cursor = end

    if any(item is None for item in output):
        return None
    return [item for item in output if item is not None]


def load_word_aligner(model_name: str, device: str, compute_type: str):
    require_word_aligner_installed()
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise PipelineError(
            "Automatic word-level timing requires faster-whisper. "
            f"Install it with:\n{aligner_install_command()}"
        ) from exc

    try:
        return WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as exc:
        raise PipelineError(
            f"cannot load faster-whisper model {model_name!r}: {exc}"
        ) from exc


def _repair_aligner_word_timestamps(
    raw_words: list[dict],
    audio_path: Path,
    *,
    tolerance_ms: float = ASR_SCENE_BOUNDARY_TOLERANCE_MS,
) -> list[dict]:
    """Repair only zero-duration ASR tokens from adjacent measured boundaries."""
    repaired: list[dict] = []
    tolerance_seconds = float(tolerance_ms) / 1000.0

    for index, raw in enumerate(raw_words):
        start = raw.get("start")
        end = raw.get("end")
        if start is None or end is None:
            raise PipelineError(
                f"aligner returned an invalid word timestamp for {audio_path.name}."
            )
        try:
            start = float(start)
            end = float(end)
        except (TypeError, ValueError) as exc:
            raise PipelineError(
                f"aligner returned an invalid word timestamp for {audio_path.name}."
            ) from exc
        if not math.isfinite(start) or not math.isfinite(end) or end < start:
            raise PipelineError(
                f"aligner returned an invalid word timestamp for {audio_path.name}."
            )

        if math.isclose(end, start, rel_tol=0.0, abs_tol=1e-9):
            next_start = None
            if index + 1 < len(raw_words):
                candidate = raw_words[index + 1].get("start")
                try:
                    candidate = float(candidate) if candidate is not None else None
                except (TypeError, ValueError):
                    candidate = None
                if candidate is not None and math.isfinite(candidate):
                    next_start = candidate

            if (
                next_start is not None
                and next_start > start
                and next_start - start <= tolerance_seconds
            ):
                end = next_start
            else:
                previous_end = (
                    float(repaired[-1]["end"])
                    if repaired
                    else None
                )
                if (
                    previous_end is None
                    or previous_end >= start
                    or start - previous_end > tolerance_seconds
                ):
                    raise PipelineError(
                        f"aligner returned an invalid word timestamp for {audio_path.name}."
                    )
                start = previous_end

        item = dict(raw)
        item["start"] = start
        item["end"] = end
        repaired.append(item)

    return repaired


def _align_scene_words(model, audio_path: Path, approved_text: str) -> list[dict]:
    expected = _expected_caption_tokens(approved_text)
    try:
        segments, _info = model.transcribe(
            str(audio_path),
            language="vi",
            word_timestamps=True,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        raw_words = []
        for segment in segments:
            for word in segment.words or []:
                heard = str(word.word).strip()
                if not _normalize_token(heard):
                    continue
                raw_words.append(
                    {
                        "heard": heard,
                        "start": word.start,
                        "end": word.end,
                        "confidence": (
                            float(word.probability)
                            if word.probability is not None
                            else None
                        ),
                    }
                )

        measured = []
        for word in _repair_aligner_word_timestamps(
            raw_words,
            audio_path,
        ):
            measured.append(
                {
                    "heard": word["heard"],
                    "startMs": float(word["start"]) * 1000,
                    "endMs": float(word["end"]) * 1000,
                    "confidence": word["confidence"],
                }
            )
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(
            f"word alignment failed for {audio_path.name}: {exc}"
        ) from exc

    expected_norm = [_normalize_token(token) for token in expected]
    heard_norm = [_normalize_token(item["heard"]) for item in measured]
    if expected_norm != heard_norm:
        coverage_gap = _alignment_coverage_gap(expected, measured)
        if not coverage_gap:
            reconciled = _reconcile_asr_variant(expected, measured)
            if reconciled is not None:
                return reconciled
        mismatch_kind = (
            "coverage_gap"
            if coverage_gap
            else "unreconciled_asr_variant"
        )
        raise AlignmentMismatchError(
            "ALIGNMENT_MISMATCH: word alignment does not match approved narration for "
            f"{audio_path.name}. kind={mismatch_kind}. "
            f"expected={expected_norm!r}, heard={heard_norm!r}. "
            "Do not guess timings; correct the TTS/alignment and retry.",
            expected=expected_norm,
            heard=heard_norm,
            coverage_gap=coverage_gap,
        )

    return [
        {
            "text": display,
            "startMs": item["startMs"],
            "endMs": item["endMs"],
            "timestampMs": item["startMs"],
            "confidence": item["confidence"],
            "alignment_source": "asr_exact",
        }
        for display, item in zip(expected, measured)
    ]


def _clamp_aligned_words_to_wav_boundary(
    scene_id: str,
    words: list[dict],
    seconds: float,
    *,
    tolerance_ms: float = ASR_SCENE_BOUNDARY_TOLERANCE_MS,
) -> list[dict]:
    """Clamp only small ASR boundary drift; reject timestamps outside real audio."""
    duration_ms = float(seconds) * 1000.0
    normalized: list[dict] = []
    prior_end = 0.0

    for index, word in enumerate(words):
        item = dict(word)
        try:
            start_ms = float(item["startMs"])
            end_ms = float(item["endMs"])
        except (KeyError, TypeError, ValueError) as exc:
            raise PipelineError(
                f"invalid measured word timing in {scene_id}."
            ) from exc

        if not math.isfinite(start_ms) or not math.isfinite(end_ms) or end_ms <= start_ms:
            raise PipelineError(f"invalid measured word timing in {scene_id}.")

        if start_ms < 0:
            if start_ms < -tolerance_ms:
                raise PipelineError(
                    f"caption word falls outside measured WAV boundary in {scene_id}."
                )
            start_ms = 0.0
            if item.get("timestampMs") is not None:
                item["timestampMs"] = 0.0

        if start_ms + 1e-6 < prior_end:
            raise PipelineError(
                f"measured caption timings overlap or are out of order in {scene_id}."
            )

        if end_ms > duration_ms:
            overrun = end_ms - duration_ms
            is_last = index == len(words) - 1
            if not is_last or overrun > tolerance_ms or start_ms >= duration_ms:
                raise PipelineError(
                    f"caption word falls outside measured WAV boundary in {scene_id}."
                )
            end_ms = duration_ms

        item["startMs"] = start_ms
        item["endMs"] = end_ms
        if item.get("timestampMs") is not None:
            timestamp = float(item["timestampMs"])
            if timestamp < 0 and timestamp >= -tolerance_ms:
                timestamp = 0.0
            item["timestampMs"] = min(max(timestamp, start_ms), end_ms)

        prior_end = end_ms
        normalized.append(item)

    return normalized


def build_timing_from_word_alignment(
    production: dict,
    durations: dict[str, float],
    aligned_words: dict[str, list[dict]],
    *,
    scene_gap_ms: float = 0.0,
    sentence_pause_ms: float = 0.0,
) -> dict:
    """Build scene frames from measured WAV duration plus explicit breathing pauses."""
    try:
        scene_gap_ms = float(scene_gap_ms)
        sentence_pause_ms = float(sentence_pause_ms)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("pacing pauses must be finite non-negative numbers.") from None
    if not math.isfinite(scene_gap_ms) or scene_gap_ms < 0 or scene_gap_ms > 5000:
        raise PipelineError("scene gap must be between 0 and 5000 ms.")
    if (
        not math.isfinite(sentence_pause_ms)
        or sentence_pause_ms < 0
        or sentence_pause_ms > 3000
    ):
        raise PipelineError("sentence pause must be between 0 and 3000 ms.")

    fps = production["video"]["fps"]
    rows = []
    elapsed_seconds = 0.0
    scenes = production["scenes"]

    for scene_index, scene in enumerate(scenes):
        scene_id = scene["id"]
        seconds = durations.get(scene_id)
        words = aligned_words.get(scene_id)
        if not isinstance(seconds, (int, float)) or seconds <= 0:
            raise PipelineError(
                f"missing measured duration for scene {scene_id}."
            )
        if not isinstance(words, list) or not words:
            raise PipelineError(
                f"missing measured word timing for scene {scene_id}."
            )

        words = _clamp_aligned_words_to_wav_boundary(
            scene_id,
            words,
            float(seconds),
        )

        pause_after = _sentence_pause_after_indices(scene["voice"])
        start_frame = round(elapsed_seconds * fps)
        offset_ms = elapsed_seconds * 1000
        elapsed_seconds += float(seconds) + (
            len(pause_after) * sentence_pause_ms / 1000.0
        )
        if scene_index < len(scenes) - 1:
            elapsed_seconds += scene_gap_ms / 1000.0
        end_frame = max(start_frame + 1, round(elapsed_seconds * fps))

        global_words = []
        pauses_before = 0
        for word_index, word in enumerate(words):
            shift_ms = pauses_before * sentence_pause_ms
            global_words.append(
                {
                    **word,
                    "startMs": offset_ms + shift_ms + float(word["startMs"]),
                    "endMs": offset_ms + shift_ms + float(word["endMs"]),
                    "timestampMs": (
                        None
                        if word.get("timestampMs") is None
                        else offset_ms + shift_ms + float(word["timestampMs"])
                    ),
                }
            )
            if word_index in pause_after:
                pauses_before += 1

        rows.append(
            {
                "scene_id": scene_id,
                "start_frame": start_frame,
                "duration_frames": end_frame - start_frame,
                "captions": global_words,
            }
        )

    return {
        "fps": fps,
        "total_duration_frames": (
            rows[-1]["start_frame"] + rows[-1]["duration_frames"]
        ),
        "scenes": rows,
    }


def _tts_python(tts_root: Path, requested: Path | None) -> Path:
    candidate = Path(requested).expanduser() if requested else Path(tts_root) / ".venv" / "Scripts" / "python.exe"
    if not candidate.is_file():
        raise PipelineError(f"VieNeu Python environment not found: {candidate}")
    return candidate.resolve()


def file_sha256(path: Path) -> str:
    """Content fingerprint used for package and per-scene voice reuse."""
    import hashlib

    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fingerprint_files(root: Path, files: list[Path]) -> str:
    """Hash file names + bytes deterministically; missing optional files are omitted."""
    import hashlib

    root = Path(root).resolve()
    digest = hashlib.sha256()
    unique = {
        Path(path).resolve()
        for path in files
        if Path(path).is_file()
    }
    for path in sorted(
        unique,
        key=lambda item: item.relative_to(root).as_posix(),
    ):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def _fingerprint_value(value) -> str:
    import hashlib

    canonical = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _tree_files(root: Path, relative: str, *, exclude: set[str] | None = None) -> list[Path]:
    base = Path(root) / relative
    if not base.is_dir():
        return []
    excluded = exclude or set()
    return [
        path
        for path in base.rglob("*")
        if path.is_file()
        and not any(part in excluded for part in path.relative_to(base).parts)
    ]


def artifact_fingerprints(package_root: Path) -> dict[str, str]:
    """Describe exact input groups for render, cover, mix, and publish outputs."""
    root = Path(package_root).resolve()
    package_manifest = _load_package_manifest(root)
    local_first_v4 = package_manifest is not None and package_manifest.get("format") == PACKAGE_FORMAT_V4

    creative_files = [
        root / "production.json",
        root / "narration.txt",
        root / "design.md",
        root / "package-manifest.json",
        *_tree_files(root, "assets"),
    ]
    if not local_first_v4:
        creative_files.extend([
            root / "handoff-manifest.json",
            root / "FINAL_VALIDATION.json",
        ])
    renderer_files = (
        []
        if package_manifest is not None
        else [
            *_tree_files(
                root,
                "renderer",
                exclude={"node_modules", "generated", ".cache"},
            ),
        ]
    )
    runtime_files = [
        root / "voice.wav",
        root / ".runtime" / "timing.json",
    ]
    publish_copy_files = [
        root / "publish" / "publish-copy.txt",
    ]
    music_files = [root / ".runtime" / "audio.json"]

    audio_config = root / ".runtime" / "audio.json"
    if audio_config.is_file():
        try:
            raw = json.loads(audio_config.read_text(encoding="utf-8")).get(
                "background_music"
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            raw = None
        if isinstance(raw, str):
            music_files.append(root / raw)

    production = {}
    production_path = root / "production.json"
    if production_path.is_file():
        try:
            production = json.loads(production_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            production = {}

    publish_document = {}
    publish_path = root / "publish" / "publish.json"
    if publish_path.is_file():
        try:
            publish_document = json.loads(publish_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            publish_document = {}

    creative = _fingerprint_files(root, creative_files)
    if package_manifest is None:
        renderer = _fingerprint_files(root, renderer_files)
    else:
        runtime_ref = package_manifest["runtime"]
        renderer = runtime_ref.get("sha256")
        if not isinstance(renderer, str) or not renderer:
            runtime_manifest = _load_json(
                _bundled_runtime_root(runtime_ref) / "runtime-manifest.json",
                "runtime-manifest.json",
            )
            renderer = str(runtime_manifest.get("sha256") or "")
    runtime = _fingerprint_files(root, runtime_files)
    publish_metadata = _fingerprint_value(publish_document)
    publish_copy = _fingerprint_files(root, publish_copy_files)
    publish = _fingerprint_value(
        {
            "metadata": publish_metadata,
            "copy": publish_copy,
        }
    )
    cover_spec = _fingerprint_value(
        publish_document.get("cover", {})
        if isinstance(publish_document, dict)
        else {}
    )
    music = _fingerprint_files(root, music_files)
    render_profile = _fingerprint_value(production.get("video", {}))

    video = _fingerprint_value(
        {
            "creative": creative,
            "renderer": renderer,
            "runtime": runtime,
            "render_profile": render_profile,
        }
    )
    cover = _fingerprint_value(
        {
            "creative": creative,
            "renderer": renderer,
            "cover_spec": cover_spec,
            "render_profile": render_profile,
        }
    )
    mix = _fingerprint_value(
        {
            "video": video,
            "music": music,
        }
    )
    final = _fingerprint_value(
        {
            "mix": mix,
            "cover": cover,
            "publish": publish,
        }
    )
    return {
        "creative": creative,
        "renderer": renderer,
        "runtime": runtime,
        "publish_metadata": publish_metadata,
        "publish_copy": publish_copy,
        "publish": publish,
        "cover_spec": cover_spec,
        "music": music,
        "render_profile": render_profile,
        "video": video,
        "cover": cover,
        "mix": mix,
        "final": final,
    }


def _performance_path(root: Path) -> Path:
    return Path(root) / ".runtime" / "performance.json"


def _write_performance_stage(
    root: Path,
    stage: str,
    *,
    elapsed_ms: int,
    status: str,
    cache_hit: bool,
    input_fingerprint: str | None,
) -> None:
    path = _performance_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        payload = {}
    stages = payload.get("stages")
    if not isinstance(stages, dict):
        stages = {}
    stages[stage] = {
        "elapsed_ms": int(elapsed_ms),
        "status": status,
        "cache_hit": bool(cache_hit),
        "input_fingerprint": input_fingerprint,
    }
    payload = {
        "version": 1,
        "fingerprints": artifact_fingerprints(root),
        "stages": stages,
    }
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temp, path)


def _prepare_cache_path(root: Path) -> Path:
    return Path(root) / ".runtime" / "prepare-cache.json"


def _load_prepare_cache(root: Path) -> dict:
    path = _prepare_cache_path(root)
    if not path.is_file():
        return {"version": 1, "stages": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {"version": 1, "stages": {}}
    if payload.get("version") != 1 or not isinstance(payload.get("stages"), dict):
        return {"version": 1, "stages": {}}
    return payload


def _prepare_stage_cached(root: Path, stage: str, fingerprint: str) -> bool:
    payload = _load_prepare_cache(root)
    entry = payload["stages"].get(stage)
    return (
        isinstance(entry, dict)
        and entry.get("status") == "PASS"
        and entry.get("fingerprint") == fingerprint
    )


def _mark_prepare_stage_cached(root: Path, stage: str, fingerprint: str) -> None:
    path = _prepare_cache_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = _load_prepare_cache(root)
    stages = dict(payload.get("stages") or {})
    stages[stage] = {
        "status": "PASS",
        "fingerprint": fingerprint,
    }
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(
        json.dumps(
            {
                "version": 1,
                "stages": stages,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    os.replace(temp, path)


def renderer_dependency_fingerprint(package_root: Path) -> str:
    root = Path(package_root).resolve()
    renderer = resolve_renderer_root(root, materialize=True)
    package = _load_json(renderer / "package.json", "renderer/package.json")
    lock_path = renderer / "package-lock.json"
    lock = file_sha256(lock_path) if lock_path.is_file() else ""
    return _fingerprint_value(
        {
            "dependencies": package.get("dependencies") or {},
            "devDependencies": package.get("devDependencies") or {},
            "package_lock": lock,
        }
    )


def _renderer_dependencies_installed(renderer: Path) -> bool:
    renderer = Path(renderer).resolve()
    try:
        package = _load_json(renderer / "package.json", "renderer/package.json")
    except PipelineError:
        return False

    expected = {}
    for field in ("dependencies", "devDependencies"):
        values = package.get(field)
        if not isinstance(values, dict):
            return False
        expected.update(values)

    for name, version in expected.items():
        parts = name.split("/")
        installed_path = renderer / "node_modules"
        for part in parts:
            installed_path /= part
        installed_path /= "package.json"
        try:
            installed = json.loads(installed_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return False
        installed_version = installed.get("version")
        if (
            name == "typescript"
            and version == "5.8.0"
            and installed_version in SUPPORTED_TYPESCRIPT_VERSIONS
        ):
            continue
        if installed_version != version:
            return False

    bin_dir = renderer / "node_modules" / ".bin"
    remotion_bin = bin_dir / ("remotion.cmd" if os.name == "nt" else "remotion")
    tsc_bin = bin_dir / ("tsc.cmd" if os.name == "nt" else "tsc")
    return remotion_bin.is_file() and tsc_bin.is_file()


def _package_runtime_sha256(manifest: dict) -> str:
    """Resolve the exact runtime hash for both v3 and local-first v4 packages."""
    runtime_ref = manifest["runtime"]
    runtime_sha = runtime_ref.get("sha256")
    if isinstance(runtime_sha, str) and re.fullmatch(r"[0-9a-f]{64}", runtime_sha):
        return runtime_sha

    runtime_manifest = _load_json(
        _bundled_runtime_root(runtime_ref) / "runtime-manifest.json",
        "runtime-manifest.json",
    )
    runtime_sha = runtime_manifest.get("sha256")
    if not isinstance(runtime_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", runtime_sha):
        raise PipelineError(
            "BUNDLED_RUNTIME_CORRUPT: runtime manifest is missing a valid sha256."
        )
    return runtime_sha


def style_compile_fingerprint(package_root: Path) -> str:
    root = Path(package_root).resolve()
    _token, source_hash = _design_token(root)
    manifest = _load_package_manifest(root)
    if manifest is not None:
        compiler = _package_runtime_sha256(manifest)
    else:
        compiler = _fingerprint_files(
            root,
            [
                root / "renderer" / "scripts" / "style-token.mjs",
                root / "renderer" / "scripts" / "compile-style-token.mjs",
            ],
        )
    return _fingerprint_value({"design_source_hash": source_hash, "compiler": compiler})


def _style_compilation_current(package_root: Path) -> bool:
    root = Path(package_root).resolve()
    try:
        token, source_hash = _design_token(root)
        production = _load_json(root / "production.json", "production.json")
    except PipelineError:
        return False
    visual = production.get("visual_system")
    compiled = visual.get("style_token") if isinstance(visual, dict) else None
    return (
        isinstance(compiled, dict)
        and compiled.get("id") == token.get("id")
        and compiled.get("source_hash") == source_hash
    )


def renderer_check_fingerprint(package_root: Path) -> str:
    root = Path(package_root).resolve()
    manifest = _load_package_manifest(root)
    if manifest is not None:
        return _package_runtime_sha256(manifest)
    fingerprints = artifact_fingerprints(root)
    production = _fingerprint_files(root, [root / "production.json"])
    return _fingerprint_value(
        {
            "renderer": fingerprints["renderer"],
            "production": production,
            "publish_metadata": fingerprints["publish_metadata"],
        }
    )


def _shared_runtime_check_cache_path(package_root: Path) -> Path:
    return resolve_renderer_root(package_root, materialize=True).parent / ".checks.json"


def renderer_checks_cached(package_root: Path, fingerprint: str) -> bool:
    root = Path(package_root).resolve()
    if _load_package_manifest(root) is None:
        return _prepare_stage_cached(root, "renderer_checks", fingerprint)
    path = _shared_runtime_check_cache_path(root)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    return payload.get("status") == "PASS" and payload.get("fingerprint") == fingerprint


def mark_renderer_checks_cached(package_root: Path, fingerprint: str) -> None:
    root = Path(package_root).resolve()
    if _load_package_manifest(root) is None:
        _mark_prepare_stage_cached(root, "renderer_checks", fingerprint)
        return
    path = _shared_runtime_check_cache_path(root)
    path.write_text(
        json.dumps({"status": "PASS", "fingerprint": fingerprint}, indent=2) + "\n",
        encoding="utf-8",
    )


@contextlib.contextmanager
def measure_performance_stage(
    package_root: Path,
    stage: str,
    *,
    input_fingerprint: str | None = None,
    cache_hit: bool = False,
):
    """Persist the latest elapsed time for a measurable runtime stage."""
    root = Path(package_root).resolve()
    started = time.perf_counter()
    status = "PASS"
    try:
        yield
    except Exception:
        status = "FAIL"
        raise
    finally:
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        _write_performance_stage(
            root,
            stage,
            elapsed_ms=elapsed_ms,
            status=status,
            cache_hit=cache_hit,
            input_fingerprint=input_fingerprint,
        )


def aligner_install_command() -> str:
    """The only supported install command: the interpreter running this runner."""
    return f'"{sys.executable}" -m pip install -r requirements-local.txt'


def require_word_aligner_installed() -> None:
    """Fail before any expensive TTS work when measured timing cannot be produced."""
    try:
        import faster_whisper  # noqa: F401
    except ImportError as exc:
        raise PipelineError(
            "Automatic word-level timing requires faster-whisper, which is missing from the "
            f"Python running Zodiac Studio ({sys.executable}).\n"
            f"Install it with:\n{aligner_install_command()}"
        ) from exc


def scene_wav_path(root: Path, scene_id: str) -> Path:
    return Path(root) / ".runtime" / "tts-scenes" / f"{scene_id}.wav"


def tts_manifest_rows(production: dict, scene_ids: list[str] | None = None) -> list[dict]:
    wanted = set(scene_ids) if scene_ids is not None else None
    return [
        {
            "scene_id": scene["id"],
            "text": scene["voice"],
            "output": str(scene_wav_path(".", scene["id"])),
        }
        for scene in production["scenes"]
        if wanted is None or scene["id"] in wanted
    ]


def _validate_speech_rate_warning_wps(value: float) -> float:
    try:
        threshold = float(value)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("speech-rate warning threshold must be a finite number greater than zero.") from None
    if not math.isfinite(threshold) or threshold <= 0:
        raise PipelineError("speech-rate warning threshold must be a finite number greater than zero.")
    return threshold


def effective_tts_generation_config(
    *,
    mode: str,
    vieneu_url: str | None,
    backend: str,
    precision: str,
    frame_cap: str,
    max_chars: int,
) -> dict:
    """Describe settings that actually affect the generated audio."""
    if vieneu_url:
        return {
            "transport": "gradio",
            "backend": "server-managed",
            "precision": "server-managed",
            "frame_cap": None,
            "max_chars": max_chars,
        }
    if mode == "v3turbo":
        return {
            "transport": "local",
            "backend": backend,
            "precision": precision,
            "frame_cap": frame_cap == "on",
            "max_chars": max_chars,
        }
    return {
        "transport": "local",
        "backend": None,
        "precision": None,
        "frame_cap": None,
        "max_chars": max_chars,
    }


def _component_label(component: dict) -> str:
    return str((component.get("props") or {}).get("label") or "").strip().casefold()


def _select_vieneu_gradio_dependency(config: dict) -> dict:
    """Return the verified single-speaker synthesis dependency or fail closed."""
    components = {
        item.get("id"): item
        for item in config.get("components", [])
        if isinstance(item, dict) and "id" in item
    }
    trusted_name = re.compile(
        r"^(?:wrapper(?:_\d+)?|synthesize_speech(?:_with_estimate)?(?:_\d+)?)$"
    )
    matches = []
    seen_api_names = []
    for dependency in config.get("dependencies", []):
        if not isinstance(dependency, dict):
            continue
        api_name = str(dependency.get("api_name") or "").strip().lstrip("/")
        if not api_name:
            continue
        seen_api_names.append(api_name)
        if not trusted_name.fullmatch(api_name):
            continue

        input_ids = [
            component_id
            for component_id in dependency.get("inputs", [])
            if (components.get(component_id) or {}).get("type") != "state"
        ]
        labels = [_component_label(components.get(component_id) or {}) for component_id in input_ids]
        text_positions = [
            index for index, label in enumerate(labels)
            if label == "văn bản" or label == "text"
        ]
        voice_positions = [
            index for index, label in enumerate(labels)
            if label == "giọng mẫu" or label in {"voice", "preset voice"}
        ]
        output_types = {
            str((components.get(component_id) or {}).get("type") or "").casefold()
            for component_id in dependency.get("outputs", [])
        }
        if len(text_positions) != 1 or len(voice_positions) != 1 or "audio" not in output_types:
            continue

        max_chars_positions = [
            index for index, label in enumerate(labels)
            if "max chars" in label
            or ("ký tự" in label and ("chunk" in label or "đoạn" in label))
        ]
        verified = dict(dependency)
        verified["_input_ids"] = input_ids
        verified["_text_position"] = text_positions[0]
        verified["_voice_position"] = voice_positions[0]
        verified["_max_chars_position"] = (
            max_chars_positions[0] if len(max_chars_positions) == 1 else None
        )
        matches.append(verified)

    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        names = ", ".join(str(item.get("api_name")) for item in matches)
        raise PipelineError(
            "Không thể xác định duy nhất endpoint tạo giọng VieNeu Gradio; "
            f"các endpoint phù hợp: {names}."
        )
    discovered = ", ".join(sorted(set(seen_api_names))) or "không có"
    raise PipelineError(
        "Không xác định được endpoint tạo giọng VieNeu Gradio từ metadata đáng tin cậy. "
        f"Endpoint phát hiện được: {discovered}."
    )


def build_tts_diagnostics(
    production: dict,
    durations: dict[str, float],
    *,
    warning_wps: float = DEFAULT_SPEECH_RATE_WARNING_WPS,
    transport: str = "local",
    backend: str | None = None,
    precision: str | None = None,
    frame_cap: bool | None = None,
    max_chars: int | None = None,
    scene_configs: dict[str, dict] | None = None,
) -> dict:
    """Measure narration density immediately after TTS, before ASR alignment."""
    warning_wps = _validate_speech_rate_warning_wps(warning_wps)
    base_config = {
        "transport": transport,
        "backend": backend,
        "precision": precision,
        "frame_cap": frame_cap,
        "max_chars": max_chars,
    }
    scene_configs = scene_configs or {}

    scenes = []
    total_words = 0
    total_seconds = 0.0
    for scene in production.get("scenes", []):
        scene_id = str(scene.get("id", ""))
        seconds = durations.get(scene_id)
        if (
            not isinstance(seconds, (int, float))
            or not math.isfinite(float(seconds))
            or float(seconds) <= 0
        ):
            raise PipelineError(f"missing measured duration for scene {scene_id}.")
        words = len(_expected_caption_tokens(str(scene.get("voice", ""))))
        wps = words / float(seconds)
        warning = wps > warning_wps
        scenes.append(
            {
                "scene_id": scene_id,
                "word_count": words,
                "duration_seconds": round(float(seconds), 6),
                "words_per_second": round(wps, 6),
                "speech_rate_warning": warning,
                "generation": dict(scene_configs.get(scene_id) or base_config),
            }
        )
        total_words += words
        total_seconds += float(seconds)

    total_wps = total_words / total_seconds if total_seconds > 0 else 0.0
    return {
        "version": 1,
        "config": {
            **base_config,
            "warning_wps": warning_wps,
        },
        "summary": {
            "word_count": total_words,
            "duration_seconds": round(total_seconds, 6),
            "words_per_second": round(total_wps, 6),
            "speech_rate_warning": total_wps > warning_wps
            or any(item["speech_rate_warning"] for item in scenes),
        },
        "scenes": scenes,
    }


def write_tts_diagnostics(
    runtime: Path,
    diagnostics: dict,
    filename: str = "tts-diagnostics.json",
) -> Path:
    path = Path(runtime) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(diagnostics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def _emit_tts_log(text: str, log_callback=None) -> None:
    if log_callback is not None:
        log_callback(str(text))
    else:
        print(str(text), flush=True)


def _print_tts_diagnostics(diagnostics: dict, log_callback=None) -> None:
    threshold = diagnostics["config"]["warning_wps"]
    for scene in diagnostics["scenes"]:
        status = "TTS_RATE_WARNING" if scene["speech_rate_warning"] else "TTS_RATE"
        _emit_tts_log(
            f"{status}: {scene['scene_id']} "
            f"{scene['duration_seconds']:.1f}s / {scene['word_count']} từ = "
            f"{scene['words_per_second']:.2f} từ/giây"
            + (
                f" > ngưỡng {threshold:.2f}"
                if scene["speech_rate_warning"]
                else ""
            ),
            log_callback,
        )
    summary = diagnostics["summary"]
    _emit_tts_log(
        f"TTS_RATE_TOTAL: {summary['duration_seconds']:.1f}s / "
        f"{summary['word_count']} từ = {summary['words_per_second']:.2f} từ/giây",
        log_callback,
    )


def run_tts_batch(
    runtime: Path,
    rows: list[dict],
    *,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    mode: str = "v3turbo",
    vieneu_url: str | None = None,
    backend: str = DEFAULT_TTS_BACKEND,
    precision: str = DEFAULT_TTS_PRECISION,
    frame_cap: str = DEFAULT_TTS_FRAME_CAP,
    frame_cap_scale: float = 1.0,
    max_chars: int = DEFAULT_TTS_MAX_CHARS,
) -> None:
    """Generate the given scene WAVs with VieNeu, in one subprocess call."""
    if not rows:
        return
    if max_chars < 32:
        raise PipelineError("--tts-max-chars must be at least 32.")
    if backend not in {"auto", "onnx", "pytorch"}:
        raise PipelineError("--tts-backend must be auto, onnx, or pytorch.")
    if precision not in {"fp32", "int8"}:
        raise PipelineError("--tts-precision must be fp32 or int8.")
    if frame_cap not in {"on", "off"}:
        raise PipelineError("--tts-frame-cap must be 'on' or 'off'.")
    try:
        frame_cap_scale = float(frame_cap_scale)
    except (TypeError, ValueError) as exc:
        raise PipelineError("frame_cap_scale must be a positive finite number.") from exc
    if not math.isfinite(frame_cap_scale) or frame_cap_scale <= 0:
        raise PipelineError("frame_cap_scale must be a positive finite number.")
    if frame_cap == "off" and not math.isclose(frame_cap_scale, 1.0):
        raise PipelineError("frame_cap_scale cannot be combined with frame-cap off.")
    if mode != "v3turbo" and (
        backend != DEFAULT_TTS_BACKEND
        or precision != DEFAULT_TTS_PRECISION
        or frame_cap != DEFAULT_TTS_FRAME_CAP
    ):
        raise PipelineError(
            "--tts-backend/--tts-precision/--tts-frame-cap chỉ áp dụng cho v3turbo."
        )
    if vieneu_url and (frame_cap == "off" or not math.isclose(frame_cap_scale, 1.0)):
        raise PipelineError(
            "frame-cap overrides cannot control an already-running Gradio server. "
            "Run VieNeu directly (omit --vieneu-url) for frame-cap diagnostics."
        )
    if mode != "v3turbo" and not math.isclose(frame_cap_scale, 1.0):
        raise PipelineError("frame_cap_scale only applies to v3turbo.")
    runtime = Path(runtime)
    scene_dir = runtime / "tts-scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)
    for row in rows:
        row["output"] = str(scene_dir / f"{row['scene_id']}.wav")
    manifest = runtime / "tts-manifest.json"
    manifest.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    python = _tts_python(Path(tts_root).expanduser().resolve(), tts_python)

    gradio_endpoint = None
    if vieneu_url:
        import urllib.request

        try:
            with urllib.request.urlopen(vieneu_url.rstrip("/") + "/config", timeout=10) as response:
                gradio_config = json.load(response)
        except Exception as exc:
            raise PipelineError(f"Không đọc được metadata VieNeu Gradio: {exc}") from exc
        gradio_endpoint = _select_vieneu_gradio_dependency(gradio_config)

    script = (
        "import json, shutil, sys, urllib.request\n"
        "from pathlib import Path\n"
        "from gradio_client import Client\n"
        "rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\n"
        "url, voice, max_chars = sys.argv[2].rstrip('/'), sys.argv[3], int(sys.argv[4])\n"
        "api_name, text_pos, voice_pos, max_chars_pos = sys.argv[5], int(sys.argv[6]), int(sys.argv[7]), int(sys.argv[8])\n"
        "config = json.load(urllib.request.urlopen(url + '/config', timeout=10))\n"
        "components = {item['id']: item for item in config.get('components', [])}\n"
        "dep = next((d for d in config.get('dependencies', []) if str(d.get('api_name') or '').lstrip('/') == api_name), None)\n"
        "if dep is None: raise RuntimeError('Endpoint VieNeu đã thay đổi sau khi xác thực metadata: ' + api_name)\n"
        "client = Client(url, verbose=False)\n"
        "for row in rows:\n"
        "    print('VieNeu API:', row['scene_id'], flush=True)\n"
        "    input_ids = [i for i in dep['inputs'] if components.get(i, {}).get('type') != 'state']\n"
        "    args = [components.get(i, {}).get('props', {}).get('value') for i in input_ids]\n"
        "    if max(text_pos, voice_pos, max_chars_pos) >= len(args): raise RuntimeError('Schema endpoint VieNeu đã thay đổi sau khi xác thực.')\n"
        "    args[text_pos], args[voice_pos] = row['text'], voice\n"
        "    if max_chars_pos >= 0: args[max_chars_pos] = max_chars\n"
        "    result = client.predict(*args, api_name='/' + api_name)\n"
        "    if isinstance(result, (tuple, list)) and result[0] is None and 'Vui lòng tải model trước' in str(result[1]):\n"
        "        print('VieNeu: đang nạp model vào server…', flush=True)\n"
        "        loaded = client.predict('VieNeu-TTS-v3-Turbo', 'VieNeu-Codec', 'Auto', True, '', 'VieNeu-TTS-v3-Nano (preview)', '', api_name='/load_model')\n"
        "        if not str(loaded[0]).startswith('✅ Model đã tải thành công'): raise RuntimeError('VieNeu không nạp được model: ' + str(loaded[0]))\n"
        "        result = client.predict(*args, api_name='/' + api_name)\n"
        "    audio = result[0] if isinstance(result, (tuple, list)) else result\n"
        "    if isinstance(result, (tuple, list)) and result[0] is None: raise RuntimeError(str(result[1]))\n"
        "    if isinstance(audio, dict): audio = audio.get('path') or audio.get('name')\n"
        "    if not audio or not Path(str(audio)).is_file(): raise RuntimeError('VieNeu API không trả về file WAV: ' + str(audio))\n"
        "    shutil.copy2(audio, row['output'])\n"
    )
    if vieneu_url:
        print("Đang tạo giọng đọc qua VieNeu Gradio…", flush=True)
        print(
            "VieNeu Gradio đang quản lý backend/precision/frame-cap; "
            "các cờ đó chỉ áp dụng khi chạy direct local SDK.",
            flush=True,
        )
        run_args = [
            str(python), "-X", "utf8", "-c", script, str(manifest),
            vieneu_url, voice, str(max_chars),
            str(gradio_endpoint["api_name"]).lstrip("/"),
            str(gradio_endpoint["_text_position"]),
            str(gradio_endpoint["_voice_position"]),
            str(
                gradio_endpoint["_max_chars_position"]
                if gradio_endpoint["_max_chars_position"] is not None
                else -1
            ),
        ]
    else:
        script = (
            "import json, sys\n"
            "from pathlib import Path\n"
            "from vieneu import Vieneu\n"
            "from apps.user_voices import load_user_voices\n"
            "rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\n"
            "mode, voice, backend, precision, frame_cap, frame_cap_scale, max_chars = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6], float(sys.argv[7]), int(sys.argv[8])\n"
            "kwargs = {}\n"
            "if mode == 'v3turbo': kwargs.update(backend=backend, precision=precision)\n"
            "tts = Vieneu(mode=mode, **kwargs)\n"
            "load_user_voices(tts)\n"
            "if voice not in tts._preset_voices: raise ValueError('VieNeu voice not found: ' + voice)\n"
            "if mode == 'v3turbo' and frame_cap == 'off':\n"
            "    if getattr(tts, 'backend', None) != 'onnx': raise RuntimeError('frame-cap off diagnostic is supported only on v3turbo ONNX/CPU')\n"
            "    import vieneu.v3turbo as turbo_module\n"
            "    turbo_module._cap_frames = lambda sampling, cap: dict(sampling)\n"
            "    original_engine_infer = tts.engine.infer\n"
            "    def uncapped_engine_infer(*args, **kwargs):\n"
            "        kwargs['frame_cap'] = False\n"
            "        return original_engine_infer(*args, **kwargs)\n"
            "    tts.engine.infer = uncapped_engine_infer\n"
            "elif mode == 'v3turbo' and frame_cap_scale != 1.0:\n"
            "    if getattr(tts, 'backend', None) != 'onnx': raise RuntimeError('scaled frame-cap diagnostic is supported only on v3turbo ONNX/CPU')\n"
            "    import math as _math\n"
            "    import vieneu.v3turbo as turbo_module\n"
            "    import vieneu_utils.core_utils as core_utils\n"
            "    _base_max_expected_frames = core_utils.max_expected_frames\n"
            "    def _scaled_max_expected_frames(phonemes):\n"
            "        base = _base_max_expected_frames(phonemes)\n"
            "        return min(300, max(1, int(_math.ceil(base * frame_cap_scale))))\n"
            "    core_utils.max_expected_frames = _scaled_max_expected_frames\n"
            "    turbo_module.max_expected_frames = _scaled_max_expected_frames\n"
            "for row in rows:\n"
            "    print('VieNeu:', row['scene_id'], flush=True)\n"
            "    tts.save(tts.infer(row['text'], voice=voice, max_chars=max_chars), row['output'])\n"
        )
        actual = effective_tts_generation_config(
            mode=mode,
            vieneu_url=None,
            backend=backend,
            precision=precision,
            frame_cap=frame_cap,
            max_chars=max_chars,
        )
        print(
            f"Đang tạo giọng bằng VieNeu direct: mode={mode}, "
            f"backend={actual['backend'] or 'n/a'}, "
            f"precision={actual['precision'] or 'n/a'}, "
            f"frame_cap={actual['frame_cap'] if actual['frame_cap'] is not None else 'n/a'}, "
            f"frame_cap_scale={frame_cap_scale:.2f}, "
            f"max_chars={max_chars}…",
            flush=True,
        )
        run_args = [
            str(python), "-X", "utf8", "-c", script, str(manifest),
            mode, voice, backend, precision, frame_cap, str(frame_cap_scale), str(max_chars),
        ]
    try:
        run_managed_subprocess(run_args, cwd=tts_root, check=True)
    except FileNotFoundError as exc:
        raise PipelineError(f"cannot start VieNeu Python: {exc}") from exc
    except subprocess.CalledProcessError as exc:
        raise PipelineError(f"VieNeu synthesis failed with exit code {exc.returncode}.")


def generate_scene_voices(
    package_root: Path,
    production: dict,
    scene_ids: list[str] | None = None,
    *,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    mode: str = "v3turbo",
    vieneu_url: str | None = None,
    backend: str = DEFAULT_TTS_BACKEND,
    precision: str = DEFAULT_TTS_PRECISION,
    frame_cap: str = DEFAULT_TTS_FRAME_CAP,
    max_chars: int = DEFAULT_TTS_MAX_CHARS,
    speech_rate_warning_wps: float = DEFAULT_SPEECH_RATE_WARNING_WPS,
    fp32_fallback_on_rate_warning: bool = True,
    log_callback=None,
) -> dict[str, float]:
    """Generate selected WAVs once; WPS is diagnostic, never a batch retry trigger."""
    speech_rate_warning_wps = _validate_speech_rate_warning_wps(
        speech_rate_warning_wps
    )
    root = Path(package_root).resolve()
    rows = tts_manifest_rows(production, scene_ids)
    run_tts_batch(
        root / ".runtime",
        rows,
        tts_root=tts_root,
        tts_python=tts_python,
        voice=voice,
        mode=mode,
        vieneu_url=vieneu_url,
        backend=backend,
        precision=precision,
        frame_cap=frame_cap,
        max_chars=max_chars,
    )

    durations: dict[str, float] = {}
    for scene in production["scenes"]:
        scene_id = scene["id"]
        path = scene_wav_path(root, scene_id)
        try:
            validate_voice(path)
        except PipelineError as exc:
            raise PipelineError(f"Scene {scene_id}: {exc}") from exc
        durations[scene_id] = _wav_duration_seconds(path)

    applied_config = effective_tts_generation_config(
        mode=mode,
        vieneu_url=vieneu_url,
        backend=backend,
        precision=precision,
        frame_cap=frame_cap,
        max_chars=max_chars,
    )
    diagnostics = build_tts_diagnostics(
        production,
        durations,
        warning_wps=speech_rate_warning_wps,
        **applied_config,
    )
    warning_ids = [
        item["scene_id"]
        for item in diagnostics["scenes"]
        if item["speech_rate_warning"]
        and item["scene_id"] in {row["scene_id"] for row in rows}
    ]
    if warning_ids:
        diagnostics["rate_policy"] = {
            "action": "warning_only",
            "reason": (
                "speech rate alone is not evidence of missing narration; "
                "alignment decides whether a scene-level retry is justified"
            ),
            "scene_ids": warning_ids,
        }
    write_tts_diagnostics(root / ".runtime", diagnostics)
    _print_tts_diagnostics(diagnostics, log_callback)
    if warning_ids and fp32_fallback_on_rate_warning:
        _emit_tts_log(
            "TTS_RATE_NOTICE: tốc độ cao chỉ được ghi cảnh báo; "
            "không sinh lại cả batch. Alignment sẽ quyết định retry theo từng scene.",
            log_callback,
        )
    return durations


def scene_voice_files(package_root: Path, production: dict) -> list[Path]:
    return [scene_wav_path(package_root, scene["id"]) for scene in production["scenes"]]


def concatenate_scene_voices(
    package_root: Path,
    production: dict,
    *,
    scene_gap_ms: float = 0.0,
    sentence_pause_ms: float = 0.0,
    timing: dict | None = None,
) -> Path:
    """Compose final voice.wav from cached scene WAVs with explicit breathing pauses."""
    root = Path(package_root).resolve()
    inputs = scene_voice_files(root, production)
    output = root / "voice.wav"

    if sentence_pause_ms <= 0 or timing is None:
        concatenate_wavs(inputs, output, gap_ms=scene_gap_ms)
        return output

    try:
        sentence_pause_ms = float(sentence_pause_ms)
        scene_gap_ms = float(scene_gap_ms)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("pacing pauses must be finite non-negative numbers.") from None
    if not math.isfinite(sentence_pause_ms) or not 0 <= sentence_pause_ms <= 3000:
        raise PipelineError("sentence pause must be between 0 and 3000 ms.")
    if not math.isfinite(scene_gap_ms) or not 0 <= scene_gap_ms <= 5000:
        raise PipelineError("scene gap must be between 0 and 5000 ms.")

    rows = timing.get("scenes") if isinstance(timing, dict) else None
    if not isinstance(rows, list) or len(rows) != len(production.get("scenes", [])):
        raise PipelineError("timing rows are required to compose sentence pauses.")
    fps = timing.get("fps")
    if not isinstance(fps, (int, float)) or fps <= 0:
        raise PipelineError("timing fps is invalid for sentence pause composition.")

    output.parent.mkdir(parents=True, exist_ok=True)
    params = None
    with wave.open(str(output), "wb") as destination:
        for scene_index, (scene, source_path, row) in enumerate(
            zip(production["scenes"], inputs, rows)
        ):
            try:
                with wave.open(str(source_path), "rb") as source:
                    if source.getcomptype() != "NONE":
                        raise PipelineError(f"scene WAV is compressed: {source_path}")
                    current = source.getparams()
                    if params is None:
                        params = current
                        destination.setnchannels(current.nchannels)
                        destination.setsampwidth(current.sampwidth)
                        destination.setframerate(current.framerate)
                        destination.setcomptype("NONE", "not compressed")
                    elif current[:3] != params[:3]:
                        raise PipelineError("scene WAV files do not share one PCM format.")

                    frame_bytes = current.sampwidth * current.nchannels
                    raw = source.readframes(source.getnframes())
                    pause_after = sorted(_sentence_pause_after_indices(scene["voice"]))
                    captions = row.get("captions")
                    if not isinstance(captions, list):
                        raise PipelineError(f"timing captions missing for {scene['id']}.")
                    expected = _expected_caption_tokens(scene["voice"])
                    if len(captions) != len(expected):
                        raise PipelineError(
                            f"timing captions do not cover sentence pauses for {scene['id']}."
                        )

                    scene_start_ms = float(row["start_frame"]) * 1000.0 / float(fps)
                    cursor_frame = 0
                    for pause_number, token_index in enumerate(pause_after):
                        adjusted_end_ms = float(captions[token_index]["endMs"]) - scene_start_ms
                        source_end_ms = adjusted_end_ms - (
                            pause_number * sentence_pause_ms
                        )
                        boundary_frame = round(
                            source_end_ms * current.framerate / 1000.0
                        )
                        boundary_frame = min(
                            max(boundary_frame, cursor_frame),
                            source.getnframes(),
                        )
                        destination.writeframes(
                            raw[cursor_frame * frame_bytes : boundary_frame * frame_bytes]
                        )
                        silent_frames = round(
                            current.framerate * sentence_pause_ms / 1000.0
                        )
                        silent_sample = (
                            b"\x80"
                            if current.sampwidth == 1
                            else b"\x00" * current.sampwidth
                        )
                        destination.writeframes(
                            silent_sample * current.nchannels * silent_frames
                        )
                        cursor_frame = boundary_frame

                    destination.writeframes(raw[cursor_frame * frame_bytes :])

                    if scene_index < len(inputs) - 1 and scene_gap_ms > 0:
                        silent_frames = round(
                            current.framerate * scene_gap_ms / 1000.0
                        )
                        silent_sample = (
                            b"\x80"
                            if current.sampwidth == 1
                            else b"\x00" * current.sampwidth
                        )
                        destination.writeframes(
                            silent_sample * current.nchannels * silent_frames
                        )
            except (wave.Error, EOFError, OSError) as exc:
                raise PipelineError(f"cannot read scene WAV {source_path}: {exc}") from exc
    return output


def _wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / wav.getframerate()


def tts_scene_frame_cap_retry_eligible(
    package_root: Path,
    scene_id: str,
    *,
    selected_mode: str,
    allow_fp32_fallback: bool,
) -> bool:
    """Whether a coverage-gap retry can preserve the selected TTS policy."""
    if not allow_fp32_fallback or selected_mode != "v3turbo":
        return False

    diagnostics_path = Path(package_root) / ".runtime" / "tts-diagnostics.json"
    try:
        diagnostics = json.loads(diagnostics_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    for scene in diagnostics.get("scenes", []):
        if scene.get("scene_id") != scene_id:
            continue
        generation = scene.get("generation") or {}
        transport = generation.get("transport")
        direct_fp32 = (
            transport == "local"
            and generation.get("backend") == "onnx"
            and generation.get("precision") == "fp32"
            and generation.get("frame_cap") is True
        )
        return transport == "gradio" or direct_fp32
    return False


def _record_frame_cap_recovery_diagnostics(
    package_root: Path,
    scene_id: str,
    duration: float,
    *,
    max_chars: int,
    frame_cap_scale: float,
) -> None:
    runtime = Path(package_root) / ".runtime"
    path = runtime / "tts-diagnostics.json"
    try:
        diagnostics = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return

    if not (runtime / "tts-diagnostics.pre-frame-cap-retry.json").exists():
        write_tts_diagnostics(
            runtime,
            diagnostics,
            "tts-diagnostics.pre-frame-cap-retry.json",
        )

    threshold = _validate_speech_rate_warning_wps(
        (diagnostics.get("config") or {}).get(
            "warning_wps",
            DEFAULT_SPEECH_RATE_WARNING_WPS,
        )
    )
    recovery_entry = None
    for scene in diagnostics.get("scenes", []):
        if scene.get("scene_id") != scene_id:
            continue
        words = int(scene.get("word_count") or 0)
        wps = words / duration if duration > 0 else 0.0
        scene["duration_seconds"] = round(duration, 6)
        scene["words_per_second"] = round(wps, 6)
        scene["speech_rate_warning"] = wps > threshold
        generation = effective_tts_generation_config(
            mode="v3turbo",
            vieneu_url=None,
            backend="onnx",
            precision="fp32",
            frame_cap="on",
            max_chars=max_chars,
        )
        generation["frame_cap_scale"] = frame_cap_scale
        scene["generation"] = generation
        scene["recovery"] = {
            "reason": "alignment_mismatch_after_capped_fp32",
            "strategy": "adaptive_frame_cap",
            "frame_cap_scale": frame_cap_scale,
        }
        recovery_entry = {
            "scene_id": scene_id,
            "duration_seconds": round(duration, 6),
            "words_per_second": round(wps, 6),
            "frame_cap_scale": frame_cap_scale,
        }
        break

    scenes = diagnostics.get("scenes", [])
    total_words = sum(int(item.get("word_count") or 0) for item in scenes)
    total_seconds = sum(float(item.get("duration_seconds") or 0.0) for item in scenes)
    total_wps = total_words / total_seconds if total_seconds > 0 else 0.0
    diagnostics["summary"] = {
        "word_count": total_words,
        "duration_seconds": round(total_seconds, 6),
        "words_per_second": round(total_wps, 6),
        "speech_rate_warning": (
            total_wps > threshold
            or any(bool(item.get("speech_rate_warning")) for item in scenes)
        ),
    }
    if recovery_entry is not None:
        diagnostics.setdefault("frame_cap_recoveries", []).append(recovery_entry)
    write_tts_diagnostics(runtime, diagnostics)


def recover_scene_alignment_with_adaptive_frame_cap(
    package_root: Path,
    production: dict,
    scene_id: str,
    aligner,
    *,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    max_chars: int = DEFAULT_TTS_MAX_CHARS,
    frame_cap_scales: tuple[float, ...] = (1.25, 1.50),
    selected_mode: str = "v3turbo",
    allow_fp32_fallback: bool = True,
    log_callback=None,
) -> tuple[list[dict], float]:
    """Retry one proven coverage gap without changing the selected TTS model."""
    if not allow_fp32_fallback:
        raise PipelineError(
            "TTS_RECOVERY_DISABLED: direct ONNX/fp32 fallback was disabled by the caller."
        )
    if selected_mode != "v3turbo":
        raise PipelineError(
            "TTS_RECOVERY_UNSUPPORTED_MODE: adaptive frame-cap recovery "
            f"cannot preserve selected mode {selected_mode!r}."
        )
    root = Path(package_root).resolve()
    scene = next(
        (item for item in production.get("scenes", []) if item.get("id") == scene_id),
        None,
    )
    if scene is None:
        raise PipelineError(f"unknown scene for adaptive frame-cap retry: {scene_id}")

    configured_scales = tuple(float(value) for value in frame_cap_scales)
    if not configured_scales or any(
        not math.isfinite(value) or value <= 1.0
        for value in configured_scales
    ) or any(
        right <= left
        for left, right in zip(configured_scales, configured_scales[1:])
    ):
        raise PipelineError(
            "frame_cap_scales must be an increasing sequence of finite values > 1."
        )

    baseline_scale = 1.0
    baseline_transport = "local"
    diagnostics_path = root / ".runtime" / "tts-diagnostics.json"
    try:
        current_diagnostics = json.loads(
            diagnostics_path.read_text(encoding="utf-8")
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        current_diagnostics = {}
    for item in current_diagnostics.get("scenes", []):
        if item.get("scene_id") != scene_id:
            continue
        generation = item.get("generation") or {}
        baseline_transport = str(generation.get("transport") or "local")
        try:
            baseline_scale = float(generation.get("frame_cap_scale", 1.0))
        except (TypeError, ValueError):
            baseline_scale = 1.0
        break

    scales = tuple(
        ([1.0] if baseline_transport == "gradio" else [])
        + [
            value
            for value in configured_scales
            if value > baseline_scale + 1e-9
        ]
    )
    if not scales:
        raise PipelineError(
            "ADAPTIVE_FRAME_CAP_RETRY_EXHAUSTED: "
            f"{scene_id} already used frame-cap x{baseline_scale:.2f}; "
            "no wider bounded retry remains."
        )

    current = scene_wav_path(root, scene_id)
    validate_voice(current)
    evidence_dir = root / ".runtime" / "tts-diagnostics"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    baseline = evidence_dir / f"{scene_id}.frame-cap-{baseline_scale:.2f}.wav"
    shutil.copy2(current, baseline)
    baseline_duration = _wav_duration_seconds(current)
    last_mismatch: Exception | None = None

    for scale in scales:
        _emit_tts_log(
            (
                f"TTS_SCENE_FP32_RETRY: {scene_id} Gradio mismatch có coverage gap; "
                "thử riêng scene bằng direct ONNX/fp32 cap x1.00."
                if baseline_transport == "gradio" and math.isclose(scale, 1.0)
                else
                f"TTS_FRAME_CAP_RETRY: {scene_id} direct ONNX/fp32 vẫn mismatch; "
                f"thử nới frame-cap x{scale:.2f}."
            ),
            log_callback,
        )
        generated = False
        try:
            run_tts_batch(
                root / ".runtime",
                [{"scene_id": scene_id, "text": scene["voice"]}],
                tts_root=tts_root,
                tts_python=tts_python,
                voice=voice,
                mode=selected_mode,
                vieneu_url=None,
                backend="onnx",
                precision="fp32",
                frame_cap="on",
                frame_cap_scale=scale,
                max_chars=max_chars,
            )
            generated = True
            validate_voice(current)
            duration = _wav_duration_seconds(current)
            aligned = _align_scene_words(aligner, current, scene["voice"])
        except AlignmentMismatchError as exc:
            if generated and current.is_file():
                failed = evidence_dir / f"{scene_id}.frame-cap-{scale:.2f}.failed.wav"
                shutil.copy2(current, failed)
            if exc.coverage_gap:
                last_mismatch = exc
                continue
            shutil.copy2(baseline, current)
            _emit_tts_log(
                f"TTS_FRAME_CAP_RETRY_STOP: {scene_id} retry chỉ còn ASR variant; "
                "dừng nới frame và khôi phục WAV baseline.",
                log_callback,
            )
            raise
        except PipelineError:
            if generated and current.is_file():
                failed = evidence_dir / f"{scene_id}.frame-cap-{scale:.2f}.failed.wav"
                shutil.copy2(current, failed)
            shutil.copy2(baseline, current)
            raise
        except Exception:
            if generated and current.is_file():
                failed = evidence_dir / f"{scene_id}.frame-cap-{scale:.2f}.failed.wav"
                shutil.copy2(current, failed)
            shutil.copy2(baseline, current)
            raise

        _record_frame_cap_recovery_diagnostics(
            root,
            scene_id,
            duration,
            max_chars=max_chars,
            frame_cap_scale=scale,
        )
        _emit_tts_log(
            f"TTS_FRAME_CAP_RECOVERED: {scene_id} align PASS với cap x{scale:.2f}; "
            f"{baseline_duration:.1f}s -> {duration:.1f}s.",
            log_callback,
        )
        return aligned, duration

    shutil.copy2(baseline, current)
    _emit_tts_log(
        f"TTS_FRAME_CAP_RETRY_FAILED: {scene_id}; cap x"
        + ", x".join(f"{value:.2f}" for value in scales)
        + f" vẫn không align đúng, đã khôi phục WAV cap x{baseline_scale:.2f}.",
        log_callback,
    )
    raise PipelineError(
        "ADAPTIVE_FRAME_CAP_RETRY_FAILED: widened frame caps still do not match "
        f"approved narration for {scene_id}. Baseline={baseline_duration:.3f}s. "
        f"{last_mismatch or ''}"
    )


def align_scene_timings(
    production: dict,
    durations: dict[str, float],
    aligner,
    scene_wavs: list[Path] | None = None,
    mismatch_recovery=None,
    *,
    scene_gap_ms: float = 0.0,
    sentence_pause_ms: float = 0.0,
) -> dict:
    """Align every scene; optionally recover exact mismatches scene-by-scene."""
    paths = list(scene_wavs or [])
    if len(paths) != len(production.get("scenes", [])):
        raise PipelineError("scene WAV count does not match production scene count.")

    aligned_words: dict[str, list[dict]] = {}
    for scene, path in zip(production["scenes"], paths):
        scene_id = scene["id"]
        try:
            aligned_words[scene_id] = _align_scene_words(
                aligner,
                path,
                scene["voice"],
            )
        except AlignmentMismatchError as exc:
            if mismatch_recovery is None or not exc.coverage_gap:
                raise
            recovered = mismatch_recovery(scene, path, aligner, exc)
            if recovered is None:
                raise
            words, seconds = recovered
            aligned_words[scene_id] = words
            durations[scene_id] = float(seconds)

    return build_timing_from_word_alignment(
        production,
        durations,
        aligned_words,
        scene_gap_ms=scene_gap_ms,
        sentence_pause_ms=sentence_pause_ms,
    )


def build_and_write_timing(package_root: Path, timing: dict) -> dict:
    root = Path(package_root).resolve()
    validate_timing(root, timing)
    path = root / ".runtime" / "timing.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return timing


def synthesize_voice(
    package_root: Path,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    mode: str = "v3turbo",
    vieneu_url: str | None = None,
    align_model: str = "small",
    align_device: str = "cpu",
    align_compute_type: str = "int8",
    tts_backend: str = DEFAULT_TTS_BACKEND,
    tts_precision: str = DEFAULT_TTS_PRECISION,
    tts_frame_cap: str = DEFAULT_TTS_FRAME_CAP,
    tts_max_chars: int = DEFAULT_TTS_MAX_CHARS,
    speech_rate_warning_wps: float = DEFAULT_SPEECH_RATE_WARNING_WPS,
    tts_fp32_fallback: bool = True,
    scene_gap_ms: float = DEFAULT_SCENE_GAP_MS,
    sentence_pause_ms: float = DEFAULT_SENTENCE_PAUSE_MS,
) -> dict:
    """Compatibility wrapper over the granular voice/timing operations."""
    root = Path(package_root).resolve()
    production = validate_package(root)

    # Root-cause guard: the aligner dependency is checked before any TTS work,
    # so a missing faster-whisper never costs a full voice generation pass.
    require_word_aligner_installed()

    durations = generate_scene_voices(
        root,
        production,
        None,
        tts_root=tts_root,
        tts_python=tts_python,
        voice=voice,
        mode=mode,
        vieneu_url=vieneu_url,
        backend=tts_backend,
        precision=tts_precision,
        frame_cap=tts_frame_cap,
        max_chars=tts_max_chars,
        speech_rate_warning_wps=speech_rate_warning_wps,
        fp32_fallback_on_rate_warning=tts_fp32_fallback,
    )
    concatenate_scene_voices(root, production, scene_gap_ms=scene_gap_ms)

    print(
        f"Đang đo căn thời gian từng từ với faster-whisper/{align_model}…",
        flush=True,
    )
    aligner = load_word_aligner(align_model, align_device, align_compute_type)
    def recover_mismatch(scene, _path, active_aligner, _error):
        scene_id = scene["id"]
        if not bool(getattr(_error, "coverage_gap", False)):
            return None
        if not tts_scene_frame_cap_retry_eligible(
            root,
            scene_id,
            selected_mode=mode,
            allow_fp32_fallback=tts_fp32_fallback,
        ):
            return None
        return recover_scene_alignment_with_adaptive_frame_cap(
            root,
            production,
            scene_id,
            active_aligner,
            tts_root=tts_root,
            tts_python=tts_python,
            voice=voice,
            max_chars=tts_max_chars,
            selected_mode=mode,
            allow_fp32_fallback=tts_fp32_fallback,
        )

    timing = align_scene_timings(
        production,
        durations,
        aligner,
        scene_voice_files(root, production),
        mismatch_recovery=recover_mismatch,
        scene_gap_ms=scene_gap_ms,
        sentence_pause_ms=sentence_pause_ms,
    )
    concatenate_scene_voices(
        root,
        production,
        scene_gap_ms=scene_gap_ms,
        sentence_pause_ms=sentence_pause_ms,
        timing=timing,
    )
    return build_and_write_timing(root, timing)

def import_package(archive_path: Path, jobs_dir: Path, name: str | None = None) -> Path:
    """Safely import one RENDER_READY video package and return its job directory."""
    archive_path = Path(archive_path).expanduser().resolve()
    jobs_dir = Path(jobs_dir).expanduser().resolve()
    if not archive_path.is_file():
        raise PipelineError(f"ZIP file does not exist: {archive_path}")
    jobs_dir.parent.mkdir(parents=True, exist_ok=True)
    jobs_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".zodiac-import-", dir=jobs_dir.parent) as scratch:
        extracted = Path(scratch) / "extracted"
        safe_extract_zip(archive_path, extracted)
        package_root = _package_root(extracted)
        _validate_import_boundary(package_root)
        validate_package(package_root)
        requested = name or (package_root.name if package_root != extracted else archive_path.stem)
        slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", requested.strip()).strip("-.").lower()
        if not slug or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,69}", slug):
            raise PipelineError("job name must reduce to a 1–70 character slug.")
        destination = jobs_dir / slug
        if destination.exists():
            raise PipelineError(f"job already exists: {destination} (choose another name with --name).")
        shutil.move(str(package_root), destination)
    return destination


def attach_runtime(package_root: Path, voice_path: Path, timing_path: Path) -> None:
    root = Path(package_root).resolve()
    voice_path = Path(voice_path).expanduser().resolve()
    timing_path = Path(timing_path).expanduser().resolve()
    validate_package(root)
    validate_voice(voice_path)
    timing = _load_json(timing_path, "timing.json")
    validate_timing(root, timing)
    runtime_dir = root / ".runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(voice_path, root / "voice.wav")
    (runtime_dir / "timing.json").write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_runtime(package_root: Path) -> tuple[dict, dict]:
    root = Path(package_root).resolve()
    production = validate_package(root)
    validate_voice(root / "voice.wav")
    timing = validate_timing(root, root / ".runtime" / "timing.json")
    validate_background_music(root)
    return production, timing


_PROCESS_OBSERVER = contextvars.ContextVar("zodiac_process_observer", default=None)


@contextlib.contextmanager
def observe_subprocesses(observer):
    """Expose the currently running child process to the Studio worker."""
    token = _PROCESS_OBSERVER.set(observer)
    try:
        yield
    finally:
        _PROCESS_OBSERVER.reset(token)


def _process_group_kwargs() -> dict:
    if os.name == "nt":
        flag = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        return {"creationflags": flag} if flag else {}
    return {"start_new_session": True}


def run_managed_subprocess(
    arguments: list[str],
    *,
    cwd: Path | str | None = None,
    check: bool = False,
    capture_output: bool = False,
    text: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    """Run one cancellable child in its own process group."""
    if any(not isinstance(arg, str) or "\x00" in arg for arg in arguments):
        raise PipelineError("subprocess arguments must be NUL-free strings.")

    popen_kwargs = _process_group_kwargs()
    if capture_output:
        popen_kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    process = subprocess.Popen(
        arguments,
        cwd=cwd,
        shell=False,
        text=text,
        env=env,
        **popen_kwargs,
    )
    observer = _PROCESS_OBSERVER.get()
    if observer is not None:
        observer(process)
    try:
        stdout, stderr = process.communicate()
    finally:
        if observer is not None:
            observer(None)

    result = subprocess.CompletedProcess(
        arguments,
        process.returncode,
        stdout,
        stderr,
    )
    if check and process.returncode:
        raise subprocess.CalledProcessError(
            process.returncode,
            arguments,
            output=stdout,
            stderr=stderr,
        )
    return result


def _npm_executable() -> str:
    raw = shutil.which("npm.cmd" if os.name == "nt" else "npm") or shutil.which("npm")
    if not raw:
        raise PipelineError("npm is required but was not found on PATH.")
    return str(Path(raw).resolve())


def _run_npm(args: list[str], cwd: Path, *, env: dict[str, str] | None = None) -> None:
    if any(not isinstance(arg, str) or "\x00" in arg for arg in args):
        raise PipelineError("npm arguments must be NUL-free strings.")
    run_managed_subprocess(
        [_npm_executable(), *args],
        cwd=cwd,
        check=True,
        env=env,
    )


def _install_renderer(renderer: Path, *, immutable_source: bool = False) -> None:
    try:
        _run_npm(["install", "--no-audit", "--no-fund"], renderer)
    except subprocess.CalledProcessError:
        package_path = renderer / "package.json"
        package = _load_json(package_path, "renderer/package.json")
        dev_dependencies = package.get("devDependencies", {})
        if dev_dependencies.get("typescript") != "5.8.0":
            raise
        probe = run_managed_subprocess(
            [_npm_executable(), "view", "typescript@5.8", "version", "--json"],
            cwd=renderer,
            capture_output=True,
            text=True,
        )
        try:
            versions = json.loads(probe.stdout) if probe.returncode == 0 else []
        except json.JSONDecodeError:
            versions = []
        if isinstance(versions, str):
            versions = [versions]
        fallback = next((version for version in reversed(versions) if version in SUPPORTED_TYPESCRIPT_VERSIONS), "")
        if fallback not in SUPPORTED_TYPESCRIPT_VERSIONS or fallback == "5.8.0":
            raise
        if immutable_source:
            print(f"typescript@5.8.0 unavailable; installing {fallback} without mutating shared runtime source.", flush=True)
            _run_npm(["install", "--no-audit", "--no-fund", "--no-save", f"typescript@{fallback}"], renderer)
        else:
            dev_dependencies["typescript"] = fallback
            package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
            print(f"typescript@5.8.0 unavailable; using available {fallback}.", flush=True)
            _run_npm(["install", "--no-audit", "--no-fund"], renderer)


def _patch_renderer_typescript_compatibility(renderer: Path) -> None:
    """Keep the shipped JSON cast valid on current TypeScript versions."""
    for relative in (
        "src/Root.tsx",
        "src/ZodiacComposition.tsx",
        "src/ZodiacCover.tsx",
    ):
        path = renderer / relative
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            raise PipelineError(f"cannot read renderer/{relative}: {exc}") from exc
        patched = source.replace("as Production", "as unknown as Production")
        if patched != source:
            path.write_text(patched, encoding="utf-8")


def _patch_renderer_font_readiness(renderer: Path) -> None:
    """Prevent measured caption layout from running before the local font loads."""
    path = renderer / "src" / "ZodiacComposition.tsx"
    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read renderer/src/ZodiacComposition.tsx: {exc}") from exc

    if (
        "const [fontReady, setFontReady] = useState(false);" in source
        and "await document.fonts.ready;" in source
        and "if (!fontReady)" in source
    ):
        return

    old_hook = '''const useVietnameseFont = () => {
  const [handle] = useState(() => delayRender("Load local Be Vietnam Pro font"));
  useEffect(() => {
    document.fonts.load(`500 ${production.caption_style.font_size_px}px "Be Vietnam Pro"`, fontText)
      .then((faces) => {
        if (!faces.length || !document.fonts.check(`500 ${production.caption_style.font_size_px}px "Be Vietnam Pro"`, fontText)) throw new Error("Required Vietnamese font face is unavailable.");
        continueRender(handle);
      })
      .catch((error) => cancelRender(new Error("Vietnamese font failed to load: " + String(error))));
  }, [handle]);
};
'''
    new_hook = '''const useVietnameseFont = () => {
  const [handle] = useState(() => delayRender("Load local Be Vietnam Pro font"));
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const descriptor = `500 ${production.caption_style.font_size_px}px "Be Vietnam Pro"`;
        const faces = await document.fonts.load(descriptor, fontText);
        await document.fonts.ready;
        if (!faces.length || !document.fonts.check(descriptor, fontText)) {
          throw new Error("Required Vietnamese font face is unavailable.");
        }
        if (cancelled) return;
        setFontReady(true);
        requestAnimationFrame(() => continueRender(handle));
      } catch (error) {
        if (!cancelled) {
          cancelRender(new Error("Vietnamese font failed to load: " + String(error)));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [handle]);
  return fontReady;
};
'''
    old_entry = '''export const ZodiacComposition: React.FC<RuntimeTiming> = (timing) => {
  useVietnameseFont();
  const sceneTiming = new Map(timing.scenes.map((item) => [item.scene_id, item]));
'''
    new_entry = '''export const ZodiacComposition: React.FC<RuntimeTiming> = (timing) => {
  const fontReady = useVietnameseFont();
  if (!fontReady) {
    return <AbsoluteFill style={{backgroundColor: production.visual_system.palette.paper}} />;
  }
  const sceneTiming = new Map(timing.scenes.map((item) => [item.scene_id, item]));
'''

    if old_hook not in source or old_entry not in source:
        raise PipelineError(
            "renderer font readiness contract is stale but cannot be auto-repaired safely."
        )
    patched = source.replace(old_hook, new_hook).replace(old_entry, new_entry)
    path.write_text(patched, encoding="utf-8")


def _validate_music_volume(volume: float) -> float:
    if (
        not isinstance(volume, (int, float))
        or isinstance(volume, bool)
        or not math.isfinite(volume)
        or not 0 <= float(volume) <= 1
    ):
        raise PipelineError("background music volume must be between 0 and 1.")
    return float(volume)


def _validate_music_file(music: Path) -> Path:
    path = Path(music).expanduser().resolve()
    if not path.is_file():
        raise PipelineError(f"background music file does not exist: {path}")
    if path.suffix.lower() not in SUPPORTED_MUSIC_EXTENSIONS:
        raise PipelineError(
            f"unsupported background music format: {path.suffix.lower()}"
        )
    return path


def _audio_config_path(root: Path) -> Path:
    return root / ".runtime" / "audio.json"


def validate_background_music(package_root: Path) -> dict | None:
    root = Path(package_root).resolve()
    config_path = _audio_config_path(root)
    if not config_path.is_file():
        return None

    config = _load_json(config_path, "audio.json")
    raw = config.get("background_music")
    volume = _validate_music_volume(config.get("background_music_volume"))
    if not isinstance(raw, str) or not raw.startswith("media/"):
        raise PipelineError(
            "background music must resolve under package media/."
        )

    path = (root / raw).resolve()
    media_root = (root / "media").resolve()
    if not path.is_relative_to(media_root) or not path.is_file():
        raise PipelineError(
            f"configured background music is missing: {raw}"
        )
    return {
        **config,
        "background_music_volume": volume,
        "_path": path,
    }


def configure_background_music(
    package_root: Path,
    music: Path | None,
    volume: float = DEFAULT_MUSIC_VOLUME,
) -> None:
    root = Path(package_root).resolve()
    volume = _validate_music_volume(volume)
    config_path = _audio_config_path(root)
    config_path.parent.mkdir(parents=True, exist_ok=True)

    media_dir = root / "media"
    media_dir.mkdir(parents=True, exist_ok=True)

    if music is None:
        config_path.unlink(missing_ok=True)
        for old in media_dir.glob("background-music.*"):
            old.unlink(missing_ok=True)
        print("Background music: disabled.", flush=True)
        return

    source = _validate_music_file(music)
    destination = media_dir / f"background-music{source.suffix.lower()}"
    for old in media_dir.glob("background-music.*"):
        if old.resolve() != destination.resolve():
            old.unlink(missing_ok=True)

    if source.resolve() != destination.resolve():
        shutil.copy2(source, destination)

    config = {
        "background_music": f"media/{destination.name}",
        "background_music_volume": volume,
    }
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    validate_background_music(root)
    print(
        f"Background music: {source.name} @ {volume:.0%}.",
        flush=True,
    )


def _trusted_executable(name: str) -> str:
    raw = shutil.which(name)
    if not raw:
        raise PipelineError(
            f"{name} is required but was not found on PATH."
        )
    resolved = Path(raw).resolve()
    if not resolved.is_file():
        raise PipelineError(
            f"resolved executable is not a file: {resolved}"
        )
    return str(resolved)


def _run_ffmpeg(arguments: list[str]) -> None:
    ffmpeg = _trusted_executable("ffmpeg")
    safe_arguments = []
    for argument in arguments:
        if not isinstance(argument, str) or "\x00" in argument:
            raise PipelineError("FFmpeg arguments must be NUL-free strings.")
        safe_arguments.append(argument)

    # Security: the executable is resolved from PATH to an absolute file,
    # every user-selected path remains a separate argv element, and no shell
    # parses the values. shlex.escape() is intentionally unnecessary here.
    try:
        run_managed_subprocess(
            [ffmpeg, *safe_arguments],
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise PipelineError(f"FFmpeg failed: {exc}") from exc


def build_audio_preview(
    package_root: Path,
    music: Path,
    volume: float = AUDIO_PREVIEW_DEFAULT_VOLUME,
    seconds: float = AUDIO_PREVIEW_SECONDS,
) -> Path:
    root = Path(package_root).resolve()
    voice = root / "voice.wav"
    has_voice = voice.is_file()
    if has_voice:
        validate_voice(voice)
    source = _validate_music_file(music)
    volume = _validate_music_volume(volume)

    if (
        not isinstance(seconds, (int, float))
        or isinstance(seconds, bool)
        or not math.isfinite(seconds)
        or not 1 <= float(seconds) <= 30
    ):
        raise PipelineError(
            "audio preview duration must be between 1 and 30 seconds."
        )

    output = root / ".runtime" / "audio-preview.wav"
    output.parent.mkdir(parents=True, exist_ok=True)
    duration = float(seconds)

    if has_voice:
        filter_complex = (
            f"[0:a]apad=pad_dur={duration:.3f},"
            f"atrim=0:{duration:.3f},asetpts=PTS-STARTPTS[voice];"
            f"[1:a]atrim=0:{duration:.3f},"
            f"asetpts=PTS-STARTPTS,volume={volume:.3f}[music];"
            f"[voice][music]amix=inputs=2:duration=longest:"
            f"dropout_transition=0,atrim=0:{duration:.3f},"
            f"alimiter=limit=0.95[out]"
        )
        inputs = ["-i", str(voice), "-stream_loop", "-1", "-i", str(source)]
        mix_note = f"{output.name}: voice + nhac @ {volume:.0%}"
    else:
        # Auditioning the track before any voice exists is normal; do not force a render first.
        filter_complex = (
            f"[0:a]atrim=0:{duration:.3f},"
            f"asetpts=PTS-STARTPTS,volume={volume:.3f},"
            f"alimiter=limit=0.95[out]"
        )
        inputs = ["-stream_loop", "-1", "-i", str(source)]
        mix_note = f"{output.name}: chi nhac @ {volume:.0%} (chua co voice.wav)"

    _run_ffmpeg(
        [
            "-y",
            "-v",
            "error",
            *inputs,
            "-filter_complex",
            filter_complex,
            "-map",
            "[out]",
            "-t",
            f"{duration:.3f}",
            "-c:a",
            "pcm_s16le",
            str(output),
        ]
    )

    if not output.is_file():
        raise PipelineError(
            "FFmpeg finished without creating audio-preview.wav."
        )

    print(f"Audio preview: {output} ({mix_note}, {duration:.1f}s).", flush=True)
    return output


def validate_publish_outputs(
    package_root: Path,
    *,
    final_video: Path | None = None,
) -> dict[str, Path]:
    root = Path(package_root).resolve()
    out = root / "out"
    video = Path(final_video).resolve() if final_video else out / "zodiac-story.mp4"
    required = {
        "video": video,
        "cover": out / "cover.png",
        "copy": out / "publish-copy.txt",
        "metadata": out / "publish.json",
    }
    for label, path in required.items():
        if not path.is_file():
            raise PipelineError(f"publish output is missing {label}: {path}")
    try:
        json.loads(required["metadata"].read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PipelineError(f"out/publish.json is invalid: {exc}") from exc
    return required


def write_local_final_validation(
    package_root: Path,
    *,
    final_video: Path | None = None,
) -> Path:
    """Write the runtime-owned final receipt for a completed zodiac-job@4 run."""
    root = Path(package_root).resolve()
    manifest = _load_package_manifest(root)
    if manifest is None or manifest.get("format") != PACKAGE_FORMAT_V4:
        raise PipelineError("LOCAL_FINAL_VALIDATION_UNSUPPORTED: only zodiac-job@4 uses the local final receipt.")

    production, _timing = validate_runtime(root)
    outputs = validate_publish_outputs(root, final_video=final_video)
    runtime_ref = manifest["runtime"]
    runtime_manifest = _load_json(
        _bundled_runtime_root(runtime_ref) / "runtime-manifest.json",
        "runtime-manifest.json",
    )
    receipt = {
        "status": "PASS",
        "production_sha256": file_sha256(root / "production.json"),
        "runtime": {
            "id": runtime_ref["id"],
            "version": runtime_ref["version"],
            "sha256": runtime_manifest["sha256"],
        },
        "package_validation": "PASS",
        "asset_lineage": "PASS",
        "semantic_animation": "PASS",
        "voice": "PASS",
        "measured_timing": "PASS",
        "visual_progression_measured": "PASS",
        "renderer_contract": "PASS",
        "video": "PASS" if outputs["video"].is_file() else "FAIL",
        "cover": "PASS" if outputs["cover"].is_file() else "FAIL",
    }
    path = root / "out" / "FINAL_VALIDATION.json"
    path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def _pristine_render_path(package_root: Path) -> Path:
    root = Path(package_root).resolve()
    return root / ".runtime" / "pristine" / "zodiac-story.mp4"


def _cache_pristine_render(package_root: Path) -> Path:
    root = Path(package_root).resolve()
    output = root / "out" / "zodiac-story.mp4"
    if not output.is_file():
        raise PipelineError(f"Remotion output is missing: {output}")
    pristine = _pristine_render_path(root)
    pristine.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output, pristine)
    (root / "out" / "zodiac-story.with-music.mp4").unlink(missing_ok=True)
    return pristine


def finalize_publish_outputs(
    package_root: Path,
    *,
    final_video: Path | None = None,
) -> dict[str, Path]:
    """Validate final outputs and write the local receipt without creating a ZIP."""
    root = Path(package_root).resolve()
    fingerprint = artifact_fingerprints(root)["final"]
    with measure_performance_stage(
        root,
        "publish.finalize",
        input_fingerprint=fingerprint,
    ):
        outputs = validate_publish_outputs(
            root,
            final_video=final_video,
        )
        manifest = _load_package_manifest(root)
        if manifest is not None and manifest.get("format") == PACKAGE_FORMAT_V4:
            write_local_final_validation(
                root,
                final_video=outputs["video"],
            )
        (root / "out" / "zodiac-publish-bundle.zip").unlink(missing_ok=True)
        (root / "out" / "zodiac-story.with-music.mp4").unlink(missing_ok=True)
    print(f"Final outputs ready in {root / 'out'}.", flush=True)
    return outputs


def _playback_adjusted_render(
    package_root: Path,
    *,
    playback_rate: float,
) -> Path:
    root = Path(package_root).resolve()
    try:
        playback_rate = float(playback_rate)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("playback rate must be a finite number.") from None
    if not math.isfinite(playback_rate) or not 0.5 <= playback_rate <= 1.5:
        raise PipelineError("playback rate must be between 0.5 and 1.5.")

    pristine = _pristine_render_path(root)
    if not pristine.is_file():
        output = root / "out" / "zodiac-story.mp4"
        if not output.is_file():
            raise PipelineError(f"Remotion output is missing: {output}")
        pristine.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(output, pristine)

    if math.isclose(playback_rate, 1.0, rel_tol=0.0, abs_tol=1e-9):
        return pristine

    adjusted = root / ".runtime" / "zodiac-story.playback.mp4"
    tmp = root / ".runtime" / "zodiac-story.playback.tmp.mp4"
    tmp.unlink(missing_ok=True)
    fingerprint = _fingerprint_value(
        {
            "pristine_sha256": file_sha256(pristine),
            "playback_rate": playback_rate,
        }
    )
    cache = root / ".runtime" / "playback-rate.json"
    try:
        cached = _load_json(cache, "playback-rate.json")
    except PipelineError:
        cached = {}
    if adjusted.is_file() and cached.get("fingerprint") == fingerprint:
        return adjusted

    _run_ffmpeg(
        [
            "-y",
            "-v",
            "error",
            "-i",
            str(pristine),
            "-filter_complex",
            f"[0:v]setpts=PTS/{playback_rate:.6f}[v];"
            f"[0:a]atempo={playback_rate:.6f}[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(tmp),
        ]
    )
    if not tmp.is_file():
        raise PipelineError("playback-rate transform did not create an MP4.")
    os.replace(tmp, adjusted)
    cache.write_text(
        json.dumps(
            {
                "version": 1,
                "playback_rate": playback_rate,
                "fingerprint": fingerprint,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return adjusted


def mix_background_music_into_render(
    package_root: Path,
    *,
    playback_rate: float = 1.0,
) -> Path:
    """Apply global playback speed, then mix normal-speed background music."""
    root = Path(package_root).resolve()
    config = validate_background_music(root)
    output = root / "out" / "zodiac-story.mp4"
    pristine = _pristine_render_path(root)
    if not pristine.is_file() and not output.is_file():
        raise PipelineError(f"Remotion output is missing: {output}")
    base_video = _playback_adjusted_render(
        root,
        playback_rate=playback_rate,
    )

    fingerprint = _fingerprint_value(
        {
            "mix": artifact_fingerprints(root)["mix"],
            "playback_rate": float(playback_rate),
        }
    )

    if config is None:
        with measure_performance_stage(
            root,
            "audio.mix",
            input_fingerprint=fingerprint,
            cache_hit=True,
        ):
            shutil.copy2(base_video, output)
            (root / "out" / "zodiac-story.with-music.mp4").unlink(missing_ok=True)
        print(
            f"Final audio: voice/SFX only at playback {float(playback_rate):.2f}x.",
            flush=True,
        )
        return output

    volume = config["background_music_volume"]
    music = config["_path"]
    filter_complex = (
        f"[1:a]volume={volume:.3f}[music];"
        "[0:a][music]amix=inputs=2:duration=first:normalize=0:"
        "dropout_transition=0,alimiter=limit=0.95[out]"
    )
    mixed_tmp = root / ".runtime" / "zodiac-story.mix.tmp.mp4"
    mixed_tmp.parent.mkdir(parents=True, exist_ok=True)
    mixed_tmp.unlink(missing_ok=True)

    with measure_performance_stage(
        root,
        "audio.mix",
        input_fingerprint=fingerprint,
    ):
        _run_ffmpeg(
            [
                "-y",
                "-v",
                "error",
                "-i",
                str(base_video),
                "-stream_loop",
                "-1",
                "-i",
                str(music),
                "-filter_complex",
                filter_complex,
                "-map",
                "0:v:0",
                "-map",
                "[out]",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-shortest",
                str(mixed_tmp),
            ]
        )
        if not mixed_tmp.is_file():
            raise PipelineError(
                "background-music post-mix did not create the final MP4."
            )
        os.replace(mixed_tmp, output)
        (root / "out" / "zodiac-story.with-music.mp4").unlink(missing_ok=True)

    print(
        f"Final audio: mixed {music.name} @ {volume:.0%} into {output.name}.",
        flush=True,
    )
    return output


def prepare_renderer(
    package_root: Path,
    *,
    music: Path | None = None,
    music_volume: float = DEFAULT_MUSIC_VOLUME,
    update_music: bool = False,
) -> None:
    """Validate one package, reuse safe prepare work, then gate the renderer."""
    root = Path(package_root).resolve()
    if update_music:
        configure_background_music(root, music, music_volume)

    # This validates the compiled style token before any package-owned Node code
    # can run. A stale design/production pair must fail closed, not self-repair
    # by executing an untrusted compile script first.
    validate_runtime(root)
    package_manifest = _load_package_manifest(root)
    shared_runtime = package_manifest is not None
    renderer = resolve_renderer_root(root, materialize=True)
    if shutil.which("node") is None or (
        shutil.which("npm") is None and shutil.which("npm.cmd") is None
    ):
        raise PipelineError(
            "Node.js và npm là bắt buộc. "
            "Hãy cài Node.js LTS mới nhất rồi thử lại."
        )

    dependency_fingerprint = renderer_dependency_fingerprint(root)
    dependencies_installed = _renderer_dependencies_installed(renderer)
    dependencies_cached = (
        dependencies_installed
        and (
            shared_runtime
            or _prepare_stage_cached(root, "dependencies", dependency_fingerprint)
        )
    )
    lock_exists = (renderer / "package-lock.json").is_file()
    bootstrap_safe = dependencies_installed and (shared_runtime or not lock_exists)
    dependency_reused = dependencies_cached or bootstrap_safe

    with measure_performance_stage(
        root,
        "renderer.dependencies",
        input_fingerprint=dependency_fingerprint,
        cache_hit=dependency_reused,
    ):
        if dependency_reused:
            if not dependencies_cached:
                _mark_prepare_stage_cached(
                    root,
                    "dependencies",
                    dependency_fingerprint,
                )
        else:
            print("Đang cài các dependency Remotion v2 đã ghim…", flush=True)
            _install_renderer(renderer, immutable_source=shared_runtime)
            if not _renderer_dependencies_installed(renderer):
                raise PipelineError(
                    "renderer dependencies were installed but pinned package versions "
                    "could not be verified."
                )
            dependency_fingerprint = renderer_dependency_fingerprint(root)
            _mark_prepare_stage_cached(
                root,
                "dependencies",
                dependency_fingerprint,
            )

    style_fingerprint = style_compile_fingerprint(root)
    style_current = _style_compilation_current(root)
    if not style_current:
        raise PipelineError(
            "compiled style token is stale after package validation; "
            "re-export the package from the canonical plugin."
        )
    with measure_performance_stage(
        root,
        "renderer.compile_style",
        input_fingerprint=style_fingerprint,
        cache_hit=True,
    ):
        # The package validator above already proves the compiled style token
        # matches design.md. Re-running compile:style on every retry is redundant.
        _mark_prepare_stage_cached(
            root,
            "compile_style",
            style_fingerprint,
        )

    validate_package(root)
    validate_publish_contract(root)

    # Backward compatibility only. New plugin exports should already contain
    # these fixes, but old imported jobs can be repaired before typecheck.
    if not shared_runtime:
        _patch_renderer_typescript_compatibility(renderer)
        _patch_renderer_font_readiness(renderer)

    check_fingerprint = renderer_check_fingerprint(root)
    checks_cached = renderer_checks_cached(root, check_fingerprint)
    if checks_cached:
        print(
            "Renderer tests/typecheck: dùng lại kết quả PASS cùng fingerprint.",
            flush=True,
        )
        with measure_performance_stage(
            root,
            "renderer.contract_tests",
            input_fingerprint=check_fingerprint,
            cache_hit=True,
        ):
            pass
        with measure_performance_stage(
            root,
            "renderer.typecheck",
            input_fingerprint=check_fingerprint,
            cache_hit=True,
        ):
            pass
    else:
        print("Đang chạy kiểm thử hợp đồng renderer…", flush=True)
        with measure_performance_stage(
            root,
            "renderer.contract_tests",
            input_fingerprint=check_fingerprint,
        ):
            if shared_runtime:
                _run_npm(["run", "test"], renderer, env=_renderer_environment(root))
            else:
                _run_npm(["run", "test"], renderer)

        print("Đang kiểm tra TypeScript của renderer…", flush=True)
        with measure_performance_stage(
            root,
            "renderer.typecheck",
            input_fingerprint=check_fingerprint,
        ):
            if shared_runtime:
                _run_npm(["run", "typecheck"], renderer, env=_renderer_environment(root))
            else:
                _run_npm(["run", "typecheck"], renderer)

        # Mark only after BOTH contract tests and TypeScript have passed.
        mark_renderer_checks_cached(root, check_fingerprint)


def render_video(package_root: Path) -> None:
    """Render canonical video + cover + publish metadata for the package."""
    root = Path(package_root).resolve()
    validate_runtime(root)
    validate_publish_contract(root)
    fingerprint = artifact_fingerprints(root)["video"]
    with measure_performance_stage(
        root,
        "renderer.render",
        input_fingerprint=fingerprint,
    ):
        renderer = resolve_renderer_root(root, materialize=True)
        if _load_package_manifest(root) is not None:
            _run_npm(["run", "render"], renderer, env=_renderer_environment(root))
        else:
            _run_npm(["run", "render"], renderer)
    validate_publish_outputs(root)
    _cache_pristine_render(root)


def run_renderer(
    package_root: Path,
    action: str,
    music: Path | None = None,
    music_volume: float = DEFAULT_MUSIC_VOLUME,
    update_music: bool = False,
) -> None:
    root = Path(package_root).resolve()
    prepare_renderer(root, music=music, music_volume=music_volume, update_music=update_music)

    if action == "preview":
        config = validate_background_music(root)
        if config:
            print(
                "Remotion Studio xem trước voice/SFX. "
                "Dùng 'Nghe thử' để nghe bản trộn nhạc nền đã chọn "
                f"({config['background_music_volume']:.0%}).",
                flush=True,
            )
        renderer = resolve_renderer_root(root, materialize=True)
        if _load_package_manifest(root) is not None:
            _run_npm(["run", "studio"], renderer, env=_renderer_environment(root))
        else:
            _run_npm(["run", "studio"], renderer)
    else:
        render_video(root)
        final_video = mix_background_music_into_render(root)
        finalize_publish_outputs(
            root,
            final_video=final_video,
        )


def _choose(prompt: str, values: list[Path]) -> Path:
    if not values:
        raise PipelineError(f"no choices available for {prompt}.")
    print(prompt)
    for index, value in enumerate(values, 1):
        print(f"  {index}. {value}")
    while True:
        answer = input("Choose number (q to quit): ").strip().lower()
        if answer == "q":
            raise PipelineError("cancelled.")
        if answer.isdigit() and 1 <= int(answer) <= len(values):
            return values[int(answer) - 1]
        print("Please choose one of the listed numbers.")


def run_tui(args: argparse.Namespace, workspace: Path) -> None:
    """Small dependency-free terminal menu for the complete local flow."""
    jobs_dir = workspace / "jobs"
    if args.archive:
        archive = Path(args.archive).expanduser().resolve()
        requested = args.name or archive.stem.replace("-render-ready", "")
        target = jobs_dir / re.sub(r"[^a-zA-Z0-9._-]+", "-", requested).strip("-.").lower()
        if not target.exists():
            target = import_package(archive, jobs_dir, args.name)
        job = target
    else:
        jobs = sorted(path for path in jobs_dir.glob("*") if path.is_dir())
        archives = sorted(Path("ready").glob("*.zip"))
        if jobs:
            job = _choose("Existing jobs:", jobs)
        else:
            job = import_package(_choose("Ready packages:", archives), jobs_dir, args.name)

    print(f"\nZodiac local TUI\nJob: {job.name}\n")
    while True:
        print("1. Generate VieNeu voice + timing")
        print("2. Generate voice + render MP4")
        print("3. Preview in Remotion Studio")
        print("4. Render MP4")
        print("5. Check package/runtime")
        print("q. Quit")
        choice = input("Action: ").strip().lower()
        if choice == "q":
            return
        if choice == "1":
            synthesize_voice(
                job,
                args.tts_root,
                args.tts_python,
                args.voice,
                args.tts_mode,
                args.vieneu_url,
                args.align_model,
                args.align_device,
                args.align_compute_type,
                args.tts_backend,
                args.tts_precision,
                args.tts_frame_cap,
                args.tts_max_chars,
                args.speech_rate_warning_wps,
                args.tts_fp32_fallback,
            )
            print("Voice and timing ready.")
        elif choice == "2":
            synthesize_voice(
                job,
                args.tts_root,
                args.tts_python,
                args.voice,
                args.tts_mode,
                args.vieneu_url,
                args.align_model,
                args.align_device,
                args.align_compute_type,
                args.tts_backend,
                args.tts_precision,
                args.tts_frame_cap,
                args.tts_max_chars,
                args.speech_rate_warning_wps,
                args.tts_fp32_fallback,
            )
            run_renderer(job, "render")
        elif choice == "3":
            run_renderer(job, "preview")
        elif choice == "4":
            run_renderer(job, "render")
        elif choice == "5":
            validate_package(job)
            validate_runtime(job)
            print("Package and local runtime: valid")
        else:
            print("Unknown action.")


def _job_path(value: str, workspace: Path) -> Path:
    candidate = Path(value).expanduser()
    if candidate.is_absolute() or candidate.exists():
        return candidate.resolve()
    return (workspace / "jobs" / candidate).resolve()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import and render Zodiac Video Pipeline packages locally.")
    parser.add_argument("--workspace", type=Path, default=Path(".zodiac-work"), help="local job workspace (default: .zodiac-work)")
    commands = parser.add_subparsers(dest="command", required=True)
    importer = commands.add_parser("import", help="safely extract and validate a RENDER_READY ZIP")
    importer.add_argument("archive", type=Path)
    importer.add_argument("--name", help="optional local job name")
    attach = commands.add_parser("attach", help="attach a recorded voice WAV and measured timing JSON")
    attach.add_argument("job")
    attach.add_argument("--voice", required=True, type=Path)
    attach.add_argument("--timing", required=True, type=Path)
    voice_command = commands.add_parser("voice", help="generate voice.wav and measured timing with VieNeu-TTS")
    voice_command.add_argument("job")
    voice_command.add_argument("--voice", default=DEFAULT_TTS_VOICE)
    voice_command.add_argument("--tts-root", type=Path, default=DEFAULT_TTS_ROOT)
    voice_command.add_argument("--tts-python", type=Path)
    voice_command.add_argument("--tts-mode", default="v3turbo")
    voice_command.add_argument("--vieneu-url", help="reuse an existing VieNeu Gradio server instead of loading another model")
    voice_command.add_argument("--tts-backend", choices=("auto", "onnx", "pytorch"), default=DEFAULT_TTS_BACKEND, help="direct v3 Turbo backend; CPU diagnosis should use onnx")
    voice_command.add_argument("--tts-precision", choices=("fp32", "int8"), default=DEFAULT_TTS_PRECISION, help="direct ONNX precision; fp32 is the safe default")
    voice_command.add_argument("--tts-frame-cap", choices=("on", "off"), default=DEFAULT_TTS_FRAME_CAP, help="direct ONNX diagnostic: disable only to test suspected truncation")
    voice_command.add_argument("--tts-max-chars", type=int, default=DEFAULT_TTS_MAX_CHARS)
    voice_command.add_argument("--speech-rate-warning-wps", type=float, default=DEFAULT_SPEECH_RATE_WARNING_WPS)
    voice_command.add_argument(
        "--no-tts-fp32-fallback",
        action="store_false",
        dest="tts_fp32_fallback",
        help="do not retry fast Gradio scenes with direct ONNX/fp32",
    )
    voice_command.set_defaults(tts_fp32_fallback=True)
    voice_command.add_argument("--align-model", default="small", help="faster-whisper model for measured word timing")
    voice_command.add_argument("--align-device", default="cpu", help="faster-whisper device")
    voice_command.add_argument("--align-compute-type", default="int8", help="faster-whisper compute type")
    inspect = commands.add_parser("check", help="check the creative package and local runtime inputs")
    inspect.add_argument("job")
    audio_preview = commands.add_parser("audio-preview", help="render a short voice + background-music mix for volume checking")
    audio_preview.add_argument("job")
    audio_preview.add_argument("--music", required=True, type=Path)
    audio_preview.add_argument("--music-volume", type=float, default=AUDIO_PREVIEW_DEFAULT_VOLUME, help="background music volume from 0 to 1")
    audio_preview.add_argument("--seconds", type=float, default=AUDIO_PREVIEW_SECONDS, help="preview duration from 1 to 30 seconds")
    for command in ("preview", "render"):
        sub = commands.add_parser(command, help=f"validate and run Remotion {command}")
        sub.add_argument("job")
        music_group = sub.add_mutually_exclusive_group()
        music_group.add_argument("--music", type=Path, help="loop this background track under the narration")
        music_group.add_argument("--no-music", action="store_true", help="remove background music from this render")
        sub.add_argument("--music-volume", type=float, default=DEFAULT_MUSIC_VOLUME, help="background music volume from 0 to 1")
    tui = commands.add_parser("tui", help="interactive local voice and Remotion workflow")
    tui.add_argument("--archive", type=Path, help="ready ZIP to import automatically")
    tui.add_argument("--name", help="local job name when importing")
    tui.add_argument("--voice", default=DEFAULT_TTS_VOICE)
    tui.add_argument("--tts-root", type=Path, default=DEFAULT_TTS_ROOT)
    tui.add_argument("--tts-python", type=Path)
    tui.add_argument("--tts-mode", default="v3turbo")
    tui.add_argument("--vieneu-url", help="reuse an existing VieNeu Gradio server")
    tui.add_argument("--tts-backend", choices=("auto", "onnx", "pytorch"), default=DEFAULT_TTS_BACKEND)
    tui.add_argument("--tts-precision", choices=("fp32", "int8"), default=DEFAULT_TTS_PRECISION)
    tui.add_argument("--tts-frame-cap", choices=("on", "off"), default=DEFAULT_TTS_FRAME_CAP)
    tui.add_argument("--tts-max-chars", type=int, default=DEFAULT_TTS_MAX_CHARS)
    tui.add_argument("--speech-rate-warning-wps", type=float, default=DEFAULT_SPEECH_RATE_WARNING_WPS)
    tui.add_argument(
        "--no-tts-fp32-fallback",
        action="store_false",
        dest="tts_fp32_fallback",
    )
    tui.set_defaults(tts_fp32_fallback=True)
    tui.add_argument("--align-model", default="small")
    tui.add_argument("--align-device", default="cpu")
    tui.add_argument("--align-compute-type", default="int8")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    workspace = args.workspace.expanduser().resolve()
    jobs_dir = workspace / "jobs"
    try:
        if args.command == "import":
            result = import_package(args.archive, jobs_dir, args.name)
            print(f"Imported package: {result}")
            print("Next: generate/attach voice.wav plus measured word-level .runtime/timing.json.")
        elif args.command == "attach":
            root = _job_path(args.job, workspace)
            attach_runtime(root, args.voice, args.timing)
            print(f"Voice and measured timing attached: {root}")
        elif args.command == "voice":
            timing = synthesize_voice(
                _job_path(args.job, workspace),
                args.tts_root,
                args.tts_python,
                args.voice,
                args.tts_mode,
                args.vieneu_url,
                args.align_model,
                args.align_device,
                args.align_compute_type,
                args.tts_backend,
                args.tts_precision,
                args.tts_frame_cap,
                args.tts_max_chars,
                args.speech_rate_warning_wps,
                args.tts_fp32_fallback,
            )
            print(f"Voice and measured timing attached ({timing['total_duration_frames']} frames).")
        elif args.command == "audio-preview":
            result = build_audio_preview(_job_path(args.job, workspace), args.music, args.music_volume, args.seconds)
            print(f"Audio mix preview ready: {result}")
        elif args.command == "check":
            root = _job_path(args.job, workspace)
            validate_package(root)
            print("Creative package: valid")
            try:
                validate_runtime(root)
            except PipelineError as exc:
                print(f"Local voice/timing: not ready ({exc})")
            else:
                print("Local voice/timing: valid")
        elif args.command in {"preview", "render"}:
            music = args.music if args.music else None
            run_renderer(_job_path(args.job, workspace), args.command, music, args.music_volume, bool(args.music or args.no_music))
        elif args.command == "tui":
            run_tui(args, workspace)
    except PipelineError as exc:
        print(f"ZODIAC_LOCAL_ERROR: {exc}", file=sys.stderr)
        return 2
    except subprocess.CalledProcessError as exc:
        return exc.returncode or 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
