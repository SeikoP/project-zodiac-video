import unittest

from tools.control_plane.anchors import resolve_voice_anchor
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.timeline import _semantic_caption_rows


def timing_scene(words):
    captions = []
    for index, text in enumerate(words):
        # timing-v1 stores global video ms: this fixture starts at frame 48 (2 s).
        start = 2000 + index * 250
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
    def test_semantic_caption_preserves_exact_word_timing_and_segment_offset(self):
        from tools.control_plane.segments import _local_scene
        scene = {"id": "S01", "caption_segments": [{"text": "Bọ Cạp!"}]}
        rows = _semantic_caption_rows(scene, timing_scene(["Bọ", "Cạp"]), fps=24)
        self.assertEqual([word["text"] for word in rows[0]["words"]], ["Bọ", "Cạp"])
        self.assertAlmostEqual(rows[0]["words"][0]["end_frame"], 52.8)
        local = _local_scene({"start_frame": 48, "captions": rows, "events": []}, 48)
        self.assertAlmostEqual(local["captions"][0]["words"][0]["end_frame"], 4.8)
        self.assertEqual(rows[0]["words"][0]["start_frame"], 48)

    def test_grouped_timing_does_not_invent_karaoke_word_timestamps(self):
        scene = {"id": "S01", "caption_segments": [{"text": "Bọ Cạp!"}]}
        rows = _semantic_caption_rows(scene, timing_scene(["Bọ Cạp"]), fps=24)
        self.assertNotIn("words", rows[0])

    def test_semantic_captions_split_measured_words_using_unicode_tokens(self):
        scene = {
            "id": "S01",
            "caption_segments": [
                {"text": "!"},
                {"text": "Bọ Cạp vừa quay lại"},
            ],
        }
        measured = {
            "captions": [
                {"text": word, "startMs": i * 100, "endMs": (i + 1) * 100}
                for i, word in enumerate(("Bọ", "Cạp", "vừa", "quay", "lại"))
            ]
        }
        rows = _semantic_caption_rows(scene, measured, fps=24)
        self.assertEqual([row["text"] for row in rows], ["Bọ Cạp vừa quay lại"])
        self.assertEqual(rows[0]["start_frame"], 0)
        self.assertEqual(rows[0]["end_frame"], 12)

    def test_scene_start_trigger_resolves_to_measured_scene_start(self):
        scene = {"id": "S01", "voice": "Xin chào"}
        frame = resolve_voice_anchor(
            scene,
            timing_scene(["Xin", "chào"]),
            {"type": "scene_start"},
        )
        self.assertEqual(frame, 48)

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
