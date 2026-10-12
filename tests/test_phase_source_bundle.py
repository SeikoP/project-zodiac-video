"""Phase-scoped bundle policy smoke tests (stdlib; no GitHub Actions needed)."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("builder", ROOT / "tools/build_source_bundle.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BundleSelectionTests(unittest.TestCase):
    def test_runner_never_bundled(self):
        for phase in builder.PHASES:
            self.assertFalse(builder.include("runtime/remotion/index.ts", phase))
            self.assertFalse(builder.include("tools/zodiac_local.py", phase))

    def test_phase_one_excludes_visual_library(self):
        path = "plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/props/book.svg"
        self.assertFalse(builder.include(path, "01-content"))
        self.assertTrue(builder.include(path, "02-visual-production"))

    def test_router_and_preflight_survive(self):
        for phase in builder.PHASES:
            self.assertTrue(builder.include("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/router.md", phase))
            self.assertTrue(builder.include("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/execution-preflight.mjs", phase))

    def test_tests_excluded(self):
        path = "plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/audit.test.mjs"
        for phase in builder.PHASES:
            self.assertFalse(builder.include(path, phase))


if __name__ == "__main__":
    unittest.main()
