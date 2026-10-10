import unittest
from copy import deepcopy

from tools.control_plane.lineage_audit import inspect_lineage


class Job5LineageTests(unittest.TestCase):
    def setUp(self):
        self.ir = {"assets": {"a": {"path": "assets/a.svg"}}, "scenes": [{
            "id": "s01", "entities": [{"id": "hero", "initial_state": "idle",
            "states": {"idle": {"asset": "a"}, "react": {"asset": "a"}}}],
            "events": [{"id": "e1", "target": "hero", "state_before": "idle",
                        "state_after": "react", "desired_motion": "state_swap"}]}]}
        self.plan = {"assets": {"a": {"path": "assets/a.svg"}}, "scenes": [{
            "id": "s01", "entities": deepcopy(self.ir["scenes"][0]["entities"]),
            "events": [{"event_id": "e1", "target": "hero", "state_before": "idle",
                        "state_after": "react", "motion": "state_swap",
                        "start_frame": 2, "end_frame": 12}]}]}

    def test_matching_source_and_plan_pass(self):
        report = inspect_lineage(self.ir, self.plan)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["events"], 1)

    def test_dropped_event_blocks(self):
        self.plan["scenes"][0]["events"] = []
        self.assertIn("EVENT_LINEAGE_MISSING",
                      [x["code"] for x in inspect_lineage(self.ir, self.plan)["issues"]])

    def test_asset_and_target_drift_block(self):
        self.plan["assets"] = {}
        self.plan["scenes"][0]["events"][0]["target"] = "other"
        codes = [x["code"] for x in inspect_lineage(self.ir, self.plan)["issues"]]
        self.assertIn("ASSET_LINEAGE_MISSING", codes)
        self.assertIn("EVENT_INTENT_DRIFT", codes)

    def test_merged_events_count_as_represented(self):
        self.ir["scenes"][0]["events"].append({
            "id": "e2", "target": "hero", "state_before": "idle",
            "state_after": "react", "desired_motion": "state_swap"})
        self.plan["scenes"][0]["events"][0]["merged_event_ids"] = ["e1", "e2"]
        report = inspect_lineage(self.ir, self.plan)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["events"], 2)


if __name__ == "__main__":
    unittest.main()
