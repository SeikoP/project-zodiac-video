from __future__ import annotations

import re
from typing import Any

from .errors import ControlPlaneError


def _tokens(value: str) -> list[str]:
    return re.findall(r"\w+", value.casefold(), flags=re.UNICODE)


def _caption_tokens(timing_scene: dict[str, Any]) -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    for caption in timing_scene.get("captions", []):
        timestamp = float(caption.get("timestampMs", caption.get("startMs", 0)))
        for token in _tokens(str(caption.get("text", ""))):
            rows.append((token, timestamp))
    return rows


def resolve_voice_anchor(
    scene: dict[str, Any],
    timing_scene: dict[str, Any],
    trigger: dict[str, Any],
) -> int:
    scene_id = str(scene.get("id") or timing_scene.get("id") or "")
    trigger_type = str(trigger.get("type") or "")
    if trigger_type == "scene_start":
        return int(timing_scene.get("start_frame") or 0)
    if trigger_type != "voice_anchor":
        raise ControlPlaneError(
            code="ANCHOR_UNSUPPORTED",
            stage="PLAN",
            message=f"unsupported trigger type: {trigger_type!r}",
            scene_id=scene_id or None,
            detail={"trigger_type": trigger_type},
        )

    phrase = _tokens(str(trigger.get("text", "")))
    if not phrase:
        raise ControlPlaneError(
            code="ANCHOR_NOT_FOUND",
            stage="PLAN",
            message="voice anchor is empty or has no resolvable tokens",
            scene_id=scene_id or None,
            detail={"anchor": trigger.get("text")},
        )

    rows = _caption_tokens(timing_scene)
    tokens = [token for token, _timestamp in rows]
    width = len(phrase)
    matches = [
        index
        for index in range(max(0, len(tokens) - width + 1))
        if tokens[index:index + width] == phrase
    ]

    occurrence = trigger.get("occurrence")
    if occurrence is None:
        if not matches:
            raise ControlPlaneError(
                code="ANCHOR_NOT_FOUND",
                stage="PLAN",
                message=f"voice anchor {trigger.get('text')!r} was not found in measured timing",
                scene_id=scene_id or None,
                detail={"anchor": trigger.get("text"), "matches": 0},
            )
        if len(matches) > 1:
            raise ControlPlaneError(
                code="ANCHOR_AMBIGUOUS",
                stage="PLAN",
                message=f"voice anchor {trigger.get('text')!r} matched more than once",
                scene_id=scene_id or None,
                detail={"anchor": trigger.get("text"), "matches": len(matches)},
            )
        selected = matches[0]
    else:
        selected_index = int(occurrence) - 1
        if selected_index < 0 or selected_index >= len(matches):
            raise ControlPlaneError(
                code="ANCHOR_NOT_FOUND",
                stage="PLAN",
                message=f"voice anchor occurrence {occurrence} does not exist in measured timing",
                scene_id=scene_id or None,
                detail={
                    "anchor": trigger.get("text"),
                    "matches": len(matches),
                    "occurrence": occurrence,
                },
            )
        selected = matches[selected_index]

    fps = int(timing_scene.get("fps") or 24)
    scene_start = int(timing_scene.get("start_frame") or 0)
    timestamp_ms = rows[selected][1]
    return scene_start + round(timestamp_ms * fps / 1000.0)
