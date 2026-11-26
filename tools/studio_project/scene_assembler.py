"""Core assembles one scene from the model's menu choices (constructive visual pipeline).

The model chose ids from ``authoring_menus``; here Core turns them into the existing ``scene.part`` shape, so
``agent_parts.validate_scene``, ``merge``, the compiler and export are unchanged. Core owns every coordinate (``PLACEMENT``),
entity id, asset key, layer, trigger text, profile and focus; an id outside the menus is an error, never repaired.
"""
from __future__ import annotations

import re

from . import agent_authoring
from . import accent_art
from .authoring_menus import DRAWN, NONE, NONE_FITS, SAME, accent_registry
from .scene_repairs import prune_non_story_references

CAPTION_ZONE = {"x": 80, "y": 1470, "width": 920, "height": 360}
LAYER_ACCENT, LAYER_DRESSING, LAYER_CHARACTER, LAYER_PROP, LAYER_STORY = 5, 10, 20, 30, 40
ACCENT_AREA, ACCENT_MIN, ACCENT_MAX_WIDTH, ACCENT_TOP, ACCENT_OVERLAP = round(0.078 * 1080 * 1920), 360, 1000, 110, 0.5

# frame id -> slot -> box (story field 1080x1400; the caption lane starts at y=1470). Characters keep the 1:2 ratio of the art.
PLACEMENT: dict[str, dict[str, dict]] = {
    "single-character-focus": {"subject": {"x": 60, "y": 450, "width": 460, "height": 920},
                               "focus_prop": {"x": 560, "y": 1010, "width": 280, "height": 360}},
    "two-person-offset": {"speaker": {"x": 20, "y": 510, "width": 420, "height": 840},
                          "listener": {"x": 640, "y": 510, "width": 420, "height": 840},
                          "shared_prop": {"x": 450, "y": 1090, "width": 180, "height": 260}},
    "prop-focus": {"focus_prop": {"x": 40, "y": 610, "width": 560, "height": 560},
                   "companion": {"x": 640, "y": 490, "width": 400, "height": 800}},
    "reaction-closeup": {"subject": {"x": 265, "y": 260, "width": 550, "height": 1100}},
    "caption-payoff": {"subject": {"x": 290, "y": 300, "width": 500, "height": 1000}},
    "three-person-comparison": {"lead": {"x": 375, "y": 370, "width": 330, "height": 660},
                                "peer_a": {"x": 40, "y": 630, "width": 330, "height": 660},
                                "peer_b": {"x": 710, "y": 630, "width": 330, "height": 660}},
}
STORY_FIELD = 1400
STORY_BAND_BOTTOM = 560  # a story visual owns y 90-510; the actors are moved up under it
STORY_VISUAL_BOX = {"x": 220, "y": 90, "width": 640, "height": 420}
# props and dressing that are not in a frame slot stand on the actors' floor line, at the first of these x that touches nobody
GROUND_X = [40, 880, 800, 300, 560, 160, 680]
DEFAULT_FLOOR = 1200
CENTRE_Y = 800  # without a story visual the cast and props are centred about here, not left at the bottom of the field
WALL_TOP, WALL_SIZE = 110, 200
FEET = 0.82  # the characters' art leaves empty space under the feet: the visible figure ends at this fraction of its box
SUPPORT_SIZE, FOCUS_SIZE, DRESSING_SIZE = 180, 300, 240
MODE_BY_MECHANIC = {"explain": "exposition", "react": "reflection", "express-reaction": "reflection", "facepalm": "reflection",
                    "point-choice": "relationship", "compare-group": "relationship", "compare-two-props": "relationship"}
