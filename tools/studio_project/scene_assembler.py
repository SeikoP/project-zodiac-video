"""Core assembles one scene from the model's menu choices (constructive visual pipeline).

The model chose ids from ``authoring_menus``; here Core turns them into the existing ``scene.part`` shape, so
``agent_parts.validate_scene``, ``merge``, the compiler and export are unchanged. Core owns every coordinate (``PLACEMENT``),
entity id, asset key, layer, trigger text, profile and focus; an id outside the menus is an error, never repaired.
"""
from __future__ import annotations

import re

from . import agent_authoring
from . import accent_art, story_visual_art
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
    # three people stand side by side on one floor line (smaller, with room between them), none hangs above the others
    "three-person-comparison": {"lead": {"x": 390, "y": 690, "width": 300, "height": 600},
                                "peer_a": {"x": 30, "y": 690, "width": 300, "height": 600},
                                "peer_b": {"x": 750, "y": 690, "width": 300, "height": 600}},
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
HEAD_TOP = 0.24  # ...and the head starts about this far down its box: the art has empty space above the hair
SUPPORT_SIZE, FOCUS_SIZE, DRESSING_SIZE = 180, 300, 240
MODE_BY_MECHANIC = {"explain": "exposition", "react": "reflection", "express-reaction": "reflection", "facepalm": "reflection",
                    "point-choice": "relationship", "compare-group": "relationship", "compare-two-props": "relationship"}
