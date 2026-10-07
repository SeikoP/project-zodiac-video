#!/usr/bin/env python3
"""Deterministic render inputs and lightweight performance telemetry.

This module is deliberately observational. It does not skip pipeline work yet.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


_MAX_RECORDS = 500

_STEP_INPUT_KEYS = {
    "IMPORT_PACKAGE": ("package",),
    "PREFLIGHT": ("package",),
    "VOICE_SCENES": ("production",),
    "CONCAT_VOICE": ("scene_voice",),
    "ALIGN_TIMING": ("production", "scene_voice", "voice"),
    "VALIDATE_RUNTIME": (
        "production",
        "design",
        "assets",
        "voice",
        "timing",
        "music",
    ),
    "PREPARE_RENDERER": (
        "production",
        "design",
        "assets",
        "renderer",
        "voice",
        "timing",
        "publish",
        "music",
    ),
    "RENDER_VIDEO": (
        "production",
        "design",
        "assets",
        "renderer",
        "voice",
        "timing",
        "publish",
        "render_profile",
    ),
    "MIX_MUSIC": ("pristine_video", "music", "cover", "publish"),
}


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_json(value) -> str:
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return _sha256_bytes(canonical)


def _file_hash(path: Path) -> str | None:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _tree_hash(root: Path, files: Iterable[Path]) -> str | None:
    root = root.resolve()
    rows = []
    for path in sorted({Path(item).resolve() for item in files}):
        if not path.is_file() or not path.is_relative_to(root):
            continue
        rows.append(
            {
                "path": path.relative_to(root).as_posix(),
                "sha256": _file_hash(path),
            }
        )
    return _sha256_json(rows) if rows else None


def _glob_files(root: Path, patterns: tuple[str, ...]) -> list[Path]:
    files: list[Path] = []
    for pattern in patterns:
        files.extend(path for path in root.glob(pattern) if path.is_file())
    return files


def _renderer_files(root: Path) -> list[Path]:
    renderer = root / "renderer"
    files: list[Path] = []
    for relative in ("package.json", "tsconfig.json"):
        path = renderer / relative
        if path.is_file():
            files.append(path)
    files.extend(
        _glob_files(
            renderer,
            (
                "src/**/*",
                "scripts/**/*",
                "schemas/**/*",
                "tests/**/*",
            ),
        )
    )
    return files


def _music_hash(root: Path) -> str | None:
    audio = root / ".runtime" / "audio.json"
    if not audio.is_file():
        return None
    try:
        config = json.loads(audio.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return _file_hash(audio)

    rows = {"config": _file_hash(audio)}
    raw = config.get("background_music") if isinstance(config, dict) else None
    if isinstance(raw, str):
        source = (root / raw).resolve()
        if source.is_file() and source.is_relative_to(root):
            rows["media"] = _file_hash(source)
    return _sha256_json(rows)


def artifact_fingerprints(package_root: Path) -> dict[str, str | None]:
    root = Path(package_root).resolve()
    production_path = root / "production.json"
    production = None
    if production_path.is_file():
        try:
            production = json.loads(production_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            production = None

    snapshot: dict[str, str | None] = {
        "production": _file_hash(production_path),
        "design": _file_hash(root / "design.md"),
        "assets": _tree_hash(root, _glob_files(root / "assets", ("**/*.svg",))),
        "renderer": _tree_hash(root, _renderer_files(root)),
        "publish": _tree_hash(root, _glob_files(root / "publish", ("**/*",))),
        "scene_voice": _tree_hash(
            root,
            _glob_files(root / ".runtime" / "tts-scenes", ("*.wav",)),
        ),
        "voice": _file_hash(root / "voice.wav"),
        "timing": _file_hash(root / ".runtime" / "timing.json"),
        "music": _music_hash(root),
        "video": _file_hash(root / "out" / "zodiac-story.mp4"),
        "pristine_video": _file_hash(root / ".runtime" / "pristine" / "zodiac-story.mp4"),
        "cover": _file_hash(root / "out" / "cover.png"),
        "render_profile": (
            _sha256_json(
                {
                    "video": production.get("video"),
                    "codec": "h264",
                }
            )
            if isinstance(production, dict)
            else None
        ),
    }
    snapshot["package"] = _sha256_json(
        {
            key: snapshot[key]
            for key in ("production", "design", "assets", "renderer", "publish")
        }
    )
    return snapshot


def snapshot_fingerprint(snapshot: dict[str, str | None]) -> str:
    return _sha256_json(snapshot)


def step_input_fingerprint(
    step: str,
    snapshot: dict[str, str | None],
) -> str:
    keys = _STEP_INPUT_KEYS.get(step)
    if keys is None:
        keys = tuple(sorted(snapshot))
    return _sha256_json({key: snapshot.get(key) for key in keys})


class PerformanceStore:
    def __init__(self, package_root: Path) -> None:
        self.root = Path(package_root).resolve()
        self.runtime = self.root / ".runtime"
        self.path = self.runtime / "performance.json"
        self.artifacts_path = self.runtime / "artifacts.json"

    def _load(self) -> dict:
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            payload = {"version": 1, "records": []}
        if (
            not isinstance(payload, dict)
            or payload.get("version") != 1
            or not isinstance(payload.get("records"), list)
        ):
            return {"version": 1, "records": []}
        return payload

    @staticmethod
    def _atomic_write(path: Path, payload: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.name + f".{os.getpid()}.tmp")
        temp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temp, path)

    def write_artifacts(self, snapshot: dict[str, str | None]) -> None:
        self._atomic_write(
            self.artifacts_path,
            {
                "version": 1,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "fingerprints": snapshot,
            },
        )

    def append(
        self,
        *,
        step: str,
        elapsed_ms: float,
        result: str,
        input_fingerprint: str,
        output_fingerprint: str,
        cache_hit: bool | None,
        cache_reason: str | None = None,
    ) -> None:
        payload = self._load()
        payload["records"].append(
            {
                "step": step,
                "elapsed_ms": round(float(elapsed_ms), 3),
                "result": result,
                "input_fingerprint": input_fingerprint,
                "output_fingerprint": output_fingerprint,
                "cache_hit": cache_hit,
                "cache_reason": cache_reason,
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        payload["records"] = payload["records"][-_MAX_RECORDS:]
        self._atomic_write(self.path, payload)
