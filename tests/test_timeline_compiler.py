import copy
import json
import unittest
from pathlib import Path

from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.timeline import compile_render_plan

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "control-plane-v2" / "minimal"


def load(name):
    return json.loads((FIXTURE / name).read_text(encoding="utf-8"))


def add_second_state_event(ir, *, target="scorpio", anchor="chao", max_drift=4, merge_policy="never", motion="reaction_pop"):
    event = {
        "id": "E02",
        "target": target,
        "intent": "reaction",
        "trigger": {"type": "voice_anchor", "text": anchor},
        "state_before": "guarded" if target == "scorpio" else "idle",
        "state_after": "open" if target == "scorpio" else "active",
        "desired_motion": motion,
        "scheduling": {
            "max_drift_frames": max_drift,
            "merge_policy": merge_policy,
        },
    }
    ir["scenes"][0]["events"].append(event)
    return event


class TimelineCompilerTests(unittest.TestCase):
    def setUp(self):
        self.ir = load("production.ir.json")
        self.timing = load(".runtime/timing.json")
        self.design = load("design-token.json")

    def test_compiles_non_conflicting_event(self):
        plan = compile_render_plan(self.ir, self.timing, self.design)
        event = plan["scenes"][0]["events"][0]
        self.assertEqual(event["event_id"], "E01")
        self.assertEqual(event["preferred_start_frame"], 0)
        self.assertEqual(event["start_frame"], 0)
        self.assertEqual(event["end_frame"], 8)

    def test_compiler_resolves_state_assets_into_executable_event(self):
        plan = compile_render_plan(self.ir, self.timing, self.design)
        event = plan["scenes"][0]["events"][0]
        self.assertEqual(event["asset_before"], "char.scorpio")
        self.assertEqual(event["asset_after"], "char.scorpio")

    def test_same_target_overlap_is_shifted_within_drift_allowance(self):
        add_second_state_event(self.ir)
        plan = compile_render_plan(self.ir, self.timing, self.design)
        first, second = plan["scenes"][0]["events"]
        self.assertEqual((first["start_frame"], first["end_frame"]), (0, 8))
        self.assertEqual(second["preferred_start_frame"], 7)
        self.assertEqual(second["start_frame"], 8)
        self.assertEqual(second["end_frame"], 16)

    def test_cross_target_overlap_remains_legal(self):
        scene = self.ir["scenes"][0]
        scene["entities"].append(
            {
                "id": "friend",
                "initial_state": "idle",
                "states": {
                    "idle": {"asset": "char.scorpio"},
                    "active": {"asset": "char.scorpio"},
                },
            }
        )
        add_second_state_event(self.ir, target="friend", anchor="xin")
        plan = compile_render_plan(self.ir, self.timing, self.design)
        first, second = plan["scenes"][0]["events"]
        self.assertEqual(first["start_frame"], 0)
        self.assertEqual(second["start_frame"], 0)

    def test_explicit_same_intent_state_merge_produces_one_interval(self):
        scene = self.ir["scenes"][0]
        second = copy.deepcopy(scene["events"][0])
        second["id"] = "E02"
        second["scheduling"] = {
            "max_drift_frames": 0,
            "merge_policy": "same_intent_same_state",
        }
        scene["events"].append(second)
        plan = compile_render_plan(self.ir, self.timing, self.design)
        events = plan["scenes"][0]["events"]
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["merged_event_ids"], ["E01", "E02"])

    def test_overlap_beyond_drift_fails_in_plan_stage(self):
        add_second_state_event(self.ir, anchor="xin", max_drift=2)
        with self.assertRaises(ControlPlaneError) as caught:
            compile_render_plan(self.ir, self.timing, self.design)
        self.assertEqual(caught.exception.code, "TIMELINE_TARGET_CONFLICT")
        self.assertEqual(caught.exception.stage, "PLAN")
        self.assertEqual(caught.exception.event_id, "E02")
        self.assertEqual(caught.exception.target, "scorpio")
        self.assertEqual(caught.exception.detail["preferred_start"], 0)
        self.assertEqual(caught.exception.detail["prior_end"], 8)

    def test_scene_boundary_overflow_fails_in_plan_stage(self):
        self.design["motion_defaults"]["reaction_long"] = {"duration_frames": 80}
        self.ir["scenes"][0]["events"][0]["desired_motion"] = "reaction_long"
        with self.assertRaises(ControlPlaneError) as caught:
            compile_render_plan(self.ir, self.timing, self.design)
        self.assertEqual(caught.exception.code, "TIMELINE_SCENE_BOUNDS")
        self.assertEqual(caught.exception.stage, "PLAN")

    def test_authored_event_order_is_stable_after_lane_scheduling(self):
        scene = self.ir["scenes"][0]
        scene["entities"].append(
            {
                "id": "friend",
                "initial_state": "idle",
                "states": {
                    "idle": {"asset": "char.scorpio"},
                    "active": {"asset": "char.scorpio"},
                },
            }
        )
        add_second_state_event(self.ir, target="friend", anchor="xin")
        plan = compile_render_plan(self.ir, self.timing, self.design)
        self.assertEqual(
            [event["event_id"] for event in plan["scenes"][0]["events"]],
            ["E01", "E02"],
        )

    def test_identical_inputs_produce_byte_stable_normalized_plan(self):
        first = compile_render_plan(self.ir, self.timing, self.design)
        second = compile_render_plan(
            copy.deepcopy(self.ir),
            copy.deepcopy(self.timing),
            copy.deepcopy(self.design),
        )
        first_bytes = json.dumps(first, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        second_bytes = json.dumps(second, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(first_bytes, second_bytes)


if __name__ == "__main__":
    unittest.main()

