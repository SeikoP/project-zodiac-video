"""Per-scene menus and the JSON Schemas a model must answer with (constructive visual pipeline).

The model never writes an id, a coordinate or a quotation: it picks from the lists built here, and the schemas make any other
answer impossible (every id field is an ``enum``). Core assembles the choices into a scene (``scene_assembler``).
"""
from __future__ import annotations

import json
import re

from . import accent_art, agent_authoring, catalog_v5, prop_families
from .graphic_sketch import COLORS as SKETCH_COLORS, SHAPES as SKETCH_SHAPES

MAX_EVENTS = 8
MAX_PROPS = 2  # few objects: each must be acted on, a crowd of them only clutters the frame
MAX_PHRASE_WORDS = 6
NONE = "none"
NONE_FITS = "none_fits"
DRAWN = "drawn"
SAME = "same"
ACTION_LIMIT = 80
_CLAUSE = re.compile(r"[^,.;:!?…—\n]+")


# What each registered scene accent reads as to a viewer. The registry only says "optional cue", which is no help in choosing.
ACCENT_READS = {
    "scene-accent-cafe": "cafe awning with hanging lights (cafe, street shop)",
    "scene-accent-board": "notice board or blackboard (school, study, plans on a wall)",
    "scene-accent-shelf": "shelf with books or jars (study, home)",
    "scene-accent-clock": "round wall clock (time, schedule, waiting)",
    "scene-accent-sign": "shop sign or menu board (cafe, food stall, street)",
    "scene-accent-home-lamp": "table or wall lamp (home, evening, night)",
    "scene-accent-cafe-window": "two-pane window (cafe, room, daylight or night)",
    "scene-accent-class-window": "four-pane classroom window (school)",
    "scene-accent-study-note": "framed note or picture on a wall (study, home)",
    "scene-accent-street-tree": "small street tree or sprout (outdoors)",
    "scene-accent-neutral-dot": "minimal neutral mark (only when nothing else reads)",
    "scene-accent-neutral-line": "minimal neutral line (only when nothing else reads)",
    "scene-accent-string-lights": "string of coloured lights (celebration, evening)",
}


def accent_registry() -> dict[str, dict]:
    """id -> registry row (path, asset_sha256) of the scene accents the library registers."""
    index = json.loads((agent_authoring.ASSETS / "scene-set/accents/index.json").read_text("utf8"))
    return {row["id"]: row for row in index["accents"]}


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


def _time(anchors: list[dict], row: dict, words: list[dict]) -> None:
    """Add ``t`` (seconds from the scene's first measured word) to each anchor; None when no timing is known."""
    start, stop = row["narration_range"]
    inside = [w for w in words if w.get("source_range") and start <= w["source_range"][0] < stop]
    base = min((w["startMs"] for w in inside), default=None)
    for anchor in anchors:
        at = start + len(row["text"][:anchor["at"]].encode())
        hit = next((w for w in inside if w["source_range"][0] <= at < w["source_range"][1]), None)
        anchor["t"] = round((hit["startMs"] - base) / 1000, 3) if hit and base is not None else None


def scene_menus(capsule: dict, skeleton_intent: dict, scene_id: str, words: list[dict]) -> dict:
    """Everything the model may choose from for one scene. Raises KeyError for a scene the capsule does not know."""
    row = next((r for r in capsule["scene_ranges"] if r["id"] == scene_id), None)
    if row is None:
        raise KeyError(scene_id)
    catalog = agent_authoring.catalog()
    props = _prop_ids()
    cast = {m["entity_id"]: sorted(m.get("states") or {}) for m in skeleton_intent.get("cast", [])}
    anchors = _anchors(row["text"])
    _time(anchors, row, words)
    accents = list(accent_registry())
    return {"frames": [f["id"] for f in catalog["frames"]], "mechanics": [m["id"] for m in catalog["mechanics"]],
            "cast": cast, "props": props, "dressing": props + [NONE], "anchors": anchors,
            "accents": accents, "accent_reads": {i: ACCENT_READS.get(i, "registered scene accent") for i in accents},
            "accent_parts": {name: meta["reads"] for name, meta in accent_art.PARTS.items()}}


