import json
import unittest

from tools.studio_project.agent_authoring import bind_proposal


class AuthoringBindingTests(unittest.TestCase):
    def setUp(self):
        self.context = {"narration_sha256": "verified", "schema": {"video": {"width": 1080, "height": 1920, "fps": 30}},
                        "scene_ranges": [{"id": "s01", "narration_range": [0, 20]}]}
        self.proposal = {"kind": "source.replace", "payload": {"intent": {"format": "zodiac-visual-intent@1",
            "narration_sha256": "model-must-not-own-hashes", "scenes": [{"id": "s01", "narration_range": [0, 19], "semantic_goal": "unchanged"}]}}}

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
