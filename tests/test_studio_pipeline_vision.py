"""Frame review in the autopilot: one vision pass per round, repairs only for scenes that look wrong, bounded rounds."""
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.test_studio_pipeline_autopilot import AutopilotCase, ORDER
from tests.pipeline_fakes import visual_state
from tools.studio_project.pipeline import autopilot as autopilot_module
from tools.studio_project.pipeline import drafts, vision

FIX = {"scenes": [{"scene_id": "s01", "verdict": "ok", "issues": [], "instruction": ""},
                  {"scene_id": "s02", "verdict": "fix", "issues": [{"code": "STATIC_SCENE", "note": "đứng yên"}],
                   "instruction": "Cho nhân vật phản ứng."}]}
OK = {"scenes": [{"scene_id": "s01", "verdict": "ok", "issues": [], "instruction": ""},
                 {"scene_id": "s02", "verdict": "ok", "issues": [], "instruction": ""}]}
ITEM = [{"kind": "visual.intent", "payload": {"command": "source.replace", "payload": {"intent": {}}}, "voice_dependencies": "dep"}]


class VisionLoopTests(AutopilotCase):
    def setUp(self):
        super().setUp()
        patcher = patch.dict(os.environ, {"ZODIAC_STUDIO_VISION_REVIEW": "on"})
        patcher.start()
        self.addCleanup(patcher.stop)
        for name, _ in ORDER:
            self.world.status[name] = "DONE"
            if name == "build":
                break
        self.world.status["inspect"] = "READY"
        self.world._settle()

    def run_pilot(self, reviews, revise=ITEM):
        reviews = list(reviews)
        seen = []
        def fake_review(service, project_id, stopped, track=None, sleep=None):
            return ("b1", reviews.pop(0)) if reviews else None
        def fake_revise(service, project_id, node_id, by_scene, pilot, hint=None):
            seen.append((by_scene, hint))
            return revise
        with patch.object(vision, "review_current_build", side_effect=fake_review), \
                patch.object(autopilot_module, "_revise_scenes", side_effect=fake_revise):
            self.pilot.start(5)
            self.drive()
        return seen

    def vision_submits(self):
        return [s for s in self.world.submits if "vision" in s[1]]

    def test_a_failing_scene_is_repaired_with_its_own_instruction_and_the_vision_hint(self):
        seen = self.run_pilot([FIX, OK])
        by_scene, hint = seen[0]
        self.assertEqual(list(by_scene), ["s02"])
        self.assertIn("Cho nhân vật phản ứng.", by_scene["s02"][0].message)
        self.assertIs(hint, autopilot_module.VISION_REPAIR_HINT)
        self.assertEqual(len(self.vision_submits()), 1)
        self.assertEqual(self.world.submit_kwargs[0]["voice_dependencies"], "dep")

    def test_all_scenes_ok_repairs_nothing_and_inspection_proceeds(self):
        seen = self.run_pilot([OK])
        self.assertEqual((seen, self.vision_submits()), ([], []))
        self.assertEqual(self.world.status["inspect"], "DONE")

    def test_rounds_are_capped_and_the_remaining_findings_stay_for_the_human(self):
        self.run_pilot([FIX, FIX, FIX, FIX])
        self.assertEqual(len(self.vision_submits()), vision.MAX_ROUNDS)

    def test_a_review_that_cannot_run_or_a_repair_that_fails_never_blocks(self):
        self.run_pilot([])
        self.assertEqual(self.vision_submits(), [])
        self.run_pilot([FIX], revise=None)
        self.assertEqual(self.vision_submits(), [])

    def test_can_be_switched_off(self):
        with patch.dict(os.environ, {"ZODIAC_STUDIO_VISION_REVIEW": "off"}):
            seen = self.run_pilot([FIX])
        self.assertEqual(seen, [])

    def test_the_review_is_saved_for_this_build_only(self):
        self.run_pilot([FIX])
        workspace = self.workspace
        self.assertEqual(vision.load(workspace, "b1")["review"]["scenes"][1]["verdict"], "fix")
        self.assertIsNone(vision.load(workspace, "other-build"))


class InspectDraftTests(AutopilotCase):
    def test_inspect_report_carries_the_frame_review_as_visual_findings(self):
        state = visual_state()
        self.service.visual.value = state
        vision.save(self.workspace, state["build"]["id"], 1, FIX)
        kind, payload = drafts.draft(self.service, "p", "inspect")
        self.assertEqual((kind, payload["method"]), ("inspect.report", "visual"))
        rows = {f["scene_id"]: f for f in payload["findings"]}
        self.assertEqual(rows["s02"]["severity"], "warn")
        self.assertIn("STATIC_SCENE", rows["s02"]["note"])
        self.assertEqual(rows["s01"]["severity"], "ok")

    def test_a_review_of_another_build_is_ignored(self):
        state = visual_state()
        self.service.visual.value = state
        vision.save(self.workspace, "some-older-build", 1, FIX)
        kind, payload = drafts.draft(self.service, "p", "inspect")
        self.assertEqual(payload["method"], "structural")
        self.assertTrue(all(f["severity"] == "ok" for f in payload["findings"]))


if __name__ == "__main__":
    unittest.main()
