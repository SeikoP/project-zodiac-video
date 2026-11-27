"""Deterministic drafts for the steps that have no model task in Studio: assets, cover, publish, inspect.

Each draft is built only from what the approved intent, narrative plan and technical build already say, then goes
through the same proposal validation and source-bound receipt as an agent proposal. They are advisory evidence for the
human Visual Review; nothing here approves anything.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..models import StudioError
from .receipts import write_receipt

DRAFTED = frozenset({"assets", "cover", "publish", "inspect"})


def _intent(service, project_id: str) -> tuple[dict, dict]:
    state = service.visual.snapshot(project_id) or {}
    if not state.get("intent"):
        raise StudioError("PIPELINE_INPUT_NOT_READY", "Chưa có bản soạn hình ảnh", "pipeline")
    return state["intent"], state


def _plan(service, project_id: str) -> dict:
    path = Path(service.registry.get(project_id).workspace) / ".authoring/narrative-plan.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def draft(service, project_id: str, spec_id: str) -> tuple[str, dict] | None:
    """(proposal kind, payload) for a drafted step; None when the step only needs a receipt (assets)."""
    intent, state = _intent(service, project_id)
    scenes = intent.get("scenes") or []
    opening = intent.get("opening") or {}
    if spec_id == "assets":
        return None
    if spec_id == "cover":
        topic = str(opening.get("topic") or "").strip() or str(service.project(project_id).get("display_title") or "")
        return "cover.design", {"headline": topic[:80] or "Tập mới", "scene_id": scenes[0]["id"]}
    if spec_id == "publish":
        plan = _plan(service, project_id)
        sign = str(opening.get("sign") or plan.get("sign") or "").strip()
        topic = str(opening.get("topic") or "").strip()
        title = (f"{sign}: {topic}" if sign and topic else topic or str(service.project(project_id).get("display_title") or ""))[:100]
        goals = [str(s.get("semantic_goal") or "").strip() for s in scenes if s.get("semantic_goal")]
        description = (str(plan.get("core_premise") or "").strip() or " ".join(goals[:2]))[:2000]
        slug = "".join(ch for ch in sign.title() if ch.isalnum()) if sign else ""
        hashtags = [t for t in (f"#{slug}" if slug else "", "#cunghoangdao", "#12cunghoangdao", "#tamly", "#tinhyeu") if t]
        return "publish.copy", {"title": title or "Tập mới", "description": description, "hashtags": hashtags}
    if spec_id == "inspect":
        build = state.get("build")
        if not build:
            raise StudioError("PIPELINE_INPUT_NOT_READY", "Chưa dựng video", "pipeline")
        qa = build.get("qa") or {}
        findings = [{"scene_id": str(item.get("scene_id") or "episode"), "severity": "fail", "note": str(item.get("code") or item)[:500]}
                    for item in qa.get("issues", [])]
        findings += [{"scene_id": str(item.get("scene_id") or "episode"), "severity": "warn",
                      "note": str(item.get("detail") or item.get("code") or item)[:500]} for item in qa.get("review_warnings", [])]
        flagged = {f["scene_id"] for f in findings}
        from . import vision
        seen = vision.load(Path(service.registry.get(project_id).workspace), str(build["id"]))
        seen_rows = {r["scene_id"]: r for r in vision.inspect_findings(seen)}
        for row in seen_rows.values():  # a frame review of THIS build: its warnings are findings, its ok marks the scene as looked at
            if row["severity"] == "warn":
                findings.append(row)
                flagged.add(row["scene_id"])
        if not seen and vision.enabled():  # the human gate must see that nobody looked at this build's frames
            rows = vision.load_log(Path(service.registry.get(project_id).workspace))
            why = next((r.get("reason") for r in reversed(rows) if r.get("event") == "skipped"), None)
            findings.append({"scene_id": "episode", "severity": "warn",
                             "note": "Chưa có review khung hình cho bản dựng này" + (f": {why}" if why else " (autopilot chưa chạy bước xem hình)")})
        findings += [{"scene_id": s["id"], "severity": "ok",
                      "note": seen_rows.get(s["id"], {}).get("note") or "Không có cảnh báo kỹ thuật"} for s in scenes if s["id"] not in flagged]
        return "inspect.report", {"build_id": str(build["id"]), "method": "visual" if seen else "structural", "findings": findings[:200]}
    raise StudioError("PIPELINE_AGENT_UNSUPPORTED", f"{spec_id}: không có bản nháp", "pipeline")


def record_assets(service, project_id: str) -> None:
    """Every library reference in the intent must resolve; then the step has a receipt bound to this source."""
    from ..agent_authoring import catalog
    intent, state = _intent(service, project_id)
    known = {"library:" + row["path"] for row in catalog()["props"]}
    missing = [key for key, asset in (intent.get("assets") or {}).items()
               if isinstance(asset, dict) and str(asset.get("path", "")).startswith("library:") and asset["path"] not in known]
    if missing:
        raise StudioError("ASSETS_UNRESOLVED", "Tài nguyên không có trong thư viện: " + ", ".join(missing[:5]), "pipeline")
    write_receipt(Path(service.registry.get(project_id).workspace), "assets", source_hash=state["source_hash"],
                  payload={"resolved": len(intent.get("assets") or {})})
