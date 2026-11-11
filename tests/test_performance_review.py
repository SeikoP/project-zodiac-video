import json
import wave
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from tools.performance_review import (
    TTS_CRITERIA,
    RENDERED_CRITERIA,
    file_sha,
    init_tts_review,
    validate_tts_review,
    init_rendered_review,
    validate_rendered_review,
)


class PerformanceReviewTests(unittest.TestCase):
    def _workspace(self, root: Path):
        (root / ".runtime").mkdir()
        (root / ".authoring").mkdir()
        (root / "out").mkdir()
        with wave.open(str(root / "voice.wav"), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\x00\x00" * 1600)
        (root / ".runtime/timing.json").write_text('{"format":"zodiac-timing@1"}\n', encoding="utf-8")
        (root / ".authoring/spoken-performance-plan.json").write_text('{"format":"zodiac-spoken-performance-plan@1"}\n', encoding="utf-8")
        (root / "out/zodiac-story.mp4").write_bytes(b"final-video-bytes")

    def _pass(self, review, keys):
        for key in keys:
            review["criteria"][key] = {
                "result": "PASS",
                "observation": "Observed the exact final media and found the requested performance intent preserved.",
                "evidence": "00:00.000-00:01.000",
            }
        review["decision"] = "PASS"
        review["revision_targets"] = []
        return review

    def test_tts_review_is_bound_to_voice_timing_and_plan(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._workspace(root)
            review = self._pass(init_tts_review(root), TTS_CRITERIA)
            (root / ".runtime/tts-performance-review.json").write_text(
                json.dumps(review), encoding="utf-8"
            )
            result = validate_tts_review(root)
            self.assertTrue(result["prosody_verified"])
            (root / "voice.wav").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "SOURCE_CHANGED"):
                validate_tts_review(root)

    def test_rendered_review_is_bound_to_final_mp4_and_tts_review(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._workspace(root)
            tts = self._pass(init_tts_review(root), TTS_CRITERIA)
            (root / ".runtime/tts-performance-review.json").write_text(
                json.dumps(tts), encoding="utf-8"
            )
            rendered = self._pass(init_rendered_review(root), RENDERED_CRITERIA)
            (root / ".runtime/rendered-performance-review.json").write_text(
                json.dumps(rendered), encoding="utf-8"
            )
            result = validate_rendered_review(root)
            self.assertTrue(result["rendered_effect_verified"])
            (root / "out/zodiac-story.mp4").write_bytes(b"rebuilt-video")
            with self.assertRaisesRegex(ValueError, "SOURCE_CHANGED"):
                validate_rendered_review(root)

    def test_review_templates_start_in_review_not_pass(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._workspace(root)
            review = init_tts_review(root)
            self.assertEqual(review["decision"], "REVIEW")
            self.assertFalse(review["prosody_verified"])


if __name__ == "__main__":
    unittest.main()
