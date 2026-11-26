import tempfile
import unittest
from pathlib import Path

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline.receipts import write_receipt
from tools.studio_project.pipeline.runner import cancel_running, register_executor, run_node


class RunnerTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-pipeline-run-")
        self.addCleanup(context.cleanup)
        self.workspace = Path(context.name)

    def service(self, **kw):
        kw.setdefault("visual", visual_state(build=None))
        kw.setdefault("voice", voice_state())
        return FakeService(self.workspace, **kw)

    def ready_for_scenes(self):
        for name in ("checks", "assets"):
            write_receipt(self.workspace, name, source_hash="h1")

    def code(self, service, node, caller="gui", base=5):
        with self.assertRaises(StudioError) as ctx:
            run_node(service, "p", node, base, caller=caller)
        return ctx.exception

    def test_gate_node_refused(self):
        service = self.service()
        error = self.code(service, "voice_review")
        self.assertEqual(error.code, "PIPELINE_GATE_USER_ONLY")
        self.assertEqual(service.calls, [])

    def test_agent_caller_refused(self):
        service = self.service()
        error = self.code(service, "voice", caller="agent")
        self.assertEqual(error.code, "PIPELINE_GATE_USER_ONLY")
        self.assertEqual(service.calls, [])

    def test_unready_input_refused_names_first_input(self):
        service = self.service(voice=voice_state(assembly=None, timing=None))
        error = self.code(service, "timing")
        self.assertEqual(error.code, "PIPELINE_INPUT_NOT_READY")
        self.assertIn("voice", error.message)
        self.assertEqual(service.calls, [])

    def test_unknown_node(self):
        self.assertEqual(self.code(self.service(), "ghost").code, "PIPELINE_NODE_UNKNOWN")

    def test_busy_refused(self):
        self.ready_for_scenes()
        service = self.service(visual=visual_state(build=None, job={"status": "RUNNING", "scene_id": "s02"}))
        error = self.code(service, "scene:s01")
        self.assertEqual(error.code, "PIPELINE_BUSY")
        self.assertEqual(service.calls, [])

    def test_blocked_when_content_not_approved(self):
        error = self.code(self.service(content="BLOCKED"), "voice")
        self.assertEqual(error.code, "PIPELINE_NODE_BLOCKED")

    def test_scene_node_calls_scene_compile_with_scene_id(self):
        self.ready_for_scenes()
        service = self.service()
        result = run_node(service, "p", "scene:s02", 5, caller="gui")
        self.assertEqual(service.calls, [("visual.start", ("p", 5, "s02"), {})])
        self.assertEqual(result["format"], "zodiac-pipeline@1")

    def test_build_node_calls_episode_build_with_base_revision(self):
        self.ready_for_scenes()
        service = self.service(visual=visual_state())  # every scene already built: a full rebuild is allowed
        run_node(service, "p", "build", 5, caller="autopilot")
        self.assertEqual(service.calls, [("visual.start", ("p", 5), {})])

    def test_stale_scene_blocks_build_until_recompiled(self):
        self.ready_for_scenes()
        service = self.service(voice=voice_state(timing={"wav_sha256": "w1", "words": [{"text": "đổi"}]}))
        error = self.code(service, "build")
        self.assertEqual(error.code, "PIPELINE_INPUT_NOT_READY")
        self.assertIn("scene:s01", error.message)

    def test_export_requires_the_user_review_gate(self):
        for name in ("checks", "assets", "cover", "publish"):
            write_receipt(self.workspace, name, source_hash="h1")
        write_receipt(self.workspace, "inspect", source_hash="h1", build_id="b1")
        service = self.service(visual=visual_state())
        # export needs the visual_review gate; it is user-only and absent, so the run is refused
        self.assertEqual(self.code(service, "export").code, "PIPELINE_INPUT_NOT_READY")

    def test_voice_generates_then_assembles(self):
        service = self.service(voice=voice_state(assembly=None, timing=None,
                                                 units=[{"id": "u1", "selected_take": None, "takes": []}]), visual=None)
        run_node(service, "p", "voice", 5, caller="gui")
        self.assertEqual(service.calls, [("voice.start", ("p", "generate", ["u1"], "Hải Đăng", "NORMAL", {}, 4), {})])
        service = self.service(voice=voice_state(assembly=None, timing=None), visual=None)
        run_node(service, "p", "voice", 5, caller="gui")
        self.assertEqual(service.calls, [("voice.assemble", ("p", 4), {})])

    def test_voice_repairs_only_missing_or_invalid_selected_takes(self):
        voice = voice_state(assembly=None, timing=None, units=[
            {"id": "good", "selected_take": "t1", "takes": [{"take_id": "t1", "valid": True}]},
            {"id": "broken", "selected_take": "t2", "takes": [{"take_id": "t2", "valid": False}]},
        ])
        service = self.service(voice=voice, visual=None)
        run_node(service, "p", "voice", 5, caller="gui")
        self.assertEqual(service.calls[0][0], "voice.start")
        self.assertEqual(service.calls[0][1][2], ["broken"])

    def test_timing_aligns_with_live_voice_revision(self):
        service = self.service(voice=voice_state(timing=None))
        run_node(service, "p", "timing", 99, caller="gui")  # client base_revision is visual-domain, ignored here
        self.assertEqual(service.calls, [("voice.start", ("p", "align", [], "Hải Đăng", "NORMAL", {}, 4), {})])

    def test_visual_authoring_tracks_agent_task_as_running(self):
        service = self.service(visual=visual_state(intent=None, build=None, source_hash=None))
        result = run_node(service, "p", "visual", 5, caller="gui")
        self.assertEqual(service.calls[0][0], "agent.start_authoring_chain")
        status = {n["id"]: n["status"] for n in result["nodes"]}
        self.assertEqual(status["visual"], "RUNNING")

    def test_unregistered_executor_is_reported_not_faked(self):
        service = self.service()
        write_receipt(self.workspace, "checks", source_hash="h1")
        error = self.code(service, "cover", caller="autopilot")
        self.assertEqual(error.code, "PIPELINE_EXECUTOR_UNAVAILABLE")
        self.assertEqual(service.calls, [])

    def test_registered_executor_is_dispatched(self):
        seen = []
        register_executor("agent.cover.start", lambda ctx: seen.append((ctx.node_id, ctx.project_id)) or {"task_id": "t9"})
        self.addCleanup(register_executor, "agent.cover.start", None)
        write_receipt(self.workspace, "checks", source_hash="h1")
        run_node(self.service(), "p", "cover", 5, caller="autopilot")
        self.assertEqual(seen, [("cover", "p")])

    def test_cancel_dispatches_to_the_running_domain(self):
        service = self.service(visual=visual_state(job={"status": "RUNNING", "scene_id": None}))
        cancel_running(service, "p")
        self.assertEqual(service.calls, [("visual.cancel", ("p",), {})])
        service = self.service(voice=voice_state(job={"status": "RUNNING", "action": "generate"}))
        cancel_running(service, "p")
        self.assertEqual(service.calls, [("voice.cancel", ("p",), {})])

    def test_cancel_without_running_node_is_a_typed_error(self):
        with self.assertRaises(StudioError) as ctx:
            cancel_running(self.service(), "p")
        self.assertEqual(ctx.exception.code, "PIPELINE_NOTHING_RUNNING")


if __name__ == "__main__":
    unittest.main()
