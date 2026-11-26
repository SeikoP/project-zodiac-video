"""Core-rendered scene accent art: the agent picks parts, Core draws them in the channel style, deterministically."""
import json
import re
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from tools.studio_project import accent_art

PALETTE = {"#F6F0E6", "#FFFDF9", "#2F3C44", "#5C6B75", "#4B5B61", "#F1C6A0", "#D0C1B3", "#8EC0B9", "#E97A66", "#F2C45C", "#435064"}


def spec(*parts):
    return {"parts": [{"part": p, "at": a, "size": s} for p, a, s in parts]}


class RenderTests(unittest.TestCase):
    def test_every_part_renders_valid_svg_in_the_channel_style(self):
        for part in accent_art.PARTS:
            at = "across" if accent_art.PARTS[part]["mount"] == "top" and accent_art.PARTS[part]["wide"] else "center"
            svg = accent_art.accent_svg(spec((part, at, "medium"))).decode("utf8")
            root = ET.fromstring(svg)
            self.assertTrue(root.tag.endswith("svg"), part)
            self.assertEqual(root.get("viewBox"), "0 0 900 420", part)
            self.assertNotIn("<text", svg, part)
            self.assertNotRegex(svg, r"filter|gradient|<script|href=|data:", part)
            self.assertIn("human-stroke-v2", svg, part)
            colors = {c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}", svg)}
            self.assertTrue(colors <= PALETTE, (part, colors - PALETTE))
            self.assertLess(len(svg.encode()), 14000, part)
            widths = {float(w) for w in re.findall(r'stroke-width="([\d.]+)"', svg)}
            self.assertTrue(widths and min(widths) >= 4 and max(widths) <= 9, (part, widths))

    def test_the_same_spec_gives_the_same_bytes_and_a_different_spec_does_not(self):
        a = accent_art.accent_svg(spec(("window", "left", "large"), ("lamp", "right", "medium")))
        self.assertEqual(a, accent_art.accent_svg(spec(("window", "left", "large"), ("lamp", "right", "medium"))))
        self.assertNotEqual(a, accent_art.accent_svg(spec(("window", "left", "large"), ("plant", "right", "medium"))))

    def test_parts_stay_inside_their_slots(self):
        for at, (lo, hi) in {"left": (0, 300), "center": (300, 600), "right": (600, 900)}.items():
            for part, meta in accent_art.PARTS.items():
                if meta["wide"]:
                    continue
                for size in ("small", "medium", "large"):
                    box = accent_art.layout(spec((part, at, size)))[0]["box"]
                    self.assertGreaterEqual(box["x"], lo, (part, at, size))
                    self.assertLessEqual(box["x"] + box["w"], hi, (part, at, size))
                    self.assertGreaterEqual(box["y"], 0, (part, size))
                    self.assertLessEqual(box["y"] + box["h"], 420, (part, size))

    def test_an_across_part_leaves_the_floor_to_floor_parts(self):
        rows = accent_art.layout(spec(("awning", "across", "medium"), ("counter", "center", "medium"), ("plant", "right", "small")))
        top = next(r for r in rows if r["part"] == "awning")["box"]
        for row in rows:
            if row["part"] != "awning":
                self.assertGreaterEqual(row["box"]["y"], top["y"] + top["h"] - 40, row["part"])

    def test_a_larger_size_is_larger(self):
        for part in ("window", "lamp", "tree", "door"):
            small, large = (accent_art.layout(spec((part, "center", s)))[0]["box"] for s in ("small", "large"))
            self.assertGreater(large["h"], small["h"], part)

    def test_floor_parts_share_one_floor_and_wall_parts_hang_above_it(self):
        boxes = {r["part"]: r["box"] for r in accent_art.layout(spec(("lamp", "left", "medium"), ("window", "center", "medium"), ("plant", "right", "medium")))}
        self.assertEqual(boxes["lamp"]["y"] + boxes["lamp"]["h"], boxes["plant"]["y"] + boxes["plant"]["h"])
        self.assertLess(boxes["window"]["y"] + boxes["window"]["h"], boxes["lamp"]["y"] + boxes["lamp"]["h"])

    def test_invalid_specs_are_rejected_not_repaired(self):
        bad = [spec(), spec(("castle", "left", "small")), spec(("window", "middle", "small")), spec(("window", "left", "huge")),
               spec(("window", "left", "small"), ("lamp", "left", "small")),
               spec(("window", "left", "small"), ("lamp", "center", "small"), ("clock", "right", "small"), ("plant", "across", "small")),
               spec(("window", "across", "small")),
               spec(("awning", "across", "medium"), ("menu_board", "right", "small")),   # a top-hung part collides with the awning
               spec(("awning", "across", "medium"), ("window", "left", "small")),        # so does a wall part
               {"parts": [{"part": "window", "at": "left", "size": "small", "extra": 1}]}, {"parts": "window"}, {}]
        for item in bad:
            with self.assertRaises(ValueError, msg=item):
                accent_art.accent_svg(item)