def stage_data(menus: dict, scene_id: str, scene_text: str, goal: str, used_motifs=(), planned=None) -> dict:
    """What the stage choice is shown: the scene, and every menu it may pick from (accents with what they read as)."""
    data = {"scene_id": scene_id, "scene_text": scene_text, "goal": goal,
            "menus": {k: menus[k] for k in ("frames", "mechanics", "cast", "props", "dressing", "accent_parts")},
            "accent_rules": ("accent_id 'drawn' = Core draws your parts (two or three read as a place; each in its own slot: left, center, right; a "
                             "wide part - awning, string_lights, curtain - goes 'across' and then only floor parts may share it). 'none_fits' = the "
                             "place cannot be drawn from these parts; leave parts empty then."),
            "capacity_rules": "A frame holds at most 3 people, and only three-person-comparison holds 3 (it has no prop slot); with a prop on the stage at most 2 people. A cast of 4 means different scenes show different people, never 4 in one frame.",
            "graphic_rules": GRAPHIC_RULES, "motifs_already_used_in_other_scenes": sorted(set(used_motifs)),
            "anchors": [{"id": a["id"], "text": a["text"]} for a in menus["anchors"]]}
    if planned:  # the production brief, written after one read of the whole script: follow it unless it cannot be drawn
        data["production_brief_for_this_scene"] = planned
    return data


BRIEF_RULES = (
    "You are preparing the production brief BEFORE anything is built. Read every document in the data (the narration scene by scene, the "
    "narrative plan, the writer brief, the episode scope, the voice direction) and the whole skill above, then write the brief exactly as "
    "brief.md describes. Think about the episode as ONE argument: what it claims, where it turns, what the viewer must see to follow it "
    "muted. EVERY scene has a HERO: the one object the scene is about, drawn by the agent in 2-4 states that the words change (picture.motif = hero; fact = the object and how it changes, e.g. a whole cake, then cut into two unequal pieces, then one piece pushed across); it must fail the removal test: delete it and the scene loses its plot. Pictures (graphic) otherwise make ONE countable, comparable or written fact visible. Prefer a sketch: a drawing YOU compose for this scene from parts (see graphic_rules), so no two episodes share one; a fixed layout is the fallback when it fits exactly: stamp (a verdict word), meter (a level between two "
    "sides), versus (two columns of rows), receipt (items and a total), route (2-4 stops), folder (a named folder with files), tally (a "
    "count), chat_thread (messages); choose 'none' for a scene only when the characters and props already carry it, and say why. Never "
    "the same motif twice. Use only props, frames, mechanics and accent parts that exist in the vocabulary. Short, concrete, Vietnamese. "
    "The cover is this episode's own (brief.md): topic, hook of 6-14 words stating its contradiction, a scene and a symbolic object, never the "
    "concept template and never like recent_episodes. who_on_stage per scene: A frame holds at most 3 people, and only three-person-comparison holds 3 (it has no prop slot); with a prop on the stage at most 2 people. A cast of 4 means different scenes show different people, never 4 in one frame. Follow invention.md: list every person who acts or is acted on (on_screen true) as a character, give EACH scene one story device that "
    "is not 'they talk' (hand-over, prop as evidence, distance as meaning, accumulation, reaction chain, split stage, callback), make the "
    "hero change on screen with the words, state by state; library props are only background, at most one per scene and only when it does something; tie each picture to what a character does on the same "
    "anchor (it must fail the removal test), vary the setting scene to scene, and say in 'rhythm' what differs from recent_episodes.")


def pictures_owed(scene_count: int) -> int:
    """How many scenes of an episode this long should carry a picture (at least one; about one in three)."""
    return max(1, round(scene_count / 3)) if scene_count else 0


