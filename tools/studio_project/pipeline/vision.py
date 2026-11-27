"""The frame-review loop of the autopilot: look at the built frames, fix only the scenes that look wrong, look again.

Cost policy (owner's choice): the vision role is the only expensive call, one per round and one batch of images for all
scenes; the repairs it triggers run on the cheaper repair role. At most MAX_ROUNDS rounds, then the findings that remain
go to the human Visual Review as warnings. Nothing here approves anything, and a failure to review never blocks the
pipeline: no Codex, a stale build or a scene that has not passed the technical QA simply skips the review.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Callable

from .. import agent_frame_review
from ..models import StudioError

MAX_ROUNDS = 2
POLL_SECONDS = 1.0
TIMEOUT_SECONDS = 360


def enabled() -> bool:
    return os.environ.get("ZODIAC_STUDIO_VISION_REVIEW", "on").strip().lower() not in ("off", "0", "false", "no")


def _path(workspace: Path) -> Path:
    return Path(workspace) / ".runtime/pipeline/vision-review.json"


last_skip: str | None = None  # why the latest review_current_build call did not produce a review


def _skip(reason: str) -> None:
    global last_skip
    last_skip = reason


def _log_path(workspace: Path) -> Path:
    return Path(workspace) / ".runtime/pipeline/vision-log.json"


def log(workspace: Path, entry: dict) -> None:
    """Append one line to the visible history of the review loop (reviewed / skipped and why / fixed which scenes)."""
    rows = load_log(workspace)
    rows.append({"at": time.time(), **entry})
    target = _log_path(workspace)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(rows[-40:], ensure_ascii=False), "utf-8")
    except OSError:
        pass


def load_log(workspace: Path) -> list[dict]:
    try:
        rows = json.loads(_log_path(workspace).read_text("utf-8"))
    except (OSError, ValueError):
        return []
    return rows if isinstance(rows, list) else []


def save(workspace: Path, build_id: str, round_no: int, review: dict) -> None:
    target = _path(workspace)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"build_id": build_id, "round": round_no, "review": review}, ensure_ascii=False), "utf-8")


def load(workspace: Path, build_id: str) -> dict | None:
    """The saved review of exactly this build, or None (a review of an older build says nothing about this one)."""
    try:
        data = json.loads(_path(workspace).read_text("utf-8"))
    except (OSError, ValueError):
        return None
    return data if data.get("build_id") == build_id and isinstance(data.get("review"), dict) else None


def review_current_build(service, project_id: str, stopped: Callable[[], bool], track: Callable[[str], None] | None = None,
                         sleep: Callable[[float], None] = time.sleep) -> tuple[str, dict] | None:
    """(build_id, validated review) of the current build, or None when it cannot be reviewed right now."""
    _skip("")
    snapshot = service.visual.snapshot(project_id)
    build = snapshot.get("build")
    if not build or build.get("revision") != snapshot.get("revision") or not snapshot.get("intent"):
        _skip("bản dựng không khớp nguồn hình ảnh hiện tại")
        return None
    try:
        frames = service.visual.review_frames(project_id, agent_frame_review.plan_times(build))
        task = agent_frame_review.build_task(snapshot["intent"], frames)
        started = service.agent.start_frame_review(project_id, task)
    except StudioError as error:
        _skip(f"không gửi được khung hình cho agent ({error.code})")
        return None
    if track:
        track(started["task_id"])
    deadline = time.time() + TIMEOUT_SECONDS
    while time.time() < deadline:
        if stopped():
            service.agent.cancel(started["task_id"])
            _skip("đã dừng")
            return None
        current = service.agent.task(started["task_id"])
        if current["status"] == "COMPLETED":
            try:
                return build["id"], json.loads(agent_frame_review.validate(current["suggestion"], task))
            except (StudioError, ValueError):
                _skip("agent trả kết quả review không đọc được")
                return None
        if current["status"] in ("FAILED", "CANCELLED", "INTERRUPTED"):
            _skip(f"agent review {current['status']}")
            return None
        sleep(POLL_SECONDS)
    service.agent.cancel(started["task_id"])
    _skip("agent review quá thời gian")
    return None


def inspect_findings(review: dict | None) -> list[dict]:
    """inspect.report findings from a frame review: one per scene, 'warn' with the model's words when it asked for a fix."""
    if not review:
        return []
    rows = []
    for row in review["review"]["scenes"]:
        if row["verdict"] == "fix":
            note = "; ".join(f"{i['code']}: {i['note']}" for i in row["issues"])[:480]
            rows.append({"scene_id": row["scene_id"], "severity": "warn", "note": "Xem khung hình: " + note})
        else:
            rows.append({"scene_id": row["scene_id"], "severity": "ok", "note": "Đã xem khung hình đã dựng, không có vấn đề"})
    return rows
