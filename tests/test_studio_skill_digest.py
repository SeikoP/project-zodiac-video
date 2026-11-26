"""The Phase 2 skill reaches the Studio agent: a digest per task kind, in every authoring prompt, with its hash recorded."""
import json
import unittest
from unittest.mock import patch

import tests.test_studio_p1_agent as base
from tools.studio_project import agent_parts, skill_digest


class DigestTests(unittest.TestCase):
    def test_each_task_kind_gets_its_modules_and_a_stable_hash(self):
        scene = skill_digest.digest("scene")
        self.assertEqual(scene["modules"], ["SKILL.md", "concepts", "scene", "acting", "story-visual", "studio"])
        self.assertIn("Scene Accent", scene["text"])
        self.assertIn("Story first, library second", scene["text"])
        self.assertEqual(scene["sha256"], skill_digest.digest("scene")["sha256"])
        self.assertNotEqual(scene["sha256"], skill_digest.digest("skeleton")["sha256"])
        self.assertIn("design intent first", skill_digest.digest("skeleton")["text"])
        self.assertIn("voice-led", skill_digest.digest("act")["text"])

    def test_a_digest_stays_within_budget(self):
        for kind in skill_digest.KINDS:
            self.assertLess(len(skill_digest.digest(kind)["text"]), skill_digest.BUDGET_CHARS, kind)

    def test_unknown_kind_is_an_error(self):
        with self.assertRaises(KeyError):
            skill_digest.digest("nonsense")

    def test_a_missing_module_fails_loudly_not_silently(self):
        with patch.object(skill_digest, "SKILL_DIR", skill_digest.SKILL_DIR / "no-such-folder"):
            skill_digest._cache.clear()
            with self.assertRaises(FileNotFoundError):
                skill_digest.digest("scene")
        skill_digest._cache.clear()

    def test_changing_a_module_changes_the_hash(self):
        before = skill_digest.digest("act")["sha256"]
        real = skill_digest._read

        def edited(name):
            return real(name) + ("\nextra rule" if name == "acting" else "")
        skill_digest._cache.clear()
        with patch.object(skill_digest, "_read", edited):
            self.assertNotEqual(skill_digest.digest("act")["sha256"], before)
        skill_digest._cache.clear()


class PromptTests(unittest.TestCase):
    def test_authoring_prompts_carry_the_skill_before_the_untrusted_data(self):
        for build, kind, task in ((agent_parts.skeleton_prompt, "skeleton", {"part": "skeleton"}),
                                  (agent_parts.scene_prompt, "scene", {"part": "scene", "scene_id": "s01"}),
                                  (agent_parts.revise_prompt, "revise", {"part": "revise", "scene_id": "s01"})):
            prompt = build(task)
            self.assertIn(skill_digest.digest(kind)["text"], prompt, kind)
            self.assertLess(prompt.index("Zodiac Phase 2 skill"), prompt.index("untrusted task DATA"), kind)


class BridgeTests(unittest.TestCase):
    setUp = base.AgentTests.setUp

    def test_a_choice_task_records_which_skill_it_was_given(self):
        schema = {"type": "object", "properties": {"a": {"type": "string", "enum": ["x"]}}, "required": ["a"], "additionalProperties": False}
        with patch.object(self.manager, "_bin", return_value="not-needed"), patch.object(self.manager, "_run", return_value=None):
            started = self.manager.start_choice(self.project["project_id"], schema, {"scene_id": "s01"}, skill="stage")
        task = self.manager.task(started["task_id"])
        self.assertEqual(task["skill_sha256"], skill_digest.digest("stage")["sha256"])
        self.assertEqual(task["choice_task"]["skill"], "stage")

    def test_a_choice_prompt_includes_the_skill(self):
        text = agent_parts.choice_prompt({"schema": {}, "data": {"scene_id": "s01"}, "skill": "act"})
        self.assertIn(skill_digest.digest("act")["text"], text)
        self.assertIn('"scene_id": "s01"', text)
        self.assertLess(text.index("Zodiac Phase 2 skill"), text.index("untrusted task DATA"))

    def test_a_choice_without_a_skill_is_unchanged(self):
        text = agent_parts.choice_prompt({"schema": {}, "data": {"scene_id": "s01"}})
        self.assertNotIn("Zodiac Phase 2 skill", text)


if __name__ == "__main__":
    unittest.main()
