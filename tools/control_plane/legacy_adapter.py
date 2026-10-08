from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from typing import Any

from .authoring import validate_authoring_ir
from .errors import ControlPlaneError


def _unsupported(
    message: str,
    *,
    scene_id: str | None = None,
    event_id: str | None = None,
    target: str | None = None,
    detail: dict[str, Any] | None = None,
) -> ControlPlaneError:
    return ControlPlaneError(
        code="LEGACY_ADAPTER_UNSUPPORTED",
        stage="PACKAGE",
        message=message,
        scene_id=scene_id,
        event_id=event_id,
        target=target,
        detail=detail or {},
    )


def _load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise _unsupported(f"cannot read legacy {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise _unsupported(f"legacy {label} root must be an object")
    return value


def _adapt_trigger(
    trigger: Any,
    *,
    scene_id: str,
    event_id: str,
    target: str,
) -> dict[str, Any]:
    if not isinstance(trigger, dict):
        raise _unsupported(
            "legacy event trigger must be an object",
            scene_id=scene_id,
            event_id=event_id,
            target=target,
        )

    source = trigger.get("source")
    if source == "scene_start":
        return {"type": "scene_start"}

    if source in {"voice", "voice_anchor"}:
        text = trigger.get("text") or trigger.get("phrase")
        if not isinstance(text, str) or not text.strip():
            raise _unsupported(
                "legacy voice trigger has no explicit anchor text",
                scene_id=scene_id,
                event_id=event_id,
                target=target,
            )
        result: dict[str, Any] = {
            "type": "voice_anchor",
            "text": text.strip(),
        }
        occurrence = trigger.get("occurrence")
        if occurrence is not None:
            result["occurrence"] = int(occurrence)
        return result

    raise _unsupported(
        f"unsupported legacy trigger source: {source!r}",
        scene_id=scene_id,
        event_id=event_id,
        target=target,
        detail={"trigger": deepcopy(trigger)},
    )


def _adapt_event(
    event: Any,
    *,
    scene_id: str,
) -> dict[str, Any]:
    if not isinstance(event, dict):
        raise _unsupported(
            "legacy scene contains a non-object event",
            scene_id=scene_id,
        )

    event_id = str(event.get("id") or "")
    target = str(event.get("target") or "")
    if not event_id or not target:
        raise _unsupported(
            "legacy event must have id and target",
            scene_id=scene_id,
            event_id=event_id or None,
            target=target or None,
        )

    motion = event.get("motion")
    preset = motion.get("preset") if isinstance(motion, dict) else None
    if not isinstance(preset, str) or not preset:
        raise _unsupported(
            "legacy event has no explicit motion.preset; runtime-owned defaults are not migrated",
            scene_id=scene_id,
            event_id=event_id,
            target=target,
        )

    state_before = event.get("state_before")
    state_after = event.get("state_after")
    if not isinstance(state_before, str) or not isinstance(state_after, str):
        raise _unsupported(
            "legacy event must declare state_before and state_after",
            scene_id=scene_id,
            event_id=event_id,
            target=target,
        )

    intent = event.get("action") or event.get("intent")
    if not isinstance(intent, str) or not intent:
        raise _unsupported(
            "legacy event has no semantic action/intent",
            scene_id=scene_id,
            event_id=event_id,
            target=target,
        )

    return {
        "id": event_id,
        "target": target,
        "intent": intent,
        "trigger": _adapt_trigger(
            event.get("trigger"),
            scene_id=scene_id,
            event_id=event_id,
            target=target,
        ),
        "state_before": state_before,
        "state_after": state_after,
        "desired_motion": preset,
        "scheduling": {
            "max_drift_frames": 0,
            "merge_policy": "never",
        },
    }


def _adapt_entity(
    entity: Any,
    *,
    scene_id: str,
) -> dict[str, Any]:
    if not isinstance(entity, dict):
        raise _unsupported(
            "legacy scene contains a non-object entity",
            scene_id=scene_id,
        )
    entity_id = entity.get("id")
    states = entity.get("states")
    if not isinstance(entity_id, str) or not entity_id:
        raise _unsupported("legacy entity has no id", scene_id=scene_id)
    if not isinstance(states, dict) or not states:
        raise _unsupported(
            "legacy entity has no states",
            scene_id=scene_id,
            target=entity_id,
        )
    result: dict[str, Any] = {
        "id": entity_id,
        "states": deepcopy(states),
    }
    initial = entity.get("initial_state")
    if isinstance(initial, str) and initial:
        result["initial_state"] = initial
    return result


def adapt_job4_production(production: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(production, dict):
        raise _unsupported("legacy production root must be an object")
    if str(production.get("version") or "") != "2.0":
        raise _unsupported(
            "legacy adapter supports production contract 2.0 only",
            detail={"version": production.get("version")},
        )

    video = production.get("video")
    if not isinstance(video, dict):
        raise _unsupported("legacy production video block is missing")
    try:
        width = int(video["width"])
        height = int(video["height"])
        fps = int(video["fps"])
    except (KeyError, TypeError, ValueError) as exc:
        raise _unsupported("legacy video dimensions/fps are invalid") from exc

    assets = production.get("assets")
    scenes = production.get("scenes")
    if not isinstance(assets, dict) or not isinstance(scenes, list) or not scenes:
        raise _unsupported("legacy production assets/scenes are invalid")

    converted_scenes: list[dict[str, Any]] = []
    for scene in scenes:
        if not isinstance(scene, dict):
            raise _unsupported("legacy production contains a non-object scene")
        scene_id = str(scene.get("id") or "")
        voice = scene.get("voice")
        if not scene_id or not isinstance(voice, str):
            raise _unsupported("legacy scene must have id and voice")
        entities = scene.get("entities")
        events = scene.get("events")
        if not isinstance(entities, list) or not isinstance(events, list):
            raise _unsupported(
                "legacy scene entities/events must be arrays",
                scene_id=scene_id,
            )
        converted_scenes.append(
            {
                "id": scene_id,
                "voice": voice,
                "duration_hint_frames": max(
                    1,
                    int(scene.get("duration_hint_frames") or fps),
                ),
                "entities": [
                    _adapt_entity(entity, scene_id=scene_id)
                    for entity in entities
                ],
                "events": [
                    _adapt_event(event, scene_id=scene_id)
                    for event in events
                ],
            }
        )

    ir = {
        "format": "zodiac-authoring-ir@1",
        "fps": fps,
        "video": {
            "width": width,
            "height": height,
        },
        "assets": deepcopy(assets),
        "scenes": converted_scenes,
    }
    validate_authoring_ir(ir)
    return ir


def adapt_job4_package(package_root: Path) -> dict[str, Any]:
    package_root = Path(package_root).resolve()
    manifest = _load_object(
        package_root / "package-manifest.json",
        "package-manifest.json",
    )
    if manifest.get("format") != "zodiac-job@4":
        raise _unsupported(
            "legacy adapter accepts zodiac-job@4 only",
            detail={"format": manifest.get("format")},
        )
    if str(manifest.get("production_contract") or "") != "2.0":
        raise _unsupported(
            "legacy adapter accepts production_contract 2.0 only",
            detail={"production_contract": manifest.get("production_contract")},
        )
    production = _load_object(package_root / "production.json", "production.json")
    return adapt_job4_production(production)
