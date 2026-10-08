"""The WAV scene gap is the only authority for global word timing."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class VoiceGapSourceTests(unittest.TestCase):
    def test_executor_forwards_voice_gap_to_timing(self):
        source = (ROOT / "tools/studio_v2/executor.py").read_text(encoding="utf-8")
        self.assertIn('"scene_gap_ms": float(config.tts_settings.get("scene_gap_ms", 180.0))', source)

    def test_global_timing_does_not_override_explicit_gap(self):
        source = (ROOT / "tools/studio_v2/timing.py").read_text(encoding="utf-8")
        self.assertIn('settings.get("scene_gap_ms", 180.0)', source)

    def test_assembly_uses_same_default(self):
        source = (ROOT / "tools/studio_v2/voice.py").read_text(encoding="utf-8")
        self.assertIn('tts_settings.get("scene_gap_ms", 180.0)', source)