MODE_BY_FAMILY = {"state": "exposition", "interaction": "behavior", "narrative": "payoff"}
NEEDS_DRESSING = frozenset({"relationship", "behavior", "payoff"})
DRESSING_FALLBACK = ("laptop", "notebook", "coffee-cup", "potted-plant", "book", "lightbulb")  # ordinary props that read as scenery
FPS = 30
LEAN = {"preset": "lean", "duration_frames": 12, "params": {"degrees": 8, "dx": 0, "dy": 0, "settle": "return"}}
SWAP = {"preset": "state_swap", "duration_frames": 12}
_VIEWBOX = re.compile(r'viewBox="\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)')


def _frames() -> list[dict]:
    return agent_authoring.catalog()["frames"]


def _slots(frame: dict, kind: str) -> list[str]:
    return [name for name, slot in frame["slots"].items() if slot["kind"] == kind]


def _required(frame: dict, kind: str) -> int:
    return sum(1 for slot in frame["slots"].values() if slot["kind"] == kind and slot.get("required"))


def _capabilities(frame: dict, characters: int, objects: int) -> set[str]:
    """What the frame's FILLED slots offer: the first `characters` character slots and the first `objects` object slots."""
    caps: set[str] = set()
    for kind, count in (("character", characters), ("object", objects)):
        for name in _slots(frame, kind)[:count]:
            caps |= set(frame["slots"][name].get("capabilities") or ())
    return caps


def _hosts(frame: dict, characters: int, objects: int) -> bool:
    return _required(frame, "character") <= characters <= len(_slots(frame, "character")) and objects >= _required(frame, "object")


def supports(frame_id: str, mechanic_id: str, characters: int, objects: int) -> bool:
    """True when this frame, filled with these entities, provides everything the mechanic requires."""
    frame = next(f for f in _frames() if f["id"] == frame_id)
    mechanic = next(m for m in agent_authoring.catalog()["mechanics"] if m["id"] == mechanic_id)
    return _hosts(frame, characters, objects) and set(mechanic.get("requires") or ()) <= _capabilities(frame, characters, objects)


def _pick(frame_id: str, mechanic_id: str, characters: int, objects: int) -> tuple[dict, str, list[str]]:
    """The chosen frame and mechanic when they fit together and these entities, else the closest pair that does (reported)."""
    frames = sorted(_frames(), key=lambda f: f["id"] != frame_id)
    mechanics = agent_authoring.catalog()["mechanics"]
    chosen = next((m for m in mechanics if m["id"] == mechanic_id), None)
    ordered = sorted(mechanics, key=lambda m: (m["id"] != mechanic_id, (chosen or {}).get("family") != m.get("family")))
    for frame in frames:  # keep the mechanic, move the frame
        if supports(frame["id"], mechanic_id, characters, objects):
            return frame, mechanic_id, ([f"frame {frame_id} -> {frame['id']}"] if frame["id"] != frame_id else [])
    for frame in frames:  # else keep the frame that fits, move the mechanic
        for mechanic in ordered:
            if supports(frame["id"], mechanic["id"], characters, objects):
                return frame, mechanic["id"], [f"frame {frame_id} -> {frame['id']}", f"mechanic {mechanic_id} -> {mechanic['id']}"]
    raise ValueError(f"Không có khung hình nào chứa {characters} nhân vật và {objects} vật")


def _aspect(prop: dict) -> float:
    try:
        svg = (agent_authoring.ASSETS / prop["path"]).read_text("utf8")
        match = _VIEWBOX.search(svg)
        width, height = float(match.group(3)), float(match.group(4))
        return width / height if width > 0 and height > 0 else 1.0
    except (OSError, AttributeError, ValueError, KeyError):
        return 1.0


def _fit(box: dict, aspect: float) -> dict:
    """The largest rectangle of the given aspect inside box, centred in it."""
    width = box["width"] if box["width"] / box["height"] <= aspect else round(box["height"] * aspect)
    height = round(width / aspect)
    return {"x": box["x"] + (box["width"] - width) // 2, "y": box["y"] + (box["height"] - height) // 2,
            "width": width, "height": height}


