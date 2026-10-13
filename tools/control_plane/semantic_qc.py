"""Deterministic semantic QC for modern Job@5 packages.

Read-only: legacy packages remain importable, new producers fail closed.
No runtime-generated frames or asset synthesis happens here.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Any


@dataclass(frozen=True)
class Diagnostic:
    code: str
    severity: str
    scene_id: str | None = None
    entity_id: str | None = None
    detail: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def asset_category_from_path(path: str) -> str | None:
    clean = "/" + path.replace("\\", "/").lstrip("/").lower()
    for folder, category in (
        ("/characters/", "character"), ("/effects/", "effect"),
        ("/props/", "prop"), ("/story/", "story_object"),\n        ("/symbols/", "story_symbol"), ("/environment/", "environment"),
        ("/environments/", "environment"),
    ):
        if folder in clean:
            return category
    return None


def _center(state: dict[str, Any]) -> tuple[float, float] | None:
    transform = state.get("transform")
    if not isinstance(transform, dict):
        return None
    try:
        return (float(transform["x"]) + float(transform["width"]) / 2,
                float(transform["y"]) + float(transform["height"]) / 2)
    except (KeyError, TypeError, ValueError):
        return None


def semantic_diagnostics(ir: dict[str, Any]) -> list[Diagnostic]:
    out: list[Diagnostic] = []
    assets = ir.get("assets", {})
    for asset_id, asset in assets.items():
        inferred = asset_category_from_path(str(asset.get("path", "")))
        if inferred and asset.get("category") != inferred:
            out.append(Diagnostic("ASSET_CATEGORY_MISMATCH", "P1", entity_id=asset_id,
                                  detail=f"path implies {inferred}; declared {asset.get('category')!r}"))
    for scene in ir.get("scenes", []):
        sid = str(scene.get("id", "<unknown>"))
        entities = {e["id"]: e for e in scene.get("entities", [])}
        events = scene.get("events", [])
        targets = {e.get("target") for e in events}
        bindings = {b["entity"]: b for b in scene.get("spatial_bindings", [])}
        for entity_id, entity in entities.items():
            states = entity.get("states", {})
            categories = {
                asset_category_from_path(str(assets.get(st.get("asset"), {}).get("path", "")))
                for st in states.values()
            } - {None}
            if len(categories) > 1:
                out.append(Diagnostic("ENTITY_MIXED_CATEGORIES", "P1", sid, entity_id))
            category = next(iter(categories), None)
            if category == "effect":
                if entity_id not in targets:
                    out.append(Diagnostic("EFFECT_UNSCHEDULED", "P1", sid, entity_id,
                                          "effect requires explicit lifecycle events"))
                else:
                    if states.get(entity.get("initial_state"), {}).get("visible", True) is not False:
                        out.append(Diagnostic("EFFECT_VISIBLE_BEFORE_EVENT", "P1", sid, entity_id))
                    if not any(states.get(e.get("state_after"), {}).get("visible") is False
                               for e in events if e.get("target") == entity_id):
                        out.append(Diagnostic("EFFECT_NO_RELEASE", "P1", sid, entity_id))
            elif category == "prop" and entity_id not in targets:
                binding = bindings.get(entity_id, {})
                relation = binding.get("relation")
                anchor_id = binding.get("anchor")
                owner = entities.get(anchor_id)
                owner_categories = (
                    {
                        asset_category_from_path(str(assets.get(st.get("asset"), {}).get("path", "")))
                        for st in owner.get("states", {}).values()
                    } - {None}
                    if owner else set()
                )
                # Producer v2.2.27 parity: a single, visible, held prop may
                # follow a real owning-character gesture without a duplicate
                # prop event. Complex/unowned interactive props still block.
                static_visible = (
                    len(states) == 1
                    and next(iter(states.values())).get("visible") is not False
                )
                owner_gestures = any(
                    event.get("target") == anchor_id
                    and event.get("state_before") != event.get("state_after")
                    for event in events
                )
                if (
                    relation == "held_by"
                    and static_visible
                    and owner_categories == {"character"}
                    and owner_gestures
                ):
                    out.append(Diagnostic(
                        "STATIC_HELD_PROP_OWNER_GESTURE", "P2", sid, entity_id,
                        "static held prop follows the character gesture; verify spatial timing",
                    ))
                elif relation in {"held_by", "points_to"}:
                    out.append(Diagnostic("INTERACTIVE_PROP_UNSCHEDULED", "P1", sid, entity_id))
                else:
                    out.append(Diagnostic("PROP_STATIC_REVIEW", "P2", sid, entity_id))
            elif category == "character" and len(states) > 1 and entity_id not in targets:
                out.append(Diagnostic("UNUSED_CHARACTER_STATES", "P2", sid, entity_id))
        # Authoring-stage temporal binding preflight. The renderer resolves
        # exact frames later; here we reject deterministic hidden-anchor errors
        # and cyclic relationships before releasing the ZIP.
        links = [(b.get("entity"), b.get("anchor")) for b in scene.get("spatial_bindings", [])]
        for subject_id, anchor_id in links:
            if (anchor_id, subject_id) in links:
                out.append(Diagnostic("SPATIAL_BINDING_CYCLE", "P1", sid, subject_id,
                                      f"{subject_id} <-> {anchor_id}"))
        current = {eid: entity.get("initial_state") for eid, entity in entities.items()}
        def check_anchor(stage: str) -> None:
            for binding in scene.get("spatial_bindings", []):
                subject = entities.get(binding.get("entity"))
                anchor = entities.get(binding.get("anchor"))
                if subject is None or anchor is None:
                    continue
                a = subject.get("states", {}).get(current.get(subject["id"]), {})
                b = anchor.get("states", {}).get(current.get(anchor["id"]), {})
                if a.get("visible", True) is not False and b.get("visible", True) is False:
                    out.append(Diagnostic("SPATIAL_ANCHOR_HIDDEN", "P1", sid, subject["id"],
                                          f"anchor={anchor['id']} stage={stage}"))
        check_anchor("initial")
        for event in events:
            if event.get("target") in current and event.get("state_after") is not None:
                current[event["target"]] = event["state_after"]
            check_anchor(str(event.get("id", "?")))
        for binding in scene.get("spatial_bindings", []):
            child, anchor = entities.get(binding.get("entity")), entities.get(binding.get("anchor"))
            if not child or not anchor:
                continue  # canonical IR validator reports missing entity refs
            for state_id, state in child.get("states", {}).items():
                if state.get("visible") is False or (position := _center(state)) is None:
                    continue
                for anchor_id, anchor_state in anchor.get("states", {}).items():
                    if anchor_state.get("visible") is False or (target := _center(anchor_state)) is None:
                        continue
                    limit = float(binding.get("max_distance_px", 0))
                    if math.dist(position, target) > limit:
                        out.append(Diagnostic("SPATIAL_BOUND_EXCEEDED", "P1", sid, binding["entity"],
                                              f"{state_id} -> {binding['anchor']}:{anchor_id} over {limit}px"))
        if scene.get("caption_timing_status") == "estimated_not_audio_aligned":
            out.append(Diagnostic("TIMING_UNMEASURED", "P2", sid,
                                  detail="verify measured timing at render acceptance"))
    return out


def strict_errors(ir: dict[str, Any]) -> list[Diagnostic]:
    return [item for item in semantic_diagnostics(ir) if item.severity == "P1"]
