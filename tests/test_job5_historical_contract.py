"""Historical Job@5 fingerprint regression: accept audited hashes, never unsupported IR."""
from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.controller import StudioV2Controller

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/fixtures/control-plane-v2/minimal"
AUDITED_HASH = "d6af8a599324fcf68dd43fb1627a0dc23f9b3db07ba0874eeb8a86e5df1a43c0"


def make_old_job5(root: Path):
    source = root / "old-job5"
    shutil.copytree(FIXTURE, source)
    shutil.rmtree(source / ".runtime", ignore_errors=True)
    (source / "narration.txt").write_text("xin chao\n", "utf8")
    publish = source / "publish"
    publish.mkdir(exist_ok=True)
    (publish / "publish.json").write_text(json.dumps({
        "format": "zodiac-publish@1",
        "source": {"narration": "narration.txt", "production": "production.ir.json"},
    }), "utf8")
    (publish / "publish-copy.txt").write_text("Legacy copy\n", "utf8")
    manifest = {
        "format": "zodiac-job@5", "job": {"id": "legacy-taurus", "revision": "1.0.0"},
        "contract": {"id": "zodiac-authoring-ir", "version": "1.0.0", "sha256": AUDITED_HASH},
        "renderer": {"id": "zodiac-renderer", "version": "2.0.1"},
        "producer": {"plugin": "zodiac-video-pipeline", "version": "2.0.0"},
    }
    (source / "package-manifest.json").write_text(json.dumps(manifest), "utf8")
    return source


class HistoricalJob5CompatibilityTests(unittest.TestCase):
    def test_historical_fingerprint_imports_and_reopens(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = make_old_job5(root)
            controller = StudioV2Controller(root / "workspace")
            controller.import_package(source)
            self.assertEqual(
                (controller.workspace / "narration.txt").read_bytes(),
                (source / "narration.txt").read_bytes(),
            )
            restored = StudioV2Controller(root / "workspace")
            self.assertEqual(restored.state.package.display_name, "old-job5")
            self.assertTrue((restored.workspace / "production.ir.json").is_file())

    def test_historical_hash_does_not_allow_retired_story_symbol(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = make_old_job5(root)
            ir_path = source / "production.ir.json"
            ir = json.loads(ir_path.read_text("utf8"))
            ir["scenes"][0]["entities"][0]["visual_role"] = "story_symbol"
            ir_path.write_text(json.dumps(ir), "utf8")
            with self.assertRaises(ControlPlaneError) as error:
                StudioV2Controller(root / "workspace").import_package(source)
            self.assertEqual(error.exception.code, "AUTHORING_IR_INVALID")

    def test_unverified_fingerprint_stays_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = make_old_job5(root)
            manifest_path = source / "package-manifest.json"
            manifest = json.loads(manifest_path.read_text("utf8"))
            manifest["contract"]["sha256"] = "e" * 64
            manifest_path.write_text(json.dumps(manifest), "utf8")
            with self.assertRaises(ControlPlaneError) as error:
                StudioV2Controller(root / "workspace").import_package(source)
            self.assertEqual(error.exception.code, "PACKAGE_CONTRACT_MISMATCH")

    def test_canonical_current_fingerprint_not_replaced(self):
        self.assertNotEqual(canonical_contract_hash("authoring-ir-v1"), AUDITED_HASH)


if __name__ == "__main__":
    unittest.main()
