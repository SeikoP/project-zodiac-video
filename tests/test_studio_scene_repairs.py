"""Set dressing (depth__*) is not a story entity: the experience profile may not name it. Core removes those names."""
import copy
import unittest

from tools.studio_project import scene_repairs
from tools.studio_project.pipeline import autopilot, vision  # noqa: F401  (autopilot imports must keep working)


def scene():
    return {"id": "s01", "entities": [
        {"id": "char-a", "kind": "character", "visual_role": "character", "states": {}},
        {"id": "char-b", "kind": "character", "visual_role": "character", "states": {}},
        {"id": "depth__notebook", "kind": "object", "visual_role": "background", "states": {}},
        {"id": "phone", "kind": "object", "visual_role": "interactive_prop", "states": {}}],
        "experience_profile": {"story_mode": "behavior", "required_physical_entities": ["phone", "depth__notebook"],
                               "story_focus": {"goal": "g", "focal_entity_id": "char-a",
                                               "supporting_entity_ids": ["char-b", "depth__notebook", "phone"],
                                               "links": [{"from": "char-a", "to": "char-b", "relation": "r", "purpose": "p"},
                                                         {"from": "char-a", "to": "depth__notebook", "relation": "r", "purpose": "p"}]}}}


class PruneTests(unittest.TestCase):
    def test_dressing_is_removed_from_required_entities_supporters_and_links(self):
        s = scene()
        changes = scene_repairs.prune_non_story_references(s)
        profile = s["experience_profile"]
        self.assertEqual(profile["required_physical_entities"], ["phone"])
        self.assertEqual(profile["story_focus"]["supporting_entity_ids"], ["char-b", "phone"])
        self.assertEqual([(l["from"], l["to"]) for l in profile["story_focus"]["links"]], [("char-a", "char-b")])
        self.assertEqual(len(changes), 3)

    def test_clean_scenes_and_story_entities_are_untouched(self):
        s = scene()
        scene_repairs.prune_non_story_references(s)
        again = copy.deepcopy(s)
        self.assertEqual(scene_repairs.prune_non_story_references(again), [])
        self.assertEqual(again, s)

    def test_scenes_without_a_profile_are_ignored(self):
        self.assertEqual(scene_repairs.prune_non_story_references({"id": "s", "entities": []}), [])

    def test_a_missing_required_physical_entity_that_is_not_dressing_is_left_alone(self):
        s = scene()
        s["experience_profile"]["required_physical_entities"] = ["ghost"]
        scene_repairs.prune_non_story_references(s)
        self.assertEqual(s["experience_profile"]["required_physical_entities"], ["ghost"])  # a real mistake: the validator reports it


class WiringTests(unittest.TestCase):
    def test_a_new_scene_part_is_pruned_when_it_arrives(self):
        import json
        from tools.studio_project import agent_parts
        s = scene()
        s.update(grammar={"frame_id": "f", "mechanic_id": "m", "bindings": {}},
                 events=[{"id": "e1", "target": "char-a", "action": "x", "state_before": "n", "state_after": "n",
                          "trigger": {"type": "voice_anchor", "text": "hello"}}])
        for entity in s["entities"]:
            entity["states"] = {"n": {"asset": "n", "layer": 5, "transform": {"x": 1, "y": 1, "width": 9, "height": 9}}}
        task = {"scene_id": "s01", "scene_range": [0, 5], "scene_text": "hello", "story_visual_assets": {}, "known_assets": ["n"],
                "cast": [{"entity_id": "char-a", "states": ["n"]}, {"entity_id": "char-b", "states": ["n"]}]}
        out = json.loads(agent_parts.validate_scene(json.dumps({"kind": "scene.part", "payload": {"scene": s, "assets": {}}}), task))
        self.assertEqual(out["payload"]["scene"]["experience_profile"]["required_physical_entities"], ["phone"])

    def test_the_checks_step_fixes_profiles_in_code_and_only_for_the_named_scenes(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from tools.studio_project import agent_authoring
        from tools.studio_project.pipeline import autofix
        from tools.studio_project.pipeline.validators import Issue
        clean = {"id": "s02", "entities": [], "experience_profile": {"required_physical_entities": ["depth__x"]}}
        svc = SimpleNamespace(visual=SimpleNamespace(snapshot=lambda pid: {"intent": {"scenes": [scene(), clean]}}))
        issues = [Issue("STORY_FOCUS_SUPPORT_INVALID", "visual-intent", "s01", "{}", "visual-intent")]
        with patch.object(agent_authoring, "dependencies", return_value="dep"):
            items, changes = autofix.propose_profile_fix(svc, "p", issues)
        intent = items[0]["payload"]["payload"]["intent"]
        self.assertEqual(intent["scenes"][0]["experience_profile"]["required_physical_entities"], ["phone"])
        self.assertEqual(intent["scenes"][1]["experience_profile"]["required_physical_entities"], ["depth__x"])  # not named: untouched
        self.assertTrue(changes)
        with patch.object(agent_authoring, "dependencies", return_value="dep"):
            self.assertEqual(autofix.propose_profile_fix(svc, "p", [Issue("PASSIVE_STORYTELLING", "visual-intent", "s01", "", "x")]), ([], []))


if __name__ == "__main__":
    unittest.main()
