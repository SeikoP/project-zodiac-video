from __future__ import annotations

from collections import defaultdict
from typing import Any

from .contracts import validate_contract_shape
from .errors import ControlPlaneError


def _fail(
    code: str,
    message: str,
    *,
    scene_id: str | None = None,
    event_id: str | None = None,
    target: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    raise ControlPlaneError(
        code=code,
        stage="PLAN",
        message=message,
        scene_id=scene_id,
        event_id=event_id,
        target=target,
        detail=detail or {},
    )


def _represented_ids(event: dict[str, Any]) -> list[str]:
    merged = event.get("merged_event_ids")
    if merged is None:
        return [event["event_id"]]
    if not isinstance(merged, list) or not merged or merged[0] != event["event_id"]:
        _fail(
            "PLAN_EVENT_DUPLICATE",
            "merged_event_ids must begin with the primary event_id",
            scene_id=event.get("scene_id"),
            event_id=event.get("event_id"),
            target=event.get("target"),
        )
    return [str(value) for value in merged]


def target_overlap_count(plan: dict[str, Any]) -> int:
    overlaps = 0
    for scene in plan.get("scenes", []):
        lanes: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for event in scene.get("events", []):
            lanes[str(event.get("target"))].append(event)
        for events in lanes.values():
            ordered = sorted(
                events,
                key=lambda event: (
                    int(event.get("start_frame", 0)),
                    int(event.get("end_frame", 0)),
                    str(event.get("event_id", "")),
                ),
            )
            previous_end: int | None = None
            for event in ordered:
                start = int(event.get("start_frame", 0))
                end = int(event.get("end_frame", 0))
                if previous_end is not None and start < previous_end:
                    overlaps += 1
                previous_end = max(previous_end or end, end)
    return overlaps


def validate_render_plan(
    plan: dict[str, Any],
    ir: dict[str, Any] | None = None,
) -> None:
    issues = validate_contract_shape("render-plan-v1", plan)
    if issues:
        _fail(
            "PLAN_SCHEMA_INVALID",
            "render plan does not match canonical schema",
            detail={"issues": [{"path": issue.path, "message": issue.message} for issue in issues]},
        )

    seen_ids: set[str] = set()
    for scene in plan["scenes"]:
        for event in scene["events"]:
            represented = _represented_ids(event)
            if len(set(represented)) != len(represented):
                _fail(
                    "PLAN_EVENT_DUPLICATE",
                    "one render-plan interval represents the same event id more than once",
                    scene_id=scene["id"],
                    event_id=event["event_id"],
                    target=event["target"],
                    detail={"event_ids": represented},
                )
            for event_id in represented:
                if event_id in seen_ids:
                    _fail(
                        "PLAN_EVENT_DUPLICATE",
                        f"duplicate event identity: {event_id}",
                        scene_id=scene["id"],
                        event_id=event_id,
                        target=event["target"],
                    )
                seen_ids.add(event_id)

    for scene in plan["scenes"]:
        scene_start = int(scene["start_frame"])
        scene_end = scene_start + int(scene["duration_frames"])
        for event in scene["events"]:
            start = int(event["start_frame"])
            end = int(event["end_frame"])
            if start < scene_start or end > scene_end or end <= start:
                _fail(
                    "PLAN_SCENE_BOUNDS",
                    f"event {event['event_id']} falls outside executable scene bounds",
                    scene_id=scene["id"],
                    event_id=event["event_id"],
                    target=event["target"],
                    detail={
                        "scene_start": scene_start,
                        "scene_end": scene_end,
                        "start_frame": start,
                        "end_frame": end,
                    },
                )

    if target_overlap_count(plan):
        for scene in plan["scenes"]:
            lanes: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for event in scene["events"]:
                lanes[event["target"]].append(event)
            for target, events in lanes.items():
                ordered = sorted(events, key=lambda event: (event["start_frame"], event["end_frame"], event["event_id"]))
                previous = None
                for event in ordered:
                    if previous is not None and event["start_frame"] < previous["end_frame"]:
                        _fail(
                            "PLAN_TARGET_OVERLAP",
                            f"events on target {target!r} overlap in executable plan",
                            scene_id=scene["id"],
                            event_id=event["event_id"],
                            target=target,
                            detail={
                                "prior_event_id": previous["event_id"],
                                "prior_end": previous["end_frame"],
                                "start_frame": event["start_frame"],
                            },
                        )
                    previous = event

    if ir is None:
        return

    ir_scene_by_id = {scene["id"]: scene for scene in ir.get("scenes", [])}
    assets = plan["assets"]

    for scene in plan["scenes"]:
        source_scene = ir_scene_by_id.get(scene["id"])
        if source_scene is None:
            _fail("PLAN_STATE_INVALID", f"plan scene {scene['id']} has no authoring source", scene_id=scene["id"])
        entities = {entity["id"]: entity for entity in source_scene.get("entities", [])}

        lanes: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for event in scene["events"]:
            target = event["target"]
            entity = entities.get(target)
            if entity is None:
                _fail(
                    "PLAN_STATE_INVALID",
                    f"target {target!r} does not exist in authoring scene",
                    scene_id=scene["id"],
                    event_id=event["event_id"],
                    target=target,
                )
            states = entity.get("states", {})
            for field in ("state_before", "state_after"):
                state_id = event[field]
                state = states.get(state_id)
                if state is None:
                    _fail(
                        "PLAN_STATE_INVALID",
                        f"{field} state {state_id!r} does not exist on target {target!r}",
                        scene_id=scene["id"],
                        event_id=event["event_id"],
                        target=target,
                    )
                asset_id = state.get("asset") if isinstance(state, dict) else None
                if asset_id is not None and asset_id not in assets:
                    _fail(
                        "PLAN_ASSET_MISSING",
                        f"state {state_id!r} references missing asset {asset_id!r}",
                        scene_id=scene["id"],
                        event_id=event["event_id"],
                        target=target,
                        detail={"asset_id": asset_id, "state_id": state_id},
                    )
            lanes[target].append(event)

        for target, events in lanes.items():
            ordered = sorted(events, key=lambda event: (event["start_frame"], event["end_frame"], event["event_id"]))
            previous = None
            for event in ordered:
                if previous is not None and previous["state_after"] != event["state_before"]:
                    _fail(
                        "PLAN_STATE_INVALID",
                        f"state continuity breaks on target {target!r}",
                        scene_id=scene["id"],
                        event_id=event["event_id"],
                        target=target,
                        detail={
                            "prior_state_after": previous["state_after"],
                            "state_before": event["state_before"],
                        },
                    )
                previous = event
