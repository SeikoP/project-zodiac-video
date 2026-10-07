"""VieNeu voice catalog shared by GUI, TUI and future CLI surfaces."""

from __future__ import annotations

import json
import os
from pathlib import Path

DEFAULT_VOICE = "Hải Đăng"


def voice_catalog_path() -> Path:
    home = Path(os.environ.get("VIENEU_HOME") or (Path.home() / ".vieneu"))
    return home / "user_voices_v3_turbo.json"


def saved_voices(path: Path | None = None) -> list[str]:
    """Return stable saved preset names with a safe local fallback."""
    source = Path(path) if path is not None else voice_catalog_path()
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
        presets = payload.get("presets", {})
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, AttributeError):
        presets = {}

    if not isinstance(presets, dict):
        presets = {}

    voices = [str(name).strip() for name in presets if str(name).strip()]
    return voices or [DEFAULT_VOICE]


def preferred_voice(voices: list[str] | None = None) -> str:
    choices = voices or saved_voices()
    if "cuongdepzai" in choices:
        return "cuongdepzai"
    return choices[0] if choices else DEFAULT_VOICE
