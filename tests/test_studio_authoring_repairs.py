"""Mechanical mistakes in model output are repaired by Core, not sent back to the model for another 30-60 s round."""
import json
import unittest

from tools.studio_project import agent_authoring, agent_parts

OPTIONS = agent_authoring.catalog()["components"]


def cast(**state):
    return [{"entity_id": "char-a", "states": {"reaction": state}}]


class CastRepairTests(unittest.TestCase):
    def test_an_expression_written_as_a_pose_moves_to_the_expression(self):
        members = cast(pose_id="side-eye", expression_id="neutral")
        changes = agent_authoring.repair_cast(members, OPTIONS)
        state = members[0]["states"]["reaction"]
        self.assertEqual((state["pose_id"], state["expression_id"]), ("neutral", "side-eye"))
        self.assertTrue(any("side-eye" in c for c in changes))

    def test_a_pose_written_as_an_expression_moves_to_the_pose(self):
        members = cast(pose_id="neutral", expression_id="facepalm")
        agent_authoring.repair_cast(members, OPTIONS)
        state = members[0]["states"]["reaction"]
        self.assertEqual((state["pose_id"], state["expression_id"]), ("facepalm", "neutral"))

    def test_unknown_values_become_the_nearest_real_one_or_neutral_and_are_reported(self):
        members = cast(pose_id="levitate", expression_id="angry")
        changes = agent_authoring.repair_cast(members, OPTIONS)
        state = members[0]["states"]["reaction"]
        self.assertEqual((state["pose_id"], state["expression_id"]), ("neutral", "exasperated"))
        self.assertEqual(len(changes), 2)

    def test_valid_cast_is_untouched(self):
        members = cast(pose_id="explain", expression_id="smug")
        self.assertEqual(agent_authoring.repair_cast(members, OPTIONS), [])
        self.assertEqual(members[0]["states"]["reaction"], {"pose_id": "explain", "expression_id": "smug"})

    def test_the_skeleton_is_repaired_when_it_arrives_not_after_eight_scenes(self):
        skeleton = {"kind": "authoring.skeleton", "payload": {"intent": {"cast": cast(pose_id="side-eye", expression_id="neutral"),
                                                                           "assets": {}}}}
        context = {"narration_sha256": "n", "schema": {"video": {}}, "narrative_plan": {}}
        out = json.loads(agent_parts.validate_skeleton(json.dumps(skeleton), context))
        state = out["payload"]["intent"]["cast"][0]["states"]["reaction"]
        self.assertEqual(state["pose_id"], "neutral")
        self.assertEqual(state["expression_id"], "side-eye")


def scene_task():
    return {"scene_id": "s02", "scene_range": [0, 11], "scene_text": "hello world", "story_visual_assets": {},
            "cast": [{"entity_id": "char-a", "states": ["neutral"]}]}


def scene_json(entity_id="phone", ref="s02-phone", event=None):
    body = {"id": "s02", "grammar": {"frame_id": "f", "mechanic_id": "m", "bindings": {}},
            "entities": [{"id": entity_id, "kind": "object", "visual_role": "interactive_prop",
                          "states": {"present": {"asset": ref, "layer": 5, "transform": {"x": 1, "y": 1, "width": 10, "height": 10}}}}],
            "events": [event or {"id": "e1", "target": entity_id, "action": "đưa", "state_before": "present", "state_after": "present",
                                 "trigger": {"type": "voice_anchor", "text": "hello"}, "motion": {"preset": "state_swap"}}],
            "experience_profile": {"story_mode": "behavior"}}
    return json.dumps({"kind": "scene.part", "payload": {"scene": body, "assets": {}}})


class SceneRepairTests(unittest.TestCase):
    def validate(self, text):
        return json.loads(agent_parts.validate_scene(text, scene_task()))["payload"]

    def test_an_undeclared_prop_that_exists_in_the_library_is_declared(self):
        payload = self.validate(scene_json())
        self.assertEqual(payload["assets"]["s02-phone"], {"path": "library:props/phone.svg", "category": "prop"})

    def test_an_undeclared_reference_without_the_scene_prefix_is_renamed_and_declared(self):
        payload = self.validate(scene_json(entity_id="depth__table", ref="table"))
        self.assertEqual(payload["scene"]["entities"][0]["states"]["present"]["asset"], "s02-table")
        self.assertEqual(payload["assets"]["s02-table"]["path"], "library:props/laptop.svg")  # set dressing only

    def test_a_story_prop_that_does_not_exist_is_still_an_error_with_real_options(self):
        with self.assertRaises(ValueError) as caught:
            agent_parts.validate_scene(scene_json(entity_id="dragon-prop", ref="s02-dragon"), scene_task())
        self.assertIn("s02-dragon", str(caught.exception))

    def test_an_enter_event_is_normalised_to_scene_start_with_a_steady_state(self):
        event = {"id": "e1", "target": "phone", "action": "xuất hiện", "state_before": "present", "state_after": "other",
                 "trigger": {"type": "voice_anchor", "text": "hello"}, "motion": {"preset": "enter"}}
        scene = self.validate(scene_json(event=event))["scene"]
        fixed = scene["events"][0]
        self.assertEqual(fixed["trigger"], {"type": "scene_start"})
        self.assertEqual(fixed["state_after"], fixed["state_before"])


