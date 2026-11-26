"""Layout faults found by the build QA are repaired in code before the frame inspection, not left for the user."""
import unittest
from unittest.mock import patch

from tools.studio_project.pipeline import autofix
from tests.test_studio_pipeline_autopilot import AutopilotCase, ORDER


def faulty_build(*codes):
    return {"build": {"scenes": [{"id": "s01", "qa": {"issues": [{"code": c} for c in codes]}},
                                 {"id": "s02", "qa": {"issues": []}}]}}


ITEM = {"kind": "visual.intent", "payload": {"command": "source.replace", "payload": {"intent": {"scenes": []}}},
        "voice_dependencies": "dep"}
CHANGE = {"scene_id": "s01", "entity_id": "hero"}


class FaultSelectionTests(unittest.TestCase):
    def test_only_fixable_codes_select_a_scene(self):
        self.assertEqual(autofix.scenes_with_geometry_faults(faulty_build("OUTSIDE_CANVAS")), ["s01"])
        self.assertEqual(autofix.scenes_with_geometry_faults(faulty_build("CAPTION_OCCLUSION", "TRANSFORM_REQUIRED")), ["s01"])
        self.assertEqual(autofix.scenes_with_geometry_faults(faulty_build("TRANSFORM_REQUIRED")), [])
        self.assertEqual(autofix.scenes_with_geometry_faults({"build": None}), [])


class InspectHookTests(AutopilotCase):
    def ready_for_inspect(self):
        for name, _ in ORDER:
            self.world.status[name] = "DONE"
            if name == "build":
                break
        self.world.status["inspect"] = "READY"
        self.world._settle()

    def test_geometry_fault_is_repaired_then_inspection_continues(self):
        self.ready_for_inspect()
        self.world.status["inspect"] = "READY"
        calls = [([ITEM], [CHANGE]), ([], [])]
        with patch.object(autofix, "propose_geometry_fix", side_effect=lambda *a: calls.pop(0)):
            self.pilot.start(5)
            self.drive()
        self.assertEqual([k for k, _ in self.world.submits][:1], ["visual.intent"])
        self.assertIn("autofix", self.world.submits[0][1])
        self.assertEqual(self.world.submit_kwargs[0]["voice_dependencies"], "dep")

    def test_repair_rounds_are_capped(self):
        self.ready_for_inspect()
        with patch.object(autofix, "propose_geometry_fix", return_value=([ITEM], [CHANGE])) as proposed:
            self.pilot.start(5)
            self.drive()
        self.assertLessEqual(len([s for s in self.world.submits if "autofix" in s[1]]), autofix.MAX_ROUNDS)
        self.assertGreaterEqual(proposed.call_count, 1)

    def test_nothing_to_repair_leaves_inspection_untouched(self):
        self.ready_for_inspect()
        with patch.object(autofix, "propose_geometry_fix", return_value=([], [])):
            self.pilot.start(5)
            self.drive()
        self.assertFalse([s for s in self.world.submits if "autofix" in s[1]])


if __name__ == "__main__":
    unittest.main()
