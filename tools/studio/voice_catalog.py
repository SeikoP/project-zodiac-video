"""VieNeu voice catalog shared by GUI, TUI and future CLI surfaces."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

DEFAULT_VOICE = "Hải Đăng"


def voice_catalog_path() -> Path:
    home = Path(os.environ.get("VIENEU_HOME") or (Path.home() / ".vieneu"))
    return home / "user_voices_v3_turbo.json"


def _load_catalog(path: Path | None = None) -> tuple[Path, dict]:
    source = Path(path) if path is not None else voice_catalog_path()
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, AttributeError):
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    return source, payload


def saved_voices(path: Path | None = None) -> list[str]:
    """Return stable saved preset names with a safe local fallback."""
    _source, payload = _load_catalog(path)
    presets = payload.get("presets", {})
    if not isinstance(presets, dict):
        presets = {}
    voices = [str(name).strip() for name in presets if str(name).strip()]
    return voices or [DEFAULT_VOICE]


def preferred_voice(voices: list[str] | None = None) -> str:
    choices = voices or saved_voices()
    if "cuongdepzai" in choices:
        return "cuongdepzai"
    return choices[0] if choices else DEFAULT_VOICE


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _profile_value_with_file_hashes(value: Any, base_dir: Path) -> Any:
    """Canonicalize a preset and fingerprint referenced local files when possible."""
    if isinstance(value, dict):
        return {
            str(key): _profile_value_with_file_hashes(item, base_dir)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, list):
        return [_profile_value_with_file_hashes(item, base_dir) for item in value]
    if isinstance(value, str):
        candidates = [Path(value).expanduser()]
        if not Path(value).is_absolute():
            candidates.append((base_dir / value).expanduser())
        for candidate in candidates:
            try:
                resolved = candidate.resolve()
            except OSError:
                continue
            if resolved.is_file():
                return {
                    "value": value,
                    "file_sha256": _file_sha256(resolved),
                }
        return value
    return value


def voice_profile_payload(
    voice: str,
    path: Path | None = None,
) -> dict:
    """Return a canonical profile snapshot used for voice artifact identity."""
    source, payload = _load_catalog(path)
    presets = payload.get("presets", {})
    preset = presets.get(voice) if isinstance(presets, dict) else None
    if preset is None:
        # Safe fallback for built-in/server-side voices whose local preset body is
        # unavailable. It is still explicit that this identity is label-only.
        return {
            "voice": voice,
            "source": "label-only",
            "preset": None,
        }
    return {
        "voice": voice,
        "source": "vieneu-user-preset",
        "preset": _profile_value_with_file_hashes(preset, source.parent),
    }


def voice_profile_hash(
    voice: str,
    path: Path | None = None,
) -> str:
    payload = voice_profile_payload(voice, path)
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()
