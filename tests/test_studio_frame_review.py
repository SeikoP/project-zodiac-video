import json
import unittest

from tools.studio_project import agent_frame_review as fr
from tools.studio_project.models import StudioError

BUILD = {"scenes": [{"id": "s01", "start_ms": 0, "end_ms": 4500}, {"id": "s02", "start_ms": 4500, "end_ms": 9000}]}
INTENT = {"scenes": [{"id": "s01", "semantic_goal": "Mở lời", "narration_range": [0, 10]},
                     {"id": "s02", "semantic_goal": "Bác lý do", "narration_range": [10, 20]}]}


def task():
    return fr.build_task(INTENT, {"s01": ["a.png", "b.png"], "s02": ["c.png", "d.png"]})


def reply(*rows):
    return json.dumps({"scenes": list(rows)}, ensure_ascii=False)


OK1 = {"scene_id": "s01", "verdict": "ok", "issues": [], "instruction": ""}
OK2 = {"scene_id": "s02", "verdict": "ok", "issues": [], "instruction": ""}
FIX2 = {"scene_id": "s02", "verdict": "fix", "issues": [{"code": "STATIC_SCENE", "note": "Nhân vật đứng yên."}],
        "instruction": "Cho nhân vật phản ứng ở câu cuối."}


class PlanTests(unittest.TestCase):
    def test_two_frames_per_scene_inside_the_scene(self):
        times = fr.plan_times(BUILD)
        self.assertEqual(times, {"s01": [1.8, 4.05], "s02": [6.3, 8.55]})

    def test_frame_names_match_hyperframes_keep_naming(self):
        self.assertEqual([fr.frame_name(t) for t in (1.8, 12.25, 3.0, 0.0)], ["at-1.8s.png", "at-12.25s.png", "at-3s.png", "at-0s.png"])

    def test_task_lists_images_in_scene_order(self):
        self.assertEqual(fr.image_paths(task()), ["a.png", "b.png", "c.png", "d.png"])
        self.assertIn("frame_count", fr.prompt(task()))


class ValidateTests(unittest.TestCase):
    def test_accepts_ok_and_fix_and_strips_fences(self):
        out = json.loads(fr.validate("```json\n" + reply(OK1, FIX2) + "\n```", task()))
        self.assertEqual([r["verdict"] for r in out["scenes"]], ["ok", "fix"])
        self.assertEqual(list(fr.scenes_to_fix(out)), ["s02"])

    def test_ok_scenes_carry_no_issues_or_instruction(self):
        noisy = dict(OK1, issues=[{"code": "OTHER", "note": "x"}], instruction="y")
        out = json.loads(fr.validate(reply(noisy, OK2), task()))
        self.assertEqual((out["scenes"][0]["issues"], out["scenes"][0]["instruction"]), ([], ""))

    def test_rejects_wrong_scenes_verdicts_codes_and_empty_fixes(self):
        bad = [reply(OK1), reply(OK2, OK1), reply(OK1, dict(OK2, verdict="maybe")),
               reply(OK1, dict(FIX2, issues=[{"code": "MADE_UP", "note": "x"}])),
               reply(OK1, dict(FIX2, instruction="")), reply(OK1, dict(FIX2, issues=[])), "not json", "[]",
               json.dumps({"scenes": [OK1, OK2], "extra": 1})]
        for text in bad:
            with self.assertRaises(StudioError, msg=text):
                fr.validate(text, task())


if __name__ == "__main__":
    unittest.main()
