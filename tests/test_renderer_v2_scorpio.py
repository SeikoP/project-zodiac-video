import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "tests.yml"


class RendererV2ScorpioCiTests(unittest.TestCase):
    def test_workflow_has_renderer_v2_scorpio_smoke(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("renderer-v2-smoke:", source)
        self.assertIn("runtime/zodiac-renderer/2.0.0/renderer", source)
        self.assertIn("npm install --no-audit --no-fund", source)
        self.assertIn("npm run typecheck", source)
        self.assertIn("tests/fixtures/scorpio-two-versions/expected/render-plan.json", source)
        self.assertIn("remotion still", source)

    def test_scorpio_golden_plan_is_overlap_free_before_renderer(self):
        import json
        from tools.control_plane.render_plan import target_overlap_count

        plan = json.loads(
            (ROOT / "tests" / "fixtures" / "scorpio-two-versions" / "expected" / "render-plan.json")
            .read_text(encoding="utf-8")
        )
        self.assertEqual(target_overlap_count(plan), 0)


if __name__ == "__main__":
    unittest.main()
