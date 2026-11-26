"""Core assembles a scene from menu choices (constructive pipeline, Task 2)."""
import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.studio_project import agent_authoring, agent_parts, authoring_menus, scene_assembler

ROOT = Path(__file__).resolve().parents[1]
TEXT = "Song Tử hỏi thêm câu 1."
RANGE = [0, len(TEXT.encode())]
CAPSULE = {"scene_ranges": [{"id": "s01", "narration_range": RANGE, "text": TEXT}]}
SKELETON = {"cast": [{"entity_id": "gemini", "states": {"neutral": {}, "asking": {}, "realizing": {}}}]}
GOAL = "Gemini hỏi thêm và nhận ra điều gì đó."


def node(payload):
    with tempfile.TemporaryDirectory() as tmp:
        source, result = Path(tmp, "in.json"), Path(tmp, "out.json")
        source.write_text(json.dumps(payload), "utf8")
        subprocess.run(["node", str(ROOT / "tools/studio_project/visual_compiler.mjs"), str(source), str(result)],
                       cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf8")
        return json.loads(result.read_text("utf8"))


def fixture_intent():
    script = ("import('./tests/studio_p34_fixture.mjs').then(m=>console.log(JSON.stringify(m.makeFixture(%s))))" % json.dumps(TEXT))
    out = subprocess.run(["node", "-e", script], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf8")
    return json.loads(out.stdout)


def choices(menus, **over):
    anchors = menus["anchors"]
    stage = {"frame_id": "single-character-focus", "mechanic_id": "explain",
             "present": [{"entity_id": "gemini", "state_id": "neutral"}],
             "props": [{"prop_id": "phone", "role": "focus"}], "dressing": "laptop"}
    act = {"events": [{"anchor_id": anchors[0]["id"], "target": "gemini", "action": "Hỏi thêm", "state_after": "asking"}] if anchors else []}
    stage.update(over.pop("stage", {}))
    act.update(over.pop("act", {}))
    return stage, act


def assemble(stage=None, act=None, **kw):
    menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
    base_stage, base_act = choices(menus)
    return menus, scene_assembler.assemble_scene(menus, {**base_stage, **(stage or {})}, {**base_act, **(act or {})}, "s01", RANGE, TEXT, GOAL, **kw)


def task():
    return {"scene_id": "s01", "scene_range": RANGE, "scene_text": TEXT,
            "cast": [{"entity_id": "gemini", "states": ["neutral", "asking", "realizing"]}], "story_visual_assets": {}}


class AssemblerTests(unittest.TestCase):
    def test_assembled_scene_passes_part_validation_and_compiler(self):
        _, part = assemble()
        text = json.dumps(part, ensure_ascii=False)
        validated = json.loads(agent_parts.validate_scene(text, task()))
        self.assertEqual(validated["payload"]["scene"], part["payload"]["scene"])  # validate_scene had nothing to change
        intent = fixture_intent()
        intent["scenes"] = [part["payload"]["scene"]]
        intent["assets"].update(part["payload"]["assets"])
        result = node({"action": "validate_authoring", "intent": intent, "narration": TEXT})
        self.assertEqual(result["status"], "VALID")

    def test_no_geometry_faults(self):
        _, part = assemble()
        intent = fixture_intent()
        intent["scenes"] = [part["payload"]["scene"]]
        intent["assets"].update(part["payload"]["assets"])
        self.assertEqual(node({"action": "autofix_geometry", "intent": intent, "theme": "light"})["changes"], [])

    def test_every_frame_places_inside_the_story_field(self):
        for frame, slots in scene_assembler.PLACEMENT.items():
            for slot, box in slots.items():
                self.assertGreaterEqual(box["x"], 0, (frame, slot))
                self.assertLessEqual(box["x"] + box["width"], 1080, (frame, slot))
                self.assertGreaterEqual(box["y"], 0, (frame, slot))
                self.assertLessEqual(box["y"] + box["height"], 1400, (frame, slot))

    def test_scene_without_characters(self):
        menus, part = assemble(stage={"present": [], "props": [], "dressing": "none"},
                               act={"events": []}, story_visuals={"s01-chat": "chat_compare"})
        scene = part["payload"]["scene"]
        self.assertEqual([e["kind"] for e in scene["entities"]], ["story_visual"])
        self.assertEqual(scene["events"][0]["state_after"], "shown")
        skeleton_task = {**task(), "cast": [], "story_visual_assets": {"s01-chat": "chat_compare"}}
        agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), skeleton_task)

    def test_dressing_is_added_by_core_and_not_in_story_focus(self):
        _, part = assemble()
        scene = part["payload"]["scene"]
        dressing = [e for e in scene["entities"] if e["id"].startswith("depth__")]
        self.assertEqual([e["id"] for e in dressing], ["depth__laptop"])
        profile = json.dumps(scene["experience_profile"])
        self.assertNotIn("depth__", profile)
        self.assertEqual(scene["experience_profile"]["story_focus"]["focal_entity_id"], "phone")

    def test_unknown_ids_are_rejected_not_repaired(self):
        menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
        stage, act = choices(menus)
        cases = [({**stage, "props": [{"prop_id": "table", "role": "focus"}]}, act),
                 ({**stage, "present": [{"entity_id": "gemini", "state_id": "side-eye"}]}, act),
                 ({**stage, "frame_id": "nope"}, act),
                 (stage, {"events": [{**act["events"][0], "anchor_id": "a99"}]})]
        for bad_stage, bad_act in cases:
            with self.assertRaises(ValueError):
                scene_assembler.assemble_scene(menus, bad_stage, bad_act, "s01", RANGE, TEXT, GOAL)

    def test_frame_that_cannot_host_the_cast_is_substituted_and_reported(self):
        _, part = assemble(stage={"frame_id": "two-person-offset"})
        self.assertEqual(part["payload"]["scene"]["grammar"]["frame_id"], "single-character-focus")
        self.assertTrue(part["core_notes"])

    def test_scene_without_anchors_still_has_an_acting_event(self):
        menus = authoring_menus.scene_menus({"scene_ranges": [{"id": "s01", "narration_range": RANGE, "text": "Chào."}]},
                                            SKELETON, "s01", [])
        stage, _ = choices(menus)
        part = scene_assembler.assemble_scene(menus, stage, {"events": []}, "s01", RANGE, "Chào.", GOAL)
        self.assertEqual(part["payload"]["scene"]["events"][0]["trigger"], {"type": "scene_start"})
        self.assertEqual(part["payload"]["scene"]["events"][0]["motion"]["preset"], "enter")


