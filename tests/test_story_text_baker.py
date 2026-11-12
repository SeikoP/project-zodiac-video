import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET


class CompactStoryTextTests(unittest.TestCase):
    def test_compact_treatments_bake_distinct_portable_outlines(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entities, assets = [], {}
            for style, text in [('bubble', 'Không nha!'), ('thought', 'Đang ổn mà'),
                                ('burst', 'WOW!'), ('whisper', 'Ủa...'), ('tag', 'Đã chọn'),
                                ('ribbon', 'Chốt rồi'), ('underline', 'Vẫn tốt'), ('sfx', 'RẦM!')]:
                assets[style] = {'path': f'assets/{style}.svg', 'category': 'overlay'}
                entities.append({'visual_role': 'overlay', 'states': {'shown': {'asset': style}},
                                 'story_text': {'states': {'shown': text}, 'styles': {'shown': style}}})
            intent = root / 'intent.json'
            intent.write_text(json.dumps({'assets': assets, 'scenes': [{'entities': entities}]}), encoding='utf-8')
            result = subprocess.run([sys.executable, str(repo / 'tools/preview/bake-story-text.py'),
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


if __name__ == '__main__':
    unittest.main()
