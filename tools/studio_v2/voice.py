from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Any, Callable

from tools.control_plane.cache import scene_voice_key, voice_key
from tools.control_plane.artifact_graph import ArtifactGraph
from tools.control_plane.errors import ControlPlaneError
from tools.studio.artifacts import (
    VoiceArtifactStore,
    VoiceIdentity,
    canonical_hash,
)
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
    cache_reason: str = "UNKNOWN"
    reused_scenes: int = 0
    generated_scenes: int = 0


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
    scene_ids: list[str],
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
        or set(scene_hashes) != set(scene_ids)
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
        cache_reason="REUSED_GLOBAL",
        reused_scenes=len(scene_hashes),
    )


def ensure_voice_artifact(
    workspace: Path,
    ir: dict[str, Any],
    *,
    voice_profile: str,
    tts_settings: dict[str, Any],
    engine_version: str,
    generator: VoiceGenerator | None = None,
    force: bool = False,
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
    scene_ids = [str(scene["id"]) for scene in production["scenes"]]
    scene_settings = {
        key: value for key, value in safe_settings.items() if key != "scene_gap_ms"
    }
    scene_keys = {
        str(scene["id"]): scene_voice_key(
            _normalized_words(scene["voice"]),
            voice_profile,
            scene_settings,
            engine_version,
        )
        for scene in production["scenes"]
    }
    profile_hash = canonical_hash(
        {
            "voice_profile": voice_profile,
            "voice_identity": safe_settings.get("voice_identity"),
        }
    )
    generation_profile_hash = canonical_hash(
        {"engine_version": engine_version, "settings": scene_settings}
    )
    voice_store = VoiceArtifactStore(workspace)
    scene_by_id = {str(scene["id"]): scene for scene in production["scenes"]}

    def record_scene_artifacts(
        scene_hashes: dict[str, str], generated_scene_ids: set[str] | None = None
    ) -> None:
        graph = ArtifactGraph(workspace)
        for scene_id in scene_ids:
            scene = scene_by_id[scene_id]
            text_hash = canonical_hash(_normalized_words(scene["voice"]))
            wav_path = scene_wav_path(workspace, scene_id)
            take = voice_store.active_take(scene_id)
            if (
                not take
                or take.get("wav_sha256") != scene_hashes.get(scene_id)
                or take.get("text_hash") != text_hash
                or take.get("voice_profile_hash") != profile_hash
            ):
                take = voice_store.register_approved(
                    scene_id,
                    wav_path,
                    identity=VoiceIdentity(
                        text_hash=text_hash,
                        voice_profile_hash=profile_hash,
                        generation_profile_hash=generation_profile_hash,
                        performance_context_hash=None,
                    ),
                    approval_source="studio-v2-compatibility",
                    migrated_from_checkpoint=True,
                )
            graph.record(
                f"voice.scene.{scene_id}",
                "voice.scene",
                canonical_hash({"text_hash": text_hash, "voice_profile_hash": profile_hash}),
                workspace / take["path"],
                producer="voice-artifact-store",
                producer_version=str(take.get("generation_profile_hash") or engine_version),
                approval_status="APPROVED",
                provenance={
                    "take_id": take.get("take_id"),
                    "generation_profile_hash": take.get("generation_profile_hash"),
                    "working_wav_hash": scene_hashes.get(scene_id),
                    "cache_reason": (
                        "GENERATED_NEW"
                        if generated_scene_ids and scene_id in generated_scene_ids
                        else "REUSED_APPROVED"
                    ),
                },
            )

    cached = None if force else _cached_artifact(workspace, input_key, scene_ids)
    if cached is not None:
        record_scene_artifacts(cached.scene_hashes)
        meta = _read_meta(_meta_path(workspace))
        if meta is not None and meta.get("scene_keys") != scene_keys:
            meta.update(version=3, scene_keys=scene_keys)
            _write_json_atomic(_meta_path(workspace), meta)
        return cached

    runtime = workspace / ".runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    prior = _read_meta(_meta_path(workspace)) or {}
    prior_keys = prior.get("scene_keys")
    prior_hashes = prior.get("scene_hashes")
    restored_approved: set[str] = set()
    dirty_scene_ids = []
    for scene_id in scene_ids:
        path = scene_wav_path(workspace, scene_id)
        if force:
            dirty_scene_ids.append(scene_id)
            continue
        text_hash = canonical_hash(_normalized_words(scene_by_id[scene_id]["voice"]))
        approved = voice_store.restore_approved(
            scene_id,
            path,
            text_hash=text_hash,
            voice_profile_hash=profile_hash,
            performance_context_hash=None,
        )
        if approved is not None:
            try:
                validate_voice(path)
                restored_approved.add(scene_id)
                continue
            except Exception:
                pass
        expected_hash = prior_hashes.get(scene_id) if isinstance(prior_hashes, dict) else None
        reusable = (
            isinstance(prior_keys, dict)
            and prior_keys.get(scene_id) == scene_keys[scene_id]
            and isinstance(expected_hash, str)
            and path.is_file()
        )
        if reusable:
            try:
                validate_voice(path)
                reusable = file_sha256(path) == expected_hash
            except Exception:
                reusable = False
        if not reusable:
            dirty_scene_ids.append(scene_id)

    active_generator = generator or _legacy_generator
    try:
        if dirty_scene_ids:
            active_generator(
                workspace,
                production,
                dirty_scene_ids,
                voice_profile,
                dict(tts_settings),
            )
        scene_hashes: dict[str, str] = {}
        for scene_id in scene_ids:
            path = scene_wav_path(workspace, scene_id)
            validate_voice(path)
            scene_hashes[scene_id] = file_sha256(path)
            if scene_id not in restored_approved:
                scene = scene_by_id[scene_id]
                voice_store.register_approved(
                    scene_id,
                    path,
                    identity=VoiceIdentity(
                        text_hash=canonical_hash(_normalized_words(scene["voice"])),
                        voice_profile_hash=profile_hash,
                        generation_profile_hash=generation_profile_hash,
                        performance_context_hash=None,
                    ),
                    approval_source="studio-v2-compatibility",
                    migrated_from_checkpoint=scene_id not in dirty_scene_ids,
                )

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
    record_scene_artifacts(scene_hashes, set(dirty_scene_ids))
    meta = {
        "version": 3,
        "input_key": input_key,
        "output_hash": output_hash,
        "scene_hashes": scene_hashes,
        "scene_keys": scene_keys,
        "voice_profile": voice_profile,
        "engine_version": engine_version,
        "tts_settings": safe_settings,
    }
    path = _meta_path(workspace)
    _write_json_atomic(path, meta)
    return VoiceArtifact(
        path=output,
        input_key=input_key,
        output_hash=output_hash,
        scene_hashes=scene_hashes,
        reused=False,
        cache_reason=(
            "REUSED_SCENES"
            if not dirty_scene_ids
            else "PARTIAL_REUSE"
            if len(dirty_scene_ids) < len(scene_ids)
            else "GENERATED_NEW"
        ),
        reused_scenes=len(scene_ids) - len(dirty_scene_ids),
        generated_scenes=len(dirty_scene_ids),
    )
