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
