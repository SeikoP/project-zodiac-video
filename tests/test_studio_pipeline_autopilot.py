import inspect
import json
import tempfile
import unittest
from pathlib import Path

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import autopilot as autopilot_module
from tools.studio_project.pipeline import proposals
from tools.studio_project.pipeline.autopilot import Autopilot
from tools.studio_project.pipeline.validators import LAST_REPORT

ORDER = [("content", "gate"), ("voice", "step"), ("voice_review", "gate"), ("timing", "step"), ("visual", "step"),
         ("checks", "step"), ("assets", "step"), ("cover", "step"), ("publish", "step"), ("build", "step"),
         ("inspect", "step"), ("visual_review", "gate"), ("export", "step")]


class World:
    """Scripted pipeline: node statuses plus fake run/agent/submit seams that evolve them."""

    def __init__(self, workspace):
        self.workspace = workspace
        self.status = {n: ("DONE" if n == "content" else "PENDING") for n, _ in ORDER}
        self.kind = dict(ORDER)
        self.runs, self.agent_calls, self.submits, self.cancelled = [], [], [], 0
        self.submit_kwargs = []
        self.checks_script = []  # list of issue-lists; empty list means pass
        self.agent_script = []   # per agent call: list of {"kind","payload"} or exception
        self.apply_ok = True
        self._settle()

    def _settle(self):
        """READY = first non-done node whose inputs (previous nodes in order) are done or awaiting."""
        prev_done = True
        for name, kind in ORDER:
            if self.status[name] in ("RUNNING", "FAILED"):
                prev_done = False
                continue
            if self.status[name] == "DONE":
                continue
            if not prev_done:
                self.status[name] = "PENDING"
            elif kind == "gate":
                self.status[name] = "AWAITING_USER" if name != "content" else "BLOCKED"
                prev_done = False
            else:
                if self.status[name] in ("PENDING", "STALE"):
                    self.status[name] = "READY" if self.status[name] == "PENDING" else "STALE"
                prev_done = False

    def graph(self, service, project_id):
        return {"nodes": [{"id": n, "kind": k, "status": self.status[n], "title": n, "detail": "", "scene_id": None, "inputs": []}
                          for n, k in ORDER], "revisions": {"visual": 5, "voice": 4}, "revision": 5}

    def run(self, service, project_id, node_id, base_revision, *, caller):
        assert caller == "autopilot"
        self.runs.append(node_id)
        if node_id == "checks":
            issues = self.checks_script.pop(0) if self.checks_script else []
            target = self.workspace / LAST_REPORT
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps({"ok": not issues, "issues": issues, "receipt_sha256": "r"}), "utf-8")
            if not issues:
                self.status["checks"] = "DONE"
        else:
            self.status[node_id] = "DONE"  # synchronous completion is enough for scheduling tests
        self._settle()

    def agent(self, service, project_id, node_id, spec, context_text, attempt):
        self.agent_calls.append((node_id, attempt, context_text))
        default = {"visual": "visual.intent", "checks": "visual.intent", "assets": "assets.select", "cover": "cover.design",
                   "publish": "publish.copy", "inspect": "inspect.report"}[node_id]
        step = self.agent_script.pop(0) if self.agent_script else [{"kind": default, "payload": {}}]
        if isinstance(step, Exception):
            raise step
        return step

    def submit(self, service, project_id, kind, payload, base_revision, command_id, **kwargs):
        self.submits.append((kind, command_id))
        self.submit_kwargs.append(kwargs)
        if not self.apply_ok:
            return {"applied": False, "waiting": False, "issues": [{"code": "PROPOSAL_ASSET_DANGLING", "owner": "visual-intent",
                                                                     "scene_id": None, "message": "x", "repair_group": "visual-intent"}]}
        node = {"visual.intent": "visual", "cover.design": "cover", "publish.copy": "publish", "inspect.report": "inspect",
                "assets.select": "assets"}[kind]
        self.status[node] = "DONE"
        self._settle()
        return {"applied": True, "waiting": False, "issues": [], "result": {}}

    def cancel(self, service, project_id):
        self.cancelled += 1


