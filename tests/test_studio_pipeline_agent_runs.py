import unittest
from types import SimpleNamespace

from tools.studio_project.pipeline import agent_runs


def service(task):
    box = dict(task)
    return SimpleNamespace(box=box, agent=SimpleNamespace(task=lambda task_id: box))


class AgentRunOverlayTests(unittest.TestCase):
    def test_failure_stays_visible_until_the_node_runs_again(self):
        failed = service({"status": "FAILED", "error": "VISUAL_BUILD_BLOCKED: cannot bind\n    at stack frame"})
        agent_runs.track(failed, "p", "visual", "t1")
        for _ in range(3):  # every poll, not just the first
            self.assertEqual(agent_runs.overlay(failed, "p"), (None, {"visual": "VISUAL_BUILD_BLOCKED: cannot bind"}))
        failed.box.update(status="RUNNING", error=None)  # run again: a new task replaces the failure
        agent_runs.track(failed, "p", "visual", "t2")
        self.assertEqual(agent_runs.overlay(failed, "p"), ("visual", {}))

    def test_completed_task_is_forgotten(self):
        done = service({"status": "COMPLETED"})
        agent_runs.track(done, "p", "visual", "t1")
        self.assertEqual(agent_runs.overlay(done, "p"), (None, {}))
        self.assertIsNone(agent_runs.tracked(done, "p"))

    def test_failure_messages_are_plain_vietnamese(self):
        self.assertIn("quá thời gian", agent_runs.friendly_error("Codex task exceeded time limit"))
        self.assertIn("bị hỏng", agent_runs.friendly_error("Expecting ',' delimiter: line 1 column 16924"))
        self.assertIn("quá dài", agent_runs.friendly_error("AGENT_PROPOSAL_INVALID: STORY_VISUAL_ART_INVALID text_overflow: 'x'"))
        self.assertEqual(agent_runs.friendly_error("Lạ" + chr(10) + "dòng hai"), "Lạ")

    def test_running_task_reports_attempt_and_elapsed_minutes(self):
        import time
        running = service({"status": "RUNNING", "started_at": time.time() - 200, "validation_attempts": [{}]})
        agent_runs.track(running, "p", "visual", "t")
        self.assertEqual(agent_runs.progress(running, "p"), {"visual": "lượt 2/3 · 3 phút"})

    def test_unapplied_completed_proposal_is_announced_until_applied(self):
        done = service({"status": "COMPLETED", "suggestion": "{}", "write_applied": False})
        agent_runs.track(done, "p", "visual", "t")
        self.assertEqual(agent_runs.overlay(done, "p"), (None, {}))
        self.assertIn("Áp dụng", agent_runs.progress(done, "p")["visual"])
        done.box["write_applied"] = True
        self.assertEqual(agent_runs.progress(done, "p"), {})
        agent_runs.overlay(done, "p")
        self.assertIsNone(agent_runs.tracked(done, "p"))

    def test_scene_by_scene_progress_counts_finished_scenes(self):
        import time
        running = service({"status": "RUNNING", "started_at": time.time() - 30, "parts_total": 8,
                           "parts": [{"id": "skeleton", "status": "DONE"}, {"id": "s01", "status": "DONE"}, {"id": "s02", "status": "RUNNING"}, {"id": "s03", "status": "RUNNING"}]})
        agent_runs.track(running, "p", "visual", "t")
        self.assertEqual(agent_runs.progress(running, "p"), {"visual": "1/8 cảnh xong · 2 agent"})


if __name__ == "__main__":
    unittest.main()
