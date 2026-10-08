from __future__ import annotations

from copy import deepcopy
from typing import Any

from .anchors import resolve_voice_anchor
from .authoring import validate_authoring_ir
from .contracts import validate_contract_shape
from .errors import ControlPlaneError


def _contract_error(code: str, message: str, issues) -> ControlPlaneError:
    return ControlPlaneError(
        code=code,
        stage="PLAN",
        message=message,
        detail={"issues": [{"path": issue.path, "message": issue.message} for issue in issues]},
    )


def _same_merge_semantics(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    return all(
        previous.get(key) == current.get(key)
        for key in ("intent", "state_before", "state_after", "desired_motion", "target")
    )


def compile_render_plan(
    ir: dict[str, Any],
    timing: dict[str, Any],
    design_token: dict[str, Any],
) -> dict[str, Any]:
    validate_authoring_ir(ir)

    timing_issues = validate_contract_shape("timing-v1", timing)
    if timing_issues:
        raise _contract_error("TIMING_INVALID", "timing does not match canonical contract", timing_issues)

    design_issues = validate_contract_shape("design-token-v4", design_token)
    if design_issues:
        raise _contract_error("DESIGN_TOKEN_INVALID", "design token does not match canonical contract", design_issues)

    if int(ir["fps"]) != int(timing["fps"]):
        raise ControlPlaneError(
            code="TIMING_INVALID",
            stage="PLAN",
            message="authoring IR fps does not match measured timing fps",
            detail={"ir_fps": ir["fps"], "timing_fps": timing["fps"]},
        )

    timing_by_scene = {scene["id"]: scene for scene in timing["scenes"]}
    motion_defaults = design_token.get("motion_defaults") or {}
    plan_scenes: list[dict[str, Any]] = []

    for scene in ir["scenes"]:
        scene_id = scene["id"]
        timing_scene = timing_by_scene.get(scene_id)
        if timing_scene is None:
            raise ControlPlaneError(
                code="TIMING_SCENE_MISSING",
                stage="PLAN",
                message=f"measured timing is missing scene {scene_id}",
                scene_id=scene_id,
            )

        measured = dict(timing_scene)
        measured["fps"] = timing["fps"]
        scene_start = int(measured["start_frame"])
        scene_end = scene_start + int(measured["duration_frames"])

        lane_last: dict[str, dict[str, Any]] = {}
        outputs: list[dict[str, Any]] = []
        entities = {entity["id"]: entity for entity in scene["entities"]}

        for authored_index, event in enumerate(scene["events"]):
            event_id = event["id"]
            target = event["target"]
            motion_id = event["desired_motion"]
            motion_profile = motion_defaults.get(motion_id)
            if not isinstance(motion_profile, dict) or not isinstance(motion_profile.get("duration_frames"), int):
                raise ControlPlaneError(
                    code="MOTION_PROFILE_MISSING",
                    stage="PLAN",
                    message=f"motion {motion_id!r} has no deterministic duration profile",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={"motion": motion_id},
                )
            duration = int(motion_profile["duration_frames"])
            preferred = resolve_voice_anchor(scene, measured, event["trigger"])
            start = preferred
            end = start + duration

            previous = lane_last.get(target)
            if previous is not None and start < previous["output"]["end_frame"]:
                policy = event["scheduling"]["merge_policy"]
                if policy == "same_intent_same_state" and _same_merge_semantics(previous["authored"], event):
                    merged = previous["output"]
                    merged["end_frame"] = max(merged["end_frame"], end)
                    merged_ids = merged.setdefault("merged_event_ids", [merged["event_id"]])
                    merged_ids.append(event_id)
                    if merged["end_frame"] > scene_end:
                        raise ControlPlaneError(
                            code="TIMELINE_SCENE_BOUNDS",
                            stage="PLAN",
                            message=f"merged event {event_id} exceeds scene bounds",
                            scene_id=scene_id,
                            event_id=event_id,
                            target=target,
                            detail={"scene_end": scene_end, "end_frame": merged["end_frame"]},
                        )
                    continue

                shifted = previous["output"]["end_frame"]
                drift = shifted - preferred
                max_drift = int(event["scheduling"]["max_drift_frames"])
                if drift > max_drift:
                    raise ControlPlaneError(
                        code="TIMELINE_TARGET_CONFLICT",
                        stage="PLAN",
                        message=f"event {event_id} cannot be scheduled on target {target!r} within drift allowance",
                        scene_id=scene_id,
                        event_id=event_id,
                        target=target,
                        detail={
                            "preferred_start": preferred,
                            "prior_end": previous["output"]["end_frame"],
                            "max_drift_frames": max_drift,
                            "required_drift_frames": drift,
                        },
                    )
                start = shifted
                end = start + duration

            if start < scene_start or end > scene_end:
                raise ControlPlaneError(
                    code="TIMELINE_SCENE_BOUNDS",
                    stage="PLAN",
                    message=f"event {event_id} falls outside scene bounds",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={
                        "scene_start": scene_start,
                        "scene_end": scene_end,
                        "start_frame": start,
                        "end_frame": end,
                    },
                )

            entity = entities[target]
            asset_before = entity["states"][event["state_before"]]["asset"]
            asset_after = entity["states"][event["state_after"]]["asset"]
            output = {
                "event_id": event_id,
                "scene_id": scene_id,
                "target": target,
                "asset_before": asset_before,
                "asset_after": asset_after,
                "preferred_start_frame": preferred,
                "start_frame": start,
                "end_frame": end,
                "state_before": event["state_before"],
                "state_after": event["state_after"],
                "motion": motion_id,
            }
            outputs.append(output)
            lane_last[target] = {
                "authored": event,
                "output": output,
                "authored_index": authored_index,
            }

        plan_scenes.append(
            {
                "id": scene_id,
                "start_frame": scene_start,
                "duration_frames": int(measured["duration_frames"]),
                "events": outputs,
            }
        )

    return {
        "format": "zodiac-render-plan@1",
        "fps": int(ir["fps"]),
        "video": deepcopy(ir["video"]),
        "assets": deepcopy(ir["assets"]),
        "scenes": plan_scenes,
    }
