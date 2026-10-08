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
        ("/props/", "prop"), ("/environment/", "environment"),
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
        # Match the executable renderer's geometry model; scale is about center.
        x, y = float(transform.get("x", 0)), float(transform.get("y", 0))
        width, height = float(transform.get("width", 520)), float(transform.get("height", 520))
        scale = float(transform.get("scale", 1))
        values = (x, y, width, height, scale)
        if not all(math.isfinite(v) for v in values) or width <= 0 or height <= 0 or scale <= 0:
            return None
        return (x + width * scale / 2, y + height * scale / 2)
    except (TypeError, ValueError):
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
                ordered = [event for event in events if event.get("target") == entity_id]
                if not ordered:
                    out.append(Diagnostic("EFFECT_UNSCHEDULED", "P1", sid, entity_id,
                                          "effect requires an explicit enter/release lifecycle"))
                else:
                    if states.get(entity.get("initial_state"), {}).get("visible", True) is not False:
                        out.append(Diagnostic("EFFECT_VISIBLE_BEFORE_EVENT", "P1", sid, entity_id))
                    transition_visibility = [
                        states.get(event.get("state_after"), {}).get("visible", True)
                        for event in ordered
                    ]
                    first_enter = next((i for i, visible in enumerate(transition_visibility) if visible), None)
                    if first_enter is None:
                        out.append(Diagnostic("EFFECT_NO_ENTRANCE", "P1", sid, entity_id))
                    if (first_enter is None or
                            not any(not visible for visible in transition_visibility[first_enter + 1:]) or
                            transition_visibility[-1] is not False):
                        out.append(Diagnostic("EFFECT_NO_RELEASE", "P1", sid, entity_id))
            elif category == "prop" and entity_id not in targets:
                if bindings.get(entity_id, {}).get("relation") in {"held_by", "points_to"}:
                    out.append(Diagnostic("INTERACTIVE_PROP_UNSCHEDULED", "P1", sid, entity_id))
                else:
                    out.append(Diagnostic("PROP_STATIC_REVIEW", "P2", sid, entity_id))
            elif category == "character" and len(states) > 1 and entity_id not in targets:
                out.append(Diagnostic("UNUSED_CHARACTER_STATES", "P2", sid, entity_id))
        for binding in scene.get("spatial_bindings", []):
            child, anchor = entities.get(binding.get("entity")), entities.get(binding.get("anchor"))
            if not child or not anchor:
                continue  # canonical IR validator checks missing entity refs
            anchor_centers = [
                pos for state in anchor.get("states", {}).values()
                if state.get("visible") is not False
                if (pos := _center(state)) is not None
            ]
            if not anchor_centers:
                out.append(Diagnostic("SPATIAL_ANCHOR_NO_GEOMETRY", "P1", sid, binding["entity"]))
                continue
            for state_id, state in child.get("states", {}).items():
                if state.get("visible") is False:
                    continue
                position = _center(state)
                if position is None:
                    out.append(Diagnostic("SPATIAL_SUBJECT_NO_GEOMETRY", "P1", sid,
                                          binding["entity"], state_id))
                    continue
                # Anchor states are *alternatives*, never simultaneously visible.
                # A related state only needs one valid authored anchor pose.
                limit = float(binding.get("max_distance_px", 0))
                minimum_distance = min(math.dist(position, target) for target in anchor_centers)
                if not math.isfinite(minimum_distance) or minimum_distance > limit:
                    out.append(Diagnostic("SPATIAL_BOUND_EXCEEDED", "P1", sid, binding["entity"],
                                          f"{state_id} -> {binding['anchor']} distance={minimum_distance:.1f} limit={limit}px"))
        if scene.get("caption_timing_status") == "estimated_not_audio_aligned":
            out.append(Diagnostic("TIMING_UNMEASURED", "P2", sid,
                                  detail="verify measured timing at render acceptance"))
    return out


def strict_errors(ir: dict[str, Any]) -> list[Diagnostic]:
    return [item for item in semantic_diagnostics(ir) if item.severity == "P1"]
