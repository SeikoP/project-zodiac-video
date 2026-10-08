from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import shutil
from typing import Any, Callable

from tools.control_plane.cache import voice_key
from tools.control_plane.errors import ControlPlaneError
from tools.zodiac_local import (
    DEFAULT_SPEECH_RATE_WARNING_WPS,
    DEFAULT_TTS_BACKEND,
    DEFAULT_TTS_FRAME_CAP,
    DEFAULT_TTS_MAX_CHARS,
    DEFAULT_TTS_PRECISION,
    DEFAULT_TTS_ROOT,
    PipelineError,
    concatenate_scene_voices,
    file_sha256,
    generate_scene_voices,
    scene_wav_path,
    validate_voice,
)


VoiceGenerator = Callable[
    [Path, dict[str, Any], list[str], str, dict[str, Any]],
    dict[str, float],
]


@dataclass(frozen=True)
class VoiceArtifact:
    path: Path
    input_key: str
    output_hash: str
    scene_hashes: dict[str, str]
    reused: bool


def _json_safe(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _normalized_words(value: str) -> str:
    return " ".join(str(value).replace("\r\n", "\n").replace("\r", "\n").split())


def _production_from_ir(ir: dict[str, Any]) -> dict[str, Any]:
    return {
        "scenes": [
            {
                "id": str(scene["id"]),
                "voice": str(scene["voice"]),
            }
            for scene in ir.get("scenes", [])
        ]
    }


def _legacy_generator(
    workspace: Path,
    production: dict[str, Any],
    scene_ids: list[str],
    voice_profile: str,
    settings: dict[str, Any],
) -> dict[str, float]:
    return generate_scene_voices(
        workspace,
        production,
        scene_ids,
        tts_root=Path(settings.get("tts_root") or DEFAULT_TTS_ROOT),
        tts_python=(
            Path(settings["tts_python"])
            if settings.get("tts_python")
            else None
        ),
        voice=voice_profile,
        mode=str(settings.get("mode") or "v3turbo"),
        vieneu_url=settings.get("vieneu_url"),
        backend=str(settings.get("backend") or DEFAULT_TTS_BACKEND),
        precision=str(settings.get("precision") or DEFAULT_TTS_PRECISION),
        frame_cap=str(settings.get("frame_cap") or DEFAULT_TTS_FRAME_CAP),
        max_chars=int(settings.get("max_chars") or DEFAULT_TTS_MAX_CHARS),
        speech_rate_warning_wps=float(
            settings.get("speech_rate_warning_wps")
            or DEFAULT_SPEECH_RATE_WARNING_WPS
        ),
        fp32_fallback_on_rate_warning=bool(
            settings.get("fp32_fallback_on_rate_warning", True)
        ),
        log_callback=settings.get("log_callback"),
    )


def _meta_path(workspace: Path) -> Path:
    return Path(workspace) / ".runtime" / "voice-v2.json"


def _read_meta(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _scene_hashes_valid(
    workspace: Path,
    scene_hashes: dict[str, Any],
) -> bool:
    for scene_id, expected in scene_hashes.items():
        path = scene_wav_path(workspace, scene_id)
        try:
            validate_voice(path)
        except Exception:
            return False
        if file_sha256(path) != expected:
            return False
    return True


def _cached_artifact(
    workspace: Path,
    input_key: str,
) -> VoiceArtifact | None:
    meta = _read_meta(_meta_path(workspace))
    if not meta or meta.get("input_key") != input_key:
        return None

    output = Path(workspace) / "voice.wav"
    expected_output = meta.get("output_hash")
    scene_hashes = meta.get("scene_hashes")
    if (
        not isinstance(expected_output, str)
        or not isinstance(scene_hashes, dict)
        or not scene_hashes
    ):
        return None

    try:
        validate_voice(output)
    except Exception:
        return None
    if file_sha256(output) != expected_output:
        return None
    if not _scene_hashes_valid(workspace, scene_hashes):
        return None

    return VoiceArtifact(
        path=output,
        input_key=input_key,
        output_hash=expected_output,
        scene_hashes={str(key): str(value) for key, value in scene_hashes.items()},
        reused=True,
    )


def ensure_voice_artifact(
    workspace: Path,
    ir: dict[str, Any],
    *,
    voice_profile: str,
    tts_settings: dict[str, Any],
    engine_version: str,
    generator: VoiceGenerator | None = None,
) -> VoiceArtifact:
    workspace = Path(workspace).resolve()
    narration_path = workspace / "narration.txt"
    try:
        narration = narration_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ControlPlaneError(
            code="VOICE_NARRATION_MISSING",
            stage="VOICE",
            message=f"cannot read narration.txt: {exc}",
            detail={"path": str(narration_path)},
        ) from exc

    production = _production_from_ir(ir)
    authored_narration = "\n".join(
        str(scene["voice"])
        for scene in production["scenes"]
    )
    if _normalized_words(narration) != _normalized_words(authored_narration):
        raise ControlPlaneError(
            code="VOICE_NARRATION_MISMATCH",
            stage="VOICE",
            message="narration.txt does not match Authoring IR scene voice text",
        )

    safe_settings = _json_safe(tts_settings)
    input_key = voice_key(
        narration,
        voice_profile,
        safe_settings,
        engine_version,
    )
    cached = _cached_artifact(workspace, input_key)
    if cached is not None:
        return cached

    scene_ids = [str(scene["id"]) for scene in production["scenes"]]
    runtime = workspace / ".runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    scene_root = runtime / "tts-scenes"
    if scene_root.exists():
        shutil.rmtree(scene_root)

    active_generator = generator or _legacy_generator
    try:
        active_generator(
            workspace,
            production,
            scene_ids,
            voice_profile,
            dict(tts_settings),
        )
        scene_hashes: dict[str, str] = {}
        for scene_id in scene_ids:
            path = scene_wav_path(workspace, scene_id)
            validate_voice(path)
            scene_hashes[scene_id] = file_sha256(path)

        output = concatenate_scene_voices(
            workspace,
            production,
            scene_gap_ms=float(tts_settings.get("scene_gap_ms", 0.0)),
        )
        validate_voice(output)
    except ControlPlaneError:
        raise
    except (PipelineError, OSError, RuntimeError, ValueError, TypeError) as exc:
        raise ControlPlaneError(
            code="VOICE_GENERATION_FAILED",
            stage="VOICE",
            message=f"voice generation failed: {exc}",
        ) from exc
    except Exception as exc:
        raise ControlPlaneError(
            code="VOICE_GENERATION_FAILED",
            stage="VOICE",
            message=f"voice generation failed: {exc}",
        ) from exc

    output_hash = file_sha256(output)
    meta = {
        "version": 2,
        "input_key": input_key,
        "output_hash": output_hash,
        "scene_hashes": scene_hashes,
        "voice_profile": voice_profile,
        "engine_version": engine_version,
        "tts_settings": safe_settings,
    }
    path = _meta_path(workspace)
    path.write_text(
        json.dumps(meta, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return VoiceArtifact(
        path=output,
        input_key=input_key,
        output_hash=output_hash,
        scene_hashes=scene_hashes,
        reused=False,
    )
