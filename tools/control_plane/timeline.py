from __future__ import annotations

from copy import deepcopy
import re
from typing import Any

from .anchors import resolve_voice_anchor
from .authoring import validate_authoring_ir
from .contracts import validate_contract_shape
from .errors import ControlPlaneError
from .performance import compile_motion_duration, context_hash


FINAL_LANDING_TAIL_FRAMES = 24


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


def _caption_rows(
    timing_scene: dict[str, Any],
    *,
    fps: int,
    scene_start: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for caption in timing_scene.get("captions", []):
        text = str(caption.get("text") or "").strip()
        if not text:
            continue
        start_ms = float(caption.get("startMs", caption.get("timestampMs", 0)))
        end_ms = float(caption.get("endMs", start_ms))
        # Measured caption timestamps are absolute offsets in the entire video.
        start_frame = round(start_ms * fps / 1000.0)
        end_frame = round(end_ms * fps / 1000.0)
        if end_frame <= start_frame:
            end_frame = start_frame + 1
        rows.append(
            {
                "text": text,
                "start_frame": start_frame,
                "end_frame": end_frame,
                **({"words": [{"text": re.findall(r"\w+", text)[0],
                    "start_frame": start_ms * fps / 1000,
                    "end_frame": end_ms * fps / 1000}]}
                   if len(re.findall(r"\w+", text)) == 1 and end_ms > start_ms else {}),
            }
        )
    return rows


def _semantic_caption_rows(scene: dict[str, Any], timing_scene: dict[str, Any], *, fps: int) -> list[dict[str, Any]]:
    """Map authored semantic phrase boundaries onto *measured* timing caption spans.

    The handoff timestamps are advisory (TTS has not yet run). Only measured
    timing determines runtime frames. Each measured caption may contain several
    words; interpolate inside it, never use a one-frame duration hint.
    """
    import re

    def words(text: str) -> list[str]:
        return re.findall(r"\w+", text.casefold(), flags=re.UNICODE)

    raw = timing_scene.get("captions", [])
    if not raw:
        raise ControlPlaneError(code="CAPTION_TIMING_MISSING", stage="PLAN",
            message="measured captions are required for semantic caption alignment", scene_id=scene["id"])
    tokens: list[tuple[str, float, float, bool]] = []
    for item in raw:
        parts = words(str(item.get("text") or ""))
        if not parts:
            continue
        a = float(item.get("startMs", item.get("timestampMs", 0)))
        b = float(item.get("endMs", a))
        if b <= a:
            raise ControlPlaneError(code="CAPTION_TIMING_INVALID", stage="PLAN",
                message="measured caption duration must be positive", scene_id=scene["id"])
        for i, token in enumerate(parts):
            tokens.append((token, a + (b - a) * i / len(parts), a + (b - a) * (i + 1) / len(parts), len(parts) == 1))
    segments = scene["caption_segments"]
    wanted = [w for segment in segments for w in words(segment["text"])]
    if wanted != [token[0] for token in tokens]:
        raise ControlPlaneError(code="CAPTION_ALIGNMENT_MISMATCH", stage="PLAN",
            message="authored caption phrases do not match measured narration tokens", scene_id=scene["id"],
            detail={"expected_words": len(wanted), "measured_words": len(tokens)})
    rows: list[dict[str, Any]] = []
    offset = 0
    for segment in segments:
        length = len(words(segment["text"]))
        if length == 0:
            continue
        first, last = tokens[offset], tokens[offset + length - 1]
        start = round(first[1] * fps / 1000)
        end = max(start + 1, round(last[2] * fps / 1000))
        row = {"text": segment["text"], "start_frame": start, "end_frame": end}
        measured = tokens[offset:offset + length]
        # Group timestamps cannot prove when individual words were spoken.
        if all(token[3] for token in measured):
            row["words"] = [
                {"text": text, "start_frame": token[1] * fps / 1000,
                 "end_frame": token[2] * fps / 1000}
                for text, token in zip(re.findall(r"\w+", segment["text"]), measured)
            ]
        rows.append(row)
        offset += length
    return rows


def _presentation(design_token: dict[str, Any]) -> dict[str, Any]:
    palette = design_token.get("palette_roles")
    if not isinstance(palette, dict):
        palette = {}
    caption = design_token.get("caption_emphasis")
    if not isinstance(caption, dict):
        caption = {}
    watermark = design_token.get("brand_overlay")
    if not isinstance(watermark, dict):
        watermark = {"enabled": False}

    color_role = str(caption.get("color_role") or "ink")
    highlight_role = str(caption.get("highlight_role") or "coral")
    safe_zone = design_token.get("safe_zone")
    if not isinstance(safe_zone, dict):
        safe_zone = {"x": 72, "y": 960, "width": 936, "height": 620}

    return {
        "paper": str(palette.get("paper") or "#ffffff"),
        "ink": str(palette.get("ink") or "#111111"),
        "caption": {
            "font_family": str(caption.get("font_family") or "sans-serif"),
            "font_size_px": int(caption.get("font_size_px") or 84),
            "font_weight": int(caption.get("font_weight") or 400),
            "max_lines": int(caption.get("max_lines") or 2),
            "color": str(palette.get(color_role) or palette.get("ink") or "#111111"),
            "highlight_color": str(
                palette.get(highlight_role) or palette.get("coral") or "#e97a66"
            ),
            "safe_zone": deepcopy(safe_zone),
        },
        "watermark": {
            "enabled": bool(watermark.get("enabled", False)),
            "text": str(watermark.get("text") or ""),
            "anchor": str(watermark.get("anchor") or "top-left"),
            "offset_px": deepcopy(
                watermark.get("offset_px")
                if isinstance(watermark.get("offset_px"), dict)
                else {"x": 68, "y": 40}
            ),
            "font_family": str(watermark.get("font_family") or "sans-serif"),
            "font_size_px": int(watermark.get("font_size_px") or 29),
            "font_weight": int(watermark.get("font_weight") or 400),
            "opacity": float(watermark.get("opacity", 0.45)),
            "layer": int(watermark.get("layer") or 100),
        },
    }


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

    fps = int(ir["fps"])
    timing_by_scene = {scene["id"]: scene for scene in timing["scenes"]}
    motion_defaults = design_token.get("motion_defaults") or {}
    plan_scenes: list[dict[str, Any]] = []
    performance_contexts: dict[str, str] = {}
    final_scene_index = len(ir["scenes"]) - 1

    for scene_index, scene in enumerate(ir["scenes"]):
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
        measured_duration = int(measured["duration_frames"])
        measured_end = scene_start + measured_duration
        executable_duration = measured_duration + (
            FINAL_LANDING_TAIL_FRAMES if scene_index == final_scene_index else 0
        )
        performance_context = scene.get("performance_context")
        scene_context_hash = context_hash(performance_context)
        if scene_context_hash:
            performance_contexts[scene_id] = scene_context_hash

        lane_last: dict[str, dict[str, Any]] = {}
        outputs: list[dict[str, Any]] = []
        entities = {entity["id"]: entity for entity in scene["entities"]}

        for authored_index, event in enumerate(scene["events"]):
            event_id = event["id"]
            target = event["target"]
            motion_id = event["desired_motion"]
            motion_profile = motion_defaults.get(motion_id)
            if not isinstance(motion_profile, dict):
                raise ControlPlaneError(
                    code="MOTION_PROFILE_MISSING",
                    stage="PLAN",
                    message=f"motion {motion_id!r} has no deterministic duration profile",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={"motion": motion_id},
                )
            duration, _ = compile_motion_duration(
                scene,
                motion_profile,
                fps=fps,
            )
            preferred = resolve_voice_anchor(scene, measured, event["trigger"])
            start = preferred
            end = start + duration

            previous = lane_last.get(target)
            if previous is not None and start < previous["output"]["end_frame"]:
                policy = event["scheduling"]["merge_policy"]
                if (
                    policy == "same_intent_same_state"
                    and _same_merge_semantics(previous["authored"], event)
                ):
                    merged = previous["output"]
                    merged["end_frame"] = max(merged["end_frame"], end)
                    merged_ids = merged.setdefault(
                        "merged_event_ids", [merged["event_id"]]
                    )
                    merged_ids.append(event_id)
                    if merged["end_frame"] > measured_end:
                        raise ControlPlaneError(
                            code="TIMELINE_SCENE_BOUNDS",
                            stage="PLAN",
                            message=f"merged event {event_id} exceeds measured scene bounds",
                            scene_id=scene_id,
                            event_id=event_id,
                            target=target,
                            detail={
                                "scene_end": measured_end,
                                "end_frame": merged["end_frame"],
                            },
                        )
                    continue

                shifted = previous["output"]["end_frame"]
                drift = shifted - preferred
                max_drift = int(event["scheduling"]["max_drift_frames"])
                if drift > max_drift:
                    raise ControlPlaneError(
                        code="TIMELINE_TARGET_CONFLICT",
                        stage="PLAN",
                        message=(
                            f"event {event_id} cannot be scheduled on target "
                            f"{target!r} within drift allowance"
                        ),
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

            if start < scene_start or end > measured_end:
                raise ControlPlaneError(
                    code="TIMELINE_SCENE_BOUNDS",
                    stage="PLAN",
                    message=f"event {event_id} falls outside measured scene bounds",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={
                        "scene_start": scene_start,
                        "scene_end": measured_end,
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
                # Job@5 legacy duration-named state swaps retain their measured
                # duration from motion_defaults, but Renderer 2 only accepts state_swap.
                "motion": "state_swap" if re.fullmatch(r"state_swap_[1-9][0-9]*f", motion_id) else motion_id,
            }
            outputs.append(output)
            lane_last[target] = {
                "authored": event,
                "output": output,
                "authored_index": authored_index,
            }

        plan_scene = {
                "id": scene_id,
                "start_frame": scene_start,
                "duration_frames": executable_duration,
                "measured_duration_frames": measured_duration,
                "entities": deepcopy(scene["entities"]),
                "captions": (_semantic_caption_rows(scene, timing_scene, fps=fps)
                 if scene.get("caption_segments") else _caption_rows(
                    timing_scene, fps=fps, scene_start=scene_start,
                 )),
                "events": outputs,
            }
        if scene.get("spatial_bindings"):
            plan_scene["spatial_bindings"] = deepcopy(scene["spatial_bindings"])
        if scene.get("layout_contract"):
            plan_scene["layout_contract"] = deepcopy(scene["layout_contract"])
        if scene.get("render_density_budget"):
            plan_scene["render_density_budget"] = deepcopy(scene["render_density_budget"])
        continuity_group = (scene.get("performance_context") or {}).get("continuity_group")
        if continuity_group:
            plan_scene["continuity_group"] = continuity_group
        if scene_context_hash:
            plan_scene["performance_context_hash"] = scene_context_hash
        plan_scenes.append(plan_scene)

    result = {
        "format": "zodiac-render-plan@1",
        "fps": fps,
        "video": deepcopy(ir["video"]),
        "presentation": _presentation(design_token),
        "assets": deepcopy(ir["assets"]),
        "scenes": plan_scenes,
    }
    if performance_contexts:
        result["performance_context_hash"] = context_hash(performance_contexts)
    return result
