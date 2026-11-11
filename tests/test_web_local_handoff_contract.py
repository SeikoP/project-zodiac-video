"""Release-level contract for the Web/Local Zodiac split."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class WebLocalHandoffReleaseTests(unittest.TestCase):
    def test_release_is_versioned_backed_up_and_keeps_existing_ready_inbox(self):
        plugin=json.loads((ROOT/"plugins/zodiac-video-pipeline/plugin.json").read_text(encoding="utf-8"))
        codex=json.loads((ROOT/"plugins/zodiac-video-pipeline/.codex-plugin/plugin.json").read_text(encoding="utf-8"))
        state=json.loads((ROOT/"plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json").read_text(encoding="utf-8"))
        self.assertRegex(plugin["version"],r"^\d+\.\d+\.\d+$")
        self.assertEqual(codex["version"],plugin["version"])
        self.assertEqual(state["plugin_version"],plugin["version"])
        backup=json.loads((ROOT/"docs/backups/zodiac-2.7.16.json").read_text(encoding="utf-8"))
        self.assertEqual(backup["backup_branch"],"backup/zodiac-2.7.16")
        self.assertEqual(backup["plugin_release_id"],"pluginrel_6aef5fcb6078819184d112c85268706a")
        readme=(ROOT/"README.md").read_text(encoding="utf-8")
        self.assertIn("phase1-done/",readme);self.assertIn("zodiac-video-local",readme);self.assertIn("zodiac-video-web",readme)
        studio=(ROOT/"tools/studio_qt/app.py").read_text(encoding="utf-8")
        self.assertIn('ROOT / "ready"',studio)

    def test_release_workflow_builds_both_split_archives(self):
        workflow=(ROOT/".github/workflows/zodiac-plugin-release.yml").read_text(encoding="utf-8")
        self.assertIn("zodiac-video-web-plugin-",workflow)
        self.assertIn("zodiac-video-local-plugin-",workflow)
        local=(ROOT/"plugins/zodiac-video-pipeline/skills/zodiac-video-local/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("run-local-phase03.mjs",local)

if __name__=="__main__":
    unittest.main()
