"""Regression: Vietnamese accent outlines must fit authored lettering surfaces."""
import json
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path


def test_story_text_ink_stays_inside_its_surface(tmp_path):
    cases = {
        "stamp": ("SỬA CẦU", (125, 90, 875, 195)),
        "title": ("TỰ TIN CHƯA ĐỦ", (100, 65, 900, 330)),
        "score": ("LẦN THỬ: 2", (80, 65, 897, 210)),
        "thought": ("NHANH THẬT KHÔNG?", (80, 65, 520, 185)),
        "bubble": ("ĐỔI LÀM GÌ?", (65, 57, 535, 180)),
        "tag": ("ĐÚNG HẸN", (70, 60, 470, 175)),
        "note": ("ĐÃ THUỘC ĐƯỜNG", (100, 75, 900, 180)),
    }
    entities, assets = [], {}
    for style, (text, _) in cases.items():
        assets[style] = {"path": f"assets/{style}.svg", "category": "overlay"}
        entities.append({"visual_role": "overlay", "states": {"shown": {"asset": style}},
                         "story_text": {"states": {"shown": text}, "styles": {"shown": style}}})
    authoring = tmp_path / ".authoring"
    authoring.mkdir()
    (authoring / "visual-intent.json").write_text(json.dumps({
        "assets": assets, "scenes": [{"entities": entities}]}), encoding="utf-8")
    root = Path(__file__).resolve().parents[1]
    subprocess.run([sys.executable, str(root / "tools/preview/bake-story-text.py"), str(tmp_path)],
                   check=True, capture_output=True)
    for style, (_, safe) in cases.items():
        svg = ET.parse(tmp_path / f"assets/{style}.svg")
        count = 0
        for element in svg.iter():
            if element.get("fill") not in {"#2F3C44", "#E97A66"} or element.get("stroke"):
                continue
            pen = BoundsPen(None)
            parse_path(element.attrib["d"], pen)
            x0, y0, x1, y1 = pen.bounds
            assert x0 >= safe[0] - .02 and y0 >= safe[1] - .02, (style, pen.bounds)
            assert x1 <= safe[2] + .02 and y1 <= safe[3] + .02, (style, pen.bounds)
            count += 1
        assert count, style
