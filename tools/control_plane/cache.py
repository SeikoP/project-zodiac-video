from __future__ import annotations

import hashlib
import json
from typing import Any


def _normalize(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("\r\n", "\n").replace("\r", "\n")
    if isinstance(value, dict):
        return {key: _normalize(value[key]) for key in sorted(value)}
    if isinstance(value, (list, tuple)):
        return [_normalize(item) for item in value]
    return value


def _key(kind: str, payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"kind": kind, **_normalize(payload)},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def voice_key(
    narration: str,
    voice_profile: str,
    tts_settings: dict[str, Any],
    engine_version: str,
) -> str:
    return _key(
        "voice",
        {
            "narration": narration,
            "voice_profile": voice_profile,
            "tts_settings": tts_settings,
            "engine_version": engine_version,
        },
    )


def scene_voice_key(
    narration: str,
    voice_profile: str,
    tts_settings: dict[str, Any],
    engine_version: str,
) -> str:
    return _key(
        "voice.scene",
        {
            "narration": narration,
            "voice_profile": voice_profile,
            "tts_settings": tts_settings,
            "engine_version": engine_version,
        },
    )


def timing_key(
    voice_hash: str,
    narration: str,
    aligner_settings: dict[str, Any],
    aligner_version: str,
) -> str:
    return _key(
        "timing",
        {
            "voice_hash": voice_hash,
            "narration": narration,
            "aligner_settings": aligner_settings,
            "aligner_version": aligner_version,
        },
    )


def scene_timing_key(
    wav_sha256: str,
    canonical_text_hash: str,
    aligner_settings: dict[str, Any],
    aligner_version: str,
) -> str:
    return _key(
        "timing.scene",
        {
            "wav_sha256": wav_sha256,
            "canonical_text_hash": canonical_text_hash,
            "aligner_settings": aligner_settings,
            "aligner_version": aligner_version,
        },
    )


def plan_key(
    ir_hash: str,
    timing_hash: str,
    design_hash: str,
    compiler_version: str,
) -> str:
    return _key(
        "plan",
        {
            "ir_hash": ir_hash,
            "timing_hash": timing_hash,
            "design_hash": design_hash,
            "compiler_version": compiler_version,
        },
    )


def render_key(
    plan_hash: str,
    assets_hash: str,
    renderer_version: str,
    renderer_hash: str,
) -> str:
    return _key(
        "render",
        {
            "plan_hash": plan_hash,
            "assets_hash": assets_hash,
            "renderer_version": renderer_version,
            "renderer_hash": renderer_hash,
        },
    )


def audio_key(
    video_hash: str,
    voice_hash: str,
    music_hash: str,
    mix_settings: dict[str, Any],
) -> str:
    return _key(
        "audio",
        {
            "video_hash": video_hash,
            "voice_hash": voice_hash,
            "music_hash": music_hash,
            "mix_settings": mix_settings,
        },
    )
