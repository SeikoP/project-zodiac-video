import copy
import json
import tempfile
import unittest
from pathlib import Path

from tools.control_plane.authoring import load_authoring_ir, validate_authoring_ir
from tools.control_plane.errors import ControlPlaneError

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "control-plane-v2" / "minimal"


def fixture_ir():
    return json.loads((FIXTURE / "production.ir.json").read_text(encoding="utf-8"))


class AuthoringIrTests(unittest.TestCase):
    def test_short_complete_scene_caption_is_valid(self):
        document = fixture_ir()
        scene = document["scenes"][0]
        scene["voice"] = "Khoan."
        for event in scene["events"]:
            event["trigger"] = {"type": "scene_start"}
        scene["caption_segments"] = [
            {"text": "Khoan.", "start_ms": 0, "end_ms": 500, "max_lines": 2, "preferred_breaks": []}
        ]
        validate_authoring_ir(document)
        scene["caption_segments"][0]["text"] = "Ừ."
        with self.assertRaisesRegex(ControlPlaneError, "exact narration token order"):
            validate_authoring_ir(document)

    def test_tiny_caption_fragment_in_longer_scene_is_rejected(self):
        document = fixture_ir()
        scene = document["scenes"][0]
        scene["voice"] = "Khoan để tôi nói."
        scene["caption_segments"] = [
            {"text": "Khoan", "start_ms": 0, "end_ms": 300, "max_lines": 2, "preferred_breaks": []},
            {"text": "để tôi nói.", "start_ms": 300, "end_ms": 900, "max_lines": 2, "preferred_breaks": []},
        ]
        with self.assertRaisesRegex(ControlPlaneError, "fewer than three words"):
            validate_authoring_ir(document)

    def test_loads_valid_semantic_ir(self):
        loaded = load_authoring_ir(FIXTURE / "production.ir.json")
        self.assertEqual(loaded["format"], "zodiac-authoring-ir@1")
        validate_authoring_ir(loaded)

    def test_duplicate_event_ids_are_rejected(self):
        document = fixture_ir()
        duplicate = copy.deepcopy(document["scenes"][0]["events"][0])
        document["scenes"][0]["events"].append(duplicate)
        with self.assertRaises(ControlPlaneError) as caught:
            validate_authoring_ir(document)
        self.assertEqual(caught.exception.code, "AUTHORING_IR_INVALID")
        self.assertIn("duplicate event id", caught.exception.message)

    def test_resolved_frame_fields_are_forbidden(self):
        document = fixture_ir()
        document["scenes"][0]["events"][0]["start_frame"] = 12
        with self.assertRaises(ControlPlaneError) as caught:
            validate_authoring_ir(document)
        self.assertEqual(caught.exception.code, "AUTHORING_IR_INVALID")
        self.assertIn("start_frame", str(caught.exception.detail))

    def test_missing_target_is_rejected(self):
        document = fixture_ir()
        document["scenes"][0]["events"][0]["target"] = "missing"
        with self.assertRaises(ControlPlaneError) as caught:
            validate_authoring_ir(document)
        self.assertEqual(caught.exception.code, "AUTHORING_IR_INVALID")
        self.assertIn("target", caught.exception.message)

    def test_missing_target_state_is_rejected(self):
        document = fixture_ir()
        document["scenes"][0]["events"][0]["state_after"] = "missing-state"
        with self.assertRaises(ControlPlaneError) as caught:
            validate_authoring_ir(document)
        self.assertEqual(caught.exception.code, "AUTHORING_IR_INVALID")
        self.assertIn("state", caught.exception.message)

    def test_scene_start_trigger_does_not_require_anchor_text(self):
        document = fixture_ir()
        document["scenes"][0]["events"][0]["trigger"] = {"type": "scene_start"}
        validate_authoring_ir(document)

    def test_repeated_voice_anchor_requires_occurrence(self):
        document = fixture_ir()
        document["scenes"][0]["voice"] = "xin mot lan, xin hai lan"
        with self.assertRaises(ControlPlaneError) as caught:
            validate_authoring_ir(document)
        self.assertEqual(caught.exception.code, "AUTHORING_IR_INVALID")
        self.assertIn("occurrence", caught.exception.message)

    def test_repeated_voice_anchor_with_occurrence_is_valid(self):
        document = fixture_ir()
        document["scenes"][0]["voice"] = "xin mot lan, xin hai lan"
        document["scenes"][0]["events"][0]["trigger"]["occurrence"] = 2
        validate_authoring_ir(document)

    def test_load_rejects_invalid_json_shape(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "production.ir.json"
            path.write_text('{"format":"wrong"}', encoding="utf-8")
            with self.assertRaises(ControlPlaneError):
                load_authoring_ir(path)


if __name__ == "__main__":
    unittest.main()
