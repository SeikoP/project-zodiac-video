from __future__ import annotations

import json
from pathlib import Path
import tempfile
from typing import Any

from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_io import extract_package_archive
from tools.studio_v2.pipeline import (
    AUDIO,
    DONE,
    FAILED,
    OUTPUT,
    PACKAGE,
    PENDING,
    PLAN,
    RENDER,
    RUNNING,
    TIMING,
    VOICE,
    PipelineStateV2,
)


_LABELS = {
    PACKAGE: "GÓI",
    VOICE: "GIỌNG",
    TIMING: "TIMING",
    PLAN: "KẾ HOẠCH",
    RENDER: "RENDER",
    AUDIO: "ÂM THANH",
    OUTPUT: "OUTPUT",
}

_GLYPHS = {
    DONE: "✓",
    RUNNING: "●",
    FAILED: "✕",
    PENDING: "○",
}


def _read_manifest(root: Path) -> dict[str, Any]:
    path = Path(root) / "package-manifest.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message=f"cannot read package-manifest.json: {exc}",
        ) from exc
    if not isinstance(value, dict):
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="package-manifest.json root must be an object",
        )
    return value


def detect_job5_manifest(source: Path) -> dict[str, Any] | None:
    source = Path(source).resolve()
    if source.is_dir():
        manifest = _read_manifest(source)
        return manifest if manifest.get("format") == "zodiac-job@5" else None
    if not source.is_file() or source.suffix.casefold() != ".zip":
        return None

    with tempfile.TemporaryDirectory(prefix="zodiac-tui-detect-") as temp:
        root = extract_package_archive(source, Path(temp) / "package")
        manifest = _read_manifest(root)
        return manifest if manifest.get("format") == "zodiac-job@5" else None


def job5_workspace_path(
    workspace_root: Path,
    manifest: dict[str, Any],
    *,
    archive_name: str | None = None,
) -> Path:
    del archive_name
    job = manifest.get("job")
    if not isinstance(job, dict):
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="zodiac-job@5 manifest is missing stable job identity",
        )
    job_id = job.get("id")
    if not isinstance(job_id, str) or not job_id:
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="zodiac-job@5 job.id is invalid",
        )
    return Path(workspace_root).resolve() / "v2" / "jobs" / job_id


def _error_detail(error: dict[str, Any] | None) -> str:
    if not error:
        return ""
    code = str(error.get("code") or "UNKNOWN")
    message = str(error.get("message") or "")
    context = " · ".join(
        str(value)
        for value in (
            error.get("scene_id"),
            error.get("event_id"),
            error.get("target"),
        )
        if value
    )
    result = f"{code}: {message}".strip()
    return f"{result} · {context}" if context else result


def v2_pipeline_rows(state: PipelineStateV2) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for step in (PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
        item = state.steps[step]
        detail = _error_detail(item.error)
        if not detail and item.status == DONE:
            detail = "Dùng lại" if item.reused else "Tạo mới"
        rows.append(
            {
                "step": step,
                "label": _LABELS[step],
                "status": item.status,
                "glyph": _GLYPHS.get(item.status, "?"),
                "progress": 1.0 if item.status == DONE else (0.5 if item.status == RUNNING else 0.0),
                "scene_done": 0,
                "scene_total": 0,
                "detail": detail,
                "reused": item.reused,
            }
        )
    return rows
