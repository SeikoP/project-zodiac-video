"""Regression: full-plan visual-role QC must precede expensive rendering."""
import ast
import unittest
from pathlib import Path

from tools.studio_v2 import executor


class FullPlanPreRenderVisualQCTests(unittest.TestCase):
    def test_default_render_path_prepares_entire_plan_before_render_reuse_or_segments(self):
        source=Path(executor.__file__).read_text(encoding="utf-8")
        start=source.index("        # Validate the *full* Job@5 visual payload")
        reuse=source.index("        if not _reuse_file(",start)
        begin=source.rindex("        self._begin_step(RENDER, cancel_event)",0,start)
        self.assertLess(begin,start)
        self.assertLess(start,reuse)
        block=source[start:reuse]
        self.assertIn('"scripts" / "prepare.mjs"',block)
        self.assertIn('stage="RENDER"',block)
        self.assertIn('self._mark_failed(RENDER, exc)',block)
        self.assertIn('self.render_handler is _default_render_handler',block)
        # No voice/timing regeneration or package mutation in the preflight.
        self.assertNotIn("voice_service(",block)
        self.assertNotIn("timing_service(",block)
        self.assertNotIn("unpack",block)

    def test_no_bypass_by_reused_video_cache(self):
        source=Path(executor.__file__).read_text(encoding="utf-8")
        start=source.index("        # Validate the *full* Job@5 visual payload")
        end=source.index("        if not _reuse_file(",start)
        check=source[start:end]
        self.assertNotIn("rendered_path.is_file()",check)
        self.assertNotIn('controller.state.steps[RENDER].reused',check)

if __name__=="__main__":
    unittest.main()
