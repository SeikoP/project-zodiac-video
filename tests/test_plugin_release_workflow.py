import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/zodiac-plugin-release.yml"

class PluginReleaseWorkflowTests(unittest.TestCase):
    def test_release_uses_hardened_bundle_builder(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("tools/release/build_plugin_bundle.py", text)
        self.assertNotIn("zip -qr", text)
        self.assertIn("candidate-plugin-report.json", text)

if __name__ == "__main__":
    unittest.main()
