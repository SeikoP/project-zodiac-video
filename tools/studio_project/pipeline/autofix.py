"""Deterministic geometry repair between "Dựng video" and "Kiểm khung hình".

The technical QA of a built scene reports OUTSIDE_CANVAS and CAPTION_OCCLUSION. Both are pure layout faults with one
correct answer, so they are repaired in code (visual_autofix.mjs), not by asking a model or the user to move things.
The result is an ordinary visual.intent proposal: it goes through the same submit path, revision check and
validation as an agent proposal, so the build becomes stale and the pipeline rebuilds exactly what changed.
"""
from __future__ import annotations

FIXABLE = frozenset({"OUTSIDE_CANVAS", "CAPTION_OCCLUSION"})
MAX_ROUNDS = 2


def scenes_with_geometry_faults(snapshot: dict) -> list[str]:
    build = snapshot.get("build") or {}
    return [s["id"] for s in build.get("scenes", [])
            if any(i.get("code") in FIXABLE for i in (s.get("qa") or {}).get("issues", []))]


PROFILE_CODES = frozenset({"PHYSICAL_STORY_ENTITY_MISSING", "STORY_FOCUS_SUPPORT_INVALID", "STORY_FOCUS_LINK_INVALID"})


def propose_profile_fix(service, project_id: str, issues) -> tuple[list[dict], list[str]]:
    """([proposal item], changes): scenery named as a story entity in a scene's experience profile is removed in code.

    Only the scenes the checks step named with one of PROFILE_CODES are touched, and only when removing dressing ids changes
    something; every other issue is left to the repair agent."""
    import copy
    from ..agent_authoring import dependencies
    from ..scene_repairs import prune_non_story_references
    scene_ids = {i.scene_id for i in issues if i.code in PROFILE_CODES and i.scene_id}
    snapshot = service.visual.snapshot(project_id)
    if not scene_ids or snapshot.get("intent") is None:
        return [], []
    intent = copy.deepcopy(snapshot["intent"])
    changes: list[str] = []
    for scene in intent.get("scenes", []):
        if scene.get("id") in scene_ids:
            changes += prune_non_story_references(scene)
    if not changes:
        return [], []
    item = {"kind": "visual.intent", "payload": {"command": "source.replace", "payload": {"intent": intent}},
            "voice_dependencies": dependencies(service, project_id)}
    return [item], changes


def propose_geometry_fix(service, project_id: str) -> tuple[list[dict], list[dict]]:
    """([proposal item], changes). Both empty when nothing in the current build can be repaired."""
    from ..agent_authoring import dependencies
    snapshot = service.visual.snapshot(project_id)
    ids = scenes_with_geometry_faults(snapshot)
    if not ids or snapshot.get("intent") is None:
        return [], []
    handle = service.visual._handle(project_id)
    result = service.visual._node(handle, {"action": "autofix_geometry", "intent": snapshot["intent"],
                                           "theme": snapshot.get("theme") or "light", "scene_ids": ids})
    changes = result.get("changes") or []
    if not changes:
        return [], []
    item = {"kind": "visual.intent", "payload": {"command": "source.replace", "payload": {"intent": result["intent"]}},
            "voice_dependencies": dependencies(service, project_id)}
    return [item], changes