class AutopilotCase(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix="zodiac-autopilot-")
        self.addCleanup(tmp.cleanup)
        self.workspace = Path(tmp.name)
        self.service = FakeService(self.workspace, visual=visual_state(), voice=voice_state())
        proposals.set_mode(self.workspace, "autopilot")
        self.world = World(self.workspace)
        self.pilot = self.make()

    def make(self):
        w = self.world
        return Autopilot(self.service, "p", graph=w.graph, run=w.run, agent=w.agent, submit=w.submit, cancel=w.cancel,
                         sleep=lambda s: None)

    def drive(self, limit=40):
        for _ in range(limit):
            record = self.pilot.step()
            if record.state != "RUNNING":
                return record
        self.fail("autopilot did not settle")


class SchedulingTests(AutopilotCase):
    def test_agent_timeout_cancels_owned_task(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        self.service._pipeline_autopilots = {"p": self.pilot}
        with patch("tools.studio_project.agent_authoring.capsule", return_value={}), patch.object(
                autopilot_module.time, "time", side_effect=[0, 10000]), patch.object(
                self.service.agent, "cancel") as cancel:
            with self.assertRaises(StudioError) as caught:
                autopilot_module.default_agent(self.service, "p", "visual", SimpleNamespace(id="visual"), "", 1)
        self.assertEqual(caught.exception.code, "AGENT_TIMEOUT")
        cancel.assert_called_once_with("task-1")

    def test_switching_to_confirm_pauses_before_next_node(self):
        self.pilot.start(5)
        proposals.set_mode(self.workspace, "confirm")
        record = self.pilot.step()
        self.assertEqual(self.world.runs, [])
        self.assertEqual(record.state, "WAITING_USER")

    def test_stop_while_preparing_agent_context_prevents_launch(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        self.service._pipeline_autopilots = {"p": self.pilot}
        self.pilot.start(5)
        def capsule(*args, **kwargs):
            self.pilot.stop()
            return {}
        with patch("tools.studio_project.agent_authoring.capsule", side_effect=capsule), patch.object(
                self.service.agent, "start_authoring_chain", side_effect=AssertionError("launched after stop")):
            with self.assertRaises(StudioError) as caught:
                autopilot_module.default_agent(self.service, "p", "visual", SimpleNamespace(id="visual"), "", 1)
        self.assertEqual(caught.exception.code, "AGENT_CANCELLED")

    def test_new_run_has_new_command_identity(self):
        first = self.pilot.start(5).run_id
        self.pilot.stop()
        self.assertNotEqual(self.pilot.start(5).run_id, first)

    def test_confirm_mode_does_not_resume_automatically(self):
        self.pilot.start(5)
        self.drive()
        proposals.set_mode(self.workspace, "confirm")
        self.assertEqual(self.pilot.resume_after_gate().state, "WAITING_GATE")

    def test_stop_during_graph_read_does_not_launch_work(self):
        graph = self.pilot._graph
        self.pilot.start(5)
        def stop_graph(*args):
            self.pilot.stop()
            return graph(*args)
        self.pilot._graph = stop_graph
        self.pilot.step()
        self.assertEqual(self.world.runs, [])

    def test_agent_result_is_not_rebased_over_new_revision(self):
        for name in ("voice", "voice_review", "timing"):
            self.world.status[name] = "DONE"
        self.world._settle()
        graph = self.world.graph
        current = [5]
        self.pilot._graph = lambda *args: {**graph(*args), "revision": current[0]}
        def agent(*args):
            current[0] = 6
            return [{"kind": "visual.intent", "payload": {}}]
        self.pilot._agent = agent
        self.pilot.start(5)
        self.pilot.step()
        self.assertEqual(self.world.submits, [])
        self.assertEqual(self.pilot.record.state, "WAITING_USER")

    def test_repeated_start_keeps_attempt_budget(self):
        self.pilot.start(5)
        self.pilot._attempts["voice"] = 1
        first = self.pilot.record
        self.pilot.start(5)
        self.assertIs(self.pilot.record, first)
        self.assertEqual(self.pilot._attempts["voice"], 1)

    def test_stop_during_agent_does_not_apply_or_resume(self):
        for name in ("voice", "voice_review", "timing"):
            self.world.status[name] = "DONE"
        self.world._settle()
        def agent(*args):
            self.pilot.stop()
            return [{"kind": "visual.intent", "payload": {}}]
        self.pilot._agent = agent
        self.pilot.start(5)
        self.pilot.step()
        self.assertEqual(self.world.submits, [])
        self.assertEqual(self.pilot.record.state, "STOPPED")

    def test_runs_nodes_in_order_until_first_gate(self):
        self.pilot.start(5)
        record = self.drive()
        self.assertEqual(self.world.runs, ["voice"])
        self.assertEqual(record.state, "WAITING_GATE")
        self.assertEqual(record.needs_you[0].node_id, "voice_review")
        self.assertEqual(record.needs_you[0].kind, "gate")

    def test_resumes_after_gate_confirmed(self):
        self.pilot.start(5)
        self.drive()
        self.world.status["voice_review"] = "DONE"
        self.world._settle()
        self.pilot.resume_after_gate()
        record = self.drive()
        self.assertEqual(self.world.runs, ["voice", "timing", "checks", "build"])
        self.assertEqual(record.state, "WAITING_GATE")
        self.assertEqual(record.needs_you[0].node_id, "visual_review")

    def test_edit_after_gate_stops_again(self):
        self.pilot.start(5)
        self.drive()
        self.world.status["voice_review"] = "DONE"
        self.world._settle()
        self.pilot.resume_after_gate()
        self.drive()
        # the user edits: an upstream node goes stale and the review gate must be asked again
        self.world.status.update(visual_review="DONE")
        self.world.status["assets"] = "STALE"
        self.world.status["visual_review"] = "PENDING"
        self.world._settle()
        self.pilot.resume_after_gate()
        record = self.drive()
        self.assertEqual(record.state, "WAITING_GATE")
        self.assertEqual(record.needs_you[0].node_id, "visual_review")

    def test_content_gate_not_approved_waits_for_user(self):
        self.world.status["content"] = "BLOCKED"
        self.world._settle()
        self.pilot.start(5)
        record = self.drive()
        self.assertEqual(record.state, "WAITING_GATE")
        self.assertEqual(record.needs_you[0].node_id, "content")
        self.assertEqual(self.world.runs, [])

    def test_never_calls_gate_confirm_or_runs_a_gate(self):
        self.pilot.start(5)
        self.drive()
        self.assertNotIn("voice_review", self.world.runs)
        source = inspect.getsource(autopilot_module)
        for word in ("gate_confirm", "gate.confirm", "confirm_gate", "write_review"):
            self.assertNotIn(word, source)

    def test_all_done_reports_done(self):
        for name in self.world.status:
            self.world.status[name] = "DONE"
        self.pilot.start(5)
        self.assertEqual(self.drive().state, "DONE")

    def test_busy_node_is_waited_for_not_restarted(self):
        self.world.status["voice"] = "RUNNING"
        self.pilot.start(5)
        record = self.pilot.step()
        self.assertEqual((record.state, record.node), ("RUNNING", "voice"))
        self.assertEqual(self.world.runs, [])

    def test_start_requires_autopilot_mode(self):
        proposals.set_mode(self.workspace, "confirm")
        with self.assertRaises(StudioError) as ctx:
            self.pilot.start(5)
        self.assertEqual(ctx.exception.code, "PIPELINE_MODE_CONFIRM")

    def test_unexpected_error_surfaces_as_needs_you(self):
        def boom(*a, **k):
            raise RuntimeError("disk exploded")
        self.world.run = boom
        pilot = self.make()
        pilot.start(5)
        record = None
        for _ in range(5):
            record = pilot.step()
            if record.state != "RUNNING":
                break
        self.assertEqual(record.state, "WAITING_USER")
        self.assertEqual(record.needs_you[0].kind, "failed")
        self.assertIn("disk exploded", record.needs_you[0].detail)


class AgentAndRepairTests(AutopilotCase):
    def at_checks(self):
        for name in ("voice", "voice_review", "timing", "visual"):
            self.world.status[name] = "DONE"
        self.world._settle()
        self.pilot.start(5)

    def test_repair_loop_uses_issues_then_succeeds_on_second_attempt(self):
        self.at_checks()
        issue = {"code": "PASSIVE_STORYTELLING", "owner": "visual-intent", "scene_id": "s02", "message": "passive", "repair_group": "visual-intent:s02"}
        self.world.checks_script = [[issue], []]
        self.world.agent_script = [[{"kind": "visual.intent", "payload": {}}]]
        self.drive()
        repairs = [c for c in self.world.agent_calls if c[0] == "checks"]
        self.assertEqual(len(repairs), 1)
        node, attempt, context_text = repairs[0]
        self.assertEqual((node, attempt), ("checks", 1))
        self.assertIn("PASSIVE_STORYTELLING", context_text)
        self.assertEqual(self.world.status["checks"], "DONE")

    def test_voice_fingerprint_from_the_agent_reaches_the_atomic_apply(self):
        self.at_checks()
        issue = {"code": "PASSIVE_STORYTELLING", "owner": "visual-intent", "scene_id": "s02", "message": "passive", "repair_group": "visual-intent:s02"}
        self.world.checks_script = [[issue], []]
        self.world.agent_script = [[{"kind": "visual.intent", "payload": {}, "voice_dependencies": "fp-captured-with-the-capsule"}]]
        self.drive()
        self.assertEqual(self.world.submit_kwargs[0], {"voice_dependencies": "fp-captured-with-the-capsule"})  # later steps submit without one

    def test_repair_budget_exhausted_marks_failed_and_lists_issues(self):
        self.at_checks()
        issue = {"code": "PASSIVE_STORYTELLING", "owner": "visual-intent", "scene_id": "s02", "message": "passive", "repair_group": "visual-intent:s02"}
        self.world.checks_script = [[issue]] * 5
        self.world.agent_script = [[{"kind": "visual.intent", "payload": {}}]] * 5
        record = self.drive()
        self.assertEqual(len(self.world.agent_calls), 2)  # checks.max_attempts == 2, never more
        self.assertEqual(record.state, "WAITING_USER")
        need = record.needs_you[0]
        self.assertEqual((need.node_id, need.kind), ("checks", "failed"))
        self.assertEqual(need.issues[0].code, "PASSIVE_STORYTELLING")

    def test_upstream_block_waits_for_user_without_agent_call(self):
        self.at_checks()
        self.world.checks_script = [[{"code": "STORY_VISUAL_DECISION", "owner": "phase1", "scene_id": None, "message": "missing", "repair_group": "phase1"}]]
        record = self.drive()
        self.assertEqual(self.world.agent_calls, [])
        self.assertEqual(record.state, "WAITING_USER")
        self.assertEqual(record.needs_you[0].kind, "blocked")
        self.assertEqual(record.needs_you[0].issues[0].owner, "phase1")

    def test_invalid_proposal_feeds_issues_into_next_attempt(self):
        self.at_checks()
        self.world.status["checks"] = "DONE"
        self.world.status["assets"] = "READY"
        self.world.apply_ok = False
        self.world.agent_script = [[{"kind": "assets.select", "payload": {}}], [{"kind": "assets.select", "payload": {}}]]
        record = self.drive()
        self.assertEqual(len(self.world.agent_calls), 2)
        self.assertIn("PROPOSAL_ASSET_DANGLING", self.world.agent_calls[1][2])
        self.assertEqual((record.state, record.needs_you[0].kind), ("WAITING_USER", "failed"))

    def test_agent_error_counts_as_an_attempt(self):
        self.at_checks()
        self.world.status["checks"] = "DONE"
        self.world.status["assets"] = "READY"
        self.world.agent_script = [StudioError("AGENT_UNAVAILABLE", "no codex", "agent")] * 3
        record = self.drive()
        self.assertEqual(len(self.world.agent_calls), 2)
        self.assertEqual(record.needs_you[0].issues[0].code, "AGENT_UNAVAILABLE")

    def test_assets_node_writes_its_receipt_after_applying(self):
        from tools.studio_project.pipeline.receipts import read_receipt
        self.at_checks()
        self.world.status["checks"] = "DONE"
        self.world.status["assets"] = "READY"
        self.world.agent_script = [[{"kind": "assets.select", "payload": {}}]]
        self.drive()
        self.assertEqual(read_receipt(self.workspace, "assets")["source_hash"], "h1")


class LifecycleTests(AutopilotCase):
    def test_restart_recovers_running_to_ready(self):
        self.pilot.start(5)
        self.assertEqual(self.pilot.record.state, "RUNNING")
        reopened = self.make()
        self.assertEqual(reopened.record.state, "IDLE")
        self.assertTrue(any("restart" in line.text for line in reopened.record.log))
        reopened.start(5)
        self.assertEqual(reopened.record.state, "RUNNING")

    def test_waiting_state_survives_restart(self):
        self.pilot.start(5)
        self.drive()
        self.assertEqual(self.make().record.state, "WAITING_GATE")

    def test_stop_cancels_running_job_and_keeps_done_nodes(self):
        self.world.status["voice"] = "RUNNING"
        self.pilot.start(5)
        record = self.pilot.stop()
        self.assertEqual(record.state, "STOPPED")
        self.assertEqual(self.world.cancelled, 1)
        self.assertEqual(self.world.status["content"], "DONE")
        self.assertEqual(self.pilot.step().state, "STOPPED")  # stays stopped; no new work scheduled
        self.assertEqual(self.world.runs, [])

    def test_stop_with_nothing_running_is_fine(self):
        def nothing(service, project_id):
            raise StudioError("PIPELINE_NOTHING_RUNNING", "idle", "pipeline")
        self.world.cancel = nothing
        pilot = self.make()
        pilot.start(5)
        self.assertEqual(pilot.stop().state, "STOPPED")

    def test_run_record_persisted_atomically_as_json(self):
        self.pilot.start(5)
        data = json.loads((self.workspace / ".runtime/pipeline/run.json").read_text("utf-8"))
        self.assertEqual(data["state"], "RUNNING")
        self.assertEqual(data["format"], "zodiac-pipeline-run@1")

    def test_background_thread_runs_to_the_first_gate(self):
        self.pilot.start(5, background=True)
        self.pilot.join(timeout=5)
        self.assertEqual(self.pilot.record.state, "WAITING_GATE")


class RpcTests(AutopilotCase):
    def test_rpc_start_requires_autopilot_mode_and_stop_returns_record(self):
        from tools.studio_project.rpc_stdio import dispatch
        proposals.set_mode(self.workspace, "confirm")
        with self.assertRaises(StudioError):
            dispatch(self.service, "pipeline.autopilot.start", {"project_id": "p", "base_revision": 5})
        stopped = dispatch(self.service, "pipeline.autopilot.stop", {"project_id": "p"})
        self.assertEqual(stopped["state"], "STOPPED")

    def test_pipeline_get_returns_run_record(self):
        from tools.studio_project.pipeline.api import pipeline_get
        from tools.studio_project.rpc_stdio import dispatch
        dispatch(self.service, "pipeline.autopilot.stop", {"project_id": "p"})
        self.assertEqual(pipeline_get(self.service, "p")["run"]["state"], "STOPPED")


if __name__ == "__main__":
    unittest.main()
