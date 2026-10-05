#!/usr/bin/env python3
"""Import and run RENDER_READY exports from zodiac-video-pipeline."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import wave
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath


class PipelineError(Exception):
    """A package, runtime, or local-tool prerequisite is invalid."""


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
}
EXPECTED_DEV_DEPENDENCIES = {
    "@types/node": "24.0.0",
    "@types/react": "19.0.0",
    "typescript": "5.8.0",
}
EXPECTED_SCRIPTS = {
    "prestudio": "node scripts/generate-sfx.mjs",
    "studio": "remotion studio src/index.ts",
    "render": "node scripts/render.mjs",
    "typecheck": "tsc --noEmit",
}
SUPPORTED_TYPESCRIPT_VERSIONS = {"5.8.0", "5.8.2"}
DEFAULT_TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
DEFAULT_TTS_VOICE = "Hải Đăng"


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


def validate_package(package_root: Path) -> dict:
    """Validate the video handoff, renderer scaffold, narration, and SVG assets."""
    root = Path(package_root).resolve()
    production = _load_json(root / "production.json", "production.json")
    video = production.get("video")
    if not isinstance(video, dict) or any(
        not isinstance(video.get(key), int)
        or isinstance(video[key], bool)
        or video[key] <= 0
        for key in ("width", "height", "fps")
    ):
        raise PipelineError("production.json video must have positive integer width, height, and fps.")

    scenes = production.get("scenes")
    assets = production.get("assets")
    primitives = production.get("primitives")
    if not isinstance(scenes, list) or not scenes:
        raise PipelineError("production.json must contain at least one scene.")
    if not isinstance(assets, dict) or not isinstance(primitives, dict):
        raise PipelineError("production.json must contain assets and primitives registries.")

    scene_ids: list[str] = []
    voices: list[str] = []
    for scene in scenes:
        if not isinstance(scene, dict) or not isinstance(scene.get("id"), str) or not scene["id"]:
            raise PipelineError("every production scene needs a non-empty id.")
        if scene["id"] in scene_ids:
            raise PipelineError(f"duplicate scene id: {scene['id']}")
        scene_ids.append(scene["id"])
        voice = scene.get("voice")
        if not isinstance(voice, str) or not voice.strip():
            raise PipelineError(f"scene {scene['id']} has no voice text.")
        voices.append(voice)

    narration_path = root / "narration.txt"
    try:
        narration = narration_path.read_text(encoding="utf-8").replace("\r\n", "\n").rstrip("\n")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read narration.txt: {exc}") from exc
    if narration not in {"\n".join(voices), "\n\n".join(voices)}:
        raise PipelineError("narration.txt must exactly match ordered scene.voice values.")

    readme = root / "README.md"
    try:
        readme_text = readme.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise PipelineError(f"cannot read README.md: {exc}") from exc
    if "PLUGIN SIDE COMPLETE" not in readme_text:
        raise PipelineError("README.md must identify the package as PLUGIN SIDE COMPLETE.")

    renderer_root = root / "renderer"
    renderer = _load_json(renderer_root / "package.json", "renderer/package.json")
    if renderer.get("name") != "zodiac-remotion-renderer":
        raise PipelineError("renderer/package.json is not the Zodiac Remotion renderer scaffold.")
    if renderer.get("dependencies") != EXPECTED_DEPENDENCIES:
        raise PipelineError("renderer/package.json Remotion/React versions do not match plugin 0.9.1.")
    dev_dependencies = renderer.get("devDependencies")
    expected_dev_dependencies = dict(EXPECTED_DEV_DEPENDENCIES)
    if isinstance(dev_dependencies, dict) and dev_dependencies.get("typescript") in SUPPORTED_TYPESCRIPT_VERSIONS:
        expected_dev_dependencies["typescript"] = dev_dependencies["typescript"]
    if dev_dependencies != expected_dev_dependencies:
        raise PipelineError("renderer/package.json TypeScript versions do not match plugin 0.9.1.")
    if renderer.get("scripts") != EXPECTED_SCRIPTS:
        raise PipelineError("renderer/package.json scripts do not match plugin 0.9.1.")
    for required in ("src/index.ts", "src/Root.tsx", "scripts/render.mjs", "scripts/generate-sfx.mjs"):
        if not (renderer_root / required).is_file():
            raise PipelineError(f"renderer scaffold is incomplete: missing renderer/{required}.")

    for asset_id, entry in assets.items():
        if not isinstance(entry, dict):
            raise PipelineError(f"asset registry entry {asset_id!r} must be an object.")
        _asset_file(root, asset_id, entry)

    for scene in scenes:
        for actor in scene.get("actors", []):
            asset_id = actor.get("asset") if isinstance(actor, dict) else None
            if asset_id not in assets:
                raise PipelineError(f"scene {scene['id']} refers to undeclared actor asset {asset_id!r}.")
        for obj in scene.get("objects", []):
            if not isinstance(obj, dict) or (bool(obj.get("asset")) == bool(obj.get("primitive"))):
                raise PipelineError(f"scene {scene['id']} objects must reference exactly one asset or primitive.")
            if obj.get("asset"):
                asset_id = obj["asset"]
                if asset_id not in assets:
                    raise PipelineError(f"scene {scene['id']} refers to undeclared object asset {asset_id!r}.")
                _asset_file(root, asset_id, assets[asset_id])
            elif obj.get("primitive") not in primitives:
                raise PipelineError(f"scene {scene['id']} refers to undeclared primitive {obj.get('primitive')!r}.")
    return production


def _normalize_words(text: str) -> str:
    return " ".join(text.split())


def validate_timing(package_root: Path, timing: dict | Path) -> dict:
    """Check measured timing IDs, continuous frame ranges, captions, and voice coverage."""
    root = Path(package_root).resolve()
    production = validate_package(root)
    if isinstance(timing, Path):
        timing = _load_json(timing, "timing.json")
    if timing.get("fps") != production["video"]["fps"]:
        raise PipelineError("timing.json fps must match production.json.")
    rows = timing.get("scenes")
    scenes = production["scenes"]
    if not isinstance(rows, list) or len(rows) != len(scenes):
        raise PipelineError("timing.json must contain one ordered row per production scene.")

    cursor = 0
    fps = timing["fps"]
    for scene, row in zip(scenes, rows):
        if not isinstance(row, dict) or row.get("scene_id") != scene["id"]:
            raise PipelineError(f"timing.json scene order/id mismatch at {scene['id']}.")
        start = row.get("start_frame")
        duration = row.get("duration_frames")
        if (
            not isinstance(start, int)
            or isinstance(start, bool)
            or start < 0
            or not isinstance(duration, int)
            or isinstance(duration, bool)
            or duration < 1
        ):
            raise PipelineError(f"scene {scene['id']} needs non-negative start_frame and positive duration_frames.")
        if start != cursor:
            raise PipelineError("scene frame ranges must be continuous and ordered from measured voice timing.")
        cursor = start + duration
        captions = row.get("captions")
        if not isinstance(captions, list) or not captions:
            raise PipelineError(f"measured caption cues are required for {scene['id']}.")
        texts = []
        prior_start = -1
        for cue in captions:
            if not isinstance(cue, dict):
                raise PipelineError(f"invalid caption cue in {scene['id']}.")
            text = cue.get("text")
            begin = cue.get("startMs")
            end = cue.get("endMs")
            timestamp = cue.get("timestampMs")
            confidence = cue.get("confidence")
            if (
                not isinstance(text, str)
                or not text.strip()
                or not isinstance(begin, (int, float))
                or isinstance(begin, bool)
                or not math.isfinite(begin)
                or not isinstance(end, (int, float))
                or isinstance(end, bool)
                or not math.isfinite(end)
                or end <= begin
                or (
                    timestamp is not None
                    and (not isinstance(timestamp, (int, float)) or isinstance(timestamp, bool) or not math.isfinite(timestamp))
                )
                or (
                    confidence is not None
                    and (not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not math.isfinite(confidence))
                )
                or "timestampMs" not in cue
                or "confidence" not in cue
            ):
                raise PipelineError(f"invalid caption cue in {scene['id']}.")
            if begin < prior_start:
                raise PipelineError(f"caption cues are not time ordered in {scene['id']}.")
            if begin < (start * 1000 / fps) - 100 or end > (cursor * 1000 / fps) + 100:
                raise PipelineError(f"caption cue falls outside measured scene timing in {scene['id']}.")
            prior_start = begin
            texts.append(text)
        if _normalize_words(" ".join(texts)) != _normalize_words(scene["voice"]):
            raise PipelineError(f"caption text does not match scene.voice in {scene['id']}.")

    if timing.get("total_duration_frames") != cursor:
        raise PipelineError("total_duration_frames must equal the final measured scene boundary.")
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


def build_timing_from_durations(production: dict, durations: dict[str, float]) -> dict:
    """Build the renderer timing contract from measured scene seconds."""
    fps = production["video"]["fps"]
    rows = []
    elapsed = 0.0
    for scene in production["scenes"]:
        scene_id = scene["id"]
        seconds = durations.get(scene_id)
        if not isinstance(seconds, (int, float)) or seconds <= 0:
            raise PipelineError(f"missing measured duration for scene {scene_id}.")
        start = round(elapsed * fps)
        elapsed += float(seconds)
        end = max(start + 1, round(elapsed * fps))
        rows.append(
            {
                "scene_id": scene_id,
                "start_frame": start,
                "duration_frames": end - start,
                "captions": [
                    {
                        "text": scene["voice"],
                        "startMs": start * 1000 / fps,
                        "endMs": end * 1000 / fps,
                        "timestampMs": None,
                        "confidence": None,
                    }
                ],
            }
        )
    return {"fps": fps, "total_duration_frames": rows[-1]["start_frame"] + rows[-1]["duration_frames"], "scenes": rows}


def _tts_python(tts_root: Path, requested: Path | None) -> Path:
    candidate = Path(requested).expanduser() if requested else Path(tts_root) / ".venv" / "Scripts" / "python.exe"
    if not candidate.is_file():
        raise PipelineError(f"VieNeu Python environment not found: {candidate}")
    return candidate.resolve()


def synthesize_voice(
    package_root: Path,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    mode: str = "v3turbo",
    vieneu_url: str | None = None,
) -> dict:
    """Generate one scene WAV per scene, then attach voice and measured timing."""
    root = Path(package_root).resolve()
    production = validate_package(root)
    tts_root = Path(tts_root).expanduser().resolve()
    python = _tts_python(tts_root, tts_python)
    runtime = root / ".runtime"
    scene_dir = runtime / "tts-scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)
    manifest = runtime / "tts-manifest.json"
    rows = [
        {"scene_id": scene["id"], "text": scene["voice"], "output": str(scene_dir / f"{scene['id']}.wav")}
        for scene in production["scenes"]
    ]
    manifest.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    script = (
        "import json, shutil, sys, urllib.request\n"
        "from pathlib import Path\n"
        "from gradio_client import Client\n"
        "rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\n"
        "url, voice = sys.argv[2].rstrip('/'), sys.argv[3]\n"
        "config = json.load(urllib.request.urlopen(url + '/config', timeout=10))\n"
        "components = {item['id']: item for item in config.get('components', [])}\n"
        "deps = [d for d in config.get('dependencies', []) if d.get('api_name') and len(d.get('inputs', [])) == 12 and len(d.get('outputs', [])) == 3]\n"
        "if not deps: raise RuntimeError('Không tìm thấy API tạo giọng đơn của VieNeu Gradio.')\n"
        "dep = next((d for d in deps if d['api_name'] == 'wrapper'), deps[0])\n"
        "client = Client(url, verbose=False)\n"
        "for row in rows:\n"
        "    print('VieNeu API:', row['scene_id'], flush=True)\n"
        "    args = [components.get(i, {}).get('props', {}).get('value') for i in dep['inputs'] if components.get(i, {}).get('type') != 'state']\n"
        "    args[0], args[1] = row['text'], voice\n"
        "    result = client.predict(*args, api_name='/' + dep['api_name'])\n"
        "    if isinstance(result, (tuple, list)) and result[0] is None and 'Vui lòng tải model trước' in str(result[1]):\n"
        "        print('VieNeu: đang nạp model vào server…', flush=True)\n"
        "        loaded = client.predict('VieNeu-TTS-v3-Turbo', 'VieNeu-Codec', 'Auto', True, '', 'VieNeu-TTS-v3-Nano (preview)', '', api_name='/load_model')\n"
        "        if not str(loaded[0]).startswith('✅ Model đã tải thành công'): raise RuntimeError('VieNeu không nạp được model: ' + str(loaded[0]))\n"
        "        result = client.predict(*args, api_name='/' + dep['api_name'])\n"
        "    audio = result[0] if isinstance(result, (tuple, list)) else result\n"
        "    if isinstance(result, (tuple, list)) and result[0] is None: raise RuntimeError(str(result[1]))\n"
        "    if isinstance(audio, dict): audio = audio.get('path') or audio.get('name')\n"
        "    if not audio or not Path(str(audio)).is_file(): raise RuntimeError('VieNeu API không trả về file WAV: ' + str(audio))\n"
        "    shutil.copy2(audio, row['output'])\n"
    )
    if vieneu_url:
        print(f"Generating voice through VieNeu Gradio: {vieneu_url}", flush=True)
        run_args = [str(python), "-X", "utf8", "-c", script, str(manifest), vieneu_url, voice]
    else:
        script = (
            "import json, sys\n"
            "from pathlib import Path\n"
            "from vieneu import Vieneu\n"
            "from apps.user_voices import load_user_voices\n"
            "rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\n"
            "tts = Vieneu(mode=sys.argv[2])\n"
            "load_user_voices(tts)\n"
            "if sys.argv[3] not in tts._preset_voices: raise ValueError('VieNeu voice not found: ' + sys.argv[3])\n"
            "for row in rows:\n"
            "    print('VieNeu:', row['scene_id'], flush=True)\n"
            "    tts.save(tts.infer(row['text'], voice=sys.argv[3]), row['output'])\n"
        )
        print("Generating Vietnamese voice with VieNeu (standalone)...", flush=True)
        run_args = [str(python), "-X", "utf8", "-c", script, str(manifest), mode, voice]
    try:
        subprocess.run(run_args, cwd=tts_root, check=True)
    except FileNotFoundError as exc:
        raise PipelineError(f"cannot start VieNeu Python: {exc}") from exc
    except subprocess.CalledProcessError as exc:
        raise PipelineError(f"VieNeu synthesis failed with exit code {exc.returncode}.") from exc

    scene_wavs = [scene_dir / f"{scene['id']}.wav" for scene in production["scenes"]]
    durations = {}
    for scene, path in zip(production["scenes"], scene_wavs):
        validate_voice(path)
        with wave.open(str(path), "rb") as wav:
            durations[scene["id"]] = wav.getnframes() / wav.getframerate()
    concatenate_wavs(scene_wavs, root / "voice.wav")
    timing = build_timing_from_durations(production, durations)
    validate_timing(root, timing)
    (runtime / "timing.json").write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return timing


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
    return production, timing


def _run_npm(args: list[str], cwd: Path) -> None:
    if os.name == "nt":
        command = "npm.cmd " + subprocess.list2cmdline(args)
        subprocess.run(command, cwd=cwd, check=True, shell=True)
    else:
        subprocess.run(["npm", *args], cwd=cwd, check=True)


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
            ["npm.cmd" if os.name == "nt" else "npm", "view", "typescript@5.8", "version", "--json"],
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


def configure_background_music(package_root: Path, music: Path | None, volume: float = 0.12) -> None:
    root = Path(package_root).resolve()
    timing_path = root / ".runtime" / "timing.json"
    timing = _load_json(timing_path, "timing.json")
    if not 0 <= volume <= 1:
        raise PipelineError("background music volume must be between 0 and 1.")
    composition = root / "renderer" / "src" / "ZodiacComposition.tsx"
    types = root / "renderer" / "src" / "types.ts"
    source = composition.read_text(encoding="utf-8")
    audio = re.search(r'(?m)^(?P<indent>[ \t]*)<Audio\s+src=\{staticFile\("voice\.wav"\)\}\s*/>', source)
    if not audio:
        raise PipelineError("renderer does not contain the expected voice audio track.")
    if "timing.background_music &&" not in source:
        indent = audio.group("indent")
        music_line = indent + "{timing.background_music && <Audio src={staticFile(timing.background_music)} volume={timing.background_music_volume ?? 0.12} loop />}"
        source = source[:audio.end()] + "\n" + music_line + source[audio.end():]
        composition.write_text(source, encoding="utf-8")
    type_source = types.read_text(encoding="utf-8")
    if not re.search(r"scenes\s*:\s*RuntimeSceneTiming\[\]", type_source):
        raise PipelineError("renderer RuntimeTiming type is unsupported.")
    if "background_music?: string;" not in type_source:
        type_source = re.sub(r"(scenes\s*:\s*RuntimeSceneTiming\[\]);?", r"\1; background_music?: string; background_music_volume?: number", type_source, count=1)
        types.write_text(type_source, encoding="utf-8")

    if music is None:
        timing.pop("background_music", None)
        timing.pop("background_music_volume", None)
    else:
        music = Path(music).expanduser().resolve()
        if not music.is_file():
            raise PipelineError(f"background music file does not exist: {music}")
        extension = music.suffix.lower()
        if extension not in {".mp3", ".wav", ".m4a", ".aac", ".ogg"}:
            raise PipelineError(f"unsupported background music format: {extension}")
        destination = root / ".runtime" / f"background-music{extension}"
        shutil.copy2(music, destination)
        timing["background_music"] = f".runtime/{destination.name}"
        timing["background_music_volume"] = volume
    timing_path.write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_renderer(package_root: Path, action: str, music: Path | None = None, music_volume: float = 0.12, update_music: bool = False) -> None:
    if update_music:
        configure_background_music(package_root, music, music_volume)
    validate_runtime(package_root)
    renderer = Path(package_root).resolve() / "renderer"
    if shutil.which("node") is None or (shutil.which("npm") is None and shutil.which("npm.cmd") is None):
        raise PipelineError("Node.js and npm are required. Install the current Node.js LTS release, then retry.")
    bin_dir = renderer / "node_modules" / ".bin"
    remotion_bin = bin_dir / ("remotion.cmd" if os.name == "nt" else "remotion")
    tsc_bin = bin_dir / ("tsc.cmd" if os.name == "nt" else "tsc")
    if not remotion_bin.is_file() or not tsc_bin.is_file():
        print("Installing the pinned Remotion dependencies…", flush=True)
        _install_renderer(renderer)
    _patch_renderer_typescript_compatibility(renderer)
    print("Checking renderer TypeScript…", flush=True)
    _run_npm(["run", "typecheck"], renderer)
    if action == "preview":
        _run_npm(["run", "studio", "--", "--props=../.runtime/timing.json"], renderer)
    else:
        _run_npm(["run", "render"], renderer)


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
            synthesize_voice(job, args.tts_root, args.tts_python, args.voice, args.tts_mode)
            print("Voice and timing ready.")
        elif choice == "2":
            synthesize_voice(job, args.tts_root, args.tts_python, args.voice, args.tts_mode)
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
    inspect = commands.add_parser("check", help="check the creative package and local runtime inputs")
    inspect.add_argument("job")
    for command in ("preview", "render"):
        sub = commands.add_parser(command, help=f"validate and run Remotion {command}")
        sub.add_argument("job")
        music_group = sub.add_mutually_exclusive_group()
        music_group.add_argument("--music", type=Path, help="loop this background track under the narration")
        music_group.add_argument("--no-music", action="store_true", help="remove background music from this render")
        sub.add_argument("--music-volume", type=float, default=0.12, help="background music volume from 0 to 1")
    tui = commands.add_parser("tui", help="interactive local voice and Remotion workflow")
    tui.add_argument("--archive", type=Path, help="ready ZIP to import automatically")
    tui.add_argument("--name", help="local job name when importing")
    tui.add_argument("--voice", default=DEFAULT_TTS_VOICE)
    tui.add_argument("--tts-root", type=Path, default=DEFAULT_TTS_ROOT)
    tui.add_argument("--tts-python", type=Path)
    tui.add_argument("--tts-mode", default="v3turbo")
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
            print("Next: create voice.wav and measured .runtime/timing.json, then run the attach command.")
        elif args.command == "attach":
            root = _job_path(args.job, workspace)
            attach_runtime(root, args.voice, args.timing)
            print(f"Voice and measured timing attached: {root}")
        elif args.command == "voice":
            timing = synthesize_voice(_job_path(args.job, workspace), args.tts_root, args.tts_python, args.voice, args.tts_mode, args.vieneu_url)
            print(f"Voice and measured timing attached ({timing['total_duration_frames']} frames).")
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
