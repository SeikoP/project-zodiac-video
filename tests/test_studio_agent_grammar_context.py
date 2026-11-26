import copy
import json
import unittest
from unittest.mock import patch

from tests import test_studio_p34_visual as fixtures
from tools.studio_project import agent_authoring
from tools.studio_project.service import ASSETS


class GrammarContextTests(unittest.TestCase):
    def setUp(self):
        fixtures.VisualWorkspaceTests.setUp(self)
        voice = patch.object(self.service.voice, "_read", side_effect=lambda _: copy.deepcopy(self.voice))
        voice.start()
        self.addCleanup(voice.stop)

    def test_author_gets_source_backed_frame_slots_and_mechanic_requirements(self):
        context = agent_authoring.capsule(self.service, self.project, "Soạn hình ảnh.")
        source = json.loads((ASSETS / "shot-layouts/index.json").read_text("utf8"))
        self.assertEqual(context["catalog"]["frames"], source.get("layouts", source.get("frames")))
        self.assertIn("requires", context["catalog"]["mechanics"][0])
        grammar = context["schema"]["grammar"]
        self.assertIn("zodiac_sign_id", context["schema"]["character_constraints"])
        self.assertIn("Every cast state", context["schema"]["character_constraints"])
        self.assertEqual(grammar["type"], "object")
        example = copy.deepcopy(grammar["example"])
        example["bindings"]["subject"] = self.intent["scenes"][0]["entities"][0]["id"]
        self.intent["scenes"][0]["grammar"] = example
        result = self.visual.command(self.project, "grammar-example", 0, "source.replace", {"intent": self.intent})
        self.assertEqual(result["intent"]["scenes"][0]["grammar"], example)
