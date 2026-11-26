import unittest

from tools.studio_project.voice_worker import relative_words


class RelativeAlignmentTests(unittest.TestCase):
    def test_float_subtraction_does_not_turn_zero_into_negative_time(self):
        words = [{"text": "word", "startMs": 10000.0, "endMs": 10220.0}]
        result = relative_words(words, 10000.000000000004)
        self.assertEqual(result, [{"text": "word", "startMs": 0.0, "endMs": 220.0}])
        self.assertEqual(words[0]["startMs"], 10000.0)

    def test_real_negative_or_reversed_timings_are_not_hidden(self):
        result = relative_words([{"startMs": 9, "endMs": 8}], 10)
        self.assertEqual(result, [{"startMs": -1, "endMs": -2}])

    def test_preserves_submillisecond_measurement_and_other_fields(self):
        result = relative_words([{"startMs": 1000.123456, "endMs": 1000.345678, "text": "a"}], 1000)
        self.assertEqual(result, [{"startMs": .123456, "endMs": .345678, "text": "a"}])
