import os
import unittest
from unittest.mock import patch

from tools.studio_project.agent_bridge import agent_effort


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
