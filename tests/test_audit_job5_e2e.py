import json
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_job5_e2e import verify, CHECKS

class AcceptanceGateTests(unittest.TestCase):
    def test_rejects_unverified(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "receipt.json"
            p.write_text('{"contract":"zodiac-job@5","scenes":[]}', encoding="utf-8")
            self.assertIn("SCENES_MISSING", verify(p))
    def test_complete_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            artifacts = {}
            for name in ("video", "cover", "publish_json", "publish_copy"):
                p = d / (name + ".dat")
                p.write_bytes(b"x")
                artifacts[name] = p.name
            scene = dict(id="S01", reviewed_frames=[0.1, 1.0, 2.0])
            scene.update({name: True for name in CHECKS})
            obj = dict(contract="zodiac-job@5", scenes=[scene], artifacts=artifacts,
                       voice_caption_synced=True, ending_not_cut=True,
                       gui_responsive=True, logs_unobstructed=True)
            p = d / "receipt.json"
            p.write_text(json.dumps(obj), encoding="utf-8")
            self.assertEqual([], verify(p))
if __name__ == "__main__":
    unittest.main()
