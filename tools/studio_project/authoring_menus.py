"""Per-scene menus and the JSON Schemas a model must answer with (constructive visual pipeline).

The model never writes an id, a coordinate or a quotation: it picks from the lists built here, and the schemas make any other
answer impossible (every id field is an ``enum``). Core assembles the choices into a scene (``scene_assembler``).
"""
from __future__ import annotations

import re

from . import agent_authoring, catalog_v5, prop_families

MAX_EVENTS = 8
MAX_PROPS = 3
MAX_PHRASE_WORDS = 6
NONE = "none"
SAME = "same"
ACTION_LIMIT = 80
_CLAUSE = re.compile(r"[^,.;:!?…—\n]+")


def _prop_ids() -> list[str]:
    """Real library file ids, the default model of each family first; meme lettering is never offered."""
    manifest = agent_authoring.prop_families_manifest()
    out: list[str] = []
    for family in manifest["families"].values():
        if family["id"] == "meme-label":
            continue
        models = sorted(family["models"], key=lambda m: m != prop_families.DEFAULT_MODEL)
        for model_id in models:
            for prop in family["models"][model_id]["states"].values():
                if prop not in out and not prop.startswith(catalog_v5.MEME_PREFIX):
                    out.append(prop)
    return out


def _anchors(text: str) -> list[dict]:
    """Phrases of 2-6 words, in order. ``at`` is the character offset of the first occurrence not used by an earlier anchor."""
    anchors, cursor = [], 0
    for clause in _CLAUSE.finditer(text):
        words = clause.group(0).split()
        if len(words) < 2:
            continue
        pieces = -(-len(words) // MAX_PHRASE_WORDS)
        size = -(-len(words) // pieces)
        position = clause.start()
        for start in range(0, len(words), size):
            piece = words[start:start + size]
            if len(piece) < 2:
                break
            found = re.search(r"\s+".join(re.escape(w) for w in piece), text[max(cursor, position):])
            if not found:
                continue
            at = max(cursor, position) + found.start()
            exact = found.group(0)
            anchors.append({"id": f"a{len(anchors) + 1}", "text": exact, "at": at})
            cursor = at + len(exact)
    return anchors


def scene_menus(capsule: dict, skeleton_intent: dict, scene_id: str, words: list[dict]) -> dict:
    """Everything the model may choose from for one scene. Raises KeyError for a scene the capsule does not know."""
    row = next((r for r in capsule["scene_ranges"] if r["id"] == scene_id), None)
    if row is None:
        raise KeyError(scene_id)
    catalog = agent_authoring.catalog()
    props = _prop_ids()
    cast = {m["entity_id"]: sorted(m.get("states") or {}) for m in skeleton_intent.get("cast", [])}
    return {"frames": [f["id"] for f in catalog["frames"]], "mechanics": [m["id"] for m in catalog["mechanics"]],
            "cast": cast, "props": props, "dressing": props + [NONE], "anchors": _anchors(row["text"])}


def _enum(values) -> dict:
    return {"type": "string", "enum": list(values) or [NONE]}


def _object(properties: dict) -> dict:
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


def stage_schema(menus: dict) -> dict:
    cast = sorted(menus["cast"])
    # a state is offered only together with the entity that owns it (one anyOf variant per entity)
    present = ([_object({"entity_id": _enum([e]), "state_id": _enum(menus["cast"][e])}) for e in cast]
               or [_object({"entity_id": _enum([]), "state_id": _enum([])})])
    return _object({
        "frame_id": _enum(menus["frames"]),
        "mechanic_id": _enum(menus["mechanics"]),
        "present": {"type": "array", "maxItems": len(cast), "items": {"anyOf": present}},
        "props": {"type": "array", "maxItems": MAX_PROPS,
                  "items": _object({"prop_id": _enum(menus["props"]), "role": {"type": "string", "enum": ["focus", "support"]}})},
        "dressing": _enum(menus["dressing"]),
    })


def act_schema(menus: dict, stage: dict | None = None) -> dict:
    """Events the model may write. Given the chosen stage, only who is in it can act, and a character only moves to one of its
    own states; a prop has none (``same``). Without a stage every cast member and prop is offered with its own states."""
    if stage is None:
        characters, props = sorted(menus["cast"]), list(menus["props"])
    else:
        characters = [row["entity_id"] for row in stage["present"]]
        props = [row["prop_id"] for row in stage["props"]]
    anchors = [a["id"] for a in menus["anchors"]]

    def event(targets, states):
        return _object({"anchor_id": _enum(anchors), "target": _enum(targets),
                        "action": {"type": "string", "maxLength": ACTION_LIMIT}, "state_after": _enum(states)})
    variants = [event([c], list(menus["cast"][c]) + [SAME]) for c in characters]
    if props:
        variants.append(event(props, [SAME]))
    return _object({"events": {"type": "array", "maxItems": min(MAX_EVENTS, len(anchors)) if variants else 0,
                               "items": {"anyOf": variants or [event([], [])]}}})


def schema_errors(value, schema: dict, path: str = "$") -> list[str]:
    """Violations of the small JSON Schema subset the menu schemas use: type, enum, required, additionalProperties,
    properties, items, maxItems, maxLength. Empty list = valid."""
    kind = schema.get("type")
    kinds = {"object": dict, "array": list, "string": str}
    if kind in kinds and not isinstance(value, kinds[kind]):
        return [f"{path}: cần kiểu {kind}"]
    errors: list[str] = []
    if "anyOf" in schema:
        tries = [schema_errors(value, variant, path) for variant in schema["anyOf"]]
        return [] if any(not t for t in tries) else min(tries, key=len)
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} không có trong menu {schema['enum'][:12]}")
    if kind == "string" and "maxLength" in schema and len(value) > schema["maxLength"]:
        errors.append(f"{path}: dài quá {schema['maxLength']} ký tự")
    if kind == "object":
        properties = schema.get("properties", {})
        errors += [f"{path}.{name}: thiếu" for name in schema.get("required", []) if name not in value]
        if schema.get("additionalProperties") is False:
            errors += [f"{path}.{name}: không được phép" for name in value if name not in properties]
        for name, sub in properties.items():
            if name in value:
                errors += schema_errors(value[name], sub, f"{path}.{name}")
    if kind == "array":
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: tối đa {schema['maxItems']} phần tử")
        for index, item in enumerate(value):
            errors += schema_errors(item, schema.get("items", {}), f"{path}[{index}]")
    return errors
