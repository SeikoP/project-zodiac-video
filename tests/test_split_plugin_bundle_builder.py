"""Split Zodiac Web/Local plugin bundle tests."""
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from tools.release.build_split_plugin_bundle import build_profile

ROOT = Path(__file__).resolve().parents[1]


class SplitPluginBundleTests(unittest.TestCase):
    def test_profiles_are_deterministic_and_have_distinct_entrypoints(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            web1 = build_profile(ROOT, "web", temp / "web1.zip")
            web2 = build_profile(ROOT, "web", temp / "web2.zip")
            local = build_profile(ROOT, "local", temp / "local.zip")
            self.assertEqual(web1["archive_sha256"], web2["archive_sha256"])
            self.assertNotEqual(web1["plugin_name"], local["plugin_name"])
            with ZipFile(temp / "web1.zip") as z:
                names = set(z.namelist())
                manifest = json.loads(z.read("plugin.json"))
                self.assertEqual(manifest["name"], "zodiac-video-web")
                self.assertIn("skills/zodiac-video-web/SKILL.md", names)
                self.assertNotIn("skills/zodiac-video-local/SKILL.md", names)
                self.assertNotIn("skills/zodiac-video-pipeline/SKILL.md", names)
                self.assertIn("skills/zodiac-video-pipeline/contracts/phase1-handoff.mjs", names)
                self.assertNotIn("skills/humanizer/SKILL.md", names)
                self.assertFalse(any(name.endswith(".svg") for name in names))
                self.assertGreater(web1["deferred_file_count"], 0)
                self.assertIn("skills/zodiac-video-pipeline/references/voice-profile.md", names)
                self.assertIn("skills/zodiac-video-pipeline/references/validate-narrative-design.mjs", names)
                self.assertIn("skills/zodiac-video-pipeline/references/validate-voice-fidelity-review.mjs", names)
                self.assertNotIn("01-content → 02-visual-production → 03-handoff", manifest["extensions"]["com.openai"]["interface"]["defaultPrompt"])
            with ZipFile(temp / "local.zip") as z:
                names = set(z.namelist())
                manifest = json.loads(z.read("plugin.json"))
                self.assertEqual(manifest["name"], "zodiac-video-local")
                self.assertIn("skills/zodiac-video-local/SKILL.md", names)
                self.assertNotIn("skills/zodiac-video-web/SKILL.md", names)
                self.assertNotIn("skills/zodiac-video-pipeline/SKILL.md", names)
                self.assertIn("skills/zodiac-video-pipeline/phases/local/local-bootstrap.mjs", names)
                self.assertNotIn("skills/humanizer/SKILL.md", names)


if __name__ == "__main__":
    unittest.main()
