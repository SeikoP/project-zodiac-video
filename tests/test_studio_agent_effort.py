import os
import unittest
from unittest.mock import patch

from tools.studio_project.agent_bridge import agent_effort, agent_model


class AgentEffortTests(unittest.TestCase):
    def test_defaults_to_xhigh(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ZODIAC_STUDIO_AGENT_EFFORT", None)
            self.assertEqual(agent_effort(), "xhigh")

    def test_override_and_invalid_value(self):
        with patch.dict(os.environ, {"ZODIAC_STUDIO_AGENT_EFFORT": "High"}):
            self.assertEqual(agent_effort(), "high")
        with patch.dict(os.environ, {"ZODIAC_STUDIO_AGENT_EFFORT": "turbo"}):
            self.assertEqual(agent_effort(), "xhigh")


class RolePolicyTests(unittest.TestCase):
    ENV = ("ZODIAC_STUDIO_AGENT_MODEL", "ZODIAC_STUDIO_AGENT_EFFORT", "ZODIAC_STUDIO_REPAIR_MODEL", "ZODIAC_STUDIO_REVIEW_MODEL",
           "ZODIAC_STUDIO_REPAIR_EFFORT", "ZODIAC_STUDIO_REVIEW_EFFORT", "ZODIAC_STUDIO_CREATIVE_MODEL", "ZODIAC_STUDIO_CREATIVE_EFFORT")

    def clean(self):
        patcher = patch.dict(os.environ, {}, clear=False)
        patcher.start()
        self.addCleanup(patcher.stop)
        for name in self.ENV:
            os.environ.pop(name, None)

    def test_sol_is_reserved_for_looking_at_frames(self):
        self.clean()
        self.assertEqual((agent_model("creative"), agent_effort("creative")), ("gpt-6-luna", "xhigh"))
        for role in ("repair", "review"):
            self.assertEqual((agent_model(role), agent_effort(role)), ("gpt-6-luna", "high"))
        self.assertEqual((agent_model("vision"), agent_effort("vision")), ("gpt-6.1-sol", "medium"))

    def test_each_role_is_overridable_and_unknown_roles_are_creative(self):
        self.clean()
        os.environ["ZODIAC_STUDIO_REVIEW_MODEL"] = "other-model"
        os.environ["ZODIAC_STUDIO_REPAIR_EFFORT"] = "High"
        self.assertEqual(agent_model("review"), "other-model")
        self.assertEqual(agent_effort("repair"), "high")
        self.assertEqual(agent_model("repair"), "gpt-6-luna")
        self.assertEqual(agent_model("nonsense"), "gpt-6-luna")

    def test_the_old_agent_variables_still_mean_creative_only(self):
        self.clean()
        os.environ["ZODIAC_STUDIO_AGENT_MODEL"] = "custom"
        self.assertEqual(agent_model("creative"), "custom")
        self.assertEqual(agent_model("review"), "gpt-6-luna")
