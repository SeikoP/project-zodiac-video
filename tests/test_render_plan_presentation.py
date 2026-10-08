import copy
import unittest

from tools.control_plane.render_plan import validate_render_plan
from tools.control_plane.timeline import compile_render_plan


class RenderPlanPresentationTests(unittest.TestCase):
    def setUp(self):
        self.ir = {
            "format": "zodiac-authoring-ir@1",
            "fps": 24,
            "video": {"width": 1080, "height": 1920},
            "assets": {
                "hero.closed": {"path": "assets/closed.svg"},
                "hero.open": {"path": "assets/open.svg"},
                "desk": {"path": "assets/desk.svg"},
            },
            "scenes": [
                {
                    "id": "S01",
                    "voice": "Bọ Cạp mở lòng rồi vẫn ở lại.",
                    "duration_hint_frames": 96,
                    "entities": [
                        {
                            "id": "hero",
                            "initial_state": "closed",
                            "states": {
                                "closed": {
                                    "asset": "hero.closed",
                                    "transform": {"x": 120, "y": 280, "width": 360, "height": 520},
                                    "layer": 20,
                                    "visible": True,
                                },
                                "open": {
                                    "asset": "hero.open",
                                    "transform": {"x": 140, "y": 270, "width": 380, "height": 530},
                                    "layer": 20,
                                    "visible": True,
                                },
                            },
                        },
                        {
                            "id": "desk",
                            "initial_state": "base",
                            "states": {
                                "base": {
                                    "asset": "desk",
                                    "transform": {"x": 40, "y": 1180, "width": 1000, "height": 500},
                                    "layer": 10,
                                    "visible": True,
                                }
                            },
                        },
                    ],
                    "events": [
                        {
                            "id": "E01",
                            "target": "hero",
                            "intent": "opens_up",
                            "trigger": {"type": "voice_anchor", "text": "mở lòng"},
                            "state_before": "closed",
                            "state_after": "open",
                            "desired_motion": "state_swap",
                            "scheduling": {"max_drift_frames": 4, "merge_policy": "never"},
                        }
                    ],
                }
            ],
        }
        self.timing = {
            "format": "zodiac-timing@1",
            "fps": 24,
            "total_duration_frames": 72,
            "scenes": [
                {
                    "id": "S01",
                    "start_frame": 0,
                    "duration_frames": 72,
                    "captions": [
                        {"text": "Bọ", "startMs": 0, "endMs": 180, "timestampMs": 0},
                        {"text": "Cạp", "startMs": 180, "endMs": 360, "timestampMs": 180},
                        {"text": "mở", "startMs": 800, "endMs": 960, "timestampMs": 800},
                        {"text": "lòng", "startMs": 960, "endMs": 1120, "timestampMs": 960},
                        {"text": "rồi", "startMs": 1200, "endMs": 1360, "timestampMs": 1200},
                        {"text": "vẫn", "startMs": 1400, "endMs": 1560, "timestampMs": 1400},
                        {"text": "ở", "startMs": 1600, "endMs": 1760, "timestampMs": 1600},
                        {"text": "lại.", "startMs": 1800, "endMs": 2000, "timestampMs": 1800},
                    ],
                }
            ],
        }
        self.design = {
            "id": "zodiac-paper-doodle-meme-v4",
            "version": "4.0",
            "style_family": "paper-doodle-chibi-meme",
            "handmade_profile": "human-stroke-v2",
            "palette_roles": {"paper": "#f6f0e6", "ink": "#2f3c44", "coral": "#e97a66"},
            "caption_emphasis": {
                "font_family": "Patrick Hand",
                "font_size_px": 84,
                "font_weight": 400,
                "max_lines": 2,
                "color_role": "ink",
                "highlight_role": "coral",
            },
            "safe_zone": {"x": 72, "y": 960, "width": 936, "height": 620},
            "brand_overlay": {
                "enabled": True,
                "text": "✦ bungmoto",
                "anchor": "top-left",
                "offset_px": {"x": 68, "y": 40},
                "font_family": "Patrick Hand",
                "font_size_px": 29,
                "font_weight": 800,
                "opacity": 0.45,
                "layer": 30,
            },
            "motion_defaults": {"state_swap": {"duration_frames": 8}},
        }

    def test_compiler_freezes_layout_captions_and_presentation_for_dumb_renderer(self):
        plan = compile_render_plan(self.ir, self.timing, self.design)
        validate_render_plan(plan, self.ir)

        self.assertEqual(plan["presentation"]["paper"], "#f6f0e6")
        self.assertEqual(plan["presentation"]["caption"]["font_family"], "Patrick Hand")
        self.assertEqual(plan["presentation"]["watermark"]["text"], "✦ bungmoto")

        scene = plan["scenes"][0]
        self.assertEqual(scene["duration_frames"], 96)  # measured 72 + 24 frame landing tail
        by_entity = {entity["id"]: entity for entity in scene["entities"]}
        self.assertEqual(by_entity["hero"]["initial_state"], "closed")
        self.assertEqual(
            by_entity["hero"]["states"]["open"]["transform"],
            {"x": 140, "y": 270, "width": 380, "height": 530},
        )
        self.assertEqual(by_entity["desk"]["states"]["base"]["layer"], 10)

        self.assertGreaterEqual(len(scene["captions"]), 1)
        self.assertTrue(all("start_frame" in caption and "end_frame" in caption for caption in scene["captions"]))
        self.assertTrue(all(caption["end_frame"] <= 72 for caption in scene["captions"]))

    def test_final_landing_tail_is_exactly_24_frames_beyond_measured_voice(self):
        plan = compile_render_plan(self.ir, self.timing, self.design)
        scene = plan["scenes"][0]
        measured_end = self.timing["scenes"][0]["start_frame"] + self.timing["scenes"][0]["duration_frames"]
        executable_end = scene["start_frame"] + scene["duration_frames"]
        self.assertEqual(executable_end - measured_end, 24)

    def test_state_layout_is_preserved_without_runtime_inference(self):
        plan = compile_render_plan(self.ir, self.timing, self.design)
        state = plan["scenes"][0]["entities"][0]["states"]["closed"]
        self.assertEqual(state["asset"], "hero.closed")
        self.assertEqual(state["layer"], 20)
        self.assertTrue(state["visible"])


if __name__ == "__main__":
    unittest.main()
