from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any

from .contracts import validate_contract_shape
from .errors import ControlPlaneError


def _tokens(value: str) -> list[str]:
    return re.findall(r"\w+", value.casefold(), flags=re.UNICODE)


def _phrase_occurrences(text: str, phrase: str) -> int:
    haystack = _tokens(text)
    needle = _tokens(phrase)
    if not needle or len(needle) > len(haystack):
        return 0
    width = len(needle)
    return sum(1 for index in range(len(haystack) - width + 1) if haystack[index:index + width] == needle)


def _invalid(message: str, *, detail: dict[str, Any] | None = None, scene_id: str | None = None, event_id: str | None = None, target: str | None = None) -> ControlPlaneError:
    return ControlPlaneError(
        code="AUTHORING_IR_INVALID",
        stage="PACKAGE",
        message=message,
        scene_id=scene_id,
        event_id=event_id,
        target=target,
        detail=detail or {},
    )


def validate_authoring_ir(document: dict[str, Any]) -> None:
    issues = validate_contract_shape("authoring-ir-v1", document)
    if issues:
        raise _invalid(
            "authoring IR does not match canonical schema",
            detail={"issues": [{"path": issue.path, "message": issue.message} for issue in issues]},
        )

    assets = document["assets"]
    scene_ids: set[str] = set()
    event_ids: set[str] = set()

    for scene in document["scenes"]:
        scene_id = scene["id"]
        if scene_id in scene_ids:
            raise _invalid(f"duplicate scene id: {scene_id}", scene_id=scene_id)
        scene_ids.add(scene_id)

        segments = scene.get("caption_segments")
        if segments is not None:
            if not segments:
                raise _invalid("caption_segments must not be empty", scene_id=scene_id)
            last_end = 0
            combined = []
            for index, segment in enumerate(segments):
                start, end = segment["start_ms"], segment["end_ms"]
                if start < last_end or end <= start:
                    raise _invalid("caption segments overlap or have invalid bounds", scene_id=scene_id, detail={"index": index})
                last_end = end
                phrase = segment["text"].strip()
                if len(_tokens(phrase)) < 3 and not any(p in phrase for p in "!?…"):
                    raise _invalid("caption fragment has fewer than three words", scene_id=scene_id, detail={"index": index})
                combined.extend(_tokens(phrase))
            if combined != _tokens(scene["voice"]):
                raise _invalid("caption text does not preserve exact narration token order", scene_id=scene_id)
        layout = scene.get("layout_contract")
        if layout is not None:
            width, height = layout["canvas"]["width"], layout["canvas"]["height"]
            for zone_name in ("caption_safe_zone", "character_zone", "prop_zone", "effect_zone"):
                zone = layout[zone_name]
                if zone["x"] + zone["width"] > width or zone["y"] + zone["height"] > height:
                    raise _invalid("layout zone exceeds canvas", scene_id=scene_id, detail={"zone": zone_name})
            def intersects(a, b):
                return (a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"] and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"])
            for zone_name in ("character_zone", "prop_zone", "effect_zone"):
                if intersects(layout["caption_safe_zone"], layout[zone_name]):
                    raise _invalid("caption safe zone collides with reserved scene zone", scene_id=scene_id, detail={"zone": zone_name})
        density = scene.get("render_density_budget")
        if density is not None:
            # Count all authored entities conservatively; a richer actor/prop classifier
            # is needed before enforcing category-specific dynamic density limits.
            if density["max_characters"] > 3:
                raise _invalid("too many characters in density budget", scene_id=scene_id)
            if density["max_characters"] == 3 and (density["max_prominent_props"] > 1 or density["max_prominent_effects"] > 1):
                raise _invalid("3-character scene must reduce props/effects", scene_id=scene_id)

        entities: dict[str, dict[str, Any]] = {}
        for entity in scene["entities"]:
            entity_id = entity["id"]
            if entity_id in entities:
                raise _invalid(
                    f"duplicate entity id {entity_id!r} in scene {scene_id}",
                    scene_id=scene_id,
                    target=entity_id,
                )
            states = entity["states"]
            if not states:
                raise _invalid(
                    f"entity {entity_id!r} must declare at least one state",
                    scene_id=scene_id,
                    target=entity_id,
                )
            initial = entity.get("initial_state")
            if initial is not None and initial not in states:
                raise _invalid(
                    f"initial state {initial!r} is missing from target {entity_id!r}",
                    scene_id=scene_id,
                    target=entity_id,
                )
            for state_id, state in states.items():
                asset_id = state.get("asset") if isinstance(state, dict) else None
                if asset_id is not None and asset_id not in assets:
                    raise _invalid(
                        f"state {state_id!r} references missing asset {asset_id!r}",
                        scene_id=scene_id,
                        target=entity_id,
                    )
            entities[entity_id] = entity

        for event in scene["events"]:
            event_id = event["id"]
            target = event["target"]
            if event_id in event_ids:
                raise _invalid(
                    f"duplicate event id: {event_id}",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                )
            event_ids.add(event_id)

            entity = entities.get(target)
            if entity is None:
                raise _invalid(
                    f"event {event_id} target {target!r} does not exist in scene {scene_id}",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                )
            states = entity["states"]
            for field in ("state_before", "state_after"):
                state_id = event[field]
                if state_id not in states:
                    raise _invalid(
                        f"event {event_id} {field} state {state_id!r} does not exist on target {target!r}",
                        scene_id=scene_id,
                        event_id=event_id,
                        target=target,
                    )

            trigger = event["trigger"]
            if trigger["type"] == "scene_start":
                continue

            count = _phrase_occurrences(scene["voice"], trigger["text"])
            occurrence = trigger.get("occurrence")
            if count == 0:
                raise _invalid(
                    f"event {event_id} voice anchor is not present in scene narration",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={"anchor": trigger["text"]},
                )
            if count > 1 and occurrence is None:
                raise _invalid(
                    f"event {event_id} voice anchor appears {count} times; trigger.occurrence is required",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={"anchor": trigger["text"], "matches": count},
                )
            if occurrence is not None and occurrence > count:
                raise _invalid(
                    f"event {event_id} trigger occurrence {occurrence} exceeds {count} anchor matches",
                    scene_id=scene_id,
                    event_id=event_id,
                    target=target,
                    detail={"anchor": trigger["text"], "matches": count, "occurrence": occurrence},
                )


def load_authoring_ir(path: Path) -> dict[str, Any]:
    try:
        document = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise _invalid(f"cannot read authoring IR: {exc}") from exc
    if not isinstance(document, dict):
        raise _invalid("authoring IR root must be an object")
    validate_authoring_ir(document)
    return document
