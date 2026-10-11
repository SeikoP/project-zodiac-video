import json, tempfile, unittest, zipfile
from pathlib import Path
from tools.control_plane.package_validation import validate_job5_package_root
from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
FIXTURE=Path(__file__).parent/'fixtures/simplification/taurus-job5.zip'
class SimplificationPackageTests(unittest.TestCase):
 def test_real_zip_current_and_audited_legacy_import(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);zipfile.ZipFile(FIXTURE).extractall(root)
   for fingerprint in [canonical_contract_hash('authoring-ir-v1'),'787bd1c4addd6cf3ec187b4019b5c988555df870563f75989d0ef6b5dfd52f21']:
    m=json.loads((root/'package-manifest.json').read_text());m['contract']['sha256']=fingerprint;(root/'package-manifest.json').write_text(json.dumps(m));self.assertIsNotNone(validate_job5_package_root(root))
 def test_unknown_hash_diagnostic_identifies_actual_expected_and_local_path(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);zipfile.ZipFile(FIXTURE).extractall(root);m=json.loads((root/'package-manifest.json').read_text());m['contract']['sha256']='0'*64;(root/'package-manifest.json').write_text(json.dumps(m))
   with self.assertRaises(ControlPlaneError) as caught:validate_job5_package_root(root)
   error=caught.exception;self.assertEqual(error.detail['actual'],'0'*64);self.assertEqual(error.detail['expected'],canonical_contract_hash('authoring-ir-v1'));self.assertTrue(error.detail.get('contract_path'));self.assertIn('runner',error.message.lower())
 def test_contiguous_voice_splits_preserve_narration_bytes(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);zipfile.ZipFile(FIXTURE).extractall(root);ir=json.loads((root/'production.ir.json').read_text());[(scene.update(voice=scene['voice']+'\n')) for scene in ir['scenes']];(root/'production.ir.json').write_text(json.dumps(ir));original=(root/'narration.txt').read_text();self.assertIsNotNone(validate_job5_package_root(root))