MODE_BY_FAMILY = {"state": "exposition", "interaction": "behavior", "narrative": "payoff"}
NEEDS_DRESSING = frozenset({"relationship", "behavior", "payoff"})
DRESSING_FALLBACK = ("laptop", "notebook", "coffee-cup", "potted-plant", "book", "lightbulb")  # ordinary props that read as scenery
FPS = 24
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
                   story_visuals: dict[str, str] | None = None, art_dir=None, story_reveal: str | None = None,
                   story_specs: dict | None = None) -> dict:
    """Return ``{"kind":"scene.part","payload":{"scene":...,"assets":...}}`` that ``validate_scene`` accepts unchanged.

    ``story_visuals`` maps asset key -> label for the Phase 1 story visuals this scene must carry (declared in the skeleton).
    Core also guarantees what no validator did: one prop per family (dressing included), nothing overlapping, and a
    required story visual in its own band above the actors. What it had to drop is reported in ``core_notes``."""
    _check(stage, act, menus)
    story_visuals = story_visuals or {}
    graphic = stage.get("graphic") if isinstance(stage.get("graphic"), dict) and stage["graphic"].get("motif") != "none" else None
    graphic_spec = None
    if graphic and not story_visuals:  # a scene carries one picture: the Phase 1 story visual wins
        graphic_spec = graphic_to_spec(graphic)  # ValueError for an invalid picture, never repaired
        story_visual_art.visual_svg(graphic_spec)  # draws it once: a field that does not fit the art is refused here, with its reason
        if story_visual_art.steps(graphic_spec) < 1:
            raise ValueError(f"graphic {graphic['motif']!r} cần ít nhất một phần nội dung (hàng/mục/điểm/tin nhắn)")
    hero_plan = None
    if graphic_spec is not None and graphic_spec["type"] == "hero":  # each state of the object lands on its own words, in order
        by_anchor = {a["id"]: a for a in menus["anchors"]}
        ids = [state["anchor_id"] for state in graphic["states"]]
        if any(i not in by_anchor for i in ids) or ids != sorted(set(ids), key=lambda i: by_anchor[i]["at"]) or ids[0] != graphic.get("anchor_id"):
            raise ValueError("hero: mỗi trạng thái cần một neo lời riêng, theo đúng thứ tự trong lời đọc, trạng thái đầu trùng anchor_id")
        hero_plan = [(f"step{k}", {"type": "voice_anchor", "text": by_anchor[i]["text"]}) for k, i in enumerate(ids, 1)]
        spoken = {w.strip(".,;:!?…—\"'()").lower() for w in scene_text.split()}
        for k, state in enumerate(graphic["states"], 1):  # story text is lettering INSIDE the picture: every state carries words of the script
            words = [p["text"] for p in state["parts"] if p.get("shape") == "text" and p.get("text")]
            if not any(all(w.strip(".,;:!?…—\"'()").lower() in spoken for w in text.split()) for text in words):
                raise ValueError(f"hero state {k}: the story text is part of the picture; letter at least one text part whose words are taken from the narration of this scene")
    has_band = bool(story_visuals) or graphic_spec is not None
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
    frame, mechanic_id, picked = _pick(stage["frame_id"], stage["mechanic_id"], len(present), len(kept) + (1 if has_band else 0))
    notes += picked
    stage = {**stage, "mechanic_id": mechanic_id}
    slots = _below_band(PLACEMENT[frame["id"]]) if has_band else {name: dict(box) for name, box in PLACEMENT[frame["id"]].items()}

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
    sv_steps: dict[str, list[str]] = {}
    for asset_key in story_visuals:
        row = (story_specs or {}).get(asset_key) or {}
        spec = row.get("visual")
        count = _spec_steps(spec)
        states = {"hidden": _state(asset_key, STORY_VISUAL_BOX, LAYER_STORY, False)}
        if count >= 2:  # revealed one piece at a time, each piece an asset of its own, on the beat's own anchors
            names = []
            for k in range(1, count + 1):
                name, key = f"step{k}", f"{asset_key}-step{k}"
                assets[key] = story_visual_art.normalized_asset(spec, directory=art_dir, phase1_id=row.get("phase1_visual_id") or asset_key, write=art_dir is not None, step=k)
                states[name] = _state(key, STORY_VISUAL_BOX, LAYER_STORY)
                names.append(name)
            sv_steps[asset_key.lower()] = names
        else:
            states["shown"] = _state(asset_key, STORY_VISUAL_BOX, LAYER_STORY)
        entities.append({"id": asset_key.lower(), "kind": "story_visual", "visual_role": "story_visual", "initial_state": "hidden",
                         "states": states, "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
        sv_entities.append(asset_key.lower())
        placed.append(STORY_VISUAL_BOX)
    if graphic_spec is not None:
        ident = f"graphic_{scene_id}"
        states = {"hidden": _state(f"{scene_id}-graphic-step1", STORY_VISUAL_BOX, LAYER_STORY, False)}
        names = []
        for k in range(1, story_visual_art.steps(graphic_spec) + 1):
            key = f"{scene_id}-graphic-step{k}"
            assets[key] = story_visual_art.normalized_asset(graphic_spec, directory=art_dir, phase1_id="", write=art_dir is not None, step=k, studio=True)
            states[f"step{k}"] = _state(key, STORY_VISUAL_BOX, LAYER_STORY)
            names.append(f"step{k}")
        reveal = next((a["text"] for a in menus["anchors"] if a["id"] == graphic.get("anchor_id")), None)
        story_reveal = reveal if reveal and reveal in scene_text else story_reveal
        entities.append({"id": ident, "kind": "object", "visual_role": "interactive_prop", "initial_state": "hidden", "states": states,
                         "narrative_intent": {"voice_anchor": _first_words(reveal or scene_text), "reason": goal}})
        sv_entities.append(ident)
        sv_steps[ident] = names
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
    events, timing_notes = _events(menus, act, entities, sv_entities, goal, scene_text, story_reveal, sv_steps, {f"graphic_{scene_id}": hero_plan} if hero_plan else None)
    notes += timing_notes
    scene = {"id": scene_id, "narration_range": list(scene_range), "semantic_goal": goal,
             "grammar": {"frame_id": frame["id"], "mechanic_id": stage["mechanic_id"], "bindings": bindings},
             "entities": entities, "events": events,
             "layout_contract": {"caption_safe_zone": dict(CAPTION_ZONE)},
             "experience_profile": _profile(menus, stage, entities, focus_prop, goal)}
    if not has_band:
        _centre(scene)
    if has_accent:
        _add_accent(scene, assets, accent, menus, scene_id, scene_text, has_band, art_dir)
    _separate_depth(scene)
    prune_non_story_references(scene)
    notes += _move(scene, menus)
    part = {"kind": "scene.part", "payload": {"scene": scene, "assets": assets}}
    if accent and accent["accent_id"] == NONE_FITS:  # the library has no such cue: ask for art, never substitute one
        part["asset_requests"] = [{"wanted": f"{accent['setting']}: {accent['visible_detail']}", "code": "NEW_VARIANT_MASTER_REQUIRED",
                                   "kind": "scene_accent", "scene_id": scene_id}]
        notes.append("scene accent: thư viện không có cue phù hợp, đã ghi yêu cầu vẽ mới")
    if notes:
        part["core_notes"] = notes
    return part


def _move(scene: dict, menus: dict) -> list[str]:
    """Core's motion pass (scene_motion): registered presets on pose changes and on the first piece of a picture."""
    from . import scene_motion
    return scene_motion.animate(scene)


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
        heads = min((r["y"] + round(r["height"] / FEET * HEAD_TOP) for r in actors), default=DEFAULT_FLOOR)
        _add_drawn_layers(scene, assets, accent, scene_id, anchor, has_story_visual, art_dir, heads,
                          max((r["y"] + r["height"] for r in actors), default=DEFAULT_FLOOR))
        return
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


def _add_drawn_layers(scene: dict, assets: dict, accent: dict, scene_id: str, anchor: str, has_story_visual: bool, art_dir,
                      cast_top: int, feet: int) -> None:
    """Core's drawing is two rear layers: what hangs sits above the cast's heads, what stands has its floor line on the actors' ground."""
    scale = 1080 / accent_art.VIEW_W
    layers = accent_art.normalized_layers({"parts": accent["parts"]}, directory=art_dir, write=art_dir is not None)
    limit = CAPTION_ZONE["y"] - 10
    for index, kind in enumerate(("wall", "floor")):
        if kind not in layers:
            continue
        view = layers[kind]["view"]
        width, height = 1080, round(view["h"] * scale)
        if kind == "floor":  # the drawn floor line lands just behind the actors' feet
            y = feet - 8 - round((view["floor_y"] - view["y"]) * scale)
        else:  # hung just above the cast's heads, and under the story visual's band when there is one
            y = max(STORY_BAND_BOTTOM + 10 if has_story_visual else ACCENT_TOP, cast_top - height - 10)
        y = max(0, min(y, limit - height))
        key = f"{scene_id}-accent-{kind}"
        assets[key] = layers[kind]["asset"]
        scene["entities"].insert(index, {
            "id": f"accent_{scene_id}_{kind}", "kind": "scene_accent", "visual_role": "scene_accent", "initial_state": "visible",
            "context": {"kind": "environment_detail", "setting": accent["setting"], "visible_detail": accent["visible_detail"]},
            "states": {"visible": _state(key, {"x": 0, "y": y, "width": width, "height": height}, LAYER_ACCENT + index)},
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


def graphic_to_spec(graphic: dict) -> dict:
    """The model's flat choice as the art module's spec (counts and levels arrive as text)."""
    motif = graphic["motif"]
    try:
        if motif == "hero":
            return {"type": "hero", "states": [{"parts": [dict(p) for p in state["parts"]]} for state in graphic["states"]]}
        if motif == "sketch":
            return {"type": "sketch", "parts": [dict(p) for p in graphic["parts"]]}
        if motif == "stamp":
            return {"type": "stamp", "text": graphic["text"], "sub": graphic["sub"]}
        if motif == "meter":
            return {"type": "meter", "title": graphic["title"], "left": graphic["left"], "right": graphic["right"], "level": int(graphic["level"])}
        if motif == "versus":
            rows = graphic["rows"]
            return {"type": "versus", "left": {"title": graphic["left_title"], "rows": [r["left"] for r in rows]},
                    "right": {"title": graphic["right_title"], "rows": [r["right"] for r in rows]}}
        if motif == "receipt":
            return {"type": "receipt", "title": graphic["title"], "total": graphic["total"], "items": [dict(i) for i in graphic["items"]]}
        if motif == "route":
            return {"type": "route", "pins": list(graphic["pins"]), "caption": graphic["caption"]}
        if motif == "folder":
            return {"type": "folder", "name": graphic["name"], "files": list(graphic["files"])}
        if motif == "tally":
            return {"type": "tally", "title": graphic["title"], "count": int(graphic["count"]), "caption": graphic["caption"]}
        if motif == "chat_thread":
            return {"type": "chat_thread", "title": graphic["title"], "messages": [dict(m) for m in graphic["messages"]]}
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"graphic {motif!r} không hợp lệ: {error}") from error
    raise ValueError(f"graphic motif {motif!r} không có trong danh sách")


def _spec_steps(spec) -> int:
    try:
        return story_visual_art.steps(spec) if isinstance(spec, dict) else 0
    except ValueError:
        return 0


def _reveal_plan(menus: dict, names: list[str], scene_text: str, story_reveal: str | None) -> list[tuple[str, dict]]:
    """[(state, trigger)] for a picture shown piece by piece: the first piece on the beat's own words, the others spread over the
    anchors that follow (at least half a second apart), and the last piece is always the last state reached."""
    anchors = sorted(menus["anchors"], key=lambda a: a["at"])
    start = next((i for i, a in enumerate(anchors) if story_reveal and story_reveal in a["text"]), 0)
    pool, last = [], None
    for a in anchors[start:]:
        t = a.get("t")
        if last is not None and t is not None and t - last < 0.5:
            continue
        pool.append(a)
        last = t if t is not None else last
    first = {"type": "voice_anchor", "text": story_reveal} if story_reveal and story_reveal in scene_text else None
    if not pool:
        return [(names[-1], first or {"type": "scene_start"})] if len(names) else []
    count, m = len(names), min(len(names), len(pool))
    # The pieces belong to the beat that shows the picture: spread them over its first anchors, not to the end of the scene
    # (a count that finishes three seconds after the words that justify it reads as a late picture).
    reach = max(m - 1, int(0.6 * (len(pool) - 1)))
    plan = []
    for e in range(m):
        position = round(e * reach / (m - 1)) if m > 1 else 0
        state = names[min(count - 1, round((e + 1) * count / m) - 1)]
        trigger = first if (e == 0 and first) else {"type": "voice_anchor", "text": pool[position]["text"]}
        if plan and plan[-1][1] == trigger:
            continue
        plan.append((state, trigger))
    plan[-1] = (names[-1], plan[-1][1])
    return plan


def story_reveal_text(context: dict, scene_id: str) -> str | None:
    """The first words of the Phase 1 beat this scene's Story Visual belongs to (an exact piece of the scene text), or None.

    The story visual appears when the narration reaches its beat, not at the top of the scene."""
    from .agent_parts import scene_text as text_of, story_visuals_by_scene
    plan = context.get("narrative_plan") or {}
    wanted = story_visuals_by_scene(context).get(scene_id, [])
    beats = {b.get("id"): b for b in plan.get("beats", []) if isinstance(b, dict)}
    scene = text_of(context, scene_id)
    for visual in plan.get("story_visuals", []):
        if visual.get("id") not in wanted:
            continue
        for beat_id in visual.get("beat_ids", []):
            words = str((beats.get(beat_id) or {}).get("voice_anchor", "")).split()
            for size in (4, 3, 2):
                phrase = " ".join(words[:size])
                if len(words) >= size and phrase and phrase in scene:
                    return phrase
    return None


def _events(menus: dict, act: dict, entities: list[dict], sv_entities: list[str], goal: str, scene_text: str, story_reveal: str | None = None,
            sv_steps: dict | None = None, plans: dict | None = None) -> tuple[list[dict], list[str]]:
    by_id = {e["id"]: e for e in entities}
    anchors = {a["id"]: a for a in menus["anchors"]}
    current = {e["id"]: e["initial_state"] for e in entities}
    events = []

    def add(target, before, after, trigger, action, motion):
        events.append({"id": f"e{len(events) + 1}", "target": target, "state_before": before, "state_after": after,
                       "action": action[:80], "trigger": trigger, "motion": motion})
        current[target] = after

    for ident in sv_entities:  # revealed on the first anchor, or at the start when the scene has none
        if (sv_steps or {}).get(ident):
            for after, trigger in (plans or {}).get(ident) or _reveal_plan(menus, sv_steps[ident], scene_text, story_reveal):
                add(ident, current[ident], after, trigger, "Vật của chuyện đổi trạng thái" if (plans or {}).get(ident) else "Hiện thêm một phần của hình giải thích", SWAP)
            continue
        first = min(anchors.values(), key=lambda a: a["at"], default=None)
        if story_reveal and story_reveal in scene_text:  # on the beat the picture explains
            trigger = {"type": "voice_anchor", "text": story_reveal}
        else:
            trigger = {"type": "voice_anchor", "text": first["text"]} if first else {"type": "scene_start"}
        add(ident, "hidden", "shown", trigger, "Hiện nội dung của cảnh", SWAP)
    busy_until: dict[str, float] = {}  # the export refuses a target's next acting event before the previous one has finished
    dropped = []
    leaned = False  # a character moves at most once per scene, and only when an event of the narration is acted out
    for row in sorted(act["events"], key=lambda r: anchors[r["anchor_id"]]["at"]):
        target = row["target"]
        when = anchors[row["anchor_id"]].get("t")
        if when is not None and when < busy_until.get(target, 0.0):
            dropped.append(f"sự kiện của {target} @{when}s quá sát sự kiện trước, bỏ")
            continue
        if target not in by_id or by_id[target]["kind"] == "story_visual":
            raise ValueError(f"target {target!r} không có mặt trong cảnh")
        after = current[target] if row["state_after"] == SAME else row["state_after"]
        if after not in by_id[target]["states"]:
            raise ValueError(f"state_after {after!r} không có trong {target}")
        trigger = {"type": "voice_anchor", "text": anchors[row["anchor_id"]]["text"]}
        swapped = after != current[target]
        if not swapped and by_id[target].get("kind") == "character":
            if leaned:  # a second push of the same body adds nothing the viewer needs
                dropped.append(f"chuyển động thừa của {target} bỏ: mỗi nhân vật chỉ nghiêng một lần mỗi cảnh")
                continue
            leaned = True
        motion = SWAP if swapped else _lean(by_id, target)
        add(target, current[target], after, trigger, row["action"] or goal, motion)
        if when is not None:
            busy_until[target] = when + motion["duration_frames"] / FPS + 0.02
    if not events:  # every scene needs one acting event: the first entity enters at the scene start
        first = next((e for e in entities if e["kind"] != "story_visual" and not e["id"].startswith("depth__")), None)
        if first is not None:
            add(first["id"], first["initial_state"], first["initial_state"], {"type": "scene_start"}, "Bước vào khung hình",
                {"preset": "enter", "duration_frames": 12, "params": {"from": "left"}})
    return events, dropped


def _lean(by_id: dict, target: str) -> dict:
    """An emphasis move: a character leans toward the other one with a small hop; anything else keeps the plain nudge."""
    me = by_id[target]
    if me.get("kind") != "character":
        return LEAN
    mine = _rect(me)
    others = [r for r in (_rect(e) for e in by_id.values() if e.get("kind") == "character" and e["id"] != target) if r]
    if not mine or not others:
        return {"preset": "lean", "duration_frames": 14, "params": {"degrees": 6, "dx": 0, "dy": 0, "settle": "return"}}
    toward = 1 if others[0]["x"] > mine["x"] else -1
    return {"preset": "lean", "duration_frames": 14, "params": {"degrees": 7 * toward, "dx": 18 * toward, "dy": 0, "settle": "return"}}


LAYER_NEAR = 25


def _separate_depth(scene: dict) -> None:
    """Readable depth needs the story entities on at least two layers. When everything is one layer (two actors and nothing else),
    the second actor stands in front of the first: a real overlap order, no change to where anyone stands."""
    story = [e for e in scene["entities"] if e.get("kind") in ("character", "object", "story_visual") and not e["id"].startswith("depth__")]
    layers = {s.get("layer") for e in story for s in (e.get("states") or {}).values() if isinstance(s, dict)}
    actors = [e for e in story if e["kind"] == "character"]
    if len(layers) >= 2 or len(actors) < 2:
        return
    for state in (actors[1].get("states") or {}).values():
        if isinstance(state, dict):
            state["layer"] = LAYER_NEAR


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
