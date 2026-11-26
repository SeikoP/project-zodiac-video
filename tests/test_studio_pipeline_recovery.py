"""After the app is reset the pipeline must still show what the last authoring run did, and offer to continue it."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from tools.studio.artifacts import canonical_hash
from tools.studio_project import agent_authoring
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import agent_runs, autopilot, runner

SUGGESTION = json.dumps({"kind": "source.replace", "payload": {"intent": {"scenes": [{"id": "s01"}]}}})


def run_task(status, **extra):
    return {"task_id": "t1", "kind": "episode.propose", "status": status, "suggestion": SUGGESTION if status == "COMPLETED" else "",
            "write_applied": False, "visual_source_hash": "h1", "dependencies": "dep1", "visual_revision": 3,
            "catalog_hash": canonical_hash(agent_authoring.prompt_catalog()), "started_at": 1, **extra}


def service(*tasks, intent=None):
    applied = []

    class Agent:
        def tasks(self, project_id):
            return list(tasks)

        def apply_suggestion(self, task_id, *, confirm, base_revision, command_id):
            applied.append((task_id, confirm, base_revision, command_id))
            return {"ok": True}

        def task(self, task_id):
            raise StudioError("AGENT_TASK_NOT_FOUND", task_id, "agent")

    visual = SimpleNamespace(snapshot=lambda pid: {"intent": intent, "source_hash": "h1", "revision": 3})
    return SimpleNamespace(agent=Agent(), visual=visual, applied=applied)


def deps(svc):
    return patch.object(agent_authoring, "dependencies", return_value="dep1")


class RecoveryOverlayTests(unittest.TestCase):
    def test_a_failed_run_is_shown_after_a_reset_with_its_reason(self):
        svc = service(run_task("FAILED", error="AGENT_PROPOSAL_INVALID: Cast x: lỗi\n  at stack"))
        running, failed = agent_runs.overlay(svc, "p")
        self.assertEqual(running, None)
        self.assertEqual(failed, {"visual": "AGENT_PROPOSAL_INVALID: Cast x: lỗi"})

    def test_an_interrupted_run_says_it_was_cut_off_and_that_progress_is_kept(self):
        _, failed = agent_runs.overlay(service(run_task("INTERRUPTED")), "p")
        self.assertIn("gián đoạn", failed["visual"])
        self.assertIn("dùng lại", failed["visual"])

    def test_nothing_is_invented_when_there_was_no_run(self):
        self.assertEqual(agent_runs.overlay(service(), "p"), (None, {}))

    def test_a_tracked_run_still_wins_over_history(self):
        svc = service(run_task("FAILED", error="old"))
        svc.agent.task = lambda task_id: {"status": "RUNNING"}
        agent_runs.track(svc, "p", "visual", "t9")
        self.assertEqual(agent_runs.overlay(svc, "p"), ("visual", {}))


class PendingProposalTests(unittest.TestCase):
    def test_a_finished_unapplied_proposal_that_is_still_current_is_pending(self):
        svc = service(run_task("COMPLETED"))
        with deps(svc):
            self.assertEqual(agent_runs.pending_proposal(svc, "p")["task_id"], "t1")
            self.assertIn("Chạy", agent_runs.progress(svc, "p")["visual"])

    def test_it_is_not_pending_when_applied_stale_or_the_episode_already_has_visuals(self):
        with deps(None):
            self.assertIsNone(agent_runs.pending_proposal(service(run_task("COMPLETED", write_applied=True)), "p"))
            self.assertIsNone(agent_runs.pending_proposal(service(run_task("COMPLETED", visual_source_hash="old")), "p"))
            self.assertIsNone(agent_runs.pending_proposal(service(run_task("COMPLETED", catalog_hash="old")), "p"))
            self.assertIsNone(agent_runs.pending_proposal(service(run_task("COMPLETED"), intent={"scenes": []}), "p"))
        with patch.object(agent_authoring, "dependencies", return_value="changed-voice"):
            self.assertIsNone(agent_runs.pending_proposal(service(run_task("COMPLETED")), "p"))


class ContinueInsteadOfRestartTests(unittest.TestCase):
    def ctx(self, svc):
        return runner.RunContext(svc, "p", "visual", "visual", None, 3, {})

    def test_run_applies_the_finished_proposal_instead_of_authoring_again(self):
        svc = service(run_task("COMPLETED"))
        started = []
        svc.agent.start_authoring_chain = lambda *a, **k: started.append(1)
        with deps(svc):
            runner._EXECUTORS["agent.author.start"](self.ctx(svc))
        self.assertEqual(started, [])
        self.assertEqual(svc.applied[0][:3], ("t1", True, 3))

    def test_run_authors_again_when_there_is_nothing_to_continue(self):
        svc = service(run_task("FAILED"))
        started = []
        svc.agent.start_authoring_chain = lambda *a, **k: started.append(1) or {"task_id": "n"}
        with deps(svc):
            runner._EXECUTORS["agent.author.start"](self.ctx(svc))
        self.assertEqual((started, svc.applied), ([1], []))

    def test_a_proposal_that_can_no_longer_be_applied_falls_back_to_authoring(self):
        svc = service(run_task("COMPLETED"))
        started = []
        svc.agent.start_authoring_chain = lambda *a, **k: started.append(1) or {"task_id": "n"}
        svc.agent.apply_suggestion = lambda *a, **k: (_ for _ in ()).throw(StudioError("REVISION_CONFLICT", "stale", "agent"))
        with deps(svc):
            runner._EXECUTORS["agent.author.start"](self.ctx(svc))
        self.assertEqual(started, [1])


class AutopilotContinuesTests(unittest.TestCase):
    def test_the_autopilot_submits_the_finished_proposal_without_a_new_run(self):
        svc = service(run_task("COMPLETED"))
        spec = SimpleNamespace(id="visual")
        with deps(svc):
            items = autopilot.default_agent(svc, "p", "visual", spec, "", 1)
        self.assertEqual(items[0]["kind"], "visual.intent")
        self.assertEqual(items[0]["payload"]["payload"]["intent"], {"scenes": [{"id": "s01"}]})
        self.assertEqual(items[0]["voice_dependencies"], "dep1")


if __name__ == "__main__":
    unittest.main()
