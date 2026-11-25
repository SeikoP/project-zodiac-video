"""Core assembles one scene from the model's menu choices (constructive visual pipeline).

The model chose ids from ``authoring_menus``; here Core turns them into the existing ``scene.part`` shape, so
``agent_parts.validate_scene``, ``merge``, the compiler and export are unchanged. Core owns every coordinate (``PLACEMENT``),
entity id, asset key, layer, trigger text, profile and focus; an id outside the menus is an error, never repaired.
"""
from __future__ import annotations

import re

from . import agent_authoring
from .authoring_menus import NONE, SAME
from .scene_repairs import prune_non_story_references

CAPTION_ZONE = {"x": 80, "y": 1470, "width": 920, "height": 360}
LAYER_DRESSING, LAYER_CHARACTER, LAYER_PROP, LAYER_STORY = 10, 20, 30, 40

# frame id -> slot -> box (story field 1080x1400; the caption lane starts at y=1470). Characters keep the 1:2 ratio of the art.
PLACEMENT: dict[str, dict[str, dict]] = {
    "single-character-focus": {"subject": {"x": 150, "y": 420, "width": 390, "height": 780},
                               "focus_prop": {"x": 600, "y": 700, "width": 360, "height": 360}},
    "two-person-offset": {"speaker": {"x": 70, "y": 420, "width": 390, "height": 780},
                          "listener": {"x": 620, "y": 380, "width": 390, "height": 780},
                          "shared_prop": {"x": 410, "y": 880, "width": 260, "height": 260}},
    "prop-focus": {"focus_prop": {"x": 60, "y": 400, "width": 560, "height": 560},
                   "companion": {"x": 640, "y": 420, "width": 390, "height": 780}},
    "reaction-closeup": {"subject": {"x": 265, "y": 260, "width": 550, "height": 1100}},
    "caption-payoff": {"subject": {"x": 290, "y": 300, "width": 500, "height": 1000}},
    "three-person-comparison": {"lead": {"x": 375, "y": 260, "width": 330, "height": 660},
                                "peer_a": {"x": 40, "y": 520, "width": 330, "height": 660},
                                "peer_b": {"x": 710, "y": 520, "width": 330, "height": 660}},
}
SUPPORT_SPOTS = [{"x": 60, "y": 1000, "width": 240, "height": 240}, {"x": 780, "y": 1000, "width": 240, "height": 240}]
DRESSING_BOX = {"x": 380, "y": 80, "width": 320, "height": 320}
STORY_VISUAL_BOX = {"x": 90, "y": 150, "width": 900, "height": 520}

MODE_BY_MECHANIC = {"explain": "exposition", "react": "reflection", "express-reaction": "reflection", "facepalm": "reflection",
                    "point-choice": "relationship", "compare-group": "relationship", "compare-two-props": "relationship"}
MODE_BY_FAMILY = {"state": "exposition", "interaction": "behavior", "narrative": "payoff"}
LEAN = {"preset": "lean", "duration_frames": 12, "params": {"degrees": 8, "dx": 0, "dy": 0, "settle": "return"}}
SWAP = {"preset": "state_swap", "duration_frames": 12}
_VIEWBOX = re.compile(r'viewBox="\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)')


def _frames() -> list[dict]:
    return agent_authoring.catalog()["frames"]


def _slots(frame: dict, kind: str) -> list[str]:
    return [name for name, slot in frame["slots"].items() if slot["kind"] == kind]


def _required(frame: dict, kind: str) -> int:
    return sum(1 for slot in frame["slots"].values() if slot["kind"] == kind and slot.get("required"))


def _pick_frame(chosen: str, characters: int, objects: int) -> tuple[dict, bool]:
    """The chosen frame when it can host exactly these entities, else the first catalog frame that can (reported)."""
    frames = _frames()
    ordered = sorted(frames, key=lambda f: f["id"] != chosen)
    for frame in ordered:
        if _required(frame, "character") <= characters <= len(_slots(frame, "character")) and objects >= _required(frame, "object"):
            return frame, frame["id"] != chosen
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


