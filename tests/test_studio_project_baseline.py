"""P0.1 source-verified compatibility baseline, not a runtime/approval receipt."""
import json
import subprocess
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = Path("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline")
ASSETS = ENGINE / "references/asset-library-v4"


def baseline_sources(repo_root: Path) -> dict[str, Path]:
    """Canonical source owners required by the P0->P3 migration."""
    owners = {
        "handoff": ENGINE / "phases/local/import-phase1-handoff.mjs",
        "handoff_contract": ENGINE / "contracts/phase1-handoff.mjs",
        "studio_v2": Path("tools/studio_v2/session.py"),
        "voice_store": Path("tools/studio/artifacts.py"),
        "timing": Path("tools/studio_v2/timing.py"),
        "voice": Path("tools/studio_v2/voice.py"),
        "checklist": Path("tools/studio_qt/production_checklist.py"),
        "library": Path("tools/application/library.py"),
        "artifact_graph": Path("tools/control_plane/artifact_graph.py"),
        "visual_source": ENGINE / "features/visual-composition/compile-visual-intent.mjs",
        "visual_preview": ENGINE / "features/visual-composition/build-native-preview-pairs.mjs",
        "scene_worker": ENGINE / "features/scene-production/native-scene-executor.mjs",
        "semantic_cache": ENGINE / "core/cache/phase02-semantic-cache.mjs",
        "profiler": ENGINE / "core/performance/episode-profiler.mjs",
        "diagnostics": ENGINE / "core/performance/diagnose-phase02.mjs",
        "selection": ENGINE / "core/policy/select-asset-guidance.mjs",
        "fresh_policy": ENGINE / "features/visual-composition/compile-visual-intent.mjs",
    }
    return {name: repo_root / relative for name, relative in owners.items()}


def read_json(relative: Path) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


class PhaseZeroBaselineTests(unittest.TestCase):
    def test_compatibility_source_map_is_complete(self):
        owners = baseline_sources(ROOT)
        self.assertGreaterEqual(len(owners), 15)
        for label, path in owners.items():
            with self.subTest(owner=label):
                self.assertTrue(path.is_file(), str(path))

    def test_original_import_and_job5_contract_present(self):
        self.assertTrue((ROOT / "contracts/zodiac-job-v5.schema.json").is_file())
        for p in ("tests/test_studio_v2_zip_import.py", "tests/test_studio_v2_voice.py",
                  "tests/test_studio_production_checklist.py", "tests/test_library.py"):
            self.assertTrue((ROOT / p).is_file(), p)

    def test_voice_timing_and_render_contracts_are_pinned(self):
        for p in ("timing-v1.schema.json", "render-plan-v1.schema.json",
                  "performance-context-v1.schema.json", "publish-v1.schema.json"):
            with self.subTest(contract=p):
                self.assertTrue((ROOT / "contracts" / p).is_file())

    def test_selection_filter_is_not_mislabeled_semantic_ranker(self):
        code = baseline_sources(ROOT)["selection"].read_text(encoding="utf-8")
        self.assertIn("selectAssetGuidance", code)
        self.assertIn("asset_needs", code)
        self.assertNotIn("findCandidates", code)

    def test_fresh_scene_set_rejection_exists(self):
        code = baseline_sources(ROOT)["fresh_policy"].read_text(encoding="utf-8")
        self.assertIn("FRESH_SCENE_SET_RETIRED", code)

    def test_v4_palette_constraints_and_audio_metadata_are_truthful(self):
        art = read_json(ENGINE / "art-direction/palette-registry.json")
        backgrounds = read_json(ASSETS / "background-palettes.json")
        catalog = read_json(Path("tools/livestream-pk/audio-pack.json"))
        self.assertTrue(art["policy"]["no_new_colors"])
        self.assertEqual(len(art["palettes"]), 6)
        self.assertEqual(len(backgrounds["palettes"]), 6)
        self.assertEqual(len(catalog["music"]), 16)
        self.assertTrue(all(x["file"].endswith(".mp3") for x in catalog["music"]))

    def test_v4_phone_states_share_same_body_not_five_models(self):
        ns = {"s": "http://www.w3.org/2000/svg"}
        body_paths = []
        states = ("phone", "phone-busy", "phone-ping", "phone-quiet", "phone-silent")
        props = read_json(ASSETS / "props/index.json")["assets"]
        indexed = {p["id"]: p for p in props}
        for state in states:
            with self.subTest(state=state):
                self.assertEqual(indexed[state].get("state_of", "phone"), "phone")
                svg = ET.parse(ROOT / ASSETS / "props" / (state + ".svg"))
                path = svg.find(".//s:g[@id='body']/s:path", ns)
                self.assertIsNotNone(path)
                body_paths.append(path.attrib["d"])
        self.assertEqual(len(set(body_paths)), 1, "V4 physical phone geometry drifted")

    def test_baseline_manifest_never_invents_wall_time_or_approvals(self):
        doc = ROOT / "docs/audits/2026-11-14-studio-phase00-baseline.md"
        self.assertTrue(doc.is_file(), "P0 baseline audit/benchmark manifest missing")
        text = doc.read_text(encoding="utf-8")
        for evidence in ('"wall_ms": null', '"agent_ms": null',
                         "UNMEASURED", "COMPAT_MIGRATED", "FRESH_SCENE_SET_RETIRED"):
            self.assertIn(evidence, text)


if __name__ == "__main__":
    unittest.main()