def brief_data(dossier: dict) -> dict:
    return {"documents": dossier, "rules": BRIEF_RULES}


def brief_schema(scene_ids: list[str], cast_ids: list[str] | None = None) -> dict:
    text = lambda n: {"type": "string", "maxLength": n}  # noqa: E731
    arr = lambda item, n: {"type": "array", "maxItems": n, "items": item}  # noqa: E731
    scene = _object({
        "scene_id": _enum(scene_ids), "beat": text(200), "viewer_read": text(200), "focus": text(120), "setting": text(120),
        "device": text(160), "who_on_stage": arr(text(40), 4),
        "props": arr(_object({"prop": text(40), "used_for": text(100), "change": text(100)}), 3), "acting_turns": arr(text(120), 4),
        "picture": _object({"motif": _enum(("none",) + GRAPHIC_MOTIFS), "fact": text(120), "why": text(160)})})
    return _object({
        "story_read": text(400), "tone": text(200),
        "characters": arr(_object({"who": text(40), "relation": text(160), "wants": text(120), "on_screen": {"type": "boolean"}}), 6),
        "scenes": {"type": "array", "minItems": len(scene_ids), "maxItems": len(scene_ids), "items": scene},
        "cover": _object({"topic": text(60), "hook": text(100), "scene_id": _enum(scene_ids), "symbol": text(100), "why": text(160)}),
        "rhythm": text(300), "rules_applied": arr(text(200), 6), "risks": arr(text(200), 6)})


def _int(high: int, low: int = 0) -> dict:
    return {"type": "integer", "minimum": low, "maximum": high}


def _enum(values) -> dict:
    return {"type": "string", "enum": list(values) or [NONE]}


def _object(properties: dict) -> dict:
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


GRAPHIC_RULES = (
    "HERO (required in every scene): the ONE object this scene is about (the cake, the pillow, the film, the message), drawn by you in 2-4 states that "
    "the narration changes: whole, then cut, then handed over, then left alone. Each state is a complete drawing (2-14 parts, same parts and 960x630 canvas "
    "as sketch, every step 1) that REPLACES the one before; each state has its own anchor_id, in the order of the words, and the first state's anchor is "
    "the graphic's anchor_id. The change must be what the words say, and the scene must lose its plot without it: if the object could be deleted and "
    "the story would read the same, you drew the wrong object. Draw the object itself, with its details (slices, a bite, a crack, a crossed-out line), "
    "never a label card; faces and hands of the characters are NOT drawn here, the characters are on stage. Library props are only background now. "
    "SKETCH (preferred): draw the scene's idea yourself as 3-18 parts on a 960x630 canvas (x,y = top-left, w,h = size; for line/arrow w,h are the "
    "end offset). Shapes: box, circle, line, arrow, text (a short label), face (text = happy|flat|angry|sad|surprised), check, cross, heart, star, scribble. "
    "Colours ink, paper, teal, coral, gold, card. step 1-4 = the order the parts appear on the anchors, steps with no gaps. Compose a picture of THIS story, not a "
    "chart: the cake cut in two unequal slices with a hand on one, a door with an arrow and a clock, two faces and a heart growing between them. "
    "x+w must be <= 960 and y+h <= 630 (a box, circle or face needs w,h of at least 20; only a line or arrow may have 0 or negative w,h). Keep parts apart, labels short (<=28 chars, text width must fit its box), keep 40px free at the edges. Never the same drawing as another scene. "
    "graphic = an OPTIONAL picture Studio draws to make ONE story fact visible (not decoration). Pick 'none' unless the narration states "
    "something countable, comparable or written that the viewer should SEE: a stamp (a verdict word), meter (a level between two sides), "
    "versus (two columns of rows), receipt (items and a total), route (2-4 stops), folder (a named folder with files), tally (a count), "
    "chat_thread (messages). The episode needs at least one such picture (about one scene in four): Core sends a scene back when its "
    "words state a countable, comparable or written fact and you chose 'none'. Use a DIFFERENT motif in every scene; never the same one twice. Fields are short, in Vietnamese, exact words "
    "from the narration where possible. anchor_id = the words where the picture first appears; later pieces appear on the anchors after it.")
