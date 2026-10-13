"""Reproducible slim plugin packaging tests, not release approval."""
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from tools.release.build_plugin_bundle import build


class CandidateBundleTests(unittest.TestCase):
    def sample(self, root):
        plugin = root / "plugins/zodiac-video-pipeline"
        entries = {
            "plugin.json": '{"name":"zodiac-video-pipeline"}',
            ".codex-plugin/plugin.json": '{"name":"zodiac-video-pipeline"}',
            "skills/zodiac-video-pipeline/SKILL.md": "# Zodiac",
            "skills/zodiac-video-pipeline/core/run.mjs": "export const run = true;",
            "skills/zodiac-video-pipeline/orchestration/tests/ignore.test.mjs": "throw Error('NO');",
            "skills/zodiac-video-pipeline/references/retired-source/dead.md": "# old",
        }
        for name, value in entries.items():
            p = plugin / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(value)
        return plugin

    def test_deterministic_zip_and_no_dead_sources(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.sample(root)
            first, second = root / "one.zip", root / "two.zip"
            one, two = build(root, first), build(root, second)
            self.assertEqual(one["archive_sha256"], two["archive_sha256"])
            self.assertEqual(one["archive_bytes"], two["archive_bytes"])
            with ZipFile(first) as package:
                self.assertIsNone(package.testzip())
                self.assertIn("skills/zodiac-video-pipeline/core/run.mjs", package.namelist())
                self.assertNotIn("skills/zodiac-video-pipeline/orchestration/tests/ignore.test.mjs", package.namelist())
                self.assertNotIn("skills/zodiac-video-pipeline/references/retired-source/dead.md", package.namelist())
            self.assertFalse(one["release_approved"])

    def test_missing_static_esm_dependency_blocks_zip(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            plugin = self.sample(root)
            entry = plugin / "skills/zodiac-video-pipeline/core/run.mjs"
            entry.write_text("import './missing.mjs';")
            with self.assertRaisesRegex(ValueError, "PLUGIN_STATIC_IMPORT_MISSING"):
                build(root, root / "candidate.zip")

    def test_version_mismatch_blocks_packaging(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            plugin = self.sample(root)
            (plugin / ".codex-plugin/plugin.json").write_text('{"version":"2.4.0"}')
            with self.assertRaisesRegex(ValueError, "PLUGIN_RELEASE_VERSION_MISMATCH"):
                build(root, root / "candidate.zip")

    def test_required_manifest_missing_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            plugin = self.sample(root)
            (plugin / ".codex-plugin/plugin.json").unlink()
            with self.assertRaisesRegex(ValueError, "PLUGIN_REQUIRED_FILE_MISSING"):
                build(root, root / "candidate.zip")


if __name__ == "__main__":
    unittest.main()
