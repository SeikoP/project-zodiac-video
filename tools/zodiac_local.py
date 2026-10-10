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


class InvalidAlignmentTimestampError(PipelineError):
    """ASR returned word timing that cannot safely be repaired from neighbors."""


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
MAX_VISUAL_GAP_WORDS = 10
MAX_VISUAL_GAP_SECONDS = 5.0
AUDIO_PREVIEW_SECONDS = 10.0
AUDIO_PREVIEW_DEFAULT_VOLUME = 1.0
DEFAULT_MUSIC_VOLUME = 1.0
DEFAULT_SCENE_GAP_MS = 350.0
DEFAULT_SENTENCE_PAUSE_MS = 320.0
DEFAULT_PLAYBACK_RATE = 1.0
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


def _materialize_exact_runtime_cache(runtime_root: Path, bundled: Path) -> None:
    """Atomically replace a stale shared runtime with the exact bundled reference."""
    runtime_root = Path(runtime_root)
    bundled = Path(bundled)
    runtime_root.parent.mkdir(parents=True, exist_ok=True)

    scratch = runtime_root.with_name(runtime_root.name + f".refresh-{os.getpid()}")
    backup = runtime_root.with_name(runtime_root.name + f".stale-{os.getpid()}")
    shutil.rmtree(scratch, ignore_errors=True)
    shutil.rmtree(backup, ignore_errors=True)
    shutil.copytree(bundled, scratch)

    had_existing = runtime_root.exists()
    try:
        if had_existing:
            os.replace(runtime_root, backup)
        os.replace(scratch, runtime_root)
    except OSError:
        shutil.rmtree(scratch, ignore_errors=True)
        if had_existing and backup.exists() and not runtime_root.exists():
            os.replace(backup, runtime_root)
        raise
    else:
        shutil.rmtree(backup, ignore_errors=True)


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
        _materialize_exact_runtime_cache(runtime_root, bundled)
    try:
        _verify_cached_runtime(runtime_root, runtime_ref)
    except PipelineError as exc:
        if "RUNTIME_HASH_MISMATCH" not in str(exc):
            raise
        _emit_tts_log("RUNTIME_CACHE_REFRESH: cached runtime is stale; rebuilding exact local runtime reference.")
        _materialize_exact_runtime_cache(runtime_root, bundled)
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
    occurrence: int…38717 tokens truncated…ses(observer):
    """Expose the currently running child process to the Studio worker."""
    token = _PROCESS_OBSERVER.set(observer)
    try:
        yield
    finally:
        _PROCESS_OBSERVER.reset(token)


@contextlib.contextmanager
def observe_subprocess_output(observer):
    """Route child stdout/stderr into a caller-owned log sink.

    Textual must never let npm/ffmpeg/pip inherit its terminal because those
    processes can overwrite the alternate-screen UI. Output is captured and
    emitted line-for-line after the child exits, preserving CompletedProcess
    stdout/stderr semantics for callers that explicitly request them.
    """
    token = _PROCESS_LOG_OBSERVER.set(observer)
    try:
        yield
    finally:
        _PROCESS_LOG_OBSERVER.reset(token)


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
    process_observer = _PROCESS_OBSERVER.get()
    log_observer = _PROCESS_LOG_OBSERVER.get()
    should_capture = capture_output or log_observer is not None
    if should_capture:
        popen_kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    process = subprocess.Popen(
        arguments,
        cwd=cwd,
        shell=False,
        text=text,
        env=env,
        **popen_kwargs,
    )
    if process_observer is not None:
        process_observer(process)
    try:
        if log_observer is None:
            stdout, stderr = process.communicate()
        else:
            import threading

            stdout_chunks = []
            stderr_chunks = []
            sentinel = "" if text else b""

            def pump(stream, chunks, channel: str) -> None:
                if stream is None:
                    return
                try:
                    for raw in iter(stream.readline, sentinel):
                        chunks.append(raw)
                        rendered = (
                            raw
                            if isinstance(raw, str)
                            else raw.decode("utf-8", errors="replace")
                        )
                        line = rendered.rstrip("\r\n")
                        if line:
                            log_observer(line, channel=channel)
                finally:
                    stream.close()

            threads = [
                threading.Thread(
                    target=pump,
                    args=(process.stdout, stdout_chunks, "stdout"),
                    daemon=True,
                ),
                threading.Thread(
                    target=pump,
                    args=(process.stderr, stderr_chunks, "stderr"),
                    daemon=True,
                ),
            ]
            for thread in threads:
                thread.start()
            process.wait()
            for thread in threads:
                thread.join()
            if text:
                stdout = "".join(stdout_chunks)
                stderr = "".join(stderr_chunks)
            else:
                stdout = b"".join(stdout_chunks)
                stderr = b"".join(stderr_chunks)
    finally:
        if process_observer is not None:
            process_observer(None)

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
            _emit_tts_log(f"typescript@5.8.0 unavailable; installing {fallback} without mutating shared runtime source.")
            _run_npm(["install", "--no-audit", "--no-fund", "--no-save", f"typescript@{fallback}"], renderer)
        else:
            dev_dependencies["typescript"] = fallback
            package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
            _emit_tts_log(f"typescript@5.8.0 unavailable; using available {fallback}.")
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
        _emit_tts_log("Background music: disabled.")
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
    _emit_tts_log(f"Background music: {source.name} @ {volume:.0%}.")


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
        try:
            validate_voice(voice)
        except PipelineError as exc:
            # Preview is an audition tool, not a runtime validation gate. A
            # stale/partial voice.wav must not make the music control unusable.
            has_voice = False
            _emit_tts_log(f"Audio preview warning: bỏ qua voice.wav chưa hợp lệ ({exc}).")
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

    _emit_tts_log(f"Audio preview: {output} ({mix_note}, {duration:.1f}s).")
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
    _emit_tts_log(f"Final outputs ready in {root / 'out'}.")
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
        _emit_tts_log(f"Final audio: voice/SFX only at playback {float(playback_rate):.2f}x.")
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

    _emit_tts_log(f"Final audio: mixed {music.name} @ {volume:.0%} into {output.name}.")
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
            _emit_tts_log("Đang cài các dependency Remotion v2 đã ghim…")
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
        _emit_tts_log("Renderer tests/typecheck: dùng lại kết quả PASS cùng fingerprint.")
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
        _emit_tts_log("Đang chạy kiểm thử hợp đồng renderer…")
        with measure_performance_stage(
            root,
            "renderer.contract_tests",
            input_fingerprint=check_fingerprint,
        ):
            if shared_runtime:
                _run_npm(["run", "test"], renderer, env=_renderer_environment(root))
            else:
                _run_npm(["run", "test"], renderer)

        _emit_tts_log("Đang kiểm tra TypeScript của renderer…")
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
            _emit_tts_log("Remotion Studio xem trước voice/SFX. "
                "Dùng 'Nghe thử' để nghe bản trộn nhạc nền đã chọn "
                f"({config['background_music_volume']:.0%}).")
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
