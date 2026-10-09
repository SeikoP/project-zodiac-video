"""Full-package preflight for Job@5 semantic voice anchors and dependent actions.

This is intentionally pure and runs BEFORE import: collect all deterministic
errors in one pass. TTS word timings still belong to the local timeline step.
"""
from __future__ import annotations

from typing import Any

from .authoring import _tokens


def _matches(voice: str, phrase: str) -> list[int]:
    words, needle = _tokens(voice), _tokens(phrase)
    if not needle:
        return []
    return [
        at for at in range(len(words) - len(needle) + 1)
        if words[at:at + len(needle)] == needle
    ]


def inspect_import_readiness(ir: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []

    def add(code: str, severity: str, scene: str, event: str, detail: str) -> None:
        issues.append({"code": code, "severity": severity,
                       "scene_id": scene, "event_id": event, "detail": detail})

    for scene in ir.get("scenes", []):
        sid = scene.get("id", "?")
        events = scene.get("events", [])
        positions: dict[str, int] = {}
        for event in events:
            eid = event["id"]
            trigger = event["trigger"]
            if trigger["type"] == "scene_start":
                positions[eid] = -1
            elif trigger["type"] == "voice_anchor":
                text = trigger.get("text", "")
                occurrences = _matches(scene.get("voice", ""), text)
                chosen = trigger.get("occurrence")
                if not occurrences:
                    add("ANCHOR_NOT_FOUND", "P1", sid, eid,
                        f"anchor={text!r} matches=0")
                elif chosen is None and len(occurrences) > 1:
                    add("ANCHOR_AMBIGUOUS", "P1", sid, eid,
                        f"anchor={text!r} matches={len(occurrences)}; set occurrence or use unique phrase")
                elif chosen is not None and (
                    not isinstance(chosen, int) or isinstance(chosen, bool)
                    or chosen < 1 or chosen > len(occurrences)
                ):
                    add("ANCHOR_OCCURRENCE_INVALID", "P1", sid, eid,
                        f"anchor={text!r} occurrence={chosen!r} matches={len(occurrences)}")
                else:
                    positions[eid] = occurrences[(chosen or 1) - 1]
                    if len(_tokens(text)) == 1:
                        add("ANCHOR_FRAGILE", "P2", sid, eid,
                            f"anchor={text!r} is a single word; prefer a short distinct phrase")
            # Validate motion contracts before costly TTS and alignment.
            if event["desired_motion"] == "state_swap" and event["state_before"] == event["state_after"]:
                add("NOOP_STATE_SWAP", "P1", sid, eid,
                    "state_swap has identical before/after state")

        bindings = {
            row["entity"]: row["anchor"]
            for row in scene.get("spatial_bindings", [])
            if row.get("relation") == "points_to"
        }
        # A drawn mark must not be displayed BEFORE its writing gesture.
        for drawing in events:
            if drawing["desired_motion"] != "slide":
                continue
            anchor_id = bindings.get(drawing["target"])
            if not anchor_id:
                continue
            for surface in events:
                if (surface["target"] != anchor_id
                    or surface["desired_motion"] != "state_swap"
                    or drawing["id"] not in positions
                    or surface["id"] not in positions):
                    continue
                if positions[drawing["id"]] > positions[surface["id"]]:
                    add("EVENT_DEPENDENCY_REVERSED", "P1", sid, drawing["id"],
                        f"slide of {drawing['target']} starts after {surface['id']} marks {anchor_id}; "
                        "writing gesture must precede visible mark")
    return issues


def blocking_import_issues(ir: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in inspect_import_readiness(ir) if item["severity"] == "P1"]
