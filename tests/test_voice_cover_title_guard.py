import copy
import unittest
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_validation import _validate_cover_narration_separation


class VoiceCoverTitleGuardTests(unittest.TestCase):
    def setUp(self):
        self.publish = {"cover": {"opening": {"enabled": True}}}
        self.ir = {"scenes": [{"id": "S01", "voice": "Ma Kết có thể chăm bạn đến mức... bạn thành người thừa."}]}

    def test_spoken_hook_can_start_at_frame_zero(self):
        _validate_cover_narration_separation(self.ir, self.publish)

    def test_canonical_allcaps_cover_title_is_not_narrated(self):
        self.ir["scenes"][0]["voice"] = (
            "MA KẾT: YÊU NHAU MÀ MỘT NGƯỜI THÀNH NGƯỜI THỪA\n\n"
            "Ma Kết có thể chăm bạn đến mức..."
        )
        with self.assertRaises(ControlPlaneError) as raised:
            _validate_cover_narration_separation(self.ir, self.publish)
        self.assertEqual(raised.exception.code, "PACKAGE_VOICE_COVER_TITLE_DUPLICATED")

    def test_no_cover_opening_does_not_enforce_cover_voice_split(self):
        self.ir["scenes"][0]["voice"] = "MA KẾT: YÊU NHAU MÀ MỘT NGƯỜI THÀNH NGƯỜI THỪA"
        _validate_cover_narration_separation(self.ir, {"cover": {"opening": {"enabled": False}}})
        _validate_cover_narration_separation(self.ir, {})

    def test_normal_emphatic_spoken_dialogue_is_allowed(self):
        self.ir["scenes"][0]["voice"] = "ĐỪNG LÀM THẾ! TÔI CÒN ĐANG NGHE ĐẤY."
        _validate_cover_narration_separation(self.ir, self.publish)


if __name__ == "__main__":
    unittest.main()
