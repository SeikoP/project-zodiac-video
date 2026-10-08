import unittest

from tools.control_plane.cache import (
    audio_key,
    plan_key,
    render_key,
    timing_key,
    voice_key,
)


class ControlPlaneCacheKeyTests(unittest.TestCase):
    def test_dict_order_and_newline_style_do_not_change_key(self):
        a = voice_key("xin\r\nchao", "voice-a", {"speed": 1, "model": "x"}, "tts-1")
        b = voice_key("xin\nchao", "voice-a", {"model": "x", "speed": 1}, "tts-1")
        self.assertEqual(a, b)

    def test_visual_patch_does_not_change_voice_or_timing_key(self):
        voice = voice_key("xin chao", "voice-a", {"speed": 1}, "tts-1")
        timing = timing_key(voice, "xin chao", {"beam": 5}, "align-1")
        plan_a = plan_key("ir-a", timing, "design-a", "compiler-1")
        plan_b = plan_key("ir-b", timing, "design-a", "compiler-1")
        self.assertNotEqual(plan_a, plan_b)
        self.assertEqual(voice, voice_key("xin chao", "voice-a", {"speed": 1}, "tts-1"))
        self.assertEqual(timing, timing_key(voice, "xin chao", {"beam": 5}, "align-1"))

    def test_narration_change_invalidates_voice_and_timing(self):
        voice_a = voice_key("xin chao", "voice-a", {}, "tts-1")
        voice_b = voice_key("xin chao moi", "voice-a", {}, "tts-1")
        self.assertNotEqual(voice_a, voice_b)
        self.assertNotEqual(
            timing_key(voice_a, "xin chao", {}, "align-1"),
            timing_key(voice_b, "xin chao moi", {}, "align-1"),
        )

    def test_renderer_upgrade_changes_render_key_not_plan_key(self):
        plan = plan_key("ir", "timing", "design", "compiler-1")
        self.assertEqual(plan, plan_key("ir", "timing", "design", "compiler-1"))
        self.assertNotEqual(
            render_key(plan, "assets", "2.0.0", "hash-a"),
            render_key(plan, "assets", "2.0.1", "hash-b"),
        )

    def test_music_change_only_changes_audio_key(self):
        render = render_key("plan", "assets", "2.0.0", "renderer")
        self.assertNotEqual(
            audio_key(render, "music-a", {"volume": 0.2}),
            audio_key(render, "music-b", {"volume": 0.2}),
        )
        self.assertEqual(render, render_key("plan", "assets", "2.0.0", "renderer"))

    def test_all_keys_are_sha256_hex(self):
        keys = [
            voice_key("x", "v", {}, "e"),
            timing_key("v", "x", {}, "a"),
            plan_key("i", "t", "d", "c"),
            render_key("p", "a", "2", "h"),
            audio_key("v", "m", {}),
        ]
        for value in keys:
            self.assertRegex(value, r"^[0-9a-f]{64}$")


if __name__ == "__main__":
    unittest.main()