def assemble_scene(menus: dict, stage: dict, act: dict, scene_id: str, scene_range: list[int], scene_text: str, goal: str,
                   story_visuals: dict[str, str] | None = None) -> dict:
    """Return ``{"kind":"scene.part","payload":{"scene":…,"assets":…}}`` that ``validate_scene`` accepts unchanged.

    ``story_visuals`` maps asset key -> label for the Phase 1 story visuals this scene must carry (declared in the skeleton)."""
    _check(stage, act, menus)
    story_visuals = story_visuals or {}
    props = {p["id"]: p for p in agent_authoring._library_props()}
    present = stage["present"]
    chosen_props = list(stage["props"])
    focus_prop = next((p for p in chosen_props if p["role"] == "focus"), None)
    frame, substituted = _pick_frame(stage["frame_id"], len(present), len(chosen_props) + len(story_visuals))
    slots = PLACEMENT[frame["id"]]
    notes = [f"frame {stage['frame_id']} -> {frame['id']}"] if substituted else []

    entities, assets, bindings = [], {}, {}
    # characters fill the character slots in order
    boxes_for = {}
    for slot, row in zip(_slots(frame, "character"), present):
        bindings[slot] = row["entity_id"]
        boxes_for[row["entity_id"]] = slots[slot]
    state_use = {row["entity_id"]: {row["state_id"]} for row in present}
    for event in act["events"]:
        target = event["target"]
        if target in state_use and event["state_after"] != SAME:
            if event["state_after"] not in menus["cast"][target]:
                raise ValueError(f"state_after {event['state_after']!r} không thuộc {target}")
            state_use[target].add(event["state_after"])
    for row in present:
        box = boxes_for[row["entity_id"]]
        entities.append({"id": row["entity_id"], "kind": "character", "visual_role": "character", "initial_state": row["state_id"],
                         "states": {s: _state(s, box, LAYER_CHARACTER) for s in sorted(state_use[row["entity_id"]])},
                         "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
    # props: the focus prop first, then supports; object slots first, then spare spots
    free_slots = [slots[s] for s in _slots(frame, "object") if s in slots]
    spots = list(SUPPORT_SPOTS)
    object_slot_names = _slots(frame, "object")
    ordered = sorted(chosen_props, key=lambda p: p["role"] != "focus")
    prop_entities = []
    for index, row in enumerate(ordered):
        library = props[row["prop_id"]]
        box = free_slots.pop(0) if free_slots else (spots.pop(0) if spots else None)
        if box is None:
            raise ValueError("quá nhiều vật cho một cảnh")
        if index < len(object_slot_names) and object_slot_names[index] in slots and not bindings.get(object_slot_names[index]):
            bindings[object_slot_names[index]] = row["prop_id"]
        key = f"{scene_id}-{row['prop_id']}"
        assets[key] = {"path": "library:" + library["path"], "category": "prop"}
        entities.append({"id": row["prop_id"], "kind": "object", "visual_role": "interactive_prop", "initial_state": "idle",
                         "states": {"idle": _state(key, _fit(box, _aspect(library)), LAYER_PROP)},
                         "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
        prop_entities.append(row["prop_id"])
    # story visuals declared by the skeleton: hidden until the first anchor
    sv_entities = []
    sv_slot = next((n for n in object_slot_names if n not in bindings), None)
    for asset_key in story_visuals:
        ident = "sv_" + re.sub(r"\W+", "_", asset_key)
        entities.append({"id": ident, "kind": "story_visual", "visual_role": "story_visual", "initial_state": "hidden",
                         "states": {"hidden": _state(asset_key, STORY_VISUAL_BOX, LAYER_STORY, False),
                                    "shown": _state(asset_key, STORY_VISUAL_BOX, LAYER_STORY)},
                         "narrative_intent": {"voice_anchor": _first_words(scene_text), "reason": goal}})
        sv_entities.append(ident)
        if sv_slot and sv_slot not in bindings:
            bindings[sv_slot] = ident
            sv_slot = None
    # set dressing is added by Core and never named as a story entity
    if stage["dressing"] != NONE:
        library = props[stage["dressing"]]
        key = f"{scene_id}-depth-{stage['dressing']}"
        assets[key] = {"path": "library:" + library["path"], "category": "prop"}
        entities.append({"id": "depth__" + stage["dressing"], "kind": "object", "visual_role": "background", "initial_state": "idle",
                         "states": {"idle": _state(key, _fit(DRESSING_BOX, _aspect(library)), LAYER_DRESSING)}})

    scene = {"id": scene_id, "narration_range": list(scene_range), "semantic_goal": goal,
             "grammar": {"frame_id": frame["id"], "mechanic_id": stage["mechanic_id"], "bindings": bindings},
             "entities": entities, "events": _events(menus, act, entities, sv_entities, goal, scene_text),
             "layout_contract": {"caption_safe_zone": dict(CAPTION_ZONE)},
             "experience_profile": _profile(menus, stage, entities, focus_prop, goal)}
    prune_non_story_references(scene)
    part = {"kind": "scene.part", "payload": {"scene": scene, "assets": assets}}
    if notes:
        part["core_notes"] = notes
    return part


def _first_words(text: str) -> str:
    return " ".join(text.split()[:2]) or text


def _events(menus: dict, act: dict, entities: list[dict], sv_entities: list[str], goal: str, scene_text: str) -> list[dict]:
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
    for row in sorted(act["events"], key=lambda r: anchors[r["anchor_id"]]["at"]):
        target = row["target"]
        if target not in by_id or by_id[target]["kind"] == "story_visual":
            raise ValueError(f"target {target!r} không có mặt trong cảnh")
        after = current[target] if row["state_after"] == SAME else row["state_after"]
        if after not in by_id[target]["states"]:
            raise ValueError(f"state_after {after!r} không có trong {target}")
        trigger = {"type": "voice_anchor", "text": anchors[row["anchor_id"]]["text"]}
        add(target, current[target], after, trigger, row["action"] or goal, SWAP if after != current[target] else LEAN)
    if not events:  # every scene needs one acting event: the first entity enters at the scene start
        first = next((e for e in entities if e["kind"] != "story_visual" and not e["id"].startswith("depth__")), None)
        if first is not None:
            add(first["id"], first["initial_state"], first["initial_state"], {"type": "scene_start"}, "Bước vào khung hình",
                {"preset": "enter", "duration_frames": 12, "params": {"from": "left"}})
    return events


def _profile(menus: dict, stage: dict, entities: list[dict], focus_prop: dict | None, goal: str) -> dict:
    mechanic = next((m for m in agent_authoring.catalog()["mechanics"] if m["id"] == stage["mechanic_id"]), {})
    mode = MODE_BY_MECHANIC.get(stage["mechanic_id"]) or MODE_BY_FAMILY.get(mechanic.get("family"), "exposition")
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