class LayerTests(unittest.TestCase):
    """Things that hang go on a wall layer, things that stand go on a floor layer, so Core can seat each where it belongs."""

    S = spec(("awning", "across", "medium"), ("counter", "center", "medium"), ("plant", "right", "small"))

    def test_the_wall_layer_holds_only_hung_parts_and_the_floor_layer_only_standing_ones(self):
        wall, floor = (accent_art.layer_svg(self.S, k) for k in ("wall", "floor"))
        self.assertIsNotNone(wall)
        self.assertIsNotNone(floor)
        self.assertNotEqual(wall, floor)
        self.assertIsNone(accent_art.layer_svg(spec(("window", "left", "small")), "floor"))
        self.assertIsNone(accent_art.layer_svg(spec(("counter", "left", "small")), "wall"))

    def test_each_layer_is_cropped_to_its_content_and_keeps_the_full_width(self):
        for kind in ("wall", "floor"):
            view = accent_art.layer_view(self.S, kind)
            root = ET.fromstring(accent_art.layer_svg(self.S, kind).decode("utf8"))
            self.assertEqual(root.get("viewBox"), f"0 {view['y']} 900 {view['h']}")
            self.assertEqual((root.get("width"), root.get("height")), ("900", str(view["h"])))
            self.assertLess(view["h"], 420)
        wall, floor = accent_art.layer_view(self.S, "wall"), accent_art.layer_view(self.S, "floor")
        self.assertEqual(wall["y"], 0)
        self.assertEqual(floor["y"] + floor["h"], 420)
        self.assertEqual(accent_art.layer_view(self.S, "floor")["floor_y"], accent_art.FLOOR)

    def test_layers_use_the_canonical_palette_and_are_deterministic(self):
        for kind in ("wall", "floor"):
            svg = accent_art.layer_svg(self.S, kind)
            self.assertEqual(svg, accent_art.layer_svg(self.S, kind))
            colors = {c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}", svg.decode("utf8"))}
            self.assertTrue(colors <= PALETTE, colors - PALETTE)
            self.assertNotIn(b"<text", svg)

    def test_normalized_layers_name_each_layer_once_and_skip_the_empty_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            both = accent_art.normalized_layers(self.S, directory=Path(tmp), write=True)
            self.assertEqual(set(both), {"wall", "floor"})
            self.assertNotEqual(both["wall"]["asset"]["path"], both["floor"]["asset"]["path"])
            for row in both.values():
                self.assertTrue(accent_art.is_drawn_accent(row["asset"], Path(tmp)))
            only = accent_art.normalized_layers(spec(("window", "left", "small")), directory=Path(tmp), write=False)
            self.assertEqual(set(only), {"wall"})


class AssetTests(unittest.TestCase):
    def test_a_normalized_asset_is_content_addressed_and_only_written_on_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = spec(("awning", "across", "medium"), ("counter", "center", "medium"))
            asset = accent_art.normalized_accent(s, directory=Path(tmp), write=False)
            self.assertEqual(asset["category"], "scene_accent")
            self.assertRegex(asset["path"], r"^\.authoring/agent-art/accent-[0-9a-f]{64}\.svg$")
            self.assertEqual(asset["creative_origin"]["mode"], "studio_template")
            self.assertFalse((Path(tmp) / asset["path"]).exists())
            again = accent_art.normalized_accent(s, directory=Path(tmp), write=True)
            self.assertEqual(again, asset)
            self.assertEqual(accent_art.sha256((Path(tmp) / asset["path"]).read_bytes()), asset["source_sha256"])

    def test_only_a_rendered_accent_is_recognised(self):
        with tempfile.TemporaryDirectory() as tmp:
            asset = accent_art.normalized_accent(spec(("window", "left", "medium")), directory=Path(tmp), write=True)
            self.assertTrue(accent_art.is_drawn_accent(asset, Path(tmp)))
            self.assertFalse(accent_art.is_drawn_accent({**asset, "source_sha256": "0" * 64}, Path(tmp)))
            self.assertFalse(accent_art.is_drawn_accent({**asset, "path": ".authoring/agent-art/accent-" + "1" * 64 + ".svg"}, Path(tmp)))
            self.assertFalse(accent_art.is_drawn_accent({**asset, "extra": 1}, Path(tmp)))
            (Path(tmp) / asset["path"]).write_bytes(b"<svg xmlns='http://www.w3.org/2000/svg'/>")
            self.assertFalse(accent_art.is_drawn_accent(asset, Path(tmp)))  # bytes changed after the hash was taken


if __name__ == "__main__":
    unittest.main()
