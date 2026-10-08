from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any, Callable
import wave

from tools.control_plane.cache import scene_timing_key, timing_key
from tools.control_plane.artifact_graph import ArtifactGraph
from tools.control_plane.contracts import validate_contract_shape
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.resource_budget import load_resource_profile
from tools.zodiac_local import (
    PipelineError,
    _align_scene_words,
    build_timing_from_word_alignment,
    file_sha256,
    load_word_aligner,
    require_word_aligner_installed,
    scene_voice_files,
)

from .voice import VoiceArtifact


TimingAligner = Callable[
    [Path, dict[str, Any], VoiceArtifact, dict[str, Any]],
    dict[str, Any],
]


@dataclass(frozen=True)
class TimingArtifact:
    path: Path
    input_key: str
    output_hash: str
    reused: bool
    cache_reason: str = "UNKNOWN"


def _json_safe(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _production_from_ir(ir: dict[str, Any]) -> dict[str, Any]:
    return {
        "video": {"fps": int(ir["fps"])},
        "scenes": [
            {
                "id": str(scene["id"]),
                "voice": str(scene["voice"]),
            }
            for scene in ir.get("scenes", [])
        ],
    }


def _wav_seconds(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as handle:
            return handle.getnframes() / float(handle.getframerate())
    except (wave.Error, EOFError, OSError, ZeroDivisionError) as exc:
        raise PipelineError(f"cannot measure scene WAV {path}: {exc}") from exc


def _canonical_text_hash(text: str) -> str:
    canonical = " ".join(str(text).replace("\r\n", "\n").replace("\r", "\n").split())
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _scene_cache_path(workspace: Path, scene_id: str, input_key: str) -> Path:
    scene_key = hashlib.sha256(scene_id.encode("utf-8")).hexdigest()[:16]
    return workspace / ".runtime" / "artifacts" / "timing" / scene_key / f"{input_key}.json"


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    try:
        temp.write_text(
            json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def _read_scene_cache(
    path: Path,
    *,
    scene_id: str,
    input_key: str,
    wav_hash: str,
    text_hash: str,
) -> tuple[float, list[dict[str, Any]]] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if (
        not isinstance(payload, dict)
        or payload.get("version") != 1
        or payload.get("scene_id") != scene_id
        or payload.get("input_key") != input_key
        or payload.get("wav_sha256") != wav_hash
        or payload.get("canonical_text_hash") != text_hash
    ):
        return None
    duration = payload.get("duration_seconds")
    words = payload.get("words")
    if (
        not isinstance(duration, (int, float))
        or not math.isfinite(duration)
        or duration <= 0
        or not isinstance(words, list)
        or not words
    ):
        return None
    for word in words:
        if (
            not isinstance(word, dict)
            or not isinstance(word.get("text"), str)
            or not word["text"]
            or not isinstance(word.get("startMs"), (int, float))
            or not isinstance(word.get("endMs"), (int, float))
            or not math.isfinite(word["startMs"])
            or not math.isfinite(word["endMs"])
            or word["startMs"] < 0
            or word["endMs"] <= word["startMs"]
            or (
                word.get("timestampMs") is not None
                and (
                    not isinstance(word["timestampMs"], (int, float))
                    or not math.isfinite(word["timestampMs"])
                )
            )
            or (
                word.get("confidence") is not None
                and (
                    not isinstance(word["confidence"], (int, float))
                    or not math.isfinite(word["confidence"])
                )
            )
        ):
            return None
    return float(duration), words


def _align_cached_scenes(
    workspace: Path,
    production: dict[str, Any],
    voice: VoiceArtifact,
    settings: dict[str, Any],
    aligner_version: str,
) -> dict[str, Any]:
    paths = scene_voice_files(workspace, production)
    scene_settings = {
        key: value
        for key, value in _json_safe(settings).items()
        if key not in {"scene_gap_ms", "sentence_pause_ms"}
    }
    durations: dict[str, float] = {}
    aligned_words: dict[str, list[dict[str, Any]]] = {}
    model = None
    resource_profile: dict[str, Any] | None = None
    graph = ArtifactGraph(workspace)

    for scene, path in zip(production["scenes"], paths):
        scene_id = str(scene["id"])
        wav_hash = file_sha256(path)
        text_hash = _canonical_text_hash(scene["voice"])
        input_key = scene_timing_key(
            wav_hash,
            text_hash,
            scene_settings,
            aligner_version,
        )
        cache_path = _scene_cache_path(workspace, scene_id, input_key)
        cached = _read_scene_cache(
            cache_path,
            scene_id=scene_id,
            input_key=input_key,
            wav_hash=wav_hash,
            text_hash=text_hash,
        )
        if cached is None:
            if model is None:
                require_word_aligner_installed()
                resource_profile = load_resource_profile(workspace)
                model = load_word_aligner(
                    str(settings.get("model") or "small"),
                    str(settings.get("device") or "cpu"),
                    str(settings.get("compute_type") or "int8"),
                    cpu_threads=int(
                        settings.get("cpu_threads")
                        or resource_profile["whisper_cpu_threads"]
                    ),
                    num_workers=int(
                        settings.get("num_workers")
                        or resource_profile["whisper_workers"]
                    ),
                )
            duration = _wav_seconds(path)
            words = _align_scene_words(model, path, scene["voice"])
            _write_json_atomic(
                cache_path,
                {
                    "version": 1,
                    "scene_id": scene_id,
                    "input_key": input_key,
                    "wav_sha256": wav_hash,
                    "canonical_text_hash": text_hash,
                    "aligner_version": aligner_version,
                    "aligner_settings": scene_settings,
                    "duration_seconds": duration,
                    "words": words,
                },
            )
        else:
            duration, words = cached
        graph.record(
            f"timing.scene.{scene_id}",
            "timing.scene",
            input_key,
            cache_path,
            producer="faster-whisper",
            producer_version=aligner_version,
            dependencies={f"voice.scene.{scene_id}": wav_hash},
            provenance={"cache_reason": "REUSED_SCENE" if cached is not None else "ALIGNED_NEW"},
        )
        durations[scene_id] = duration
        aligned_words[scene_id] = words

    return build_timing_from_word_alignment(
        production,
        durations,
        aligned_words,
        scene_gap_ms=float(settings.get("scene_gap_ms", 0.0)),
        sentence_pause_ms=0.0,
    )


def _record_global_cache_scene_reuse(
    workspace: Path,
    production: dict[str, Any],
    settings: dict[str, Any],
    aligner_version: str,
) -> None:
    scene_settings = {
        key: value
        for key, value in _json_safe(settings).items()
        if key not in {"scene_gap_ms", "sentence_pause_ms"}
    }
    graph = ArtifactGraph(workspace)
    for scene, path in zip(production["scenes"], scene_voice_files(workspace, production)):
        scene_id = str(scene["id"])
        wav_hash = file_sha256(path)
        text_hash = _canonical_text_hash(scene["voice"])
        input_key = scene_timing_key(wav_hash, text_hash, scene_settings, aligner_version)
        cache_path = _scene_cache_path(workspace, scene_id, input_key)
        if _read_scene_cache(
            cache_path,
            scene_id=scene_id,
            input_key=input_key,
            wav_hash=wav_hash,
            text_hash=text_hash,
        ) is None:
            continue
        graph.record(
            f"timing.scene.{scene_id}",
            "timing.scene",
            input_key,
            cache_path,
            producer="faster-whisper",
            producer_version=aligner_version,
            dependencies={f"voice.scene.{scene_id}": wav_hash},
            provenance={"cache_reason": "REUSED_SCENE"},
        )


def _normalize_timing(raw: dict[str, Any], ir: dict[str, Any]) -> dict[str, Any]:
    scenes: list[dict[str, Any]] = []
    for row in raw.get("scenes", []):
        if not isinstance(row, dict):
            continue
        scene_id = row.get("id") or row.get("scene_id")
        scenes.append(
            {
                "id": scene_id,
                "start_frame": row.get("start_frame"),
                "duration_frames": row.get("duration_frames"),
                "captions": row.get("captions", []),
            }
        )
    return {
        "format": "zodiac-timing@1",
        "fps": int(raw.get("fps") or ir["fps"]),
        "total_duration_frames": raw.get("total_duration_frames"),
        "scenes": scenes,
    }


def _validate_canonical_timing(timing: dict[str, Any]) -> None:
    issues = validate_contract_shape("timing-v1", timing)
    if issues:
        raise ControlPlaneError(
            code="TIMING_INVALID",
            stage="TIMING",
            message="measured timing does not match canonical timing-v1",
            detail={
                "issues": [
                    {"path": issue.path, "message": issue.message}
                    for issue in issues
                ]
            },
        )


def _meta_path(workspace: Path) -> Path:
    return Path(workspace) / ".runtime" / "timing-v3.json"


def _read_meta(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _cached_timing(workspace: Path, input_key: str) -> TimingArtifact | None:
    meta = _read_meta(_meta_path(workspace))
    path = Path(workspace) / ".runtime" / "timing.json"
    if (
        not meta
        or meta.get("version") != 3
        or meta.get("input_key") != input_key
        or not path.is_file()
        or not isinstance(meta.get("output_hash"), str)
    ):
        return None
    output_hash = file_sha256(path)
    if output_hash != meta["output_hash"]:
        return None
    try:
        timing = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(timing, dict):
        return None
    if validate_contract_shape("timing-v1", timing):
        return None
    return TimingArtifact(
        path=path,
        input_key=input_key,
        output_hash=output_hash,
        reused=True,
        cache_reason="REUSED_GLOBAL",
    )


def ensure_timing_artifact(
    workspace: Path,
    ir: dict[str, Any],
    voice: VoiceArtifact,
    *,
    aligner_settings: dict[str, Any],
    aligner_version: str,
    aligner: TimingAligner | None = None,
) -> TimingArtifact:
    workspace = Path(workspace).resolve()
    sentence_pause_ms = float(aligner_settings.get("sentence_pause_ms", 0.0))
    if sentence_pause_ms != 0.0:
        raise ControlPlaneError(
            code="TIMING_CONFIG_INVALID",
            stage="TIMING",
            message=(
                "Studio v2 timing cannot inject sentence pauses after voice caching; "
                "sentence_pause_ms must be 0."
            ),
            detail={"sentence_pause_ms": sentence_pause_ms},
        )

    narration_path = workspace / "narration.txt"
    try:
        narration = narration_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ControlPlaneError(
            code="TIMING_NARRATION_MISSING",
            stage="TIMING",
            message=f"cannot read narration.txt: {exc}",
        ) from exc

    if not voice.path.is_file() or file_sha256(voice.path) != voice.output_hash:
        raise ControlPlaneError(
            code="TIMING_VOICE_INVALID",
            stage="TIMING",
            message="voice artifact content does not match its approved hash",
        )

    safe_settings = _json_safe(aligner_settings)
    assembly_settings = {
        **safe_settings,
        "fps": int(ir["fps"]),
        "scene_ids": [str(scene["id"]) for scene in ir.get("scenes", [])],
    }
    input_key = timing_key(
        voice.output_hash,
        narration,
        assembly_settings,
        aligner_version,
    )
    cached = _cached_timing(workspace, input_key)
    if cached is not None:
        _record_global_cache_scene_reuse(
            workspace,
            _production_from_ir(ir),
            dict(aligner_settings),
            aligner_version,
        )
        return cached

    production = _production_from_ir(ir)
    voice_hash_before = file_sha256(voice.path)
    try:
        raw = (
            _align_cached_scenes(
                workspace,
                production,
                voice,
                dict(aligner_settings),
                aligner_version,
            )
            if aligner is None
            else aligner(
                workspace,
                production,
                voice,
                dict(aligner_settings),
            )
        )
    except ControlPlaneError:
        raise
    except Exception as exc:
        raise ControlPlaneError(
            code="TIMING_ALIGNMENT_FAILED",
            stage="TIMING",
            message=f"word alignment failed: {exc}",
        ) from exc

    if file_sha256(voice.path) != voice_hash_before:
        raise ControlPlaneError(
            code="TIMING_MUTATED_VOICE",
            stage="TIMING",
            message="timing stage modified immutable voice.wav",
        )

    if not isinstance(raw, dict):
        raise ControlPlaneError(
            code="TIMING_INVALID",
            stage="TIMING",
            message="aligner returned a non-object timing document",
        )
    normalized = _normalize_timing(raw, ir)
    _validate_canonical_timing(normalized)

    runtime = workspace / ".runtime"
    path = runtime / "timing.json"
    _write_json_atomic(path, normalized)
    output_hash = file_sha256(path)
    meta = {
        "version": 3,
        "input_key": input_key,
        "output_hash": output_hash,
        "voice_hash": voice.output_hash,
        "aligner_version": aligner_version,
        "aligner_settings": safe_settings,
        "assembly_settings": assembly_settings,
    }
    _write_json_atomic(_meta_path(workspace), meta)
    graph = ArtifactGraph(workspace)
    scene_reused = sum(
        1
        for key, record in graph.records.items()
        if key.startswith("timing.scene.")
        and isinstance(record.get("provenance"), dict)
        and record["provenance"].get("cache_reason") == "REUSED_SCENE"
    )
    scene_aligned = sum(
        1
        for key, record in graph.records.items()
        if key.startswith("timing.scene.")
        and isinstance(record.get("provenance"), dict)
        and record["provenance"].get("cache_reason") == "ALIGNED_NEW"
    )
    return TimingArtifact(
        path=path,
        input_key=input_key,
        output_hash=output_hash,
        reused=False,
        cache_reason=(
            "PARTIAL_REUSE"
            if scene_reused and scene_aligned
            else "REUSED_SCENES"
            if scene_reused
            else "ALIGNED_NEW"
        ),
    )