def _state(asset: str, box: dict, layer: int, visible: bool = True) -> dict:
    return {"asset": asset, "visible": visible, "layer": layer, "transform": dict(box)}


def _check(stage: dict, act: dict, menus: dict) -> None:
    def need(value, allowed, label):
        if value not in allowed:
            raise ValueError(f"{label} {value!r} không có trong menu")
    need(stage["frame_id"], menus["frames"], "frame_id")
    need(stage["mechanic_id"], menus["mechanics"], "mechanic_id")
    need(stage["dressing"], menus["dressing"], "dressing")
    seen = set()
    for row in stage["present"]:
        need(row["entity_id"], menus["cast"], "entity_id")
        need(row["state_id"], menus["cast"][row["entity_id"]], f"state_id của {row['entity_id']}")
        if row["entity_id"] in seen:
            raise ValueError(f"nhân vật {row['entity_id']} xuất hiện hai lần")
        seen.add(row["entity_id"])
    for row in stage["props"]:
        need(row["prop_id"], menus["props"], "prop_id")
        need(row["role"], ("focus", "support"), "role")
    anchors = {a["id"] for a in menus["anchors"]}
    for event in act["events"]:
        need(event["anchor_id"], anchors, "anchor_id")
    accent = stage.get("accent")
    if accent is not None:
        need(accent["accent_id"], list(menus["accents"]) + [DRAWN, NONE_FITS], "accent_id")
        need(accent["anchor_id"], anchors, "accent anchor_id")
        if accent["accent_id"] == DRAWN:
            accent_art.layout({"parts": accent.get("parts", [])})  # ValueError for an invalid drawing, never repaired


def _mode(mechanic_id: str) -> str:
    mechanic = next((m for m in agent_authoring.catalog()["mechanics"] if m["id"] == mechanic_id), {})
    return MODE_BY_MECHANIC.get(mechanic_id) or MODE_BY_FAMILY.get(mechanic.get("family"), "exposition")


def _family(prop_id: str) -> str:
    return agent_authoring.prop_families_manifest()["by_prop"].get(prop_id, {}).get("family_id", prop_id)


def _below_band(boxes: dict[str, dict]) -> dict[str, dict]:
    """Move a frame's boxes up under the story visual band and scale them only as much as it takes to fit above y=1400."""
    top, bottom = min(b["y"] for b in boxes.values()), max(b["y"] + b["height"] for b in boxes.values())
    k = min(1.0, (STORY_FIELD - STORY_BAND_BOTTOM) / (bottom - top))
    return {name: {"x": round(540 + (b["x"] - 540) * k), "y": round(STORY_BAND_BOTTOM + (b["y"] - top) * k),
                   "width": round(b["width"] * k), "height": round(b["height"] * k)} for name, b in boxes.items()}


def _figure(box: dict) -> dict:
    """The part of a character's box that is drawn: narrower than the box and ending at the feet."""
    return {"x": box["x"] + round(box["width"] * 0.12), "y": box["y"], "width": round(box["width"] * 0.76), "height": round(box["height"] * FEET)}


def _visible(entity: dict) -> dict | None:
    box = _rect(entity)
    return _figure(box) if box and entity.get("kind") == "character" else box


def _hits(a: dict, b: dict, margin: int = 12) -> bool:
    return (a["x"] < b["x"] + b["width"] + margin and b["x"] < a["x"] + a["width"] + margin and
            a["y"] < b["y"] + b["height"] + margin and b["y"] < a["y"] + a["height"] + margin)


def _ground_spot(placed: list[dict], floor: int, size: int, aspect: float) -> dict | None:
    """The first standing place on the floor line, for a prop of this aspect, that touches nobody; None when the row is full."""
    for x in GROUND_X:
        fitted = _ground(_fit({"x": min(x, 1040 - size), "y": floor - size, "width": size, "height": size}, aspect), floor)
        if not any(_hits(fitted, other) for other in placed):
            return fitted
    return None


