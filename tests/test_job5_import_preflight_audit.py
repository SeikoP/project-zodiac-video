import unittest

from tools.control_plane.import_preflight import inspect_import_readiness, blocking_import_issues


def voice_scene(voice, events, bindings=None):
    return {"id": "s05", "voice": voice, "events": events,
            "spatial_bindings": bindings or []}


def e(name, text, motion="subtle-tilt", target="gemini", before="idle", after="idle", occurrence=None):
    trigger = {"type": "voice_anchor", "text": text}
    if occurrence is not None:
        trigger["occurrence"] = occurrence
    return {"id": name, "target": target, "state_before": before,
            "state_after": after, "desired_motion": motion, "trigger": trigger}


class FullJob5ImportPreflightTests(unittest.TestCase):
    def test_reports_all_ambiguous_anchors_in_one_pass(self):
        ir = {"scenes": [voice_scene("Song Tử nói xong. Song Tử lắng nghe.", [
            e("s05_e01", "Song"), e("s05_e02", "Song", target="notebook"),
        ])]}
        result = blocking_import_issues(ir)
        self.assertEqual([(i["event_id"], i["code"]) for i in result],
                         [("s05_e01", "ANCHOR_AMBIGUOUS"), ("s05_e02", "ANCHOR_AMBIGUOUS")])

    def test_valid_occurrence_and_unique_phrase(self):
        ir = {"scenes": [voice_scene("Song Tử nói xong. Song Tử lắng nghe.", [
            e("s05_e01", "Song", occurrence=1),
            e("s05_e02", "Song Tử lắng nghe", target="notebook"),
        ])]}
        self.assertEqual(blocking_import_issues(ir), [])

    def test_missing_anchor_and_invalid_occurrence_are_aggregated(self):
        ir = {"scenes": [voice_scene("Song Tử nói xong. Song Tử lắng nghe.", [
            e("bad", "chẳng hề xuất hiện"),e("bad2", "Song", occurrence=3),
        ])]}
        self.assertEqual({i["code"] for i in blocking_import_issues(ir)},
                         {"ANCHOR_NOT_FOUND", "ANCHOR_OCCURRENCE_INVALID"})

    def test_reversed_pen_contact_detected_before_timeline(self):
        ir = {"scenes": [voice_scene("Gạch sửa rồi khoanh B rồi chọn cái này.", [
            e("pen_slide", "chọn cái này", "slide", "pen","visible","visible"),
            e("notebook_mark", "khoanh B", "state_swap", "notebook","visible","marked"),
        ], [{"entity": "pen", "anchor": "notebook", "relation": "points_to",
             "max_distance_px": 360}])]}
        result = blocking_import_issues(ir)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["code"], "EVENT_DEPENDENCY_REVERSED")
        ir["scenes"][0]["events"][0]["trigger"]["text"] = "Gạch sửa"
        self.assertEqual(blocking_import_issues(ir), [])

    def test_noop_state_swap_and_fragile_single_word(self):
        ir = {"scenes": [voice_scene("Lắng nghe thông tin mới.", [
            e("noop", "Lắng", "state_swap", before="idle", after="idle"),
        ])]}
        result = inspect_import_readiness(ir)
        self.assertEqual({i["code"] for i in result},
                         {"NOOP_STATE_SWAP", "ANCHOR_FRAGILE"})
        self.assertEqual([i["code"] for i in blocking_import_issues(ir)],
                         ["NOOP_STATE_SWAP"])

    def test_full_list_across_multiple_scenes(self):
        ir = {"scenes": [
            voice_scene("Nhân vật chạy. Nhân vật dừng.", [e("a", "Nhân vật")]),
            dict(voice_scene("Mở cửa. Mở cửa.", [e("b", "Mở cửa")]), id="s06"),
        ]}
        issues = blocking_import_issues(ir)
        self.assertEqual(len(issues), 2)
        self.assertEqual({i["scene_id"] for i in issues}, {"s05", "s06"})


if __name__ == "__main__":
    unittest.main()
