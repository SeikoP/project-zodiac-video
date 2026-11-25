"""Tracks agent tasks started for pipeline nodes (agent work is not visible in voice/visual jobs)."""
from __future__ import annotations

_ACTIVE = ("STARTING", "RUNNING")


def friendly_error(raw: str) -> str:
    """One plain Vietnamese line for the step list; the full text stays in the agent panel's details."""
    first = (raw or "").strip().splitlines()[0] if (raw or "").strip() else ""
    if "exceeded time limit" in first:
        return "Agent quá thời gian cho phép. Bấm Chạy lại."
    if "Expecting" in first and "delimiter" in first or "Unterminated string" in first:
        return "Agent trả dữ liệu bị hỏng giữa chừng. Bấm Chạy lại."
    if "text_overflow" in first:
        return "Chữ trong khung Story Visual quá dài. Bấm Chạy lại để agent rút gọn."
    return first or "Agent không hoàn thành"


def progress(service, project_id: str) -> dict[str, str]:
    """{node: "lượt 2/3 · 3 phút"} for a running tracked agent task, so a long run does not look frozen."""
    import time
    entry = tracked(service, project_id)
    if entry is None:
        return {}
    node_id, task_id = entry
    try:
        task = service.agent.task(task_id)
    except Exception:
        return {}
    if task.get("status") not in _ACTIVE:
        if task.get("status") == "COMPLETED" and task.get("suggestion") and not task.get("write_applied"):
            return {node_id: "Đã có đề xuất, mở bước này rồi bấm Áp dụng"}
        return {}
    minutes = max(0, int(time.time() - float(task.get("started_at") or time.time())) // 60)
    if task.get("parts_total"):  # scene-by-scene authoring: show how far the scenes are
        parts = task.get("parts") or []
        done = sum(1 for p in parts if p["id"] != "skeleton" and p.get("status") == "DONE")
        busy = sum(1 for p in parts if p.get("status") == "RUNNING")
        head = "đang soạn khung nhân vật" if not any(p["id"] == "skeleton" and p.get("status") == "DONE" for p in parts) else f"{done}/{task['parts_total']} cảnh xong"
        return {node_id: f"{head} · {busy} agent · {minutes} phút" if minutes else f"{head} · {busy} agent"}
    attempt = len(task.get("validation_attempts") or []) + 1
    return {node_id: f"lượt {attempt}/3 · {minutes} phút" if minutes else f"lượt {attempt}/3 · dưới 1 phút"}


def _runs(service) -> dict:
    return service.__dict__.setdefault("_pipeline_agent_runs", {})


def track(service, project_id: str, node_id: str, task_id: str) -> None:
    _runs(service)[project_id] = (node_id, task_id)


def tracked(service, project_id: str) -> tuple[str, str] | None:
    return _runs(service).get(project_id)


def forget(service, project_id: str) -> None:
    _runs(service).pop(project_id, None)


def overlay(service, project_id: str) -> tuple[str | None, dict[str, str]]:
    """(running node id, failed {node: message}) for the tracked agent task, if any."""
    entry = tracked(service, project_id)
    if entry is None:
        return None, {}
    node_id, task_id = entry
    try:
        task = service.agent.task(task_id)
    except Exception:  # task unreadable: stop tracking, never invent progress
        forget(service, project_id)
        return None, {}
    status = task.get("status")
    if status in _ACTIVE:
        return node_id, {}
    if status == "FAILED":
        # Keep the failure until the node is run again (track() replaces it); dropping it after one poll made the
        # step flip back to "Sẵn sàng" and hid why the agent stopped.
        return None, {node_id: friendly_error(str(task.get("error") or ""))[:300]}
    if status == "COMPLETED" and task.get("suggestion") and not task.get("write_applied"):
        return None, {}  # keep tracking until the proposal is applied, so the step can say it is waiting for that
    forget(service, project_id)
    return None, {}
