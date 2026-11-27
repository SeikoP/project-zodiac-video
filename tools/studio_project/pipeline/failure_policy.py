"""Who fixes a finding: Core (deterministic), the model (a different choice), or the owner (a decision or new art).

The constructive chain asks the model for as little as possible: anything Core can repair by rule never costs a model call,
and anything that needs art or taste that does not exist ends as an owner card instead of a substitute.
"""
from __future__ import annotations

CORE = frozenset({
    "OUTSIDE_CANVAS", "CAPTION_OCCLUSION", "CAPTION_LANE_OVERLAP", "OFF_CANVAS", "ENTITY_OVERLAP",
    "DUPLICATE_PROP_FAMILY", "SCENE_FIELD_MISSING", "ASSET_KEY_MISSING", "LAYER_MISSING", "TRANSFORM_MISSING",
    "STORY_VISUAL_MISSING", "EVENT_STATE_CHAIN_INITIAL", "EVENT_STATE_CHAIN_DISCONNECTED", "EXPORT_ACTING_TIMING_INVALID",
})
OWNER = frozenset({
    "NEW_VARIANT_MASTER_REQUIRED", "ASSET_REQUEST", "VOICE_CHANGED", "CATALOG_GAP", "SCENE_UNBUILDABLE",
})


# Findings that come from WHEN things happen, not from what is on stage: only the act (events) is chosen again for these.
ACT_ORIGIN = frozenset({
    "PASSIVE_STORYTELLING", "PASSIVE_ACCENT_ONLY", "STORY_FOCUS_DISCONNECTED", "STORY_ENTITY_UNLINKED", "CHARACTER_ACTION_MISSING",
    "SCENE_EVENTS_MISSING", "PROP_IDLE", "EVENT_TARGET_MISSING", "EVENT_STATE_AFTER_MISSING", "EVENT_STATE_BEFORE_MISSING",
})


def origin(issue: dict) -> str:
    """Which choice produced the finding: 'act' (events and timing) or 'stage' (frame, cast, props, accent), the broader one."""
    return "act" if str((issue or {}).get("code") or "") in ACT_ORIGIN else "stage"


def route(issue: dict) -> str:
    """'core' | 'model' | 'owner' for one finding (a dict with a `code`). Unknown quality findings go to the model."""
    code = str((issue or {}).get("code") or "")
    if code == "PROPOSAL_INVALID" and not (issue or {}).get("scene_id"):
        return "owner"  # the merged episode is wrong somewhere no scene owns (cover, cast, assets): choosing scene 1 again cannot fix it
    if code in OWNER or code.startswith("NEW_"):
        return "owner"
    if code in CORE:
        return "core"
    return "model"
