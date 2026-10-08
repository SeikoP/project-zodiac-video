import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ControlPlaneCiContractTests(unittest.TestCase):
    def test_workflow_has_dedicated_v2_core_gate(self):
        workflow = (ROOT / ".github" / "workflows" / "tests.yml").read_text(encoding="utf-8")
        self.assertIn("control-plane-v2-core:", workflow)
        self.assertIn("Test Control Plane v2 core", workflow)
        self.assertIn("test_control_plane_scorpio_golden", workflow)
        self.assertIn("zodiac-control build", workflow)


if __name__ == "__main__":
    unittest.main()
