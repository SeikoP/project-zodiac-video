import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.studio_project.models import StudioError
from tools.studio_project.pipeline.derive import derive
from tools.studio_project.pipeline.evidence import collect_evidence
from tools.studio_project.pipeline.receipts import receipt_state, write_receipt
from tools.studio_project.pipeline.registry import load_registry
from tools.studio_project.rpc_stdio import handle_line
from tools.studio_project.service import StudioProjectService
from tests.pipeline_fakes import FakeService, TIMING, visual_state, voice_state

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/studio_phase1_synthetic_fixture.mjs"


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-pipeline-")
        self.addCleanup(context.cleanup)
        self.workspace = Path(context.name)

    def graph(self, service, **kw):
        evidence = collect_evidence(service, "p", **kw)
        return {n.node_id: n.status for n in derive(load_registry(), evidence, project_id="p", revision=5).nodes}

    def receipts(self, build_id="b1", **skip):
        for name in ("checks", "assets", "cover", "publish"):
            write_receipt(self.workspace, name, source_hash="h1")
        write_receipt(self.workspace, "inspect", source_hash="h1", build_id=build_id)

    def test_unapproved_content_gives_empty_evidence(self):
        evidence = collect_evidence(FakeService(self.workspace, content="BLOCKED"), "p")
        self.assertFalse(evidence.content_approved)
        self.assertEqual(evidence.scene_ids, ())

    def test_unknown_project_raises(self):
        with self.assertRaises(StudioError) as ctx:
            collect_evidence(FakeService(self.workspace), "missing")
        self.assertEqual(ctx.exception.code, "PROJECT_NOT_FOUND")

    def test_snapshot_errors_become_absent_evidence(self):
        service = FakeService(self.workspace, visual=StudioError("VISUAL_SOURCE_DRIFT"), voice=StudioError("VOICE_X"))
        status = self.graph(service)
        self.assertEqual(status["content"], "DONE")
        self.assertEqual(status["voice"], "READY")
        self.assertEqual(status["build"], "PENDING")

    def test_full_evidence_round_trips_to_done_through_derive(self):
        self.receipts()
        status = self.graph(FakeService(self.workspace, visual=visual_state(), voice=voice_state()))
        self.assertEqual(status["build"], "DONE")
        self.assertEqual(status["inspect"], "DONE")
        self.assertEqual(status["visual_review"], "AWAITING_USER")  # review receipt is user-only, absent
        self.assertEqual(status["export"], "PENDING")

    def test_receipts_go_stale_when_source_hash_changes(self):
        self.receipts()
        status = self.graph(FakeService(self.workspace, visual=visual_state(source_hash="h2"), voice=voice_state()))
        for node in ("checks", "assets", "cover", "publish", "inspect"):
            self.assertEqual(status[node], "STALE", node)

    def test_inspect_receipt_is_bound_to_the_build(self):
        self.receipts(build_id="old")
        self.assertEqual(receipt_state(self.workspace, "inspect", "h1", "b1"), "STALE")

    def test_reselected_voice_stales_the_build(self):
        self.receipts()
        voice = voice_state(timing={"wav_sha256": "w1", "words": [{"text": "changed"}]})
        status = self.graph(FakeService(self.workspace, visual=visual_state(), voice=voice))
        self.assertEqual(status["build"], "STALE")
        self.assertEqual(status["checks"], "DONE")

    def test_running_comes_from_jobs_and_override(self):
        job = {"status": "RUNNING", "scene_id": "s02"}
        status = self.graph(FakeService(self.workspace, visual=visual_state(job=job), voice=voice_state()))
        self.assertEqual(status["scene:s02"], "RUNNING")
        status = self.graph(FakeService(self.workspace, visual=visual_state(), voice=voice_state()), running="visual")
        self.assertEqual(status["visual"], "RUNNING")
        status = self.graph(FakeService(self.workspace, voice=voice_state(job={"status": "RUNNING", "action": "align"})))
        self.assertEqual(status["timing"], "RUNNING")

    def test_failed_overlay_is_passed_through(self):
        status = self.graph(FakeService(self.workspace, voice=voice_state(assembly=None, timing=None)), failed={"voice": "TTS lỗi"})
        self.assertEqual(status["voice"], "FAILED")

    def test_exported_status_maps_to_export_node(self):
        self.receipts()
        service = FakeService(self.workspace, video="EXPORTED", visual=visual_state(), voice=voice_state())
        status = self.graph(service)
        self.assertEqual(status["export"], "DONE")  # technical export exists; human review stays pending
        self.assertEqual(status["visual_review"], "AWAITING_USER")


class RpcTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-pipeline-rpc-")
        self.addCleanup(context.cleanup)
        root = Path(context.name)
        self.service = StudioProjectService(root / "projects")
        archive = root / "approved.zip"
        subprocess.run(["node", str(FIXTURE), str(archive), "valid"], cwd=ROOT, check=True,
                       capture_output=True, encoding="utf-8")
        self.project = self.service.import_capsule(archive)

    def call(self, method, params):
        return handle_line(self.service, json.dumps({"id": "t", "method": method, "params": params}).encode("utf8"))

    def test_pipeline_get_returns_graph_for_imported_project(self):
        out = self.call("pipeline.get", {"project_id": self.project["project_id"]})
        self.assertTrue(out["ok"], out)
        graph = out["result"]
        self.assertEqual(graph["format"], "zodiac-pipeline@1")
        nodes = {n["id"]: n for n in graph["nodes"]}
        self.assertEqual(nodes["content"]["status"], "DONE")
        self.assertEqual(nodes["voice"]["status"], "READY")
        self.assertEqual(nodes["visual_review"]["kind"], "gate")
        self.assertEqual(set(graph["revisions"]), {"visual", "voice"})

    def test_reopening_recovers_persisted_running_autopilot(self):
        from tools.studio_project.pipeline.autopilot import FORMAT, RUN_FILE
        workspace = self.service.registry.get(self.project["project_id"]).workspace
        target = workspace / RUN_FILE
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"format": FORMAT, "run_id": "old", "state": "RUNNING", "log": []}), encoding="utf-8")
        out = self.call("pipeline.get", {"project_id": self.project["project_id"]})
        self.assertTrue(out["ok"], out)
        self.assertEqual(out["result"]["run"]["state"], "IDLE")

    def test_confirming_episode_voice_resumes_only_waiting_voice_gate(self):
        from types import SimpleNamespace
        from unittest.mock import Mock, patch
        from tools.studio_project.rpc_stdio import dispatch
        pilot = Mock(record=SimpleNamespace(state="WAITING_GATE", node="voice_review"))
        voice = Mock()
        voice.confirm.return_value = {"assembly": {"listened": {"kind": "user_listened"}}}
        service = SimpleNamespace(voice=voice)
        params = dict(project_id="p", unit_id="episode", take_id="t", playback_id="play", confirm=True, base_revision=1)
        with patch("tools.studio_project.pipeline.autopilot.autopilot_for", return_value=pilot):
            dispatch(service, "voice.confirm", params)
            pilot.resume_after_gate.assert_called_once_with(background=True)
            pilot.reset_mock()
            dispatch(service, "voice.confirm", {**params, "unit_id": "u1"})
            pilot.resume_after_gate.assert_not_called()

    def test_pipeline_get_unknown_project(self):
        out = self.call("pipeline.get", {"project_id": "missing"})
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "PROJECT_NOT_FOUND")

    def test_pipeline_get_rejects_extra_params(self):
        out = self.call("pipeline.get", {"project_id": self.project["project_id"], "approve": True})
        self.assertEqual(out["error"]["code"], "RPC_PARAMS_INVALID")

    def test_pipeline_get_is_read_only(self):
        before = self.service.events(self.project["project_id"])
        self.call("pipeline.get", {"project_id": self.project["project_id"]})
        self.assertEqual(self.service.events(self.project["project_id"]), before)
        self.assertEqual(self.service.project(self.project["project_id"])["revision"], self.project["revision"])


if __name__ == "__main__":
    unittest.main()
