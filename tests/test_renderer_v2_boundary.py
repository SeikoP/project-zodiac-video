import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime" / "zodiac-renderer" / "2.0.0"
RENDERER = RUNTIME / "renderer"


class RendererV2BoundaryTests(unittest.TestCase):
    def test_runtime_manifest_declares_renderer_2(self):
        manifest = json.loads((RUNTIME / "runtime-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["id"], "zodiac-renderer")
        self.assertEqual(manifest["version"], "2.0.0")
        self.assertEqual(manifest["input_contract"], "zodiac-render-plan@1")

    def test_prepare_boundary_only_reads_render_plan(self):
        source = (RENDERER / "scripts" / "prepare.mjs").read_text(encoding="utf-8")
        self.assertIn("render-plan.json", source)
        for forbidden in (
            "production.ir.json",
            "production.json",
            "materializeProductionDefaults",
            "resolveProductionEvents",
            "validatePerformanceTiming",
            "voice_anchor",
        ):
            self.assertNotIn(forbidden, source)

    def test_prepare_script_emits_renderer_props_name(self):
        source = (RENDERER / "scripts" / "prepare.mjs").read_text(encoding="utf-8")
        self.assertIn("renderer-v2-props.json", source)

    def test_renderer_package_exposes_prepare_and_test_commands(self):
        package = json.loads((RENDERER / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(package["name"], "zodiac-renderer-v2")
        self.assertIn("prepare", package["scripts"])
        self.assertIn("test", package["scripts"])

    def test_renderer_tree_has_its_own_boundary_tests(self):
        self.assertTrue((RENDERER / "tests" / "prepare.test.mjs").is_file())


if __name__ == "__main__":
    unittest.main()
