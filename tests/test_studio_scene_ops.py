"""Scene revision by operations: small, id-addressed edits that leave everything else untouched."""
import copy
import json
import unittest

from tools.studio_project import agent_parts
from tools.studio_project.scene_ops import apply_scene_ops, scene_changes

BOX = {"x": 40, "y": 520, "width": 430, "height": 800}
SCENE = {
    "id": "s03", "narration_range": [0, 10], "semantic_goal": "Hội bạn hỏi lại", "grammar": {"frame_id": "two-person-offset"},
    "experience_profile": {"story_mode": "behavior"},
    "entities": [
        {"id": "gemini", "kind": "character", "initial_state": "neutral",
         "states": {"neutral": {"asset": "neutral", "visible": True, "layer": 20, "transform": dict(BOX)}}},
        {"id": "phone", "kind": "object", "initial_state": "hidden",
         "states": {"hidden": {"asset": "s03-phone", "visible": False, "layer": 30, "transform": dict(BOX)},
                    "shown": {"asset": "s03-phone", "visible": True, "layer": 30, "transform": dict(BOX)}}},
    ],
    "events": [{"id": "e1", "target": "phone", "state_before": "hidden", "state_after": "shown", "action": "chìa điện thoại",
                "trigger": {"type": "voice_anchor", "text": "rủ nhau"}}],
}


