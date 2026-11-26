"""Short units share one Whisper pass; each unit is still verified alone if the shared pass cannot prove it."""
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from tools.studio_project import voice_worker


def silent_wav(path: Path, seconds: float) -> None:
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(16000)
        out.writeframes(bytes(int(16000 * seconds) * 2))


class BatchedWordSourceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.units = []
        for index, seconds in enumerate((3.0, 2.0, 20.0)):
            audio = root / f"take-{index}.wav"; silent_wav(audio, seconds)
            self.units.append({"id": f"U{index}", "audio": str(audio)})

    def run_source(self, transcribe, align, clamp=None):
        source = voice_worker.BatchedWordSource(self.units)
        with patch.object(voice_worker, "_transcribe_raw_words", side_effect=transcribe) as heard, \
                patch.object(voice_worker, "_align_scene_words", side_effect=align) as aligned,                 patch.object(voice_worker, "_clamp_aligned_words_to_wav_boundary", side_effect=clamp or (lambda *a, **k: a[1])):
            results = [source(None, Path("scenes") / f"U{i}.wav", f"text{i}") for i in range(3)]
        return heard, aligned, results

    def test_units_within_one_window_share_a_single_pass_with_local_times(self):
        # U0 starts at 0 s, U1 at 3.5 s (3 s + 0.5 s gap); the 20 s unit no longer fits the 24 s window.
        words = [{"heard": "a", "start": 0.2, "end": 0.5, "confidence": 1.0},
                 {"heard": "b", "start": 3.7, "end": 4.0, "confidence": 1.0}]
        def align(model, path, text, raw_words=None):
            return raw_words if raw_words is not None else [{"alone": text}]
        calls = []
        def transcribe(model, path, **options):
            calls.append(options)
            return list(words) if len(calls) == 1 else []
        heard, aligned, results = self.run_source(transcribe, align)
        self.assertEqual(heard.call_count, 2)  # one shared pass for U0+U1, one for the long U2
        self.assertEqual(calls[0], {"beam_size": 1, "temperature": 0.0})
        self.assertEqual([w["heard"] for w in results[0]], ["a"])
        self.assertAlmostEqual(results[1][0]["start"], 0.2, places=3)  # 3.7 s minus U1 offset 3.5 s

    def test_unit_that_cannot_be_verified_is_heard_alone(self):
        def align(model, path, text, raw_words=None):
            if raw_words is not None:
                raise RuntimeError("ALIGNMENT_MISMATCH")
            return [{"alone": text}]
        heard, aligned, results = self.run_source(lambda model, path, **opts: [], align)
        self.assertEqual(results[0], [{"alone": "text0"}])
        self.assertIsNone(aligned.call_args_list[1].kwargs.get("raw_words"))  # second try for U0 carries no shared words

    def test_word_spilling_past_its_unit_is_heard_alone(self):
        def align(model, path, text, raw_words=None):
            return [{"alone": text}] if raw_words is None else [{"shared": text}]
        def clamp(scene_id, words, seconds):
            if words[0].get("shared"):
                raise RuntimeError("caption word falls outside measured WAV boundary")
            return words
        heard, aligned, results = self.run_source(lambda model, path, **opts: [], align, clamp)
        self.assertEqual(results[0], [{"alone": "text0"}])


if __name__ == "__main__":
    unittest.main()
