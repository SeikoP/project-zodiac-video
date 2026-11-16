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
                self.assertIn("skills/zodiac-video-pipeline/references/zodiac-identity-first.md", names)
                self.assertNotIn("package.json", names)
                self.assertNotIn("package-lock.json", names)
                self.assertFalse(any("validate-" in name and name.endswith(".mjs") for name in names))
                self.assertFalse(any("/core/performance/" in name for name in names))
                self.assertLess(len(names), 30)
                self.assertNotIn("01-content → 02-visual-production → 03-handoff", manifest["extensions"]["com.openai"]["interface"]["defaultPrompt"])
            with ZipFile(temp / "local.zip") as z:
                names = set(z.namelist())
                manifest = json.loads(z.read("plugin.json"))
                self.assertEqual(manifest["name"], "zodiac-video-local")
                self.assertTrue(manifest["extensions"]["com.openai"]["interface"]["shortDescription"].startswith(f"v{manifest['version']} | "))
                self.assertIn("skills/zodiac-video-local/SKILL.md", names)
                self.assertNotIn("skills/zodiac-video-web/SKILL.md", names)
                self.assertNotIn("skills/zodiac-video-pipeline/SKILL.md", names)
                self.assertIn("skills/zodiac-video-pipeline/phases/local/local-bootstrap.mjs", names)
                self.assertNotIn("skills/humanizer/SKILL.md", names)


    def test_web_phase1_packages_prewrite_motif_and_rhythm_guidance(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            web = build_profile(ROOT, "web", temp / "web.zip")
            canonical = json.loads((ROOT / "plugins/zodiac-video-pipeline/plugin.json").read_text(encoding="utf-8"))
            self.assertEqual(web["version"], canonical["version"])
            with ZipFile(temp / "web.zip") as z:
                names = set(z.namelist())
                motif_path = "skills/zodiac-video-pipeline/references/narrative-motif.md"
                self.assertIn(motif_path, names)
                motif = z.read(motif_path).decode("utf-8")
                self.assertIn("narrative_motif", motif)
                self.assertIn("removal_test", motif)
                self.assertIn("second-half", motif)

                phase = json.loads(z.read("skills/zodiac-video-pipeline/orchestration/phases/01-content.json"))
                design = next(step for step in phase["steps"] if step["id"] == "narrative_design")
                self.assertIn("references/narrative-motif.md", design["load_references"])
                self.assertIn("narrative-motif", design["creative_outputs"])

                skill = z.read("skills/zodiac-video-web/SKILL.md").decode("utf-8")
                self.assertIn("Narrative Motif", skill)
                self.assertIn("second-half", skill)
                self.assertIn("no stale", skill.lower())


    def test_web_phase1_preserves_creative_editorial_invariants(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            build_profile(ROOT, "web", temp / "web.zip")
            with ZipFile(temp / "web.zip") as z:
                skill = z.read("skills/zodiac-video-web/SKILL.md").decode("utf-8")
                lower = skill.lower()
                for phrase in (
                    "behavior core",
                    "broad recognition",
                    "multi-context test",
                    "scenario-dependency test",
                    "scene dominance",
                    "moral drift",
                    "unsupported motive",
                    "style-only firewall",
                    "recognition is not progression",
                    "behavior first, label second",
                    "silent-read",
                    "audio-only editorial pass",
                    "physical situations in narrative design",
                ):
                    self.assertIn(phrase, lower)
                self.assertIn("zodiac-phase1-handoff@2", skill)

                manifest = json.loads(z.read("plugin.json"))
                prompt = manifest["extensions"]["com.openai"]["interface"]["defaultPrompt"].lower()
                self.assertIn("recognition", prompt)
                self.assertIn("identity", prompt)
                self.assertNotIn("run validators", prompt)


    def test_canonical_router_prompt_keeps_phase1_creative_checks(self):
        plugin_root = ROOT / "plugins/zodiac-video-pipeline"
        manifest = json.loads((plugin_root / "plugin.json").read_text(encoding="utf-8"))
        codex = json.loads((plugin_root / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
        prompt = manifest["extensions"]["com.openai"]["interface"]["defaultPrompt"].lower()
        self.assertEqual(prompt, codex["interface"]["defaultPrompt"].lower())
        for requirement in ("broad-recognition", "zodiac-identity", "evidence-bounded", "audio-only", "silent-read"):
            self.assertIn(requirement, prompt)
        self.assertIn("no native source bootstrap", prompt)

    def test_phase1_ci_no_longer_runs_legacy_native_web_authoring(self):
        workflow = (ROOT / ".github/workflows/phase1-voice-first.yml").read_text(encoding="utf-8")
        self.assertNotIn("phase01-agent-e2e.test.mjs", workflow)
        self.assertNotIn("episode-phase01-e2e.test.mjs", workflow)
        self.assertIn("phase1-handoff-export.test.mjs", workflow)
        self.assertIn("local-phase1-bootstrap.test.mjs", workflow)


if __name__ == "__main__":
    unittest.main()