TWO = {"cast": [{"entity_id": "ban", "states": {"neutral": {}, "asking": {}}}, {"entity_id": "kia", "states": {"neutral": {}, "smug": {}}}]}
THREE = {"cast": TWO["cast"] + [{"entity_id": "ba", "states": {"neutral": {}}}]}
CHAT = {"sv01-chat-compare": "chat_compare"}


def cast_of(skeleton, count):
    return [{"entity_id": m["entity_id"], "state_id": "neutral"} for m in skeleton["cast"][:count]]


def build(skeleton, present, props, dressing="none", story=None, frame="two-person-offset", mechanic="explain", acting=None):
    menus = authoring_menus.scene_menus(CAPSULE, skeleton, "s01", [])
    stage = {"frame_id": frame, "mechanic_id": mechanic, "present": present,
             "props": [{"prop_id": p, "role": "focus" if i == 0 else "support"} for i, p in enumerate(props)], "dressing": dressing}
    targets = [present[0]["entity_id"] if present else props[0]] + list(acting or [])
    act = {"events": [{"anchor_id": menus["anchors"][min(i, len(menus["anchors"]) - 1)]["id"], "target": t,
                       "action": "Làm gì đó", "state_after": "same"} for i, t in enumerate(targets)]}
    return scene_assembler.assemble_scene(menus, stage, act, "s01", RANGE, TEXT, GOAL, story_visuals=story)


