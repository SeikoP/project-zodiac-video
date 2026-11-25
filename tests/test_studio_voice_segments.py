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
        self.assertEqual(state["status"], "TECHNICAL_VALID")  # assembling never approves by itself
        self.assertEqual(state["segments_needing_listen"], [])
        self.assertTrue(state["can_confirm_from_segments"])
        state = self.lab.confirm_from_segments(self.project, state["revision"])
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")
        self.assertEqual(state["assembly"]["listened"]["derived_from"], "segment_proofs")

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
        self.assertEqual(state["status"], "TECHNICAL_VALID")
        state = self.lab.confirm_from_segments(self.project, state["revision"])
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

    def test_confirming_from_segments_is_refused_when_anything_is_unheard_or_the_episode_was_never_heard(self):
        state = self.create()
        state = self.lab.assemble(self.project, state["revision"])
        self.assertFalse(state["can_confirm_from_segments"])
        with self.assertRaises(StudioError) as caught:  # nothing heard at all
            self.lab.confirm_from_segments(self.project, state["revision"])
        self.assertEqual(caught.exception.code, "VOICE_SEGMENTS_NOT_HEARD")
        for unit in state["units"]:  # every unit heard alone, the assembled episode never
            state = self.listened(unit["id"], unit["selected_take"])
        state = self.lab.assemble(self.project, state["revision"])
        self.assertFalse(state["can_confirm_from_segments"])
        with self.assertRaises(StudioError):
            self.lab.confirm_from_segments(self.project, state["revision"])

    def test_the_rpc_confirms_from_segments_only_for_the_episode_and_only_when_asked_explicitly(self):
        from tools.studio_project.rpc_stdio import dispatch
        state = self.approved()
        unit = state["units"][0]
        self.lab.select(self.project, unit["id"], unit["selected_take"], self.state()["revision"], unit["gap_after_ms"] + 50)
        state = self.listened(unit["id"], unit["selected_take"])
        state = self.lab.assemble(self.project, state["revision"])
        with self.assertRaises(StudioError):  # confirm must be exactly True, as for a normal listen
            dispatch(self.service, "voice.confirm", {"project_id": self.project, "unit_id": "episode", "take_id": "", "playback_id": "", "confirm": "true", "base_revision": state["revision"]})
        with self.assertRaises(StudioError):  # a unit can never be confirmed without a playback
            dispatch(self.service, "voice.confirm", {"project_id": self.project, "unit_id": unit["id"], "take_id": "", "playback_id": "", "confirm": True, "base_revision": state["revision"]})
        state = dispatch(self.service, "voice.confirm", {"project_id": self.project, "unit_id": "episode", "take_id": "", "playback_id": "", "confirm": True, "base_revision": state["revision"]})
        self.assertEqual(state["status"], "USER_LISTENED_APPROVED")

    def test_assembling_alone_never_mints_an_approval_even_when_every_segment_is_proven(self):
        state = self.approved()
        unit = state["units"][0]
        state = self.lab.select(self.project, unit["id"], unit["selected_take"], state["revision"], unit["gap_after_ms"] + 50)
        state = self.listened(unit["id"], unit["selected_take"])
        state = self.lab.assemble(self.project, state["revision"])
        self.assertIsNone(state["assembly"]["listened"])

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

    def test_scenes_group_units_and_listening_every_scene_makes_the_episode_confirmable(self):
        state = self.create()
        scenes = state["scenes"]
        self.assertGreaterEqual(len(scenes), 1)
        self.assertEqual([uid for s in scenes for uid in s["unit_ids"]], [u["id"] for u in state["units"]])
        self.assertTrue(all(s["take"] and s["take"]["duration_seconds"] > 0 for s in scenes))
        state = self.lab.assemble(self.project, state["revision"])
        for scene in state["scenes"]:
            state = self.listened("scene:" + scene["id"], scene["take"]["take_id"])
        self.assertEqual(state["segments_needing_listen"], [])
        self.assertNotEqual(state["status"], "USER_LISTENED_APPROVED")  # a scene listen never approves the episode by itself
        self.assertTrue(state["can_confirm_from_segments"])
        self.assertTrue(all(u["listened"] for u in state["units"]))

    def test_a_scene_can_be_accepted_without_playback_but_a_sentence_cannot(self):
        state = self.create()
        scene = state["scenes"][0]
        state = self.lab.confirm(self.project, "scene:" + scene["id"], scene["take"]["take_id"], "", True, state["revision"])
        members = [u for u in state["units"] if u["id"] in scene["unit_ids"]]
        self.assertTrue(all(u["listened"]["playback"] == "skipped_by_user" for u in members))
        other = next((u for u in state["units"] if u["id"] not in scene["unit_ids"]), state["units"][0])
        with self.assertRaises(StudioError):
            self.lab.confirm(self.project, other["id"], other["selected_take"], "", True, state["revision"])
        with self.assertRaises(StudioError):
            self.lab.confirm(self.project, "episode", "", "", True, state["revision"])

    def test_one_scene_listen_marks_only_its_units(self):
        state = self.create()
        if len(state["scenes"]) < 2:
            self.skipTest("fixture narration has a single scene")
        scene = state["scenes"][0]
        state = self.listened("scene:" + scene["id"], scene["take"]["take_id"])
        heard = {u["id"] for u in state["units"] if u["listened"]}
        self.assertEqual(heard, set(scene["unit_ids"]))


if __name__ == "__main__":
    unittest.main()
