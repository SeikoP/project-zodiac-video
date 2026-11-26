import json
import unittest

from tools.studio_project.agent_authoring import bind_proposal


class AuthoringBindingTests(unittest.TestCase):
    def setUp(self):
        self.context = {"narration_sha256": "verified", "schema": {"video": {"width": 1080, "height": 1920, "fps": 30}},
                        "scene_ranges": [{"id": "s01", "narration_range": [0, 20]}]}
        self.proposal = {"kind": "source.replace", "payload": {"intent": {"format": "zodiac-visual-intent@1",
            "narration_sha256": "model-must-not-own-hashes", "scenes": [{"id": "s01", "narration_range": [0, 19], "semantic_goal": "unchanged"}]}}}

    def test_a_single_sign_scope_without_a_sign_field_still_fixes_the_cover(self):
        # zodiac-episode-scope@1 lists member_ids only; the cover said "libra" and every run failed on "Cover phải ghi đúng tên cung"
        from tools.studio_project.agent_authoring import scope_sign
        scope = {"format": "zodiac-episode-scope@1", "episode_format": "single_sign", "member_ids": ["libra"]}
        self.assertEqual(scope_sign(scope), "Thiên Bình")
        self.assertEqual(scope_sign({"sign": "Sư Tử"}), "Sư Tử")
        self.assertIsNone(scope_sign({"episode_format": "comparison", "member_ids": ["libra", "leo"]}))
        self.assertIsNone(scope_sign({}))
        self.context["episode_scope"] = {"sign": scope_sign(scope)}
        self.proposal["payload"]["intent"]["opening"] = {"format": "zodiac-series-opening@1", "series": "12 CUNG HOÀNG ĐẠO", "sign": "libra",
                                                         "topic": "Cách Thiên Bình yêu bằng sự công bằng", "duration_frames": 45, "transition_frames": 9}
        text, changed = bind_proposal(json.dumps(self.proposal), self.context)
        self.assertEqual(json.loads(text)["payload"]["intent"]["opening"]["sign"], "Thiên Bình")
        self.assertIn("opening_sign", changed)

    def test_a_proposal_error_no_scene_owns_is_not_sent_back_to_scene_one(self):
        from tools.studio_project.pipeline.failure_policy import route
        self.assertEqual(route({"code": "PROPOSAL_INVALID", "scene_id": None}), "owner")
        self.assertEqual(route({"code": "PROPOSAL_INVALID", "scene_id": "s02"}), "model")

    def test_binds_source_metadata_without_inventing_scene_content(self):
        text, changed = bind_proposal(json.dumps(self.proposal), self.context)
        intent = json.loads(text)["payload"]["intent"]
        self.assertEqual(intent["narration_sha256"], "verified")
        self.assertEqual(intent["video"], self.context["schema"]["video"])
        self.assertEqual(intent["scenes"], [{"id": "s01", "narration_range": [0, 20], "semantic_goal": "unchanged"}])
        self.assertIn("narration_sha256", changed)
        self.assertNotIn("video", self.proposal["payload"]["intent"])

    def test_only_a_single_missing_outer_brace_is_recoverable(self):
        text, changed = bind_proposal(json.dumps(self.proposal)[:-1], self.context)
        self.assertIsInstance(json.loads(text), dict)
        self.assertIn("outer_json_brace", changed)
        for bad in ['{"kind":"source.replace","payload":', '{"kind":"unterminated', json.dumps(self.proposal)[:-2]]:
            with self.assertRaises(ValueError):
                bind_proposal(bad, self.context)

    def test_does_not_repair_unsupported_video_or_unknown_scene_ids(self):
        self.proposal["payload"]["intent"]["video"] = {"fps": 99}
        self.proposal["payload"]["intent"]["scenes"][0]["id"] = "unknown"
        text, _ = bind_proposal(json.dumps(self.proposal), self.context)
        intent = json.loads(text)["payload"]["intent"]
        self.assertEqual(intent["video"], {"fps": 99})
        self.assertEqual(intent["scenes"][0]["id"], "unknown")

    def test_prop_entity_alias_uses_canonical_object_kind_without_changing_assets(self):
        self.proposal["payload"]["intent"]["scenes"][0]["entities"] = [{"id": "p", "kind": "prop", "states": {"idle": {"asset": "phone"}}}]
        text, _ = bind_proposal(json.dumps(self.proposal), self.context)
        entity = json.loads(text)["payload"]["intent"]["scenes"][0]["entities"][0]
        self.assertEqual(entity, {"id": "p", "kind": "object", "states": {"idle": {"asset": "phone"}}})
