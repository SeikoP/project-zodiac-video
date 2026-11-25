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
        floor = bottom(scene, "ban")
        self.assertEqual(bottom(scene, "phone-ping"), floor)
        self.assertEqual(bottom(scene, "depth__laptop"), floor)

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
        squeezed = build(TWO, cast_of(TWO, 2), [], story=CHAT)["payload"]["scene"]
        self.assertGreaterEqual(next(e for e in squeezed["entities"] if e["id"] == "ban")["states"]["neutral"]["transform"]["height"], 500)


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
