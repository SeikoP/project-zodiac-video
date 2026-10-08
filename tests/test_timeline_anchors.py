import unittest

from tools.control_plane.anchors import resolve_voice_anchor
from tools.control_plane.errors import ControlPlaneError


def timing_scene(words):
    captions = []
    for index, text in enumerate(words):
        start = index * 250
        captions.append(
            {
                "text": text,
                "startMs": start,
                "endMs": start + 200,
                "timestampMs": start,
            }
        )
    return {
        "id": "S01",
        "start_frame": 48,
        "duration_frames": 240,
        "fps": 24,
        "captions": captions,
    }


class TimelineAnchorTests(unittest.TestCase):
    def test_resolves_unique_phrase_to_measured_frame(self):
        scene = {"id": "S01", "voice": "Bọ Cạp bắt đầu mở lòng"}
        frame = resolve_voice_anchor(
            scene,
            timing_scene(["Bọ", "Cạp", "bắt", "đầu", "mở", "lòng"]),
            {"type": "voice_anchor", "text": "bắt đầu"},
        )
        self.assertEqual(frame, 60)

    def test_case_and_punctuation_are_normalized(self):
        scene = {"id": "S01", "voice": "Ủa, ALO?"}
        frame = resolve_voice_anchor(
            scene,
            timing_scene(["Ủa,", "ALO?"]),
            {"type": "voice_anchor", "text": "ủa alo"},
        )
        self.assertEqual(frame, 48)

    def test_repeated_phrase_without_occurrence_is_ambiguous(self):
        scene = {"id": "S01", "voice": "tin rồi lại tin"}
        with self.assertRaises(ControlPlaneError) as caught:
            resolve_voice_anchor(
                scene,
                timing_scene(["tin", "rồi", "lại", "tin"]),
                {"type": "voice_anchor", "text": "tin"},
            )
        self.assertEqual(caught.exception.code, "ANCHOR_AMBIGUOUS")
        self.assertEqual(caught.exception.stage, "PLAN")

    def test_occurrence_selects_requested_match(self):
        scene = {"id": "S01", "voice": "tin rồi lại tin"}
        frame = resolve_voice_anchor(
            scene,
            timing_scene(["tin", "rồi", "lại", "tin"]),
            {"type": "voice_anchor", "text": "tin", "occurrence": 2},
        )
        self.assertEqual(frame, 66)

    def test_missing_anchor_is_structured_error(self):
        scene = {"id": "S01", "voice": "xin chao"}
        with self.assertRaises(ControlPlaneError) as caught:
            resolve_voice_anchor(
                scene,
                timing_scene(["xin", "chao"]),
                {"type": "voice_anchor", "text": "khong co"},
            )
        self.assertEqual(caught.exception.code, "ANCHOR_NOT_FOUND")
        self.assertEqual(caught.exception.scene_id, "S01")

    def test_occurrence_past_last_match_is_not_found(self):
        scene = {"id": "S01", "voice": "tin rồi lại tin"}
        with self.assertRaises(ControlPlaneError) as caught:
            resolve_voice_anchor(
                scene,
                timing_scene(["tin", "rồi", "lại", "tin"]),
                {"type": "voice_anchor", "text": "tin", "occurrence": 3},
            )
        self.assertEqual(caught.exception.code, "ANCHOR_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
