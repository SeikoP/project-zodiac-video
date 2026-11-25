"""The frame review task: vision role (sol), images attached as local files, findings validated, nothing applied."""
import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch

import tests.test_studio_p1_agent as base
from tools.studio_project import agent_frame_review as fr
from tools.studio_project.models import StudioError

INTENT = {"scenes": [{"id": "s01", "semantic_goal": "Mở lời", "narration_range": [0, 5]},
                     {"id": "s02", "semantic_goal": "Bác lý do", "narration_range": [5, 9]}]}
GOOD = json.dumps({"scenes": [
    {"scene_id": "s01", "verdict": "ok", "issues": [], "instruction": ""},
    {"scene_id": "s02", "verdict": "fix", "issues": [{"code": "STATIC_SCENE", "note": "đứng yên"}], "instruction": "Cho phản ứng."}]})


class FrameReviewBridgeTests(unittest.TestCase):
    setUp = base.AgentTests.setUp

    def task(self):
        return fr.build_task(INTENT, {"s01": ["C:/f/a.png", "C:/f/b.png"], "s02": ["C:/f/c.png"]})

    def run_review(self, reply):
        review = self.task()
        with patch.object(self.manager, "_bin", return_value="not-needed"), patch.object(self.manager, "_run", return_value=None):
            started = self.manager.start_frame_review(self.project["project_id"], review)
        messages = [{"id": 1, "result": {}}, {"id": 2, "result": {"thread": {"id": "t"}}}, {"id": 3, "result": {"turn": {"id": "u"}}},
                    {"method": "item/completed", "params": {"item": {"type": "agentMessage", "text": reply}}},
                    {"method": "turn/completed", "params": {"turn": {"id": "u", "status": "completed", "items": []}}}]
        process = MagicMock()
        process.stdin = io.BytesIO()
        process.stdout = io.BytesIO(b"".join((json.dumps(m) + "\n").encode() for m in messages))
        process.poll.return_value = None
        auth = self.root / "auth-home"
        auth.mkdir(exist_ok=True)
        (auth / "auth.json").write_text("{}", encoding="utf8")
        sent = []
        with patch.dict(os.environ, {"CODEX_HOME": str(auth)}):
            with patch.object(self.manager, "_bin", return_value="codex.exe"), \
                    patch("tools.studio_project.agent_bridge.subprocess.Popen", return_value=process), \
                    patch.object(self.manager, "_send", side_effect=lambda _, msg: sent.append(msg)):
                self.manager._run(started["task_id"], {**self.project, "review_task": review})
        return self.manager.task(started["task_id"]), sent

    def test_runs_on_the_vision_role_and_attaches_every_frame(self):
        task, sent = self.run_review(GOOD)
        self.assertEqual((task["kind"], task["role"], task["status"]), ("frame.review", "vision", "COMPLETED"))
        self.assertEqual(task["model"], "gpt-6.1-sol")
        turn = next(m for m in sent if m.get("id") == 3)["params"]
        self.assertEqual(turn["model"], "gpt-6.1-sol")
        self.assertEqual(turn["effort"], "medium")
        self.assertEqual([i["path"] for i in turn["input"] if i["type"] == "localImage"], ["C:/f/a.png", "C:/f/b.png", "C:/f/c.png"])
        self.assertEqual(turn["sandboxPolicy"], {"type": "readOnly"})
        self.assertEqual(json.loads(task["suggestion"])["scenes"][1]["verdict"], "fix")
        self.assertFalse(task["write_applied"])

    def test_an_unusable_reply_fails_the_task_instead_of_passing_it_on(self):
        task, _ = self.run_review('{"scenes": []}')
        self.assertEqual(task["status"], "FAILED")
        self.assertEqual(task["suggestion"], "")

    def test_nothing_to_review_is_refused(self):
        with patch.object(self.manager, "_bin", return_value="not-needed"):
            with self.assertRaises(StudioError):
                self.manager.start_frame_review(self.project["project_id"], {"scenes": []})


if __name__ == "__main__":
    unittest.main()
