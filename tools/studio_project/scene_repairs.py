"""Mechanical repairs of an authored scene that have exactly one correct answer (no model needed)."""
from __future__ import annotations

NON_STORY_ROLES = frozenset({"background", "environment", "scene_accent"})


def _is_dressing(entity: dict) -> bool:
    return str(entity.get("id", "")).startswith("depth__") or entity.get("visual_role") in NON_STORY_ROLES


def prune_non_story_references(scene: dict) -> list[str]:
    """Set dressing (depth__* and background/environment/accent entities) is scenery, not a story entity. The experience
    profile may only name story entities, so any dressing id is removed from required_physical_entities, the focus
    supporters, and every link that touches it. Ids that are not in the scene at all are left for the validator to report.
    Returns what was removed (empty when the scene was already clean)."""
    profile = scene.get("experience_profile")
    if not isinstance(profile, dict):
        return []
    dressing = {e.get("id") for e in scene.get("entities") or [] if isinstance(e, dict) and _is_dressing(e)}
    changes: list[str] = []
    required = profile.get("required_physical_entities")
    if isinstance(required, list):
        kept = [i for i in required if i not in dressing]
        if len(kept) != len(required):
            changes.append(f"{scene.get('id')}: required_physical_entities -{sorted(set(required) - set(kept))}")
            profile["required_physical_entities"] = kept
    focus = profile.get("story_focus")
    if isinstance(focus, dict):
        support = focus.get("supporting_entity_ids")
        if isinstance(support, list):
            kept = [i for i in support if i not in dressing]
            if len(kept) != len(support):
                changes.append(f"{scene.get('id')}: supporting_entity_ids -{sorted(set(support) - set(kept))}")
                focus["supporting_entity_ids"] = kept
        links = focus.get("links")
        if isinstance(links, list):
            kept_links = [l for l in links if not (isinstance(l, dict) and (l.get("from") in dressing or l.get("to") in dressing))]
            if len(kept_links) != len(links):
                changes.append(f"{scene.get('id')}: links -{len(links) - len(kept_links)}")
                focus["links"] = kept_links
    return changes
