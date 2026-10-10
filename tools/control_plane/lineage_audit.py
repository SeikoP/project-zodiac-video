"""Job@5 IR -> executable render-plan identity/asset lineage audit.

This does not certify visual meaning, actual pixels, VieNeu, or MP4 output.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def inspect_lineage(ir: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    rows: list[dict[str, Any]] = []

    def issue(code: str, scene: str, detail: str) -> None:
        issues.append({"code": code, "scene_id": scene, "detail": detail})

    authored = {s["id"]: s for s in ir.get("scenes", [])}
    rendered = {s["id"]: s for s in plan.get("scenes", [])}
    for sid in sorted(set(authored) | set(rendered)):
        source, output = authored.get(sid), rendered.get(sid)
        if not source or not output:
            issue("SCENE_LINEAGE_MISSING", sid, "scene exists only in IR or plan")
            continue
        a_entities = {e["id"]: e for e in source.get("entities", [])}
        p_entities = {e["id"]: e for e in output.get("entities", [])}
        for eid in sorted(set(a_entities) | set(p_entities)):
            a, p = a_entities.get(eid), p_entities.get(eid)
            if not a or not p:
                issue("ENTITY_LINEAGE_MISSING", sid, eid)
                continue
            if a.get("initial_state") != p.get("initial_state"):
                issue("INITIAL_STATE_DRIFT", sid, eid)
            for state, value in a.get("states", {}).items():
                destination = p.get("states", {}).get(state)
                if not destination:
                    issue("STATE_LINEAGE_MISSING", sid, f"{eid}.{state}")
                elif destination.get("asset") != value.get("asset"):
                    issue("STATE_ASSET_DRIFT", sid, f"{eid}.{state}")
        in_events = {e["id"]: e for e in source.get("events", [])}
        out_events: dict[str, dict] = {}
        for event in output.get("events", []):
            for event_id in event.get("merged_event_ids", [event.get("event_id")]):
                if event_id in out_events:
                    issue("DUPLICATE_RENDERED_EVENT", sid, str(event_id))
                out_events[event_id] = event
        for event_id in sorted(set(in_events) | set(out_events)):
            a, p = in_events.get(event_id), out_events.get(event_id)
            if not a or not p:
                issue("EVENT_LINEAGE_MISSING", sid, event_id)
                continue
            for left, right in (("target", "target"), ("state_before", "state_before"),
                                ("state_after", "state_after"), ("desired_motion", "motion")):
                if a.get(left) != p.get(right):
                    issue("EVENT_INTENT_DRIFT", sid, f"{event_id}.{left}")
            if p.get("start_frame", -1) >= p.get("end_frame", -1):
                issue("EVENT_INTERVAL_INVALID", sid, event_id)
            rows.append({"scene_id": sid, "event_id": event_id, "target": a["target"],
                         "asset_before": p.get("asset_before"), "asset_after": p.get("asset_after"),
                         "start_frame": p.get("start_frame"), "end_frame": p.get("end_frame")})
    for asset_id in ir.get("assets", {}):
        if asset_id not in plan.get("assets", {}):
            issue("ASSET_LINEAGE_MISSING", "*", asset_id)
    return {"format": "zodiac-job5-lineage-audit@1",
            "status": "PASS" if not issues else "FAIL",
            "scenes": len(authored), "events": len(rows),
            "event_trace": sorted(rows, key=lambda r: (r["scene_id"], r["event_id"])),
            "issues": issues, "boundary": "IR_TO_RENDER_PLAN_ONLY"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Job@5 IR to Render Plan lineage")
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = args.workspace
    ir = json.loads((root / "production.ir.json").read_text(encoding="utf-8"))
    plan = json.loads((root / ".runtime/render-plan.json").read_text(encoding="utf-8"))
    report = inspect_lineage(ir, plan)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