GRAPHIC_MOTIFS = ("hero", "sketch", "stamp", "meter", "versus", "receipt", "route", "folder", "tally", "chat_thread")


def _graphic_schema(menus: dict) -> dict:
    anchor = _enum([a["id"] for a in menus["anchors"]])
    text = lambda n: {"type": "string", "maxLength": n}  # noqa: E731
    arr = lambda item, n: {"type": "array", "maxItems": n, "items": item}  # noqa: E731
    return {"anyOf": [
        _object({"motif": _enum(["none"])}),
        _object({"motif": _enum(["hero"]), "anchor_id": anchor, "name": text(30),
                 "states": {"type": "array", "minItems": 2, "maxItems": 4, "items": _object({
                     "anchor_id": anchor,
                     "parts": arr(_object({"shape": _enum(SKETCH_SHAPES), "x": _int(960), "y": _int(630), "w": _int(960, -960), "h": _int(630, -630),
                                           "color": _enum(tuple(SKETCH_COLORS)), "text": text(28), "step": _int(1, 1)}), 14)})}}),
        _object({"motif": _enum(["sketch"]), "anchor_id": anchor,
                 "parts": arr(_object({"shape": _enum(SKETCH_SHAPES), "x": _int(960), "y": _int(630), "w": _int(960, -960), "h": _int(630, -630),
                                       "color": _enum(tuple(SKETCH_COLORS)), "text": text(28), "step": _int(4, 1)}), 18)}),
        _object({"motif": _enum(["stamp"]), "anchor_id": anchor, "text": text(16), "sub": text(30)}),
        _object({"motif": _enum(["meter"]), "anchor_id": anchor, "title": text(24), "left": text(14), "right": text(14), "level": _enum(["1", "2", "3", "4"])}),
        _object({"motif": _enum(["versus"]), "anchor_id": anchor, "left_title": text(14), "right_title": text(14),
                 "rows": arr(_object({"left": text(24), "right": text(24)}), 3)}),
        _object({"motif": _enum(["receipt"]), "anchor_id": anchor, "title": text(20), "total": text(24),
                 "items": arr(_object({"name": text(22), "price": text(8)}), 4)}),
        _object({"motif": _enum(["route"]), "anchor_id": anchor, "caption": text(34), "pins": arr(text(16), 4)}),
        _object({"motif": _enum(["folder"]), "anchor_id": anchor, "name": text(28), "files": arr(text(24), 3)}),
        _object({"motif": _enum(["tally"]), "anchor_id": anchor, "title": text(28), "count": _enum(["2", "3", "4", "5"]), "caption": text(40)}),
        _object({"motif": _enum(["chat_thread"]), "anchor_id": anchor, "title": text(20),
                 "messages": arr(_object({"from": _enum(["me", "them"]), "text": text(46)}), 4)}),
    ]}


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
        "graphic": _graphic_schema(menus),
        # the setting of the scene: a registered accent, what the narration places there, and the exact words it is bound to
        "accent": _object({"accent_id": _enum([DRAWN, NONE_FITS]),
                           "setting": {"type": "string", "maxLength": 80},
                           "visible_detail": {"type": "string", "maxLength": 140},
                           "anchor_id": _enum([a["id"] for a in menus["anchors"]]),
                           # for accent_id "drawn": up to three parts Core draws, one per slot (left/center/right, or one wide part across)
                           "parts": {"type": "array", "maxItems": 2,
                                     "items": _object({"part": _enum(sorted(menus["accent_parts"])), "at": _enum(list(accent_art.AT)),
                                                       "size": _enum(list(accent_art.SIZES))})}}),
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
