from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any, Callable
import wave

from tools.control_plane.cache import timing_key
from tools.control_plane.contracts import validate_contract_shape
from tools.control_plane.errors import ControlPlaneError
from tools.zodiac_local import (
    PipelineError,
    align_scene_timings,
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


def _legacy_aligner(
    workspace: Path,
    production: dict[str, Any],
    voice: VoiceArtifact,
    settings: dict[str, Any],
) -> dict[str, Any]:
    require_word_aligner_installed()
    model = load_word_aligner(
        str(settings.get("model") or "small"),
        str(settings.get("device") or "cpu"),
        str(settings.get("compute_type") or "int8"),
    )
    paths = scene_voice_files(workspace, production)
    durations = {
        scene["id"]: _wav_seconds(path)
        for scene, path in zip(production["scenes"], paths)
    }
    return align_scene_timings(
        production,
        durations,
        model,
        paths,
        mismatch_recovery=None,
        scene_gap_ms=float(settings.get("scene_gap_ms", 0.0)),
        sentence_pause_ms=0.0,
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
    return Path(workspace) / ".runtime" / "timing-v2.json"


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
    input_key = timing_key(
        voice.output_hash,
        narration,
        safe_settings,
        aligner_version,
    )
    cached = _cached_timing(workspace, input_key)
    if cached is not None:
        return cached

    production = _production_from_ir(ir)
    voice_hash_before = file_sha256(voice.path)
    active_aligner = aligner or _legacy_aligner
    try:
        raw = active_aligner(
            workspace,
            production,
            voice,
            dict(aligner_settings),
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
    runtime.mkdir(parents=True, exist_ok=True)
    path = runtime / "timing.json"
    path.write_text(
        json.dumps(normalized, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    output_hash = file_sha256(path)
    meta = {
        "version": 2,
        "input_key": input_key,
        "output_hash": output_hash,
        "voice_hash": voice.output_hash,
        "aligner_version": aligner_version,
        "aligner_settings": safe_settings,
    }
    _meta_path(workspace).write_text(
        json.dumps(meta, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return TimingArtifact(
        path=path,
        input_key=input_key,
        output_hash=output_hash,
        reused=False,
    )
