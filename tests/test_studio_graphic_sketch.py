"""A sketch is a drawing the agent composes from parts: Core checks every part and draws it in the channel style."""
import unittest

from tools.studio_project import graphic_sketch, scene_assembler, story_visual_art


def part(shape, x, y, w, h, color="card", text="", step=1):
    return {"shape": shape, "x": x, "y": y, "w": w, "h": h, "color": color, "text": text, "step": step}


GOOD = {"type": "sketch", "parts": [
    part("circle", 120, 160, 360, 300, "gold"), part("scribble", 140, 300, 320, 40, "ink"),
    part("face", 600, 120, 200, 200, "card", "angry", 2), part("arrow", 480, 300, 100, 20, "coral", "", 2),
    part("text", 520, 420, 360, 90, "ink", "Phần của tôi", 3)]}


class SketchTests(unittest.TestCase):
    def test_draws_step_by_step(self):
        self.assertEqual(story_visual_art.steps(GOOD), 3)
        one, three = story_visual_art.visual_svg(GOOD, 1), story_visual_art.visual_svg(GOOD, 3)
        self.assertLess(len(one), len(three))
        self.assertIn(b"viewBox=\"0 0 960 630\"", three)

    def test_bad_parts_are_refused_not_repaired(self):
        for bad in ({**GOOD, "parts": GOOD["parts"][:2]},
                    {**GOOD, "parts": GOOD["parts"] + [part("box", 900, 600, 200, 100)]},
                    {**GOOD, "parts": GOOD["parts"] + [part("star", 10, 10, 50, 50, "pink")]},
                    {**GOOD, "parts": GOOD["parts"] + [part("face", 10, 10, 50, 50, "card", "grin")]},
                    {**GOOD, "parts": [part("box", 10, 10, 90, 90, step=1), part("box", 200, 10, 90, 90, step=3), part("box", 400, 10, 90, 90, step=3)]},
                    {**GOOD, "parts": GOOD["parts"] + [part("text", 10, 10, 60, 60, "ink", "một dòng chữ quá dài không thể nằm vừa trong ô này")]}):
            with self.assertRaises(ValueError):
                story_visual_art.visual_svg(bad)

    def test_a_scene_can_carry_a_sketch(self):
        spec = scene_assembler.graphic_to_spec({"motif": "sketch", "anchor_id": "a1", "parts": GOOD["parts"]})
        self.assertEqual(spec["type"], "sketch")
        self.assertGreater(story_visual_art.steps(spec), 0)

    def test_the_menu_offers_sketch_first(self):
        from tools.studio_project import authoring_menus
        self.assertEqual(authoring_menus.GRAPHIC_MOTIFS[0], "sketch")
        self.assertIn(graphic_sketch.SHAPES[0], authoring_menus.SKETCH_SHAPES)


if __name__ == "__main__":
    unittest.main()