class SceneQualityTests(unittest.TestCase):
    """What the spike showed: three phones, a missing required story visual, props on top of people. All Core's to prevent."""

    def test_one_prop_per_family_and_dressing_never_repeats_a_story_prop(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping", "phone-busy"], dressing="phone-ping")
        keys = [e["id"] for e in part["payload"]["scene"]["entities"] if e["kind"] == "object"]
        self.assertEqual(keys, ["phone-ping"])
        self.assertEqual(scene_assembler.scene_faults(part), [])
        self.assertTrue(any("phone" in n for n in part["core_notes"]))

    def test_a_behavior_scene_always_gets_set_dressing_from_an_unused_family(self):
        for dressing in ("none", "phone-ping"):
            part = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing=dressing, mechanic="confront")
            ids = [e["id"] for e in part["payload"]["scene"]["entities"] if e["id"].startswith("depth__")]
            self.assertEqual(len(ids), 1, dressing)
            self.assertNotIn("phone", ids[0])
            self.assertEqual(scene_assembler.scene_faults(part), [])

    def test_an_exposition_scene_does_not_get_dressing_it_did_not_ask_for(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing="none", mechanic="explain")
        self.assertEqual([e["id"] for e in part["payload"]["scene"]["entities"] if e["id"].startswith("depth__")], [])

    def test_the_frame_and_mechanic_are_chosen_together(self):
        # the spike's s05: payoff needs a payoff_subject, only caption-payoff offers one, and it holds exactly one character
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], frame="caption-payoff", mechanic="payoff")
        grammar = part["payload"]["scene"]["grammar"]
        self.assertTrue(scene_assembler.supports(grammar["frame_id"], grammar["mechanic_id"], 2, 1), grammar)
        self.assertTrue(part["core_notes"])

    def test_a_valid_pair_is_left_alone(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], frame="two-person-offset", mechanic="confront")
        self.assertEqual(part["payload"]["scene"]["grammar"]["mechanic_id"], "confront")
        self.assertEqual(part["payload"]["scene"]["grammar"]["frame_id"], "two-person-offset")

    def test_dressing_of_another_family_is_kept(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing="laptop")
        self.assertIn("depth__laptop", [e["id"] for e in part["payload"]["scene"]["entities"]])

    def test_required_story_visual_is_present_and_nothing_overlaps_it(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing="laptop", story=CHAT)
        scene = part["payload"]["scene"]
        self.assertIn("sv01-chat-compare", [e["id"] for e in scene["entities"]])
        self.assertEqual(scene_assembler.scene_faults(part, required_story_visuals=list(CHAT)), [])
        self.assertEqual(scene["experience_profile"]["story_focus"]["focal_entity_id"], "phone-ping")

    def test_faults_are_named(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"])
        scene = copy.deepcopy(part["payload"]["scene"])
        scene["entities"].append(copy.deepcopy(next(e for e in scene["entities"] if e["id"] == "phone-ping")))
        scene["entities"][-1]["id"] = "phone-busy"
        scene["entities"][-1]["states"]["idle"]["asset"] = "s01-phone-busy"
        broken = {"payload": {"scene": scene, "assets": {**part["payload"]["assets"], "s01-phone-busy": {"path": "library:props/phone-busy.svg", "category": "prop"}}}}
        codes = {f["code"] for f in scene_assembler.scene_faults(broken, required_story_visuals=["sv01-chat-compare"])}
        self.assertEqual(codes, {"DUPLICATE_PROP_FAMILY", "ENTITY_OVERLAP", "STORY_VISUAL_MISSING"})

    def test_no_faults_for_any_frame_prop_count_or_story_visual(self):
        props = ["phone-ping", "laptop", "notebook"]
        for frame, skeleton, count in (("single-character-focus", authoring_skeleton(1), 1), ("two-person-offset", TWO, 2),
                                       ("prop-focus", TWO, 1), ("reaction-closeup", authoring_skeleton(1), 1),
                                       ("caption-payoff", authoring_skeleton(1), 1), ("three-person-comparison", THREE, 3)):
            for how_many in (1, 2):
                for story in (None, CHAT):
                    for dressing in ("none", "coffee-cup"):
                        with self.subTest(frame=frame, props=how_many, story=bool(story), dressing=dressing):
                            part = build(skeleton, cast_of(skeleton, count), props[:how_many], dressing, story, frame)
                            self.assertEqual(scene_assembler.scene_faults(part, list(story or ())), [])


def bottom(scene, entity_id):
    entity = next(e for e in scene["entities"] if e["id"] == entity_id)
    return max(s["transform"]["y"] + s["transform"]["height"] for s in entity["states"].values())


class GroundedLayoutTests(unittest.TestCase):
    def test_props_and_dressing_stand_on_the_floor_line_of_the_actors(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing="laptop", mechanic="confront")
        scene = part["payload"]["scene"]
        floor = bottom(scene, "phone-ping")
        for dressing in [e["id"] for e in scene["entities"] if e["id"].startswith("depth__")]:
            self.assertLessEqual(bottom(scene, dressing), 1400, dressing)  # inside the story field, never floating in a corner
            self.assertGreaterEqual(bottom(scene, dressing), floor, dressing)  # standing on or in front of the floor line

    def test_a_support_prop_nobody_acts_on_is_dropped(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping", "laptop"], mechanic="confront")
        ids = [e["id"] for e in part["payload"]["scene"]["entities"]]
        self.assertNotIn("laptop", ids)
        self.assertTrue(any("laptop" in n and "không có hành động" in n for n in part["core_notes"]))

    def test_a_support_prop_with_an_action_but_no_room_is_dropped_and_reported(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping", "laptop"], mechanic="confront", acting=["laptop"])
        scene = part["payload"]["scene"]
        self.assertNotIn("laptop", [e["id"] for e in scene["entities"]])
        self.assertNotIn("laptop", [e["target"] for e in scene["events"]])
        self.assertTrue(any("laptop" in n and "chỗ trống" in n for n in part["core_notes"]))

    def test_a_support_prop_with_an_action_and_room_is_kept(self):
        part = build(authoring_skeleton(1), cast_of(authoring_skeleton(1), 1), ["phone-ping", "laptop"], mechanic="explain",
                     frame="single-character-focus", acting=["laptop"])
        self.assertIn("laptop", [e["id"] for e in part["payload"]["scene"]["entities"]], part.get("core_notes"))

    def test_actors_are_big_enough_to_read_on_a_phone(self):
        scene = build(authoring_skeleton(1), cast_of(authoring_skeleton(1), 1), [], frame="single-character-focus")["payload"]["scene"]
        box = next(e for e in scene["entities"] if e["id"] == "ban")["states"]["neutral"]["transform"]
        self.assertGreaterEqual(box["height"], 900)
        beside = build(TWO, cast_of(TWO, 2), [], story=CHAT)["payload"]["scene"]
        ban = next(e for e in beside["entities"] if e["id"] == "ban")["states"]["neutral"]["transform"]
        self.assertGreaterEqual(ban["height"], 780)  # the actors fill the field below the story visual, they are not shrunk into a corner of it
        self.assertLessEqual(ban["y"] - (scene_assembler.STORY_VISUAL_BOX["y"] + scene_assembler.STORY_VISUAL_BOX["height"]), 120)


class FeetLineTests(unittest.TestCase):
    """Real render: the art has empty space under the feet, so 'the floor' is the feet line, not the bottom of the box."""

    def test_the_floor_is_the_feet_line_of_the_actors(self):
        scene = build(TWO, cast_of(TWO, 2), ["phone-ping"], mechanic="confront")["payload"]["scene"]
        box = next(e for e in scene["entities"] if e["id"] == "ban")["states"]["neutral"]["transform"]
        feet = box["y"] + box["height"] * scene_assembler.FEET
        self.assertAlmostEqual(bottom(scene, "phone-ping"), feet, delta=2)

    def test_a_behavior_scene_with_a_story_visual_still_gets_its_depth_layer(self):
        part = build(TWO, cast_of(TWO, 2), ["phone-ping"], mechanic="confront", story=CHAT)
        self.assertEqual(len([e for e in part["payload"]["scene"]["entities"] if e["id"].startswith("depth__")]), 1, part.get("core_notes"))
        self.assertEqual(scene_assembler.scene_faults(part, list(CHAT)), [])

    def test_dressing_stands_in_the_foreground_band_under_the_actors_feet(self):
        for story in (None, CHAT):
            scene = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing="laptop", mechanic="confront", story=story)["payload"]["scene"]
            box = next(e for e in scene["entities"] if e["id"] == "depth__laptop")["states"]["idle"]["transform"]
            feet = max(e["states"]["neutral"]["transform"]["y"] + e["states"]["neutral"]["transform"]["height"] * scene_assembler.FEET
                       for e in scene["entities"] if e["kind"] == "character")
            self.assertGreaterEqual(box["y"], feet - 2, story)
            self.assertLessEqual(box["y"] + box["height"], 1400, story)
            self.assertGreaterEqual(box["height"], 100, story)

    def test_dressing_never_stands_on_an_actor(self):
        for story in (None, CHAT):
            part = build(TWO, cast_of(TWO, 2), ["phone-ping"], dressing="laptop", mechanic="confront", story=story)
            scene = part["payload"]["scene"]
            rect = lambda i: scene_assembler._visible(next(e for e in scene["entities"] if e["id"] == i))
            for actor in ("ban", "kia"):
                for dressing in [e["id"] for e in scene["entities"] if e["id"].startswith("depth__")]:
                    self.assertFalse(scene_assembler._hits(rect(actor), rect(dressing), 0), (story, actor, dressing))


class CompositionTests(unittest.TestCase):
    def test_a_scene_without_a_story_visual_is_centred_not_bottom_heavy(self):
        for frame, skeleton, count in (("two-person-offset", TWO, 2), ("single-character-focus", authoring_skeleton(1), 1)):
            scene = build(skeleton, cast_of(skeleton, count), ["phone-ping"], "laptop", None, frame, "confront")["payload"]["scene"]
            rects = [scene_assembler._visible(e) for e in scene["entities"]]
            top, low = min(r["y"] for r in rects), max(r["y"] + r["height"] for r in rects)
            self.assertAlmostEqual((top + low) / 2, scene_assembler.CENTRE_Y, delta=60, msg=frame)
            self.assertGreaterEqual(top, 100, frame)
            self.assertLessEqual(low, 1400, frame)


def accent_stage(accent_id="scene-accent-clock", **over):
    menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
    return {"accent_id": accent_id, "setting": "Phòng khách buổi tối", "visible_detail": "Đồng hồ treo tường phía sau nhóm",
            "anchor_id": menus["anchors"][0]["id"], **over}


def with_accent(accent=None, story=None, mechanic="confront", **kw):
    menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
    base_stage, base_act = choices(menus)
    stage = {**base_stage, "mechanic_id": mechanic, "accent": accent or accent_stage(), **kw}
    return scene_assembler.assemble_scene(menus, stage, base_act, "s01", RANGE, TEXT, GOAL, story_visuals=story)


class SceneAccentTests(unittest.TestCase):
    """The setting of every scene: a registered accent, drawn canvas-native on a rear layer, declared with its context."""

    def test_the_accent_entity_satisfies_the_plugins_canvas_accent_validator(self):
        part = with_accent()
        scene = part["payload"]["scene"]
        entity = next(e for e in scene["entities"] if e["kind"] == "scene_accent")
        self.assertEqual(entity["visual_role"], "scene_accent")
        self.assertEqual(entity["context"], {"kind": "environment_detail", "setting": "Phòng khách buổi tối",
                                              "visible_detail": "Đồng hồ treo tường phía sau nhóm"})
        self.assertIn(entity["narrative_intent"]["voice_anchor"], TEXT)
        asset = part["payload"]["assets"][entity["states"]["visible"]["asset"]]
        self.assertEqual((asset["category"], asset["path"]), ("scene_accent", "library:scene-set/accents/scene-accent-clock.svg"))
        scene_for_validator = {**scene, "voice": TEXT}
        script = ("import('./plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/validate-canvas-accents.mjs')"
                  ".then(m=>console.log(JSON.stringify(m.validateCanvasAccents(%s,%s))))" % (json.dumps(scene_for_validator), json.dumps(part["payload"]["assets"])))
        out = subprocess.run(["node", "-e", script], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf8")
        self.assertEqual(json.loads(out.stdout), {"status": "PASS", "issues": []})

    def test_the_accent_is_rear_inside_the_canvas_and_clear_of_the_caption_lane(self):
        for story in (None, CHAT):
            scene = with_accent(story=story)["payload"]["scene"]
            box = next(e for e in scene["entities"] if e["kind"] == "scene_accent")["states"]["visible"]
            self.assertLess(box["layer"], scene_assembler.LAYER_CHARACTER)
            t = box["transform"]
            self.assertGreaterEqual(t["x"], 0)
            self.assertLessEqual(t["x"] + t["width"], 1080)
            self.assertGreaterEqual(t["y"], 0)
            self.assertLessEqual(t["y"] + t["height"], scene_assembler.CAPTION_ZONE["y"])

    def test_every_registered_accent_is_big_enough_to_read_as_the_place(self):
        # the plugin's own review wants the context cue to cover about 7 percent of the canvas
        for accent_id in authoring_menus.accent_registry():
            for story in (None, CHAT):
                scene = with_accent(accent_stage(accent_id), story=story)["payload"]["scene"]
                t = next(e for e in scene["entities"] if e["kind"] == "scene_accent")["states"]["visible"]["transform"]
                self.assertGreaterEqual(t["width"] * t["height"] / (1080 * 1920), 0.07, (accent_id, bool(story)))
                self.assertLessEqual(t["x"] + t["width"], 1080, accent_id)
                self.assertLessEqual(t["y"] + t["height"], scene_assembler.CAPTION_ZONE["y"], accent_id)

    def test_an_accent_means_core_adds_no_filler_dressing(self):
        scene = with_accent(dressing="none")["payload"]["scene"]
        self.assertEqual([e["id"] for e in scene["entities"] if e["id"].startswith("depth__")], [])
        self.assertTrue([e for e in build(TWO, cast_of(TWO, 2), ["phone-ping"], mechanic="confront")["payload"]["scene"]["entities"]
                         if e["id"].startswith("depth__")], "without an accent the filler is still the fallback")

    def test_the_accent_is_not_a_story_entity_and_never_a_fault(self):
        part = with_accent()
        scene = part["payload"]["scene"]
        self.assertNotIn("accent", json.dumps(scene["experience_profile"]))
        self.assertEqual(scene_assembler.scene_faults(part), [])

    def test_no_accent_fits_is_a_request_not_a_substitute(self):
        part = with_accent(accent_stage("none_fits", visible_detail="Một cửa hàng bánh tráng nướng bên đường"))
        self.assertFalse([e for e in part["payload"]["scene"]["entities"] if e["kind"] == "scene_accent"])
        self.assertEqual(part["asset_requests"][0]["code"], "NEW_VARIANT_MASTER_REQUIRED")
        self.assertIn("bánh tráng", part["asset_requests"][0]["wanted"])
        self.assertTrue(any("scene accent" in n.lower() for n in part["core_notes"]))

    def test_an_accent_outside_the_menu_is_rejected_not_repaired(self):
        with self.assertRaises(ValueError):
            with_accent(accent_stage("scene-accent-castle"))

    def test_an_accent_anchor_outside_the_scene_text_is_rejected(self):
        with self.assertRaises(ValueError):
            with_accent(accent_stage(anchor_id="a99"))

    def test_part_validation_keeps_the_accent_as_it_is(self):
        part = with_accent()
        validated = json.loads(agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), task()))["payload"]["scene"]
        accent = next(e for e in validated["entities"] if e["kind"] == "scene_accent")
        self.assertEqual(accent["visual_role"], "scene_accent")
        self.assertEqual(accent, next(e for e in part["payload"]["scene"]["entities"] if e["kind"] == "scene_accent"))

    def test_the_assembled_scene_still_compiles_with_an_accent(self):
        part = with_accent()
        intent = fixture_intent()
        intent["scenes"] = [part["payload"]["scene"]]
        intent["assets"].update(part["payload"]["assets"])
        self.assertEqual(node({"action": "validate_authoring", "intent": intent, "narration": TEXT})["status"], "VALID")


class DrawnAccentTests(unittest.TestCase):
    PARTS = [{"part": "awning", "at": "across", "size": "medium"}, {"part": "counter", "at": "center", "size": "medium"}]

    def drawn(self, parts=None, art_dir=None, story=None):
        menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
        base_stage, base_act = choices(menus)
        accent = {**accent_stage("drawn"), "setting": "Quầy bánh tráng nướng", "visible_detail": "Mái hiên sọc và quầy có hai ly", "parts": self.PARTS if parts is None else parts}
        return scene_assembler.assemble_scene(menus, {**base_stage, "mechanic_id": "confront", "dressing": "none", "accent": accent},
                                              base_act, "s01", RANGE, TEXT, GOAL, story_visuals=story, art_dir=art_dir)

    def accents(self, part):
        return {e["id"].rsplit("_", 1)[1]: e for e in part["payload"]["scene"]["entities"] if e["kind"] == "scene_accent"}

    def test_a_drawn_accent_is_rendered_into_the_workspace_and_declared(self):
        import tempfile
        from pathlib import Path
        from tools.studio_project import accent_art
        with tempfile.TemporaryDirectory() as tmp:
            part = self.drawn(art_dir=Path(tmp))
            layers = self.accents(part)
            self.assertEqual(set(layers), {"wall", "floor"})
            for entity in layers.values():
                asset = part["payload"]["assets"][entity["states"]["visible"]["asset"]]
                self.assertTrue(accent_art.is_drawn_accent(asset, Path(tmp)))
                self.assertEqual(entity["context"]["setting"], "Quầy bánh tráng nướng")
                t = entity["states"]["visible"]["transform"]
                self.assertLess(entity["states"]["visible"]["layer"], scene_assembler.LAYER_CHARACTER)
                self.assertGreaterEqual(t["x"], 0)
                self.assertLessEqual(t["x"] + t["width"], 1080)
                self.assertLessEqual(t["y"] + t["height"], scene_assembler.CAPTION_ZONE["y"])
            self.assertEqual([e["id"] for e in part["payload"]["scene"]["entities"] if e["id"].startswith("depth__")], [])

    def test_each_layer_keeps_its_drawing_proportions(self):
        from tools.studio_project import accent_art
        part = self.drawn()
        for kind, entity in self.accents(part).items():
            t = entity["states"]["visible"]["transform"]
            view = accent_art.layer_view({"parts": self.PARTS}, kind)
            self.assertAlmostEqual(t["width"] / t["height"], view["w"] / view["h"], delta=0.03, msg=kind)

    def test_floor_parts_stand_on_the_actors_floor_line_and_wall_parts_hang_above_them(self):
        from tools.studio_project import accent_art
        for story in (None, CHAT):
            part = self.drawn(story=story)
            scene = part["payload"]["scene"]
            feet = max(r["y"] + r["height"] for r in (scene_assembler._visible(e) for e in scene["entities"] if e.get("kind") == "character") if r)
            layers = self.accents(part)
            floor, wall = (layers[k]["states"]["visible"]["transform"] for k in ("floor", "wall"))
            view = accent_art.layer_view({"parts": self.PARTS}, "floor")
            scale = floor["height"] / view["h"]
            ground = floor["y"] + (view["floor_y"] - view["y"]) * scale      # where the drawn floor line lands on the canvas
            self.assertLessEqual(abs(ground - feet), 30, bool(story))
            self.assertLess(wall["y"], ground - 150, bool(story))              # hung well above the ground line
            if story:                                                           # not hidden behind the story visual band
                self.assertGreaterEqual(wall["y"], scene_assembler.STORY_BAND_BOTTOM)

    def test_a_scene_with_only_hung_parts_has_no_floor_layer_and_the_reverse(self):
        wall_only = self.accents(self.drawn([{"part": "window", "at": "left", "size": "medium"}]))
        floor_only = self.accents(self.drawn([{"part": "counter", "at": "center", "size": "medium"}]))
        self.assertEqual(set(wall_only), {"wall"})
        self.assertEqual(set(floor_only), {"floor"})

    def test_without_an_art_dir_the_asset_is_described_but_nothing_is_written(self):
        part = self.drawn()
        entity = next(e for e in part["payload"]["scene"]["entities"] if e["kind"] == "scene_accent")
        self.assertRegex(part["payload"]["assets"][entity["states"]["visible"]["asset"]]["path"], r"accent-[0-9a-f]{64}\.svg$")

    def test_an_invalid_drawing_spec_is_rejected(self):
        for parts in ([], [{"part": "castle", "at": "left", "size": "small"}],
                      [{"part": "awning", "at": "across", "size": "small"}, {"part": "window", "at": "left", "size": "small"}]):
            with self.assertRaises(ValueError, msg=parts):
                self.drawn(parts)

    def test_a_drawn_accent_passes_the_plugin_validator_and_part_validation(self):
        part = self.drawn()
        scene = part["payload"]["scene"]
        validated = json.loads(agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), task()))["payload"]["scene"]
        self.assertEqual(next(e for e in validated["entities"] if e["kind"] == "scene_accent")["visual_role"], "scene_accent")
        script = ("import('./plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/validate-canvas-accents.mjs')"
                  ".then(m=>console.log(JSON.stringify(m.validateCanvasAccents(%s,%s))))" % (json.dumps({**scene, "voice": TEXT}), json.dumps(part["payload"]["assets"])))
        out = subprocess.run(["node", "-e", script], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf8")
        self.assertEqual(json.loads(out.stdout), {"status": "PASS", "issues": []})


class EventTimingTests(unittest.TestCase):
    """The real export refuses two acting events of one target that overlap (EXPORT_ACTING_TIMING_INVALID)."""

    def menus_with_times(self, times):
        menus = authoring_menus.scene_menus({"scene_ranges": [{"id": "s01", "narration_range": RANGE,
                                                                 "text": "Chờ nhé, để xem ngay, rồi sao nữa, thế đấy."}]}, TWO, "s01", [])
        for anchor, t in zip(menus["anchors"], times):
            anchor["t"] = t
        return menus

    def test_events_of_one_target_never_overlap_in_time(self):
        menus = self.menus_with_times([1.54, 1.84, 3.0, 4.0])
        stage = {"frame_id": "two-person-offset", "mechanic_id": "explain", "present": cast_of(TWO, 2), "props": [], "dressing": "none"}
        events = [{"anchor_id": a["id"], "target": "ban", "action": "x", "state_after": "same"} for a in menus["anchors"][:4]]
        part = scene_assembler.assemble_scene(menus, stage, {"events": events}, "s01", RANGE, "Chờ nhé, để xem ngay, rồi sao nữa, thế đấy.", GOAL)
        mine = [e for e in part["payload"]["scene"]["events"] if e["target"] == "ban"]
        at = {a["id"]: a["t"] for a in menus["anchors"]}
        by_trigger = {a["text"]: a["t"] for a in menus["anchors"]}
        times = [by_trigger[e["trigger"]["text"]] for e in mine]
        for first, second, event in zip(times, times[1:], mine):
            self.assertGreaterEqual(second, first + event["motion"]["duration_frames"] / 30)
        self.assertLess(len(mine), 4)
        self.assertTrue(any("quá sát" in n for n in part["core_notes"]))

    def test_events_without_known_times_are_all_kept(self):
        menus = self.menus_with_times([None, None, None, None])
        stage = {"frame_id": "two-person-offset", "mechanic_id": "explain", "present": cast_of(TWO, 2), "props": [], "dressing": "none"}
        events = [{"anchor_id": a["id"], "target": "ban", "action": "x", "state_after": "same"} for a in menus["anchors"][:3]]
        part = scene_assembler.assemble_scene(menus, stage, {"events": events}, "s01", RANGE, "Chờ nhé, để xem ngay, rồi sao nữa, thế đấy.", GOAL)
        self.assertEqual(len([e for e in part["payload"]["scene"]["events"] if e["target"] == "ban"]), 3)


class StoryVisualLookupTests(unittest.TestCase):
    def test_scene_gets_the_asset_keys_of_the_phase1_visuals_its_beat_names(self):
        context = {"scene_ranges": [{"id": "s01", "text": "Mở đầu."}, {"id": "s02", "text": "Cả nhóm rủ, nó bảo để xem."}],
                   "required_story_visual_ids": ["sv01"],
                   "narrative_plan": {"beats": [{"id": "b1", "voice_anchor": "nó bảo để xem"}],
                                      "story_visuals": [{"id": "sv01", "beat_ids": ["b1"]}]}}
        assets = {"SV01": {"category": "story_visual", "creative_origin": {"phase1_visual_id": "sv01"}, "source_visual_type": "chat_compare"},
                  "s02-chat-compare": {"category": "story_visual", "creative_origin": {"phase1_visual_id": "sv01"}, "source_visual_type": "chat_compare"},
                  "phone": {"category": "prop"}}
        # the skeleton's own asset, not a copy an earlier run made under a scene prefix
        self.assertEqual(scene_assembler.story_visual_assets(context, assets, "s02"), {"SV01": "chat_compare"})
        self.assertEqual(scene_assembler.story_visual_assets(context, assets, "s01"), {})


def authoring_skeleton(count):
    return {"cast": TWO["cast"][:count]}


if __name__ == "__main__":
    unittest.main()
