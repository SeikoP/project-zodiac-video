import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_validation import validate_job5_package_root

FIXTURE = Path(__file__).parent / "fixtures/simplification/taurus-job5.zip"


class SimplificationPackageTests(unittest.TestCase):
    def test_real_zip_current_and_audited_legacy_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            zipfile.ZipFile(FIXTURE).extractall(root)
            for fingerprint in [
                canonical_contract_hash("authoring-ir-v1"),
                "787bd1c4addd6cf3ec187b4019b5c988555df870563f75989d0ef6b5dfd52f21",
            ]:
                manifest_path = root / "package-manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest["contract"]["sha256"] = fingerprint
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8", newline="\n")
                self.assertIsNotNone(validate_job5_package_root(root))

    def test_unknown_hash_diagnostic_identifies_actual_expected_and_local_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            zipfile.ZipFile(FIXTURE).extractall(root)
            manifest_path = root / "package-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["contract"]["sha256"] = "0" * 64
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8", newline="\n")
            with self.assertRaises(ControlPlaneError) as caught:
                validate_job5_package_root(root)
            error = caught.exception
            self.assertEqual(error.detail["actual"], "0" * 64)
            self.assertEqual(error.detail["expected"], canonical_contract_hash("authoring-ir-v1"))
            self.assertTrue(error.detail.get("contract_path"))
            self.assertIn("runner", error.message.lower())

    def test_contiguous_voice_splits_preserve_narration_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            zipfile.ZipFile(FIXTURE).extractall(root)
            ir_path = root / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            for scene in ir["scenes"]:
                scene["voice"] += "\n"
            ir_path.write_text(json.dumps(ir), encoding="utf-8", newline="\n")
            original = (root / "narration.txt").read_text(encoding="utf-8")
            self.assertTrue(original)
            self.assertIsNotNone(validate_job5_package_root(root))
