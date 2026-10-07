"""Pure presentation helpers for the Zodiac Textual UI.

This module intentionally has no Textual dependency so its behaviour can be
covered by the regular Python unit-test job.
"""

from __future__ import annotations

from tools.studio.pipeline import (
    ALIGN_TIMING,
    CONCAT_VOICE,
    DONE,
    FAILED,
    IMPORT_PACKAGE,
    MIX_MUSIC,
    PENDING,
    PREFLIGHT,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    RUNNING,
    SKIPPED,
    VALIDATE_RUNTIME,
    VOICE_SCENES,
)

CANCELLED = "CANCELLED"

STATUS_GLYPHS = {
    DONE: "✓",
    RUNNING: "●",
    FAILED: "✕",
    SKIPPED: "–",
    PENDING: "○",
    CANCELLED: "!",
}

STATUS_LABELS = {
    DONE: "Hoàn tất",
    RUNNING: "Đang chạy",
    FAILED: "Thất bại",
    SKIPPED: "Bỏ qua",
    PENDING: "Chờ",
    CANCELLED: "Đã dừng",
}

GROUPS = (
    ("GÓI", (IMPORT_PACKAGE, PREFLIGHT)),
    ("GIỌNG", (VOICE_SCENES, CONCAT_VOICE)),
    ("TIMING", (ALIGN_TIMING,)),
    ("CHUẨN BỊ", (VALIDATE_RUNTIME, PREPARE_RENDERER)),
    ("RENDER", (RENDER_VIDEO,)),
    ("ÂM THANH", (MIX_MUSIC,)),
)


def status_glyph(status: str) -> str:
    return STATUS_GLYPHS.get(status, "?")


def status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status or "Không rõ")


def _group_status(statuses: list[str]) -> str:
    if not statuses:
        return PENDING
    if FAILED in statuses:
        return FAILED
    if CANCELLED in statuses:
        return CANCELLED
    if RUNNING in statuses:
        return RUNNING
    if all(item in (DONE, SKIPPED) for item in statuses):
        return DONE
    return PENDING


def _effective_progress(row: dict) -> float:
    status = str(row.get("status") or PENDING)
    if status in (DONE, SKIPPED):
        return 1.0
    return max(0.0, min(1.0, float(row.get("progress") or 0.0)))


def compact_pipeline_rows(rows: list[dict]) -> list[dict]:
    """Collapse the internal 9-step DAG into six operator-facing stages."""
    by_step = {row.get("step"): row for row in rows}
    compact: list[dict] = []
    for label, steps in GROUPS:
        members = [by_step[step] for step in steps if step in by_step]
        statuses = [str(row.get("status") or PENDING) for row in members]
        status = _group_status(statuses)
        progress = 0.0
        if members:
            progress = sum(_effective_progress(row) for row in members) / len(members)
        scene_done = scene_total = 0
        for row in members:
            scenes = row.get("scenes") or {}
            scene_total += len(scenes)
            scene_done += sum(1 for item in scenes.values() if item.get("status") == DONE)
        compact.append(
            {
                "label": label,
                "status": status,
                "glyph": status_glyph(status),
                "progress": progress,
                "scene_done": scene_done,
                "scene_total": scene_total,
                "steps": steps,
                "rerun_step": steps[0],
            }
        )
    return compact
