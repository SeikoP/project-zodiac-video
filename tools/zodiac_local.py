#!/usr/bin/env python3
"""Import and run RENDER_READY exports from zodiac-video-pipeline."""

from __future__ import annotations

import argparse
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
EXPECTED_DEPENDENCIES = {
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
EXPECTED_DEV_DEPENDENCIES = {
    "@types/node": "24.0.0",
    "@types/react": "19.0.0",
    "typescript": "5.8.0",
}
EXPECTED_SCRIPTS = {
    "prepare:runtime": "node scripts/render.mjs --prepare-only",
    "studio": "npm run prepare:runtime && remotion studio src/index.ts --props=../.runtime/render-props.json",
    "render": "node scripts/render.mjs",
    "test": "node --test tests/*.test.mjs",
    "typecheck": "tsc --noEmit",
    "compile:style": "node scripts/compile-style-token.mjs",
}
SUPPORTED_TYPESCRIPT_VERSIONS = {"5.8.0", "5.8.2"}
DEFAULT_TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
DEFAULT_TTS_VOICE = "Hải Đăng"
DEFAULT_TTS_BACKEND = "onnx"
DEFAULT_TTS_PRECISION = "fp32"
DEFAULT_TTS_FRAME_CAP = "on"
DEFAULT_TTS_MAX_CHARS = 256
DEFAULT_SPEECH_RATE_WARNING_WPS = 3.8
ASR_SCENE_BOUNDARY_TOLERANCE_MS = 250.0
AUDIO_PREVIEW_SECONDS = 10.0
AUDIO_PREVIEW_DEFAULT_VOLUME = 1.0
DEFAULT_MUSIC_VOLUME = 1.0
SUPPORTED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}


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
    for element in tree.iter():
        tag = element.tag.split("}")[-1].lower()
        if tag in {"script", "foreignobject", "image"}:
            raise PipelineError(f"unsupported active or raster SVG element <{tag}> in {raw}.")
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


