"""Which edits may drop the listening approval, and does the snapshot say why."""
import unittest

import tests.test_studio_p2_voice_lab as fixture
from tools.studio_project.service import StudioProjectService


class ApprovalMatrixTests(unittest.TestCase):
    # Reuse the real voice-lab fixture without re-running its own tests.
    setUp = fixture.VoiceLabTests.setUp
    generate = fixture.VoiceLabTests.generate
    state = fixture.VoiceLabTests.state
    wait = fixture.VoiceLabTests.wait
    create = fixture.VoiceLabTests.create
    listened = fixture.VoiceLabTests.listened

    def approved(self):
        state = self.create()
        state = self.lab.assemble(self.project, state["revision"])
        state = self.listened("episode", state["assembly"]["take_id"])
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")
        return state

    def test_keep_after_reassemble(self):
        state = self.approved()
        state = self.lab.assemble(self.project, state["revision"])
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")
        self.assertIsNone(state.get("approval_note"))

    def test_keep_after_restart(self):
        self.approved()
        restored = StudioProjectService(self.root / "projects")
        self.addCleanup(restored.close)
        self.assertEqual(restored.voice.snapshot(self.project)["status"], "USER_LISTENED_APPROVED")

    def test_drop_reason_pause_changed(self):
        state = self.approved()
        unit = state["units"][0]
        state = self.lab.select(self.project, unit["id"], unit["selected_take"], state["revision"], unit["gap_after_ms"] + 50)
        self.assertNotEqual(state["status"], "USER_LISTENED_APPROVED")
        self.assertEqual(state["approval_note"]["reason"], "pause_changed")
        self.assertEqual(state["approval_note"]["unit_ids"], [unit["id"]])

    def test_drop_reason_take_changed(self):
        state = self.approved()
        unit = state["units"][1]
        self.lab.start(self.project, "generate", [unit["id"]], "Hải Đăng", "NORMAL", {}, state["revision"])
        state = self.wait()
        target = next(u for u in state["units"] if u["id"] == unit["id"])
        state = self.lab.select(self.project, unit["id"], target["takes"][-1]["take_id"], state["revision"], target["gap_after_ms"])
        self.assertEqual(state["approval_note"]["reason"], "take_changed")
        self.assertEqual(state["approval_note"]["unit_ids"], [unit["id"]])

    def test_the_note_clears_when_the_episode_is_heard_again(self):
        state = self.approved()
        unit = state["units"][0]
        state = self.lab.select(self.project, unit["id"], unit["selected_take"], state["revision"], unit["gap_after_ms"] + 50)
        state = self.lab.assemble(self.project, state["revision"])
        state = self.listened("episode", state["assembly"]["take_id"])
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")
        self.assertIsNone(state.get("approval_note"))

    def test_no_note_function_can_create_a_listening_proof(self):
        state = self.approved()
        unit = state["units"][0]
        state = self.lab.select(self.project, unit["id"], unit["selected_take"], state["revision"], unit["gap_after_ms"] + 50)
        self.assertIsNone((state.get("assembly") or {}).get("listened"))


if __name__ == "__main__":
    unittest.main()
