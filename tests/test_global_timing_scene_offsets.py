"""Regression: timing-v1 timestamps are global, not scene-relative."""
from tools.control_plane.anchors import resolve_voice_anchor
from tools.control_plane.timeline import _caption_rows


def test_voice_anchor_does_not_double_count_scene_offset():
    scene = {"id": "S02"}
    measured = {
        "id": "S02", "fps": 24, "start_frame": 333, "duration_frames": 212,
        "captions": [
            {"text": "Nhưng", "startMs": 19740, "endMs": 19940, "timestampMs": 19740},
            {"text": "tới", "startMs": 19940, "endMs": 20160, "timestampMs": 19940},
            {"text": "lượt", "startMs": 20160, "endMs": 20380, "timestampMs": 20160},
            {"text": "hỏi", "startMs": 20380, "endMs": 20500, "timestampMs": 20380},
            {"text": "về", "startMs": 20500, "endMs": 20640, "timestampMs": 20500},
            {"text": "họ?", "startMs": 20640, "endMs": 20820, "timestampMs": 20640},
        ],
    }
    actual = resolve_voice_anchor(scene, measured, {"type": "voice_anchor", "text": "tới lượt hỏi về họ"})
    assert actual == 479
    assert 333 <= actual < 545


def test_caption_frames_are_absolute():
    measured = {"captions": [{"text": "tới", "startMs": 19940, "endMs": 20160}]}
    assert _caption_rows(measured, fps=24, scene_start=333) == [
        {"text": "tới", "start_frame": 479, "end_frame": 484}
    ]
