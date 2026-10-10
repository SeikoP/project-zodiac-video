import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from tools.media_acceptance import assess_durations, png_size, inspect


class MediaAcceptanceTests(unittest.TestCase):
    def test_rejects_audio_tail_cut(self):
        self.assertIn("FINAL_AUDIO_CUTS_VOICE", assess_durations(20, 18, 19.5, 24))

    def test_rejects_video_cut(self):
        self.assertIn("FINAL_VIDEO_CUTS_VOICE", assess_durations(18, 20, 19.5, 24))

    def test_allows_video_hold_after_completed_voice(self):
        self.assertEqual(assess_durations(21, 20, 19.5, 24), [])

    def test_rejects_wrong_cover(self):
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/"cover.png"
            path.write_bytes(b"not an image")
            with self.assertRaisesRegex(ValueError, "COVER_PNG_INVALID"):
                png_size(path)

    def test_missing_artifacts_do_not_generate_pass_receipt(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp)
            report=inspect(root,root/"out.mp4",root/"cover.png")
            self.assertEqual(report["status"], "BLOCKED")
            self.assertEqual(report["visual_human_review"], "NOT_VERIFIED")
            self.assertIn("ARTIFACT_MISSING:voice", report["issues"])


if __name__ == "__main__":
    unittest.main()
