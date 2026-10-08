from __future__ import annotations

import hashlib
import json
from typing import Any

from .contracts import validate_contract_shape
from .errors import ControlPlaneError


def context_hash(context: dict[str, Any] | None) -> str | None:
    if not context:
        return None
    canonical = json.dumps(
        context,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def compile_motion_duration(
    scene: dict[str, Any],
    motion_profile: dict[str, Any],
    *,
    fps: int,
) -> tuple[int, dict[str, Any] | None]:
    context = scene.get("performance_context")
    if context is not None:
        issues = validate_contract_shape("performance-context-v1", context)
        if issues:
            raise ControlPlaneError(
                code="PERFORMANCE_CONTEXT_INVALID",
                stage="PLAN",
                scene_id=str(scene.get("id") or ""),
                message="scene performance context is invalid",
                detail={"issues": [{"path": issue.path, "message": issue.message} for issue in issues]},
            )
    duration_ms = (
        (context or {}).get("transition_duration_ms")
        or (context or {}).get("motion_duration_ms")
        or motion_profile.get("duration_ms")
    )
    if duration_ms is not None:
        pace = (context or {}).get("pace", "medium")
        pace_scale = {"slow": 1.15, "medium": 1.0, "fast": 0.85}[pace]
        return max(1, round(float(duration_ms) * pace_scale * fps / 1000)), context
    duration_frames = motion_profile.get("duration_frames")
    if not isinstance(duration_frames, int) or duration_frames <= 0:
        raise ControlPlaneError(
            code="MOTION_PROFILE_MISSING",
            stage="PLAN",
            scene_id=str(scene.get("id") or ""),
            message="motion profile needs duration_ms or legacy duration_frames",
        )
    return duration_frames, context
