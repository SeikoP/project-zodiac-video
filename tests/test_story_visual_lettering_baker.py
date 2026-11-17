import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET


class CompactStoryVisualLetteringTests(unittest.TestCase):
    def test_compact_treatments_bake_distinct_portable_outlines(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entities, assets = [], {}
            for style, text in [('bubble', 'Không nha!'), ('thought', 'Đang ổn mà'),
                                ('burst', 'WOW!'), ('whisper', 'Ủa...'), ('tag', 'Đã chọn'),
                                ('ribbon', 'Chốt rồi'), ('underline', 'Vẫn tốt'), ('sfx', 'RẦM!')]:
                assets[style] = {'path': f'assets/{style}.svg', 'category': 'story_visual'}
                entities.append({'kind': 'story_visual', 'visual_role': 'story_visual',
                                 'states': {'shown': {'asset': style}},
                                 'lettering': {'states': {'shown': text}, 'styles': {'shown': style}}})
            intent = root / 'intent.json'
            intent.write_text(json.dumps({'assets': assets, 'scenes': [{'entities': entities}]}), encoding='utf-8')
            result = subprocess.run([sys.executable, str(repo / 'tools/preview/bake-story-visual-lettering.py'),
                                     str(root), '--intent', str(intent)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            drawings = []
            for style in assets:
                raw = (root / assets[style]['path']).read_text(encoding='utf-8')
                svg = ET.fromstring(raw)
                box = [float(n) for n in svg.attrib['viewBox'].split()]
                self.assertLessEqual(box[2], 640)
                self.assertLessEqual(box[3], 360)
                self.assertNotIn('<text', raw)
                self.assertNotIn('<image', raw)
                self.assertIn(f'treatment={style}', raw)
                drawings.append(raw)
            self.assertEqual(len(set(drawings)), 8)
            result = subprocess.run([sys.executable, str(repo / 'tools/preview/bake-story-visual-lettering.py'),
                                     str(root), '--intent', str(intent)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual([(root / asset['path']).read_text(encoding='utf-8')
                              for asset in assets.values()], drawings)

    def test_existing_story_visual_keeps_illustration_when_lettering_is_baked(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            asset = root / 'assets/combined.svg'
            asset.parent.mkdir(parents=True)
            asset.write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800">'
                '<metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata>'
                '<path id="illustration" d="M80 600 Q400 220 900 620" fill="none" stroke="#2F3C44" stroke-width="12"/>'
                '</svg>\n', encoding='utf-8')
            intent = root / 'intent.json'
            intent.write_text(json.dumps({
                'assets': {'COMBINED': {'path': 'assets/combined.svg', 'category': 'story_visual'}},
                'scenes': [{'entities': [{
                    'kind': 'story_visual', 'visual_role': 'story_visual',
                    'states': {'shown': {'asset': 'COMBINED'}},
                    'lettering': {
                        'states': {'shown': 'ĐƯỢC XÁCH!'},
                        'styles': {'shown': 'stamp'},
                        'placements': {'shown': {'x': 180, 'y': 60, 'width': 640, 'height': 190}}
                    }
                }]}]
            }), encoding='utf-8')
            result = subprocess.run([sys.executable, str(repo / 'tools/preview/bake-story-visual-lettering.py'),
                                     str(root), '--intent', str(intent)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            raw = asset.read_text(encoding='utf-8')
            self.assertIn('id="illustration"', raw)
            self.assertIn('story-visual-lettering:start', raw)
            self.assertIn('data-story-visual-lettering="outlined"', raw)
            self.assertNotIn('<text', raw)
            first = raw
            result = subprocess.run([sys.executable, str(repo / 'tools/preview/bake-story-visual-lettering.py'),
                                     str(root), '--intent', str(intent)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(asset.read_text(encoding='utf-8'), first)


if __name__ == '__main__':
    unittest.main()
