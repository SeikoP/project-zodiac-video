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
        self.assertEqual(authoring_menus.GRAPHIC_MOTIFS[:2], ("hero", "sketch"))
        self.assertIn(graphic_sketch.SHAPES[0], authoring_menus.SKETCH_SHAPES)


if __name__ == "__main__":
    unittest.main()


def hero_state(extra=()):
    return {"parts": [dict(part("circle", 200, 200, 400, 300, "card"), step=1), dict(part("scribble", 240, 330, 320, 40, "ink"), step=1), *extra]}


HERO = {"type": "hero", "states": [
    hero_state(),
    hero_state([part("line", 400, 200, 0, 300, "ink")]),
    {"parts": [part("circle", 100, 260, 260, 220, "card"), part("circle", 540, 280, 260, 220, "card"), part("arrow", 380, 360, 120, 0, "coral")]}]}


class HeroTests(unittest.TestCase):
    def test_each_state_replaces_the_one_before(self):
        self.assertEqual(story_visual_art.steps(HERO), 3)
        first, last = story_visual_art.visual_svg(HERO, 1), story_visual_art.visual_svg(HERO, 3)
        self.assertNotEqual(first, last)
        self.assertNotIn(b"<rect", first)  # the object itself, no card behind it

    def test_bad_heroes_are_refused(self):
        for bad in ({"type": "hero", "states": HERO["states"][:1]},
                    {"type": "hero", "states": [hero_state(), {"parts": [dict(p, step=2) for p in hero_state()["parts"]]}]},
                    {"type": "hero", "states": [hero_state(), {"parts": hero_state()["parts"][:1]}]}):
            with self.assertRaises(ValueError):
                story_visual_art.visual_svg(bad)

    def test_the_scene_object_changes_on_its_own_words(self):
        from tests.test_studio_scene_assembler import TWO, GOAL, cast_of
        from tools.studio_project import authoring_menus
        TEXT = "Kim Ngưu cắt bánh, đẩy phần to sang cho người yêu, rồi ngồi nhìn phần nhỏ."
        RANGE = [0, len(TEXT.encode())]
        menus = authoring_menus.scene_menus({"scene_ranges": [{"id": "s01", "narration_range": RANGE, "text": TEXT}]}, TWO, "s01", [])
        ids = [a["id"] for a in menus["anchors"]]
        graphic = {"motif": "hero", "anchor_id": ids[0], "name": "bánh", "states": [
            {"anchor_id": ids[0], **{"parts": HERO["states"][0]["parts"]}}, {"anchor_id": ids[1], "parts": HERO["states"][1]["parts"]},
            {"anchor_id": ids[2], "parts": HERO["states"][2]["parts"]}]}
        stage = {"frame_id": "two-person-offset", "mechanic_id": "explain", "present": cast_of(TWO, 2), "props": [], "dressing": "none", "graphic": graphic}
        part_ = scene_assembler.assemble_scene(menus, stage, {"events": []}, "s01", RANGE, TEXT, GOAL)
        events = [e for e in part_["payload"]["scene"]["events"] if e["target"] == "graphic_s01"]
        self.assertEqual([e["state_after"] for e in events], ["step1", "step2", "step3"])
        by = {a["id"]: a["text"] for a in menus["anchors"]}
        self.assertEqual([e["trigger"]["text"] for e in events], [by[i] for i in ids[:3]])
        late_first = {**graphic, "states": [graphic["states"][1], graphic["states"][0], graphic["states"][2]]}
        with self.assertRaises(ValueError):
            scene_assembler.assemble_scene(menus, {**stage, "graphic": late_first}, {"events": []}, "s01", RANGE, TEXT, GOAL)
