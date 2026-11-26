"""ASR alignment runs several single-stream workers because Whisper on CPU does not scale with threads."""
import os
import unittest
from unittest.mock import patch


class AlignWorkerCountTests(unittest.TestCase):
    def count(self, units, env=None):
        from tools.studio_project import voice_worker
        with patch.dict(os.environ, env or {}, clear=False):
            if env is None:
                os.environ.pop("ZODIAC_STUDIO_ALIGN_WORKERS", None)
            return voice_worker.align_workers(units)

    def test_override_is_respected_but_never_exceeds_half_the_units(self):
        self.assertEqual(self.count(32, {"ZODIAC_STUDIO_ALIGN_WORKERS": "3"}), 3)
        self.assertEqual(self.count(4, {"ZODIAC_STUDIO_ALIGN_WORKERS": "8"}), 2)
        self.assertEqual(self.count(1, {"ZODIAC_STUDIO_ALIGN_WORKERS": "4"}), 1)

    def test_bad_or_zero_value_falls_back_to_one_worker(self):
        self.assertEqual(self.count(32, {"ZODIAC_STUDIO_ALIGN_WORKERS": "many"}), 1)
        self.assertEqual(self.count(32, {"ZODIAC_STUDIO_ALIGN_WORKERS": "0"}), 1)

    def test_default_is_between_one_and_four(self):
        self.assertTrue(1 <= self.count(32) <= 4)


if __name__ == "__main__":
    unittest.main()
