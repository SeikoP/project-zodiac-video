"""Initial authoring is a proposal; only validated confirmed commands write source."""
import copy
import json
import unittest
from unittest.mock import patch

from tests import test_studio_p34_visual as fixtures
from tools.studio_project.models import StudioError


class AgentAuthoringTests(unittest.TestCase):
    def setUp(self):
        fixtures.VisualWorkspaceTests.setUp(self)
        self.manager = self.service.agent
        raw_voice = patch.object(self.service.voice, "_read", side_effect=lambda _: copy.deepcopy(self.voice))
        raw_voice.start(); self.addCleanup(raw_voice.stop)

    def start(self):
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            return self.manager.start_authoring(self.project, "Diễn rõ hành động và phản ứng.")

    def completed(self):
        task = self.start()
        self.manager._update(task["task_id"], status="COMPLETED", suggestion=json.dumps({"kind": "source.replace", "payload": {"intent": self.intent}}, ensure_ascii=False))
        return task

    def test_initial_proposal_confirm_apply_reopen_and_idempotency(self):
        task = self.completed()
        self.assertEqual(task["kind"], "episode.propose")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])
        for confirm in (False, None):
            with self.assertRaises(StudioError):
                self.manager.apply_suggestion(task["task_id"], confirm=confirm, base_revision=0, command_id="author")
        state = self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="author")
        self.assertEqual(state["intent"], self.intent)
        repeated = self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="author")
        self.assertEqual(repeated["revision"], state["revision"])
        self.assertEqual(self.manager.task(task["task_id"])["applied_command_id"], "author")
        self.assertNotEqual(self.service.project(self.project)["status"]["visual"], "APPROVED")

    def test_existing_intent_and_missing_timing_are_rejected(self):
        self.voice["timing"] = None
        with self.assertRaises(StudioError): self.start()
        self.voice["timing"] = {"wav_sha256": "f" * 64}
        self.visual.command(self.project, "existing", 0, "source.replace", {"intent": self.intent})
        with self.assertRaises(StudioError): self.start()

    def test_voice_and_timing_drift_reject_before_write(self):
        for field in ("assembly", "timing"):
            with self.subTest(field=field):
                original = copy.deepcopy(self.voice)
                task = self.completed()
                self.voice[field]["wav_sha256"] = "e" * 64
                with self.assertRaises(StudioError) as caught:
                    self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="stale-" + field)
                self.assertEqual(caught.exception.code, "AGENT_DEPENDENCIES_CHANGED")
                self.assertIsNone(self.visual.snapshot(self.project)["intent"])
                self.voice = original

    def test_unknown_asset_paths_and_malformed_output_cannot_write(self):
        task = self.completed()
        for path in ("../../outside.svg", "https://example.com/a.svg", "library:props/missing.svg"):
            intent = copy.deepcopy(self.intent)
            intent["assets"]["phone"]["path"] = path
            self.manager._update(task["task_id"], suggestion=json.dumps({"kind": "source.replace", "payload": {"intent": intent}}))
            with self.assertRaises(StudioError):
                self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="bad")
        self.manager._update(task["task_id"], suggestion='{"kind":')
        with self.assertRaises(StudioError):
            self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="bad")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])

    def test_initial_cannot_replace_intent_added_while_agent_runs(self):
        task = self.completed()
        self.visual.command(self.project, "manual", 0, "source.replace", {"intent": self.intent})
        with self.assertRaises(StudioError):
            self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=1, command_id="late")

    def test_voice_change_during_proposal_validation_cannot_commit(self):
        task = self.completed()
        original = self.visual._node
        def changed(*args, **kwargs):
            result = original(*args, **kwargs)
            self.voice["timing"]["duration_seconds"] += 1
            return result
        with patch.object(self.visual, "_node", side_effect=changed), self.assertRaises(StudioError) as caught:
            self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="racing")
        self.assertEqual(caught.exception.code, "AGENT_DEPENDENCIES_CHANGED")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])

    def test_rpc_authoring_contract(self):
        from tools.studio_project.rpc_stdio import dispatch
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            task = dispatch(self.service, "agent.author.start", {"project_id": self.project, "instruction": "Soạn hình ảnh."})
        self.assertEqual(task["kind"], "episode.propose")

    def test_native_board_supports_empty_chat_setup_and_rejects_unreadable_lines(self):
        from tools.studio_project.agent_authoring import board_svg
        self.assertIn(b'<path', board_svg({"title": "Chat", "lines": []}))
        self.assertIn(b'stroke-width="3"', board_svg({"title": "Chat", "lines": ["Hội bạn → Nhân Mã"]}))
        with self.assertRaises(StudioError): board_svg({"title": "Chat", "lines": ["x" * 61]})
        with self.assertRaises(StudioError): board_svg({"title": "Chat", "lines": ["A"] * 5})


if __name__ == "__main__": unittest.main()