def validate_package(package_root: Path) -> dict:
    """Validate one Zodiac Video Pipeline v2.0 creative package."""
    root = Path(package_root).resolve()
    return validate_production_document(
        root,
        _load_json(root / "production.json", "production.json"),
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
    compiled = visual.get("style_token")
    if not isinstance(compiled, dict) or compiled.get("id") != token.get("id"):
        raise PipelineError("production.json style_token must match design.md.")
    if compiled.get("source_hash") != source_hash:
        raise PipelineError("production.json style token is stale; run npm run compile:style in renderer/.")
    if (
        caption_style.get("font_family") != "Be Vietnam Pro"
        or caption_style.get("font_weight") != 500
        or not isinstance(caption_style.get("font_size_px"), int)
        or not isinstance(caption_style.get("min_font_size_px"), int)
    ):
        raise PipelineError(
            "caption_style must use local Be Vietnam Pro weight 500 with a declared size range."
        )

    style_id = compiled.get("id")
    for asset_id, entry in assets.items():
        if not isinstance(entry, dict):
            raise PipelineError(f"asset registry entry {asset_id!r} must be an object.")
        _asset_file(root, asset_id, entry)
        if entry.get("style_id") != style_id:
            raise PipelineError(
                f"asset {asset_id!r} style_id does not match the compiled design token."
            )

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

            if (
                not isinstance(motion, dict)
                or motion.get("preset") not in motion_presets
                or not isinstance(motion.get("duration_frames"), int)
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
        if (
            not isinstance(captions, dict)
            or captions.get("source") != "voice"
            or not all(
                isinstance(captions.get(key), int)
                for key in ("page_target_words", "max_words", "max_lines")
            )
            or not 3 <= captions["page_target_words"] <= 7
            or not 3 <= captions["max_words"] <= 7
            or not 1 <= captions["max_lines"] <= 2
        ):
            raise PipelineError(f"scene {scene_id} has an invalid v2 caption policy.")

    narration_path = root / "narration.txt"
    try:
        narration = narration_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read narration.txt: {exc}") from exc

    if narration.endswith("\n"):
        narration = narration[:-1]
    if narration != "\n".join(voices):
        raise PipelineError(
            "narration.txt must exactly match ordered scene.voice lines."
        )

    try:
        readme_text = (root / "README.md").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read README.md: {exc}") from exc
    if "PLUGIN SIDE COMPLETE" not in readme_text:
        raise PipelineError(
            "README.md must identify the package as PLUGIN SIDE COMPLETE."
        )

    renderer_root = root / "renderer"
    renderer = _load_json(renderer_root / "package.json", "renderer/package.json")
    if renderer.get("name") != "zodiac-remotion-renderer":
        raise PipelineError(
            "renderer/package.json is not the Zodiac Remotion renderer scaffold."
        )
    if renderer.get("dependencies") != EXPECTED_DEPENDENCIES:
        raise PipelineError(
            "renderer dependencies do not match the current Zodiac v2 renderer contract."
        )

    dev_dependencies = renderer.get("devDependencies")
    expected_dev = dict(EXPECTED_DEV_DEPENDENCIES)
    if (
        isinstance(dev_dependencies, dict)
        and dev_dependencies.get("typescript") in SUPPORTED_TYPESCRIPT_VERSIONS
    ):
        expected_dev["typescript"] = dev_dependencies["typescript"]
    if dev_dependencies != expected_dev:
        raise PipelineError(
            "renderer development dependencies do not match the current Zodiac v2 contract."
        )

    if renderer.get("scripts") != EXPECTED_SCRIPTS:
        raise PipelineError(
            "renderer scripts do not match the current Zodiac v2 renderer contract."
        )

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
        "tests/pipeline-contract.test.mjs",
    )
    for required in required_renderer:
        if not (renderer_root / required).is_file():
            raise PipelineError(
                f"renderer scaffold is incomplete: missing renderer/{required}."
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


def concatenate_wavs(inputs: list[Path], output: Path) -> None:
    """Concatenate PCM WAV files without re-encoding them."""
    if not inputs:
        raise PipelineError("no scene WAV files were generated.")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    params = None
    with wave.open(str(output), "wb") as destination:
        for source_path in inputs:
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
        measured = []
        for segment in segments:
            for word in segment.words or []:
                heard = str(word.word).strip()
                if not _normalize_token(heard):
                    continue
                if word.start is None or word.end is None or word.end <= word.start:
                    raise PipelineError(
                        f"aligner returned an invalid word timestamp for {audio_path.name}."
                    )
                measured.append(
                    {
                        "heard": heard,
                        "startMs": float(word.start) * 1000,
                        "endMs": float(word.end) * 1000,
                        "confidence": (
                            float(word.probability)
                            if word.probability is not None
                            else None
                        ),
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
) -> dict:
    """Build scene frames from measured WAV duration plus measured word alignment."""
    fps = production["video"]["fps"]
    rows = []
    elapsed_seconds = 0.0

    for scene in production["scenes"]:
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

        start_frame = round(elapsed_seconds * fps)
        offset_ms = elapsed_seconds * 1000
        elapsed_seconds += float(seconds)
        end_frame = max(start_frame + 1, round(elapsed_seconds * fps))

        global_words = []
        for word in words:
            global_words.append(
                {
                    **word,
                    "startMs": offset_ms + float(word["startMs"]),
                    "endMs": offset_ms + float(word["endMs"]),
                    "timestampMs": (
                        None
                        if word.get("timestampMs") is None
                        else offset_ms + float(word["timestampMs"])
                    ),
                }
            )

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
        subprocess.run(run_args, cwd=tts_root, check=True)
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


def concatenate_scene_voices(package_root: Path, production: dict) -> Path:
    root = Path(package_root).resolve()
    inputs = scene_voice_files(root, production)
    output = root / "voice.wav"
    concatenate_wavs(inputs, output)
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

    return build_timing_from_word_alignment(production, durations, aligned_words)


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
    concatenate_scene_voices(root, production)

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
    )
    concatenate_scene_voices(root, production)
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


def _npm_executable() -> str:
    raw = shutil.which("npm.cmd" if os.name == "nt" else "npm") or shutil.which("npm")
    if not raw:
        raise PipelineError("npm is required but was not found on PATH.")
    return str(Path(raw).resolve())


def _run_npm(args: list[str], cwd: Path) -> None:
    if any(not isinstance(arg, str) or "\x00" in arg for arg in args):
        raise PipelineError("npm arguments must be NUL-free strings.")
    # nosemgrep: python.lang.security.audit.dangerous-subprocess-use-audit
    subprocess.run(
        [_npm_executable(), *args],
        cwd=cwd,
        check=True,
        shell=False,
    )


def _install_renderer(renderer: Path) -> None:
    try:
        _run_npm(["install", "--no-audit", "--no-fund"], renderer)
    except subprocess.CalledProcessError:
        package_path = renderer / "package.json"
        package = _load_json(package_path, "renderer/package.json")
        dev_dependencies = package.get("devDependencies", {})
        if dev_dependencies.get("typescript") != "5.8.0":
            raise
        probe = subprocess.run(
            [_npm_executable(), "view", "typescript@5.8", "version", "--json"],
            cwd=renderer,
            capture_output=True,
            text=True,
            shell=False,
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
        dev_dependencies["typescript"] = fallback
        package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
        print(f"typescript@5.8.0 unavailable; using available {fallback}.", flush=True)
        _run_npm(["install", "--no-audit", "--no-fund"], renderer)


def _patch_renderer_typescript_compatibility(renderer: Path) -> None:
    """Keep the shipped JSON cast valid on current TypeScript versions."""
    for relative in ("src/Root.tsx", "src/ZodiacComposition.tsx"):
        path = renderer / relative
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            raise PipelineError(f"cannot read renderer/{relative}: {exc}") from exc
        patched = source.replace("as Production", "as unknown as Production")
        if patched != source:
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
    volume: float = 0.12,
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
        # nosemgrep: python.lang.security.audit.dangerous-subprocess-use-audit
        subprocess.run(
            [ffmpeg, *safe_arguments],
            check=True,
            shell=False,
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


def mix_background_music_into_render(package_root: Path) -> Path:
    root = Path(package_root).resolve()
    config = validate_background_music(root)
    output = root / "out" / "zodiac-story.mp4"

    if not output.is_file():
        raise PipelineError(
            f"Remotion output is missing: {output}"
        )

    if config is None:
        print(
            "Final audio: voice/SFX only "
            "(background music disabled).",
            flush=True,
        )
        return output

    mixed = output.with_name("zodiac-story.with-music.mp4")
    volume = config["background_music_volume"]
    music = config["_path"]
    filter_complex = (
        f"[1:a]volume={volume:.3f}[music];"
        "[0:a][music]amix=inputs=2:duration=first:"
        "dropout_transition=0,alimiter=limit=0.95[out]"
    )

    _run_ffmpeg(
        [
            "-y",
            "-v",
            "error",
            "-i",
            str(output),
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
            "-shortest",
            str(mixed),
        ]
    )

    if not mixed.is_file():
        raise PipelineError(
            "background-music post-mix did not create the final MP4."
        )

    mixed.replace(output)
    print(
        f"Final audio: mixed {music.name} @ {volume:.0%} "
        f"into {output.name}.",
        flush=True,
    )
    return output


def prepare_renderer(
    package_root: Path,
    *,
    music: Path | None = None,
    music_volume: float = 0.12,
    update_music: bool = False,
) -> None:
    """Install pins, compile design.md, run renderer tests and typecheck."""
    root = Path(package_root).resolve()
    if update_music:
        configure_background_music(root, music, music_volume)

    validate_runtime(root)
    renderer = root / "renderer"
    if shutil.which("node") is None or (
        shutil.which("npm") is None and shutil.which("npm.cmd") is None
    ):
        raise PipelineError(
            "Node.js và npm là bắt buộc. "
            "Hãy cài Node.js LTS mới nhất rồi thử lại."
        )

    bin_dir = renderer / "node_modules" / ".bin"
    remotion_bin = bin_dir / ("remotion.cmd" if os.name == "nt" else "remotion")
    tsc_bin = bin_dir / ("tsc.cmd" if os.name == "nt" else "tsc")
    if not remotion_bin.is_file() or not tsc_bin.is_file():
        print("Đang cài các dependency Remotion v2 đã ghim…", flush=True)
        _install_renderer(renderer)

    print("Đang biên dịch design.md → style token trong production.json…", flush=True)
    _run_npm(["run", "compile:style"], renderer)
    validate_package(root)

    print("Đang chạy kiểm thử hợp đồng renderer…", flush=True)
    _run_npm(["run", "test"], renderer)

    print("Đang kiểm tra TypeScript của renderer…", flush=True)
    _run_npm(["run", "typecheck"], renderer)


def render_video(package_root: Path) -> None:
    """Render the canonical Remotion MP4 for the package."""
    root = Path(package_root).resolve()
    validate_runtime(root)
    _run_npm(["run", "render"], root / "renderer")


def run_renderer(
    package_root: Path,
    action: str,
    music: Path | None = None,
    music_volume: float = 0.12,
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
        _run_npm(["run", "studio"], root / "renderer")
    else:
        render_video(root)
        mix_background_music_into_render(root)


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
