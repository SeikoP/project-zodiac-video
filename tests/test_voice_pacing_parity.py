"""Guard the default speech breathing gap and timing/audio parity."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class VoicePacingDefaultsTests(unittest.TestCase):
    def test_voice_and_alignment_use_identical_nonzero_gap(self):
        voice = (ROOT / "tools/studio_v2/voice.py").read_text(encoding="utf-8")
        timing = (ROOT / "tools/studio_v2/timing.py").read_text(encoding="utf-8")
        self.assertIn('scene_gap_ms=float(tts_settings.get("scene_gap_ms", 180.0))', voice)
        self.assertIn('scene_gap_ms=float(settings.get("scene_gap_ms", 180.0))', timing)

    def test_override_with_zero_remains_supported(self):
        voice = (ROOT / "tools/studio_v2/voice.py").read_text(encoding="utf-8")
        self.assertIn('tts_settings.get("scene_gap_ms", 180.0)', voice)
        self.assertNotIn('max(180', voice)
        
    def test_do_not_claim_unimplemented_sentence_pauses(self):
        timing = (ROOT / "tools/studio_v2/timing.py").read_text(encoding="utf-8")
        self.assertIn('sentence_pause_ms=0.0', timing)

if __name__ == "__main__":
    unittest.main()
