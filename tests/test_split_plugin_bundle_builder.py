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
                self.assertIn("skills/zodiac-narrative-mechanics/SKILL.md", names)
                mechanics = z.read("skills/zodiac-narrative-mechanics/SKILL.md").decode("utf-8")
                for term in ("Escalating Roast", "Defense Collapse", "Reverse Reveal", "Only a real explicit user Content Review approval"):
                    self.assertIn(term, mechanics)
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
                self.assertNotIn("skills/zodiac-narrative-mechanics/SKILL.md", names)
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


    def test_web_audience_alignment_is_reachable_and_preserves_pov_flexibility(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "web.zip"
            build_profile(ROOT, "web", output)
            with ZipFile(output) as z:
                skill = z.read("skills/zodiac-video-web/SKILL.md").decode("utf-8")
                mechanics = z.read("skills/zodiac-narrative-mechanics/SKILL.md").decode("utf-8")
                prompt = json.loads(z.read("plugin.json"))["extensions"]["com.openai"]["interface"]["defaultPrompt"]
                microphases = skill.split("## Creative microphases", 1)[1].split("## Creative-first rule", 1)[0]
                for line in ("**Concept**", "**Narrative Design**", "**Content Review**"):
                    step = next(s for s in microphases.splitlines() if line in s)
                    self.assertIn("Audience Alignment", step)
                for phrase in ("Viewer POV", "Role bias test", "Behavioral alternatives",
                               "Recognition payoff", "Review and repair", "predominantly female audience",
                               "explicit episode audience/POV overrides", "changing pronouns alone is not a repair",
                               "love-sincere / Sagittarius", "no new mandatory JSON fields"):
                    self.assertIn(phrase, skill)
                self.assertIn("Audience Alignment Gate", mechanics)
                self.assertIn("Invitations are one option", mechanics)
                self.assertIn("Audience Alignment", prompt)
                self.assertIn("role bias", prompt)

    def test_canonical_router_prompt_keeps_phase1_creative_checks(self):
        plugin_root = ROOT / "plugins/zodiac-video-pipeline"
        manifest = json.loads((plugin_root / "plugin.json").read_text(encoding="utf-8"))
        codex = json.loads((plugin_root / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
        prompt = manifest["extensions"]["com.openai"]["interface"]["defaultPrompt"].lower()
        self.assertEqual(prompt, codex["interface"]["defaultPrompt"].lower())
        for requirement in ("broad-recognition", "zodiac-identity", "audience alignment", "role bias", "evidence-bounded", "audio-only", "silent-read"):
            self.assertIn(requirement, prompt)
        self.assertIn("no native source bootstrap", prompt)

    def test_web_phase1_handoff_guidance_requires_runnable_performance_plan(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            build_profile(ROOT, "web", temp / "web.zip")
            with ZipFile(temp / "web.zip") as z:
                skill = z.read("skills/zodiac-video-web/SKILL.md").decode("utf-8").lower()
                for phrase in (
                    'version: "2.1"',
                    "voice_anchor",
                    "occurrence",
                    "delivery",
                    "energy",
                    "emotion",
                    "pace",
                    "emphasis",
                    "reason",
                    "before content review",
                    "do not invent",
                ):
                    self.assertIn(phrase, skill)


    def test_web_distribution_packages_narration_skeleton_and_references(self):
        import re
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "web.zip"
            build_profile(ROOT, "web", destination)
            with ZipFile(destination) as archive:
                names = set(archive.namelist())
                text = lambda suffix: next(
                    archive.read(n).decode("utf-8") for n in names if n.endswith(suffix)
                )
                skill = text("skills/zodiac-video-web/SKILL.md")
                manifest = json.loads(text("orchestration/phases/01-content.json"))
                plugin = json.loads(text("/plugin.json") if any(n.endswith("/plugin.json") for n in names) else text("plugin.json"))
        base = "skills/zodiac-video-pipeline/"
        skeleton = base + "references/narration-skeleton.md"
        styles = base + "references/style-references/profile-structure-references.md"
        for required in (skeleton, styles):
            self.assertTrue(any(n.endswith(required) for n in names), required)
        # Every reference the narration step loads must be inside the Web zip.
        narration = next(s for s in manifest["steps"] if s["id"] == "narration")
        for ref in narration["load_references"]:
            self.assertTrue(
                any(n.endswith(base + ref) for n in names), f"not packaged: {ref}"
            )
        # The Web entry skill can select a mode and apply the Trend Phrase Pass.
        for phrase in (
            "Narration shape",
            "Narration shape check",
            "Trend Phrase Pass",
            "long profile",
            "short profile",
            "situation",
            "narration-skeleton.md",
        ):
            self.assertIn(phrase.lower(), skill.lower(), phrase)
        # Web has no native runtime: validators and tests are not shipped.
        for n in names:
            self.assertNotIn("validate-narration-skeleton", n)
            self.assertNotIn("validate-trend-phrases", n)
            self.assertFalse(n.endswith(".test.mjs"), n)
        # Plan 2.1 / handoff@2 stay compatible.
        self.assertTrue(any(n.endswith("contracts/phase1-handoff.mjs") for n in names))
        self.assertIn("2.1", skill)
        self.assertIn("zodiac-phase1-handoff@2", skill)
        self.assertTrue(plugin["version"])

    def test_web_content_review_rules_close_the_2_13_0_gaps(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "web.zip"
            build_profile(ROOT, "web", destination)
            with ZipFile(destination) as archive:
                text = lambda suffix: next(
                    archive.read(n).decode("utf-8") for n in archive.namelist() if n.endswith(suffix)
                ).lower()
                skill = text("zodiac-video-web/SKILL.md")
                story = text("references/story-visual-direction.md")
                motif = text("references/narrative-motif.md")
                briefing = text("references/phase01-briefing.md")
                skeleton = text("references/narration-skeleton.md")
        for phrase in ("story visual candidate review", "at least two candidates", "which condition failed"):
            self.assertIn(phrase, story, phrase)
        self.assertIn("candidate review", skill)
        for doc in (motif, briefing):
            self.assertIn("motif_candidates", doc)
        self.assertIn("must not contain `narrative_motif`", motif)
        for phrase in (
            "concept fit",
            "hook carries the concept",
            "per-paragraph token table",
            "sign-swap test names the swap sign",
            "referent",
            "trend search status",
        ):
            self.assertIn(phrase, skeleton, phrase)
        self.assertIn("per-paragraph token table", skill)
        self.assertIn("trend search status", skill)

    def test_plugin_manifests_share_one_version(self):
        base = ROOT / "plugins/zodiac-video-pipeline"
        versions = {
            json.loads((base / "plugin.json").read_text(encoding="utf-8"))["version"],
            json.loads((base / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))["version"],
            json.loads(
                (base / "skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json")
                .read_text(encoding="utf-8")
            )["plugin_version"],
        }
        self.assertEqual(len(versions), 1, versions)

    def test_phase1_ci_no_longer_runs_legacy_native_web_authoring(self):
        workflow = (ROOT / ".github/workflows/phase1-voice-first.yml").read_text(encoding="utf-8")
        self.assertNotIn("phase01-agent-e2e.test.mjs", workflow)
        self.assertNotIn("episode-phase01-e2e.test.mjs", workflow)
        self.assertIn("phase1-handoff-export.test.mjs", workflow)
        self.assertIn("local-phase1-bootstrap.test.mjs", workflow)


if __name__ == "__main__":
    unittest.main()