def _foreground_spot(placed: list[dict], floor: int, aspect: float) -> dict | None:
    """In front of the actors, in the band between their feet and the bottom of the story field; None when it is too shallow."""
    size = min(DRESSING_SIZE, STORY_FIELD - (floor + 10))
    if size < 110:
        return None
    for x in GROUND_X:
        fitted = _fit({"x": min(x, 1040 - size), "y": floor + 10, "width": size, "height": size}, aspect)
        fitted["y"] = floor + 10
        if not any(_hits(fitted, other, 0) for other in placed):
            return fitted
    return None


def _wall_spot(placed: list[dict], aspect: float) -> dict | None:
    """A place high on the wall beside the top row, for set dressing when the floor row is full (a story visual leaves the sides)."""
    for size in (WALL_SIZE, 160):
        for x in (30, 1050 - size):
            fitted = _fit({"x": x, "y": WALL_TOP, "width": size, "height": size}, aspect)
            fitted["y"] = WALL_TOP + size - fitted["height"]
            if not any(_hits(fitted, other) for other in placed):
                return fitted
    return None


def _ground(box: dict, floor: int) -> dict:
    return {**box, "y": floor - box["height"]}


def assemble_scene(menus: dict, stage: dict, act: dict, scene_id: str, scene_range: list[int], scene_text: str, goal: str,
                   story_visuals: dict[str, str] | None = None, art_dir=None) -> dict:
    """Return ``{"kind":"scene.part","payload":{"scene":...,"assets":...}}`` that ``validate_scene`` accepts unchanged.

    ``story_visuals`` maps asset key -> label for the Phase 1 story visuals this scene must carry (declared in the skeleton).
    Core also guarantees what no validator did: one prop per family (dressing included), nothing overlapping, and a
    required story visual in its own band above the actors. What it had to drop is reported in ``core_notes``."""
    _check(stage, act, menus)
    story_visuals = story_visuals or {}
    props = {p["id"]: p for p in agent_authoring._library_props()}
    present = stage["present"]
    notes: list[str] = []
    kept, alias, families = [], {}, {}
    for row in sorted(stage["props"], key=lambda p: p["role"] != "focus"):  # one prop per family, the focus first
        family = _family(row["prop_id"])
        if family in families:
            alias[row["prop_id"]] = families[family]
            notes.append(f"{row['prop_id']} bỏ: cùng họ {family} với {families[family]}")
            continue
        families[family] = row["prop_id"]
        kept.append(row)
    acted = {alias.get(e["target"], e["target"]) for e in act["events"]}
    for row in [r for r in kept if r["role"] != "focus" and r["prop_id"] not in acted]:  # a prop with no action is clutter
        kept.remove(row)
        notes.append(f"{row['prop_id']} bỏ: không có hành động nào dùng tới")
    dressing = stage["dressing"]
    if dressing != NONE and _family(dressing) in families:
        notes.append(f"dressing {dressing} bỏ: cùng họ {_family(dressing)} với vật của cảnh")
        dressing = NONE
    accent = stage.get("accent")
    has_accent = bool(accent) and accent["accent_id"] != NONE_FITS
    if dressing == NONE and not has_accent and _mode(stage["mechanic_id"]) in NEEDS_DRESSING:  # the checks require a depth__ layer in these scenes
        dressing = next((p for p in DRESSING_FALLBACK if p in props and _family(p) not in families), NONE)
        if dressing != NONE:
            notes.append(f"dressing {dressing}: Core thêm vì cảnh cần lớp nền")
    focus_prop = next((p for p in kept if p["role"] == "focus"), None)
    frame, mechanic_id, picked = _pick(stage["frame_id"], stage["mechanic_id"], len(present), len(kept) + len(story_visuals))
    notes += picked
    stage = {**stage, "mechanic_id": mechanic_id}
    slots = _below_band(PLACEMENT[frame["id"]]) if story_visuals else {name: dict(box) for name, box in PLACEMENT[frame["id"]].items()}

    entities, assets, bindings, placed = [], {}, {}, []
    boxes_for = {}
    for slot, row in zip(_slots(frame, "character"), present):
        bindings[slot] = row["entity_id"]
        boxes_for[row["entity_id"]] = slots[slot]
        placed.append(_figure(slots[slot]))
    state_use = {row["entity_id"]: {row["state_id"]} for row in present}
    for event in act["events"]:
        target = event["target"]
        if target in state_use and event["state_after"] != SAME:
            if event["state_after"] not in menus["cast"][target]:
                raise ValueError(f"state_after {event['state_after']!r} không thuộc {target}")
            state_use[target].add(event["state_after"])
    for row in present:
        entities.append({"id": row["entity_id"], "kind": "character", "visual_role": "character", "initial_state": row["state_id"],
                         "states": {s: _state(s, boxes_for[row["entity_id"]], LAYER_CHARACTER) for s in sorted(state_use[row["entity_id"]])},
                         "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
    # a story visual takes its own band; props take an object slot, else a free spot that touches nobody
    sv_entities = []
    object_slots = _slots(frame, "object")
    character_bottoms = [b["y"] + round(b["height"] * FEET) for b in boxes_for.values()]
    floor = max(character_bottoms) if character_bottoms else DEFAULT_FLOOR
    for asset_key in story_visuals:
        entities.append({"id": asset_key.lower(), "kind": "story_visual", "visual_role": "story_visual", "initial_state": "hidden",
                         "states": {"hidden": _state(asset_key, STORY_VISUAL_BOX, LAYER_STORY, False),
                                    "shown": _state(asset_key, STORY_VISUAL_BOX, LAYER_STORY)},
                         "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
        sv_entities.append(asset_key.lower())
        placed.append(STORY_VISUAL_BOX)
    for row in kept:
        library = props[row["prop_id"]]
        slot = next((n for n in object_slots if n not in bindings), None)
        aspect = _aspect(library)
        fitted = (_ground(_fit(slots[slot], aspect), floor) if slot
                  else _ground_spot(placed, floor, FOCUS_SIZE if row is focus_prop else SUPPORT_SIZE, aspect))
        if fitted is None:
            notes.append(f"{row['prop_id']} bỏ: không còn chỗ trống")
            alias[row["prop_id"]] = None
            if row is focus_prop:
                focus_prop = None
            continue
        if slot:
            bindings[slot] = row["prop_id"]
        placed.append(fitted)
        key = f"{scene_id}-{row['prop_id']}"
        assets[key] = {"path": "library:" + library["path"], "category": "prop"}
        entities.append({"id": row["prop_id"], "kind": "object", "visual_role": "interactive_prop", "initial_state": "idle",
                         "states": {"idle": _state(key, fitted, LAYER_PROP)},
                         "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
    sv_slot = next((n for n in object_slots if n not in bindings), None)
    if sv_slot and sv_entities:
        bindings[sv_slot] = sv_entities[0]
    # set dressing is added by Core, behind everything, only where it touches nobody
    if dressing != NONE:
        library = props[dressing]
        aspect = _aspect(library)
        box = (_ground_spot(placed, floor, DRESSING_SIZE, aspect) or _foreground_spot(placed, floor, aspect)
               or _wall_spot(placed, aspect))
        if box is None:
            notes.append(f"dressing {dressing} bỏ: không còn chỗ trống")
        else:
            key = f"{scene_id}-depth-{dressing}"
            assets[key] = {"path": "library:" + library["path"], "category": "prop"}
            entities.append({"id": "depth__" + dressing, "kind": "object", "visual_role": "background", "initial_state": "idle",
                             "states": {"idle": _state(key, box, LAYER_DRESSING)}})

    act = {"events": [{**e, "target": alias.get(e["target"], e["target"])} for e in act["events"]
                      if alias.get(e["target"], e["target"]) is not None]}
    events, timing_notes = _events(menus, act, entities, sv_entities, goal, scene_text)
    notes += timing_notes
    scene = {"id": scene_id, "narration_range": list(scene_range), "semantic_goal": goal,
             "grammar": {"frame_id": frame["id"], "mechanic_id": stage["mechanic_id"], "bindings": bindings},
             "entities": entities, "events": events,
             "layout_contract": {"caption_safe_zone": dict(CAPTION_ZONE)},
             "experience_profile": _profile(menus, stage, entities, focus_prop, goal)}
    if not story_visuals:
        _centre(scene)
    if has_accent:
        _add_accent(scene, assets, accent, menus, scene_id, scene_text, bool(story_visuals), art_dir)
    prune_non_story_references(scene)
    part = {"kind": "scene.part", "payload": {"scene": scene, "assets": assets}}
    if accent and accent["accent_id"] == NONE_FITS:  # the library has no such cue: ask for art, never substitute one
        part["asset_requests"] = [{"wanted": f"{accent['setting']}: {accent['visible_detail']}", "code": "NEW_VARIANT_MASTER_REQUIRED",
                                   "kind": "scene_accent", "scene_id": scene_id}]
        notes.append("scene accent: thư viện không có cue phù hợp, đã ghi yêu cầu vẽ mới")
    if notes:
        part["core_notes"] = notes
    return part


def _centre(scene: dict) -> None:
    """Move everything up together so the group is centred about CENTRE_Y (never down, never above y=100)."""
    rects = [r for r in (_visible(e) for e in scene["entities"]) if r]
    if not rects:
        return
    top, low = min(r["y"] for r in rects), max(r["y"] + r["height"] for r in rects)
    shift = max(round(CENTRE_Y - (top + low) / 2), 100 - top)
    if shift >= 0:
        return
    for entity in scene["entities"]:
        for state in (entity.get("states") or {}).values():
            if isinstance(state, dict) and state.get("transform"):
                state["transform"]["y"] += shift


def _add_accent(scene: dict, assets: dict, accent: dict, menus: dict, scene_id: str, scene_text: str, has_story_visual: bool, art_dir) -> None:
    """The scene's setting: a rear, canvas-native cue (a registered master or art Core draws), declared with its context and anchor."""
    anchor = next(a["text"] for a in menus["anchors"] if a["id"] == accent["anchor_id"])
    key = f"{scene_id}-accent"
    actors = [r for r in (_visible(e) for e in scene["entities"] if e.get("kind") == "character") if r]
    top = min((r["y"] for r in actors), default=DEFAULT_FLOOR)
    if accent["accent_id"] == DRAWN:
        assets[key] = accent_art.normalized_accent({"parts": accent["parts"]}, directory=art_dir, write=art_dir is not None)
        # the 900x420 picture sits above the cast (or behind the story visual), scaled down to the room there is
        scale = 0.8 if has_story_visual else max(0.55, min(1.0, (top - ACCENT_TOP - 20) / accent_art.VIEW_H))
        width, height = round(accent_art.VIEW_W * scale), round(accent_art.VIEW_H * scale)
        y = ACCENT_TOP + 10 if has_story_visual else max(ACCENT_TOP, top - height - 20)
        box = {"x": (1080 - width) // 2, "y": min(y, CAPTION_ZONE["y"] - height - 10), "width": width, "height": height}
    else:
        row = accent_registry()[accent["accent_id"]]
        assets[key] = {"path": "library:scene-set/" + row["path"], "category": "scene_accent", "source_sha256": row["asset_sha256"]}
        aspect = _aspect({"path": "scene-set/" + row["path"]})
        width = min(ACCENT_MAX_WIDTH, max(ACCENT_MIN, round((ACCENT_AREA * aspect) ** 0.5)))
        height = round(width / aspect)
        # a rear cue: it may reach behind the cast's heads, so it can be big enough to read as the place
        y = max(ACCENT_TOP, top - round(height * ACCENT_OVERLAP))
        box = {"x": (1080 - width) // 2, "y": min(y, CAPTION_ZONE["y"] - height - 10), "width": width, "height": height}
    scene["entities"].insert(0, {
        "id": "accent_" + scene_id, "kind": "scene_accent", "visual_role": "scene_accent", "initial_state": "visible",
        "context": {"kind": "environment_detail", "setting": accent["setting"], "visible_detail": accent["visible_detail"]},
        "states": {"visible": _state(key, box, LAYER_ACCENT)},
        "narrative_intent": {"voice_anchor": anchor, "reason": accent["visible_detail"]}})


def _rect(entity: dict) -> dict | None:
    boxes = [s["transform"] for s in (entity.get("states") or {}).values() if isinstance(s, dict) and s.get("transform")]
    if not boxes:
        return None
    left, top = min(b["x"] for b in boxes), min(b["y"] for b in boxes)
    return {"x": left, "y": top, "width": max(b["x"] + b["width"] for b in boxes) - left,
            "height": max(b["y"] + b["height"] for b in boxes) - top}


def scene_faults(part: dict, required_story_visuals=()) -> list[dict]:
    """Faults no existing check names: a prop family twice, two things on top of each other, a required story visual missing."""
    scene, assets = part["payload"]["scene"], part["payload"].get("assets") or {}
    by_path = {"library:" + p["path"]: p["id"] for p in agent_authoring._library_props()}
    faults, seen = [], {}
    for entity in scene["entities"]:
        if entity.get("kind") != "object":
            continue
        asset = next((s.get("asset") for s in entity["states"].values()), None)
        prop = by_path.get((assets.get(asset) or {}).get("path", ""))
        if prop is None:
            continue
        family = _family(prop)
        if family in seen:
            faults.append({"code": "DUPLICATE_PROP_FAMILY", "entities": [seen[family], entity["id"]], "family": family})
        seen.setdefault(family, entity["id"])
    kinds = {e["id"]: e.get("kind") for e in scene["entities"]}
    rects = [(e["id"], _visible(e)) for e in scene["entities"] if _visible(e)]
    for i, (a_id, a) in enumerate(rects):
        for b_id, b in rects[i + 1:]:
            behind = {a_id.startswith("depth__"), b_id.startswith("depth__")} == {True, False} and "character" in (kinds[a_id], kinds[b_id])
            rear = "scene_accent" in (kinds[a_id], kinds[b_id])  # a rear context cue is independent of the actors
            if _hits(a, b, margin=0) and not behind and not rear:
                faults.append({"code": "ENTITY_OVERLAP", "entities": [a_id, b_id]})
    present = {e["id"] for e in scene["entities"]}
    faults += [{"code": "STORY_VISUAL_MISSING", "entity": key} for key in required_story_visuals if key.lower() not in present]
    return faults


def story_visual_assets(context: dict, intent_assets: dict, scene_id: str) -> dict[str, str]:
    """{asset key: label} of the Phase 1 story visuals this scene must carry (the scene holding the beat's voice anchor).
    The skeleton's own asset is used, not a per-scene copy (key starting with a scene id) an earlier run made."""
    from .agent_parts import story_visuals_by_scene
    wanted = story_visuals_by_scene(context).get(scene_id, [])
    found: dict[str, tuple[str, str]] = {}
    for key, asset in intent_assets.items():
        if asset.get("category") != "story_visual":
            continue
        phase1 = asset.get("phase1_visual_id") or (asset.get("creative_origin") or {}).get("phase1_visual_id")
        if phase1 not in wanted or (phase1 in found and re.match(r"s\d\d-", key)):
            continue
        found[phase1] = (key, asset.get("source_visual_type") or (asset.get("visual") or {}).get("type") or "story_visual")
    return {key: label for key, label in found.values()}


def _first_words(text: str) -> str:
    return " ".join(text.split()[:2]) or text


def _events(menus: dict, act: dict, entities: list[dict], sv_entities: list[str], goal: str, scene_text: str) -> tuple[list[dict], list[str]]:
    by_id = {e["id"]: e for e in entities}
    anchors = {a["id"]: a for a in menus["anchors"]}
    current = {e["id"]: e["initial_state"] for e in entities}
    events = []

    def add(target, before, after, trigger, action, motion):
        events.append({"id": f"e{len(events) + 1}", "target": target, "state_before": before, "state_after": after,
                       "action": action[:80], "trigger": trigger, "motion": motion})
        current[target] = after

    for ident in sv_entities:  # revealed on the first anchor, or at the start when the scene has none
        first = min(anchors.values(), key=lambda a: a["at"], default=None)
        trigger = {"type": "voice_anchor", "text": first["text"]} if first else {"type": "scene_start"}
        add(ident, "hidden", "shown", trigger, "Hiện nội dung của cảnh", SWAP)
    busy_until: dict[str, float] = {}  # the export refuses a target's next acting event before the previous one has finished
    dropped = []
    for row in sorted(act["events"], key=lambda r: anchors[r["anchor_id"]]["at"]):
        target = row["target"]
        when = anchors[row["anchor_id"]].get("t")
        if when is not None and when < busy_until.get(target, 0.0):
            dropped.append(f"{target} @{when}s")
            continue
        if target not in by_id or by_id[target]["kind"] == "story_visual":
            raise ValueError(f"target {target!r} không có mặt trong cảnh")
        after = current[target] if row["state_after"] == SAME else row["state_after"]
        if after not in by_id[target]["states"]:
            raise ValueError(f"state_after {after!r} không có trong {target}")
        trigger = {"type": "voice_anchor", "text": anchors[row["anchor_id"]]["text"]}
        motion = SWAP if after != current[target] else LEAN
        add(target, current[target], after, trigger, row["action"] or goal, motion)
        if when is not None:
            busy_until[target] = when + motion["duration_frames"] / FPS + 0.02
    if not events:  # every scene needs one acting event: the first entity enters at the scene start
        first = next((e for e in entities if e["kind"] != "story_visual" and not e["id"].startswith("depth__")), None)
        if first is not None:
            add(first["id"], first["initial_state"], first["initial_state"], {"type": "scene_start"}, "Bước vào khung hình",
                {"preset": "enter", "duration_frames": 12, "params": {"from": "left"}})
    return events, [f"sự kiện của {d} quá sát sự kiện trước, bỏ" for d in dropped]


def _profile(menus: dict, stage: dict, entities: list[dict], focus_prop: dict | None, goal: str) -> dict:
    mode = _mode(stage["mechanic_id"])
    story = [e["id"] for e in entities if e["kind"] in ("character", "object", "story_visual") and not e["id"].startswith("depth__")]
    focal = (focus_prop["prop_id"] if focus_prop else next((e["id"] for e in entities if e["kind"] == "story_visual"), None)
             or next((e["id"] for e in entities if e["kind"] == "character"), None) or (story[0] if story else None))
    support = [i for i in story if i != focal]
    profile: dict = {"story_mode": mode}
    required = [p for p in ([focus_prop["prop_id"]] if focus_prop else [])]
    if required:
        profile["required_physical_entities"] = required
    if focal:
        profile["story_focus"] = {"goal": goal, "focal_entity_id": focal, "supporting_entity_ids": support,
                                  "links": [{"from": focal, "to": other, "relation": "cùng tham gia khoảnh khắc của cảnh",
                                             "purpose": "làm rõ mục tiêu của cảnh"} for other in support]}
    return profile
