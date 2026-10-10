from __future__ import annotations

import hashlib
import json
import math
from copy import deepcopy
from typing import Any


def _hash(value: Any) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def scene_asset_ids(scene: dict[str, Any]) -> set[str]:
    ids = {
        str(state["asset"])
        for entity in scene.get("entities", [])
        for state in (entity.get("states") or {}).values()
        if isinstance(state, dict) and isinstance(state.get("asset"), str)
    }
    for event in scene.get("events", []):
        for key in ("asset_before", "asset_after"):
            if isinstance(event.get(key), str):
                ids.add(event[key])
    return ids


def props_for_segment(props: dict[str, Any], segment: dict[str, Any]) -> dict[str, Any]:
    selected = set(segment["scene_ids"])
    offset = int(segment["start_frame"])
    scenes = []
    for source in props["scenes"]:
        if source["id"] not in selected:
            continue
        scene = _local_scene(source, offset)
        scenes.append(scene)
    asset_ids = set(segment["asset_ids"])
    return {
        **props,
        "scenes": scenes,
        "assets": {
            asset_id: asset
            for asset_id, asset in props.get("assets", {}).items()
            if asset_id in asset_ids
        },
    }


def _local_scene(scene: dict[str, Any], offset: int) -> dict[str, Any]:
    row = deepcopy(scene)
    row["start_frame"] = int(row["start_frame"]) - offset
    row["captions"] = [
        {
            **caption,
            "start_frame": int(caption["start_frame"]) - offset,
            "end_frame": int(caption["end_frame"]) - offset,
            **({"words": [{**word,
                "start_frame": word["start_frame"] - offset,
                "end_frame": word["end_frame"] - offset}
                for word in caption["words"]]} if "words" in caption else {}),
        }
        for caption in row.get("captions", [])
    ]
    row["events"] = [
        {
            **event,
            "start_frame": int(event["start_frame"]) - offset,
            "end_frame": int(event["end_frame"]) - offset,
            **(
                {"preferred_start_frame": int(event["preferred_start_frame"]) - offset}
                if event.get("preferred_start_frame") is not None
                else {}
            ),
        }
        for event in row.get("events", [])
    ]
    return row


def plan_segments(
    render_plan: dict[str, Any],
    *,
    renderer_version: str,
    renderer_hash: str,
    target_seconds: float = 30.0,
) -> list[dict[str, Any]]:
    """Group complete scenes into deterministic, cut-safe render segments."""
    if not math.isfinite(target_seconds) or target_seconds <= 0:
        raise ValueError("segment target duration must be a finite positive number")
    fps = int(render_plan["fps"])
    target_frames = max(1, round(target_seconds * fps))
    assets = render_plan.get("assets") or {}
    segments: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_frames = 0

    def append_segment(scenes: list[dict[str, Any]]) -> None:
        asset_ids = sorted(set().union(*(scene_asset_ids(scene) for scene in scenes)))
        input_payload = {
            "renderer_version": renderer_version,
            "renderer_hash": renderer_hash,
            "fps": fps,
            "video": render_plan.get("video"),
            "presentation": render_plan.get("presentation"),
            "scenes": [_local_scene(scene, int(scenes[0]["start_frame"])) for scene in scenes],
            "assets": {asset_id: assets[asset_id] for asset_id in asset_ids if asset_id in assets},
        }
        fingerprint = _hash(input_payload)
        scene_ids = [str(scene["id"]) for scene in scenes]
        segments.append(
            {
                "segment_id": _hash(scene_ids)[:16],
                "scene_ids": scene_ids,
                "start_frame": int(scenes[0]["start_frame"]),
                "end_frame": max(
                    int(scene["start_frame"]) + int(scene["duration_frames"])
                    for scene in scenes
                ),
                "asset_ids": asset_ids,
                "input_fingerprint": fingerprint,
            }
        )

    for scene in render_plan.get("scenes", []):
        duration = int(scene["duration_frames"])
        if current and current_frames + duration > target_frames:
            prior_group = current[-1].get("continuity_group")
            scene_group = scene.get("continuity_group")
            if not prior_group or prior_group != scene_group:
                append_segment(current)
                current = []
                current_frames = 0
        current.append(scene)
        current_frames += duration
    if current:
        append_segment(current)
    return segments
