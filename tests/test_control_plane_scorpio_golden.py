import json
import unittest
from pathlib import Path

from tools.control_plane.render_plan import target_overlap_count, validate_render_plan
from tools.control_plane.timeline import compile_render_plan

ROOT = Path(__file__).resolve().parent / "fixtures" / "scorpio-two-versions"
PACKAGE = ROOT / "package"


class ScorpioGoldenTimelineTests(unittest.TestCase):
    def test_e22_overlap_is_serialized_before_renderer(self):
        ir = json.loads((PACKAGE / "production.ir.json").read_text(encoding="utf-8"))
        timing = json.loads((ROOT / "timing.json").read_text(encoding="utf-8"))
        design = json.loads((PACKAGE / "design-token.json").read_text(encoding="utf-8"))

        plan = compile_render_plan(ir, timing, design)
        validate_render_plan(plan, ir)

        events = plan["scenes"][0]["events"]
        by_id = {event["event_id"]: event for event in events}
        self.assertEqual(by_id["E21"]["preferred_start_frame"], 30)
        self.assertEqual((by_id["E21"]["start_frame"], by_id["E21"]["end_frame"]), (30, 38))
        self.assertEqual(by_id["E22"]["preferred_start_frame"], 34)
        self.assertEqual((by_id["E22"]["start_frame"], by_id["E22"]["end_frame"]), (38, 46))
        self.assertEqual(target_overlap_count(plan), 0)

    def test_compiled_plan_matches_checked_in_golden_bytes(self):
        ir = json.loads((PACKAGE / "production.ir.json").read_text(encoding="utf-8"))
        timing = json.loads((ROOT / "timing.json").read_text(encoding="utf-8"))
        design = json.loads((PACKAGE / "design-token.json").read_text(encoding="utf-8"))
        plan = compile_render_plan(ir, timing, design)
        actual = (json.dumps(plan, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
        expected = (ROOT / "expected" / "render-plan.json").read_bytes()
        self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