class ApplyOpsTests(unittest.TestCase):
    def test_set_changes_only_the_named_field(self):
        out = apply_scene_ops(SCENE, [{"op": "set", "path": "entities/gemini/states/neutral/transform/x", "value": 120}])
        self.assertEqual(out["entities"][0]["states"]["neutral"]["transform"], {**BOX, "x": 120})
        before = copy.deepcopy(SCENE)
        self.assertEqual(SCENE, before)  # input untouched
        out["entities"][0]["states"]["neutral"]["transform"]["x"] = BOX["x"]
        self.assertEqual(out, SCENE)

    def test_add_and_remove_by_id(self):
        extra = {"id": "e2", "target": "phone", "state_before": "shown", "state_after": "hidden", "action": "cất đi",
                 "trigger": {"type": "voice_anchor", "text": "rủ nhau"}}
        out = apply_scene_ops(SCENE, [{"op": "add", "path": "events", "value": extra}])
        self.assertEqual([e["id"] for e in out["events"]], ["e1", "e2"])
        out = apply_scene_ops(out, [{"op": "remove", "path": "events/e1"}])
        self.assertEqual([e["id"] for e in out["events"]], ["e2"])

    def test_set_replaces_whole_top_level_fields(self):
        out = apply_scene_ops(SCENE, [{"op": "set", "path": "grammar", "value": {"frame_id": "single-character-focus"}},
                                      {"op": "set", "path": "semantic_goal", "value": "Mục tiêu mới"}])
        self.assertEqual((out["grammar"], out["semantic_goal"]), ({"frame_id": "single-character-focus"}, "Mục tiêu mới"))

    def test_unknown_ids_and_duplicates_are_rejected(self):
        for op in ({"op": "set", "path": "entities/ghost/states/neutral/transform/x", "value": 1},
                   {"op": "set", "path": "entities/gemini/states/nope/transform/x", "value": 1},
                   {"op": "remove", "path": "events/zzz"},
                   {"op": "add", "path": "events", "value": {"id": "e1"}},
                   {"op": "rotate", "path": "events", "value": 1}):
            with self.subTest(op=op), self.assertRaises(ValueError):
                apply_scene_ops(SCENE, [op])

    def test_ids_can_never_be_renamed_by_an_op(self):
        for path in ("entities/gemini/id", "events/e1/id", "entities/gemini/states/neutral/id"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                apply_scene_ops(SCENE, [{"op": "set", "path": path, "value": "renamed"}])

    def test_changes_come_out_in_a_stable_order(self):
        new = apply_scene_ops(SCENE, [{"op": "set", "path": "entities/gemini/states/neutral/transform/x", "value": 1},
                                      {"op": "set", "path": "entities/phone/states/shown/transform/x", "value": 2},
                                      {"op": "set", "path": "entities/phone/states/hidden/transform/x", "value": 3}])
        lines = scene_changes(SCENE, new)
        self.assertEqual([line.split(" (")[1].split(")")[0] for line in lines], ["neutral", "hidden", "shown"])  # entities then states, sorted

    def test_removing_an_entity_that_an_event_targets_names_the_event(self):
        with self.assertRaises(ValueError) as caught:
            apply_scene_ops(SCENE, [{"op": "remove", "path": "entities/phone"}])
        self.assertIn("e1", str(caught.exception))
        out = apply_scene_ops(SCENE, [{"op": "remove", "path": "events/e1"}, {"op": "remove", "path": "entities/phone"}])
        self.assertEqual([e["id"] for e in out["entities"]], ["gemini"])

    def test_an_event_may_not_point_to_a_missing_state(self):
        with self.assertRaises(ValueError):
            apply_scene_ops(SCENE, [{"op": "set", "path": "events/e1/state_after", "value": "gone"}])

    def test_ops_leave_every_other_scene_byte_identical(self):
        other = {**copy.deepcopy(SCENE), "id": "s04"}
        intent = {"scenes": [SCENE, other]}
        before = json.dumps(intent["scenes"][1], sort_keys=True)
        revised = apply_scene_ops(intent["scenes"][0], [{"op": "set", "path": "semantic_goal", "value": "x"}])
        merged = {"scenes": [revised, intent["scenes"][1]]}
        self.assertEqual(json.dumps(merged["scenes"][1], sort_keys=True), before)


class DiffTests(unittest.TestCase):
    def test_changes_are_human_readable_vietnamese(self):
        new = apply_scene_ops(SCENE, [{"op": "set", "path": "entities/gemini/states/neutral/transform/x", "value": 120},
                                      {"op": "remove", "path": "events/e1"}, {"op": "set", "path": "semantic_goal", "value": "Mới"}])
        text = "\n".join(scene_changes(SCENE, new))
        self.assertIn("gemini", text)
        self.assertIn("x 40 → 120", text)
        self.assertIn("Bỏ sự kiện e1", text)
        self.assertIn("Mục tiêu cảnh", text)

    def test_no_changes_means_an_empty_list(self):
        self.assertEqual(scene_changes(SCENE, copy.deepcopy(SCENE)), [])


class RevisionTaskTests(unittest.TestCase):
    CAPSULE = {"narration_sha256": "h", "instruction": "cho Nhân Mã lớn hơn", "schema": {"grammar": {}, "experience_profile": "x", "scenes": "y", "assets": "z", "video": {}},
               "catalog": {"props": [], "frames": [], "mechanics": []}, "required_story_visual_ids": [],
               "scene_ranges": [{"id": "s03", "narration_range": [0, 10], "text": "rủ nhau đi chơi"}], "narrative_plan": {}}

    def intent(self):
        return {"cast": [{"entity_id": "gemini", "states": {"neutral": {}}}], "assets": {"s03-phone": {"path": "library:props/phone.svg", "category": "prop"}},
                "scenes": [copy.deepcopy(SCENE)]}

    def test_prompt_forbids_rewriting_and_carries_the_current_scene(self):
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "cho Nhân Mã lớn hơn")
        prompt = agent_parts.revise_prompt(task)
        self.assertIn("ONLY ops", prompt)
        self.assertIn("keep every id", prompt)
        self.assertEqual(task["current_scene"]["id"], "s03")
        self.assertEqual(task["instruction"], "cho Nhân Mã lớn hơn")
        self.assertEqual(task["must_use_story_visuals"], [])  # a revision never adds what the scene did not have
        self.assertIn("nothing else", prompt)

    def test_finish_revision_builds_a_whole_intent_and_a_change_list(self):
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "x")
        answer = json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "ops": [
            {"op": "set", "path": "entities/gemini/states/neutral/transform/width", "value": 520}]}})
        text, changes = agent_parts.finish_revision(answer, task, self.intent())
        scene = json.loads(text)["payload"]["intent"]["scenes"][0]
        self.assertEqual(scene["entities"][0]["states"]["neutral"]["transform"]["width"], 520)
        self.assertEqual(len(changes), 1)

    def test_assets_the_episode_already_has_are_not_duplicated_under_a_new_key(self):
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "đổi vị trí")
        answer = json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "assets": {"s03-phone": {"path": "library:props/other.svg"}},
            "ops": [{"op": "set", "path": "entities/gemini/states/neutral/transform/x", "value": 99}]}})
        text, _ = agent_parts.finish_revision(answer, task, self.intent())
        assets = json.loads(text)["payload"]["intent"]["assets"]
        self.assertEqual(assets, self.intent()["assets"])  # the existing asset wins; nothing renamed or added

    def test_the_story_visual_guard_cannot_be_opened_by_words_inside_other_words_or_by_automatic_repair_text(self):
        sv = {"id": "s03-SV", "kind": "story_visual", "initial_state": "v", "states": {"v": {"asset": "s03-phone", "visible": True, "layer": 40, "transform": dict(BOX)}}}
        answer = json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "ops": [{"op": "add", "path": "entities", "value": sv}]}})
        for instruction, automatic in (("PASSIVE_STORYTELLING: thêm hành động", True), ("fix the history of this scene", False), ("thêm story visual", True)):
            with self.subTest(instruction=instruction):
                task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", instruction, automatic=automatic)
                self.assertFalse(task["allow_story_visual"])
                with self.assertRaises(ValueError):
                    agent_parts.finish_revision(answer, task, self.intent())
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "thêm story visual hội thoại")
        self.assertTrue(task["allow_story_visual"])

    def test_removal_words_match_whole_words_only(self):
        self.assertTrue(agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "bỏ cái điện thoại")["allow_removal"])
        self.assertFalse(agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "đổi vị trí rồi để đó, không dùng trống")["allow_removal"])

    def test_a_story_visual_is_not_added_unless_the_instruction_asks(self):
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "cho nhân vật lớn hơn")
        sv = {"id": "s03-SV", "kind": "story_visual", "initial_state": "v", "states": {"v": {"asset": "s03-phone", "visible": True, "layer": 40, "transform": dict(BOX)}}}
        answer = json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "ops": [{"op": "add", "path": "entities", "value": sv}]}})
        with self.assertRaises(ValueError) as caught:
            agent_parts.finish_revision(answer, task, self.intent())
        self.assertIn("Story Visual", str(caught.exception))
        asked = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "thêm story visual hội thoại")
        agent_parts.finish_revision(answer, asked, self.intent())

    def test_a_rewrite_instead_of_ops_is_rejected(self):
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "x")
        for answer in (json.dumps({"kind": "scene.part", "payload": {"scene": SCENE}}),
                       json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s09", "ops": []}}),
                       json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "ops": []}})):
            with self.subTest(answer=answer[:40]), self.assertRaises(ValueError):
                agent_parts.finish_revision(answer, task, self.intent())

    def test_deleting_most_of_a_scene_needs_the_user_to_say_so(self):
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "đổi vị trí")
        answer = json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "ops": [
            {"op": "remove", "path": "events/e1"}, {"op": "remove", "path": "entities/phone"}]}})
        with self.assertRaises(ValueError):
            agent_parts.finish_revision(answer, task, self.intent())
        task = agent_parts.revise_task(self.CAPSULE, self.intent(), "s03", "bỏ cái điện thoại")
        keep_acting = {"id": "e3", "target": "gemini", "state_before": "neutral", "state_after": "neutral", "action": "nhìn bạn",
                       "trigger": {"type": "voice_anchor", "text": "rủ nhau"}}
        allowed = json.dumps({"kind": "scene.ops", "payload": {"scene_id": "s03", "ops": json.loads(answer)["payload"]["ops"] + [
            {"op": "add", "path": "events", "value": keep_acting}]}})
        agent_parts.finish_revision(allowed, task, self.intent())  # a scene still needs one authored action


if __name__ == "__main__":
    unittest.main()
