"""Timing is recomposed from cached per-unit words, and approved audio is reused instead of re-synthesised."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import tests.test_studio_p2_voice_lab as fixture
from tools.studio_project.voice_bank import VoiceBank, recompose_timing

UNITS = [
    {"id": "U1", "gap_after_ms": 200, "duration_ms": 1000.0, "sample_rate": 16000, "wav_sha256": "a"},
    {"id": "U2", "gap_after_ms": 0, "duration_ms": 500.0, "sample_rate": 16000, "wav_sha256": "b"},
]
LOCAL = {
    "U1": {"wav_sha256": "a", "words": [{"text": "x", "startMs": 10.0, "endMs": 90.0, "unit_id": "U1", "anchor_id": "U1:0"}]},
    "U2": {"wav_sha256": "b", "words": [{"text": "y", "startMs": 5.0, "endMs": 50.0, "unit_id": "U2", "anchor_id": "U2:0"}]},
}


class RecomposeTests(unittest.TestCase):
    def test_offsets_are_durations_plus_pauses(self):
        words = recompose_timing(UNITS, LOCAL)
        self.assertEqual([(w["unit_id"], w["startMs"], w["endMs"]) for w in words], [("U1", 10.0, 90.0), ("U2", 1205.0, 1250.0)])

    def test_changed_wav_or_missing_unit_means_no_recomposition(self):
        self.assertIsNone(recompose_timing(UNITS, {**LOCAL, "U2": {**LOCAL["U2"], "wav_sha256": "other"}}))
        self.assertIsNone(recompose_timing(UNITS, {"U1": LOCAL["U1"]}))

    def test_cached_words_are_not_mutated(self):
        snapshot = json.dumps(LOCAL, sort_keys=True)
        recompose_timing(UNITS, LOCAL)
        self.assertEqual(json.dumps(LOCAL, sort_keys=True), snapshot)


class BankTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-bank-")
        self.addCleanup(context.cleanup)
        self.root = Path(context.name)
        self.wav = self.root / "take.wav"
        self.wav.write_bytes(b"RIFF....audio")
        self.bank = VoiceBank(self.root / "bank")

    def test_reuses_the_same_text_voice_and_generation_profile(self):
        self.bank.remember("t1", "v1", "g1", self.wav)
        found = self.bank.lookup("t1", "v1", "g1")
        self.assertEqual(found.read_bytes(), self.wav.read_bytes())

    def test_never_reuses_across_voice_or_generation_profile(self):
        self.bank.remember("t1", "v1", "g1", self.wav)
        self.assertIsNone(self.bank.lookup("t1", "v2", "g1"))
        self.assertIsNone(self.bank.lookup("t1", "v1", "g2"))
        self.assertIsNone(self.bank.lookup("t2", "v1", "g1"))

    def test_concurrent_writers_of_the_same_key_never_collide(self):
        import threading
        errors = []
        def write():
            try:
                for _ in range(15):
                    self.bank.remember("t1", "v1", "g1", self.wav)
            except Exception as error:  # pragma: no cover - the failure being tested
                errors.append(error)
        threads = [threading.Thread(target=write) for _ in range(6)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        self.assertEqual(errors, [])
        self.assertEqual(self.bank.lookup("t1", "v1", "g1").read_bytes(), self.wav.read_bytes())
        self.assertEqual([p.name for p in (self.root / "bank").glob("*.tmp*")], [])

    def test_a_failing_bank_write_is_swallowed_by_the_caller_helper(self):
        from tools.studio_project.voice_bank import remember_quietly
        self.assertFalse(remember_quietly(self.bank, "t1", "v1", "g1", self.root / "missing.wav"))
        self.assertTrue(remember_quietly(self.bank, "t1", "v1", "g1", self.wav))

    def test_a_tampered_bank_file_is_ignored(self):
        self.bank.remember("t1", "v1", "g1", self.wav)
        self.bank.lookup("t1", "v1", "g1").write_bytes(b"changed")
        self.assertIsNone(self.bank.lookup("t1", "v1", "g1"))


class LabIntegrationTests(unittest.TestCase):
    setUp = fixture.VoiceLabTests.setUp
    generate = fixture.VoiceLabTests.generate
    state = fixture.VoiceLabTests.state
    wait = fixture.VoiceLabTests.wait
    create = fixture.VoiceLabTests.create

    def align(self, args, **_):
        manifest = json.loads(Path(args[4]).read_text(encoding="utf8"))
        result = {}
        for unit in manifest["units"]:
            text = unit["tts_text"].split()
            result[unit["id"]] = [{"text": w, "startMs": 800 * i / len(text), "endMs": 800 * (i + 1) / len(text), "confidence": .95}
                                  for i, w in enumerate(text)]
        Path(args[5]).write_text(json.dumps(result), encoding="utf8")

    def aligned(self):
        state = self.create()
        state = self.lab.assemble(self.project, state["revision"])
        with patch("tools.studio_project.voice_lab.run_managed_subprocess", side_effect=self.align) as worker:
            self.lab.start(self.project, "align", [], "Hải Đăng", "NORMAL", {}, state["revision"])
            state = self.wait()
        self.assertEqual(worker.call_count, 1)
        return state

    def test_pause_change_keeps_timing_ready_without_asr(self):
        state = self.aligned()
        unit = state["units"][0]
        state = self.lab.select(self.project, unit["id"], unit["selected_take"], state["revision"], unit["gap_after_ms"] + 50)
        self.assertIsNone(state["timing"])  # the assembly is gone until it is rebuilt
        with patch("tools.studio_project.voice_lab.run_managed_subprocess") as worker:
            state = self.lab.assemble(self.project, state["revision"])
        worker.assert_not_called()
        self.assertEqual(state["timing"]["source"], "measured_asr")
        self.assertEqual(state["timing"]["wav_sha256"], state["assembly"]["wav_sha256"])
        second = [w for w in state["timing"]["words"] if w["unit_id"] == state["units"][1]["id"]][0]
        self.assertGreater(second["startMs"], state["units"][0]["takes"][0]["duration_seconds"] * 1000 + unit["gap_after_ms"] + 49)

    def test_missing_takes_are_taken_from_the_bank_not_synthesised_again(self):
        state = self.create()
        calls = len(self.calls)
        raw = self.lab._read(self.handle)
        for unit in raw["units"]:
            unit["selected_take"] = None
        self.lab._save(self.handle, raw)
        self.lab.start(self.project, "generate", [], "Hải Đăng", "NORMAL", {}, self.state()["revision"])
        state = self.wait()
        self.assertEqual(state["job"]["status"], "COMPLETED", state["job"])
        self.assertEqual(len(self.calls), calls)  # the engine was not called again
        self.assertTrue(all(u["selected_take"] for u in state["units"]))

    def test_an_explicit_retake_always_synthesises(self):
        state = self.create()
        calls = len(self.calls)
        self.lab.start(self.project, "generate", [state["units"][0]["id"]], "Hải Đăng", "NORMAL", {}, state["revision"])
        self.wait()
        self.assertEqual(len(self.calls), calls + 1)


if __name__ == "__main__":
    unittest.main()
