"""Listening approval is recorded per segment, so one edit needs one listen."""
import unittest
from unittest.mock import patch

import tests.test_studio_p2_voice_lab as fixture
from tools.studio_project.models import StudioError


class SegmentProofTests(unittest.TestCase):
    setUp = fixture.VoiceLabTests.setUp
    generate = fixture.VoiceLabTests.generate
    state = fixture.VoiceLabTests.state
    wait = fixture.VoiceLabTests.wait
    create = fixture.VoiceLabTests.create
    listened = fixture.VoiceLabTests.listened

    def approved(self):
        state = self.create()
        state = self.lab.assemble(self.project, state["revision"])
        return self.listened("episode", state["assembly"]["take_id"])

    def test_episode_listen_records_a_proof_for_every_segment(self):
        state = self.approved()
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")
        proofs = state["segment_proofs"]
        self.assertEqual([p["unit_id"] for p in proofs], [u["id"] for u in state["units"]])
        self.assertTrue(all(p["wav_sha256"] and p["gap_after_ms"] is not None for p in proofs))
        self.assertEqual(state["segments_needing_listen"], [])

    def test_pause_change_needs_only_that_unit_and_listening_it_restores_approval(self):
        state = self.approved()
        unit = state["units"][0]
        state = self.lab.select(self.project, unit["id"], unit["selected_take"], state["revision"], unit["gap_after_ms"] + 50)
        self.assertEqual(state["segments_needing_listen"], [unit["id"]])
        state = self.listened(unit["id"], unit["selected_take"])
        state = self.lab.assemble(self.project, state["revision"])
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")
        self.assertEqual(state["segments_needing_listen"], [])

    def test_retake_needs_only_that_unit(self):
        state = self.approved()
        unit = state["units"][1]
        self.lab.start(self.project, "generate", [unit["id"]], "Hải Đăng", "NORMAL", {}, state["revision"])
        state = self.wait()
        target = next(u for u in state["units"] if u["id"] == unit["id"])
        take = target["takes"][-1]["take_id"]
        state = self.lab.select(self.project, unit["id"], take, state["revision"], target["gap_after_ms"])
        self.assertEqual(state["segments_needing_listen"], [unit["id"]])
        state = self.listened(unit["id"], take)
        state = self.lab.assemble(self.project, state["revision"])
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")

    def test_listening_to_one_unit_never_approves_the_others(self):
        state = self.create()
        first = state["units"][0]
        state = self.listened(first["id"], first["selected_take"])
        state = self.lab.assemble(self.project, state["revision"])
        self.assertNotEqual(state["status"], "USER_LISTENED_APPROVED")
        self.assertEqual(state["segments_needing_listen"], [u["id"] for u in state["units"][1:]])

    def test_every_unit_heard_alone_still_needs_the_assembled_episode_once(self):
        state = self.create()
        for unit in state["units"]:
            state = self.listened(unit["id"], unit["selected_take"])
        state = self.lab.assemble(self.project, state["revision"])
        self.assertEqual(state["segments_needing_listen"], [])
        self.assertEqual(state["status"], "TECHNICAL_VALID")  # seams between units were never heard

    def test_no_proof_without_a_completed_playback(self):
        state = self.create()
        unit = state["units"][0]
        token = self.lab.playback(self.project, unit["id"], unit["selected_take"])["playback_id"]
        with self.assertRaises(StudioError) as caught:  # confirmed immediately, playback not finished
            self.lab.confirm(self.project, unit["id"], unit["selected_take"], token, True, self.state()["revision"])
        self.assertEqual(caught.exception.code, "VOICE_PLAYBACK_INCOMPLETE")
        self.assertEqual(self.state().get("segment_proofs", []), [])

    def test_proofs_from_another_narration_are_ignored(self):
        state = self.approved()
        handle = self.handle
        raw = self.lab._read(handle)
        raw["segment_proofs"][0]["narration_sha256"] = "someone-else"
        self.lab._save(handle, raw)
        self.assertEqual(self.state()["segments_needing_listen"], [state["units"][0]["id"]])


if __name__ == "__main__":
    unittest.main()
