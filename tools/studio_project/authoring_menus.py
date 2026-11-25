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
    states = sorted({s for v in menus["cast"].values() for s in v})
    return _object({
        "frame_id": _enum(menus["frames"]),
        "mechanic_id": _enum(menus["mechanics"]),
        "present": {"type": "array", "maxItems": len(cast),
                    "items": _object({"entity_id": _enum(cast), "state_id": _enum(states)})},
        "props": {"type": "array", "maxItems": MAX_PROPS,
                  "items": _object({"prop_id": _enum(menus["props"]), "role": {"type": "string", "enum": ["focus", "support"]}})},
        "dressing": _enum(menus["dressing"]),
    })


def act_schema(menus: dict) -> dict:
    targets = sorted(menus["cast"]) + [p for p in menus["props"] if p not in menus["cast"]]
    states = sorted({s for v in menus["cast"].values() for s in v}) + [SAME]
    return _object({
        "events": {"type": "array", "maxItems": min(MAX_EVENTS, len(menus["anchors"])),
                   "items": _object({"anchor_id": _enum(a["id"] for a in menus["anchors"]), "target": _enum(targets),
                                     "action": {"type": "string", "maxLength": ACTION_LIMIT}, "state_after": _enum(states)})}})