class CharacterStateRepairTests(unittest.TestCase):
    """A character event that goes to one of the cast's own states the scene entity forgot to list (the s04 failure)."""

    def scene(self, entity_states, event_after="reaction", cast_states=("neutral", "reaction")):
        task = {**scene_task(), "cast": [{"entity_id": "char-a", "states": list(cast_states)}]}
        body = json.loads(scene_json())["payload"]["scene"]
        body["entities"] = [{"id": "char-a", "kind": "character", "visual_role": "character", "states": entity_states}]
        body["events"] = [{"id": "e1", "target": "char-a", "action": "phản ứng", "state_before": "neutral", "state_after": event_after,
                           "trigger": {"type": "voice_anchor", "text": "hello"}, "motion": {"preset": "state_swap"}}]
        text = json.dumps({"kind": "scene.part", "payload": {"scene": body, "assets": {}}})
        return json.loads(agent_parts.validate_scene(text, task))["payload"]["scene"]

    def neutral(self):
        return {"neutral": {"asset": "neutral", "visible": True, "layer": 5, "transform": {"x": 10, "y": 20, "width": 300, "height": 600}}}

    def test_a_cast_state_missing_from_the_entity_is_added_in_the_same_place(self):
        entity = self.scene(self.neutral())["entities"][0]
        self.assertEqual(entity["states"]["reaction"]["asset"], "reaction")
        self.assertEqual(entity["states"]["reaction"]["transform"], entity["states"]["neutral"]["transform"])

    def test_a_state_that_is_not_in_the_cast_is_still_an_error(self):
        with self.assertRaises(ValueError):
            self.scene(self.neutral(), event_after="levitating")

    def test_nothing_is_added_when_the_entity_already_has_the_state(self):
        states = {**self.neutral(), "reaction": {"asset": "reaction", "visible": True, "layer": 5,
                                                  "transform": {"x": 1, "y": 2, "width": 3, "height": 4}}}
        self.assertEqual(self.scene(states)["entities"][0]["states"]["reaction"]["transform"], {"x": 1, "y": 2, "width": 3, "height": 4})


class MechanicalFieldRepairTests(unittest.TestCase):
    def validate(self, mutate):
        data = json.loads(scene_json())
        data["payload"]["assets"] = {"s02-phone": {"path": "library:props/phone.svg", "category": "prop"}}
        mutate(data["payload"]["scene"])
        return json.loads(agent_parts.validate_scene(json.dumps(data), scene_task()))["payload"]["scene"]

    def test_layer_and_transform_numbers_written_loosely_are_coerced(self):
        def loose(scene):
            state = scene["entities"][0]["states"]["present"]
            state["layer"] = 7.0
            state["transform"] = {"x": "100", "y": 5.5, "width": "40", "height": 40}
        state = self.validate(loose)["entities"][0]["states"]["present"]
        self.assertEqual(state["layer"], 7)
        self.assertEqual(state["transform"], {"x": 100, "y": 5.5, "width": 40, "height": 40})

    def test_an_out_of_range_layer_is_clamped(self):
        def far(scene):
            scene["entities"][0]["states"]["present"]["layer"] = 99999
        self.assertEqual(self.validate(far)["entities"][0]["states"]["present"]["layer"], 10000)

    def test_a_trigger_text_that_differs_only_in_case_or_spacing_snaps_to_the_real_text(self):
        def sloppy(scene):
            scene["events"][0]["trigger"]["text"] = "HELLO  "
        self.assertEqual(self.validate(sloppy)["events"][0]["trigger"]["text"], "hello")

    def test_a_trigger_text_that_is_not_in_the_scene_is_still_an_error(self):
        def wrong(scene):
            scene["events"][0]["trigger"]["text"] = "goodbye"
        with self.assertRaises(ValueError):
            self.validate(wrong)

    def test_transition_frames_outside_the_preset_range_are_clamped(self):
        def far(scene):
            scene["transition"] = {"preset": "paper-slide", "frames": 9999}
        spec = agent_parts.TRANSITIONS["presets"]["paper-slide"]
        self.assertEqual(self.validate(far)["transition"]["frames"], spec["max_frames"])


CONTEXT = {"narration_sha256": "n", "video": {}, "scene_ranges": [], "schema": {"video": {}}, "narrative_plan": {},
           "episode_scope": {"concept_code": "love-sincere", "sign": "Nhân Mã"}, "suggested_opening_topic": "Cách Nhân Mã yêu thật lòng"}


def bound(opening):
    intent = {"narration_sha256": "n", "video": {}, "taxonomy_version": "story_visual@1", "scenes": [], "assets": {}, "cast": []}
    if opening is not None:
        intent["opening"] = opening
    text, changed = agent_authoring.bind_proposal(json.dumps({"kind": "source.replace", "payload": {"intent": intent}}), CONTEXT)
    return json.loads(text)["payload"]["intent"], changed


class OpeningRepairTests(unittest.TestCase):
    def test_a_missing_opening_is_built_from_the_approved_scope(self):
        out, changed = bound(None)
        self.assertEqual((out["opening"]["sign"], out["opening"]["topic"]), ("Nhân Mã", "Cách Nhân Mã yêu thật lòng"))
        self.assertEqual(out["opening"]["format"], "zodiac-series-opening@1")
        self.assertIn("opening_built", changed)

    def test_a_wrong_sign_or_hook_as_topic_is_corrected_not_rejected(self):
        out, changed = bound({"format": "zodiac-series-opening@1", "series": "12 CUNG HOÀNG ĐẠO", "sign": "Sư Tử",
                              "topic": "Tao yêu vào vẫn thế", "duration_frames": 45, "transition_frames": 9})
        self.assertEqual((out["opening"]["sign"], out["opening"]["topic"]), ("Nhân Mã", "Cách Nhân Mã yêu thật lòng"))
        self.assertTrue(any(c.startswith("opening_") for c in changed))


if __name__ == "__main__":
    unittest.main()
