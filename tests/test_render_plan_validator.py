import copy
import json
import unittest
from pathlib import Path

from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.render_plan import target_overlap_count, validate_render_plan
from tools.control_plane.timeline import compile_render_plan

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "control-plane-v2" / "minimal"


def load(name):
    return json.loads((FIXTURE / name).read_text(encoding="utf-8"))


class RenderPlanValidatorTests(unittest.TestCase):
    def setUp(self):
        self.ir = load("production.ir.json")
        self.plan = compile_render_plan(
            self.ir,
            load(".runtime/timing.json"),
            load("design-token.json"),
        )

    def test_compiled_plan_is_valid(self):
        validate_render_plan(self.plan, self.ir)
        self.assertEqual(target_overlap_count(self.plan), 0)

    def test_merged_semantic_events_are_valid_render_plan_intervals(self):
        event = self.ir["scenes"][0]["events"][0]
        duplicate = copy.deepcopy(event)
        duplicate["id"] = "E02"
        duplicate["scheduling"] = {
            "max_drift_frames": 0,
            "merge_policy": "same_intent_same_state",
        }
        self.ir["scenes"][0]["events"].append(duplicate)
        plan = compile_render_plan(
            self.ir,
            load(".runtime/timing.json"),
            load("design-token.json"),
        )
        merged = plan["scenes"][0]["events"][0]
        self.assertEqual(merged["merged_event_ids"], ["E01", "E02"])
        validate_render_plan(plan, self.ir)

    def test_same_target_overlap_is_rejected(self):
        duplicate = copy.deepcopy(self.plan["scenes"][0]["events"][0])
        duplicate["event_id"] = "E02"
        duplicate["start_frame"] = 4
        duplicate["end_frame"] = 12
        self.plan["scenes"][0]["events"].append(duplicate)
        self.assertEqual(target_overlap_count(self.plan), 1)
        with self.assertRaises(ControlPlaneError) as caught:
            validate_render_plan(self.plan, self.ir)
        self.assertEqual(caught.exception.code, "PLAN_TARGET_OVERLAP")

    def test_invalid_target_state_is_rejected(self):
        self.plan["scenes"][0]["events"][0]["state_after"] = "ghost"
        with self.assertRaises(ControlPlaneError) as caught:
            validate_render_plan(self.plan, self.ir)
        self.assertEqual(caught.exception.code, "PLAN_STATE_INVALID")

    def test_scene_overflow_is_rejected(self):
        event = self.plan["scenes"][0]["events"][0]
        event["end_frame"] = self.plan["scenes"][0]["duration_frames"] + 1
        with self.assertRaises(ControlPlaneError) as caught:
            validate_render_plan(self.plan, self.ir)
        self.assertEqual(caught.exception.code, "PLAN_SCENE_BOUNDS")

    def test_missing_asset_referenced_by_state_is_rejected(self):
        self.plan["assets"].pop("char.scorpio")
        with self.assertRaises(ControlPlaneError) as caught:
            validate_render_plan(self.plan, self.ir)
        self.assertEqual(caught.exception.code, "PLAN_ASSET_MISSING")

    def test_duplicate_event_identity_is_rejected(self):
        duplicate = copy.deepcopy(self.plan["scenes"][0]["events"][0])
        duplicate["start_frame"] = 12
        duplicate["end_frame"] = 20
        self.plan["scenes"][0]["events"].append(duplicate)
        with self.assertRaises(ControlPlaneError) as caught:
            validate_render_plan(self.plan, self.ir)
        self.assertEqual(caught.exception.code, "PLAN_EVENT_DUPLICATE")

    def test_unresolved_semantic_trigger_is_schema_error(self):
        self.plan["scenes"][0]["events"][0]["trigger"] = {
            "type": "voice_anchor",
            "text": "xin",
        }
        with self.assertRaises(ControlPlaneError) as caught:
            validate_render_plan(self.plan, self.ir)
        self.assertEqual(caught.exception.code, "PLAN_SCHEMA_INVALID")


if __name__ == "__main__":
    unittest.main()

