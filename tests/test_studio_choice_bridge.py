"""Structured menu choices through the Codex bridge: outputSchema is sent and a violating reply fails the task."""
import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch

import tests.test_studio_p1_agent as base
from tools.studio_project import authoring_menus
from tools.studio_project.models import StudioError

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["frame_id", "items"],
          "properties": {"frame_id": {"type": "string", "enum": ["a", "b"]},
                         "items": {"type": "array", "maxItems": 2,
                                   "items": {"type": "object", "additionalProperties": False, "required": ["id"],
                                             "properties": {"id": {"type": "string", "enum": ["x", "y"]}}}}}}
GOOD = json.dumps({"frame_id": "a", "items": [{"id": "x"}]})


class SchemaCheckTests(unittest.TestCase):
    def check(self, value):
        return authoring_menus.schema_errors(value, SCHEMA)

    def test_valid_value_has_no_errors(self):
        self.assertEqual(self.check(json.loads(GOOD)), [])

    def test_each_kind_of_violation_is_named(self):
        self.assertTrue(self.check({"frame_id": "c", "items": []}))                       # enum
        self.assertTrue(self.check({"items": []}))                                          # required
        self.assertTrue(self.check({"frame_id": "a", "items": [], "extra": 1}))           # additionalProperties
        self.assertTrue(self.check({"frame_id": "a", "items": [{"id": "x"}] * 3}))        # maxItems
        self.assertTrue(self.check({"frame_id": "a", "items": [{"id": "z"}]}))            # nested enum
        self.assertTrue(self.check({"frame_id": "a", "items": "x"}))                        # type
        self.assertTrue(self.check([]))                                                     # root type


class ChoiceBridgeTests(unittest.TestCase):
    setUp = base.AgentTests.setUp

    def run_choice(self, reply):
        with patch.object(self.manager, "_bin", return_value="not-needed"), patch.object(self.manager, "_run", return_value=None):
            started = self.manager.start_choice(self.project["project_id"], SCHEMA, {"scene_id": "s01"})
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
        task = self.manager.task(started["task_id"])
        with patch.dict(os.environ, {"CODEX_HOME": str(auth)}):
            with patch.object(self.manager, "_bin", return_value="codex.exe"), \
                    patch("tools.studio_project.agent_bridge.subprocess.Popen", return_value=process), \
                    patch.object(self.manager, "_send", side_effect=lambda _, msg: sent.append(msg)):
                self.manager._run(started["task_id"], {**self.project, "choice_task": task["choice_task"]})
        return self.manager.task(started["task_id"]), sent

    def test_turn_start_carries_the_output_schema_on_the_creative_role(self):
        task, sent = self.run_choice(GOOD)
        turn = next(m for m in sent if m.get("id") == 3)["params"]
        self.assertEqual(turn["outputSchema"], SCHEMA)
        self.assertEqual((task["kind"], task["role"], task["model"]), ("scene.choice", "creative", "gpt-6-luna"))
        self.assertEqual(turn["model"], "gpt-6-luna")
        self.assertEqual(task["status"], "COMPLETED")
        self.assertEqual(task["suggestion"], GOOD)
        self.assertFalse(task["write_applied"])

    def test_a_reply_that_violates_the_schema_fails_the_task(self):
        task, _ = self.run_choice(json.dumps({"frame_id": "zzz", "items": []}))
        self.assertEqual(task["status"], "FAILED")
        self.assertEqual(task["suggestion"], "")
        self.assertIn("frame_id", task["error"])

    def test_a_reply_that_is_not_json_fails_the_task(self):
        task, _ = self.run_choice("sure, here you go")
        self.assertEqual(task["status"], "FAILED")

    def test_an_invalid_schema_is_refused_before_starting(self):
        with patch.object(self.manager, "_bin", return_value="not-needed"):
            with self.assertRaises(StudioError):
                self.manager.start_choice(self.project["project_id"], {}, {})


if __name__ == "__main__":
    unittest.main()
