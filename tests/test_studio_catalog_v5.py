import json
import unittest

from tools.studio_project import agent_authoring, catalog_v5 as v5


class CatalogV5Tests(unittest.TestCase):
    def setUp(self):
        self.raw = agent_authoring.catalog()

    def test_every_pose_and_expression_is_in_exactly_one_group(self):
        comps = self.raw["components"]
        self.assertEqual(v5.ungrouped(v5.POSE_GROUPS, comps["poses"]), [])
        self.assertEqual(v5.ungrouped(v5.EXPRESSION_GROUPS, comps["expressions"]), [])
        for groups, key in ((v5.POSE_GROUPS, "poses"), (v5.EXPRESSION_GROUPS, "expressions")):
            members = [m for g in groups.values() for m in g]
            self.assertEqual(len(members), len(set(members)), "an id sits in two groups")
            self.assertEqual(set(members) - set(comps[key]), set(), "a group names an id the library does not have")

    def test_synonyms_only_point_at_real_ids(self):
        comps = self.raw["components"]
        real = set(comps["poses"]) | set(comps["expressions"])
        self.assertEqual({v for v in v5.SYNONYMS.values()} - real, set())

    def test_prompt_catalog_is_much_smaller_and_loses_no_prop(self):
        full = len(json.dumps(self.raw, ensure_ascii=False))
        prompt = agent_authoring.prompt_catalog()
        self.assertLess(len(json.dumps(prompt, ensure_ascii=False)), full * 0.8)
        listed = v5.listed_prop_ids(prompt["props"])
        self.assertLess(len(prompt["props"]["items"]) + len(prompt["props"]["meme_labels"]["slugs"]), len(self.raw["props"]),
                        "families must list fewer entries than files")
        self.assertEqual(sorted(listed), sorted(p["id"] for p in self.raw["props"]))
        for prop in self.raw["props"]:  # path_rule + exceptions reproduce every real path
            path = prompt["props"]["path_exceptions"].get(prop["id"], f"props/{prop['id']}.svg")
            self.assertEqual(path, prop["path"])
        regrouped = {m for g in prompt["components"]["poses"].values() for m in g}
        self.assertEqual(regrouped, set(self.raw["components"]["poses"]))

    def test_nearest_prop_and_component(self):
        props = agent_authoring._library_props()
        self.assertIn(v5.nearest_props(props, "library:props/cup.svg")[0]["id"], {"coffee-cup", "takeaway-cup"})
        self.assertEqual(v5.nearest_props(props, "props/dragon.svg"), [])
        options = self.raw["components"]["expressions"]
        self.assertEqual(v5.nearest_component("angry", options), "exasperated")
        self.assertEqual(v5.nearest_component("deadpan", options), "deadpan")
        self.assertIsNone(v5.nearest_component("zzz", options))

    def test_bind_proposal_substitutes_missing_parts_but_not_when_nothing_is_close(self):
        intent = {"narration_sha256": "n", "video": {}, "taxonomy_version": "story_visual@1", "scenes": [],
                  "assets": {"s01-cup": {"path": "library:props/cup.svg", "category": "prop"},
                             "s01-dragon": {"path": "library:props/dragon.svg", "category": "prop"}},
                  "cast": [{"entity_id": "a", "states": {"neutral": {"pose_id": "neutral", "expression_id": "angry"},
                                                          "x": {"pose_id": "levitate", "expression_id": "deadpan"}}}]}
        context = {"narration_sha256": "n", "scene_ranges": [], "schema": {"video": {}}, "narrative_plan": {}}
        text, changed = agent_authoring.bind_proposal(json.dumps({"kind": "source.replace", "payload": {"intent": intent}}), context)
        out = json.loads(text)["payload"]["intent"]
        self.assertIn(out["assets"]["s01-cup"]["path"], {"library:props/coffee-cup.svg", "library:props/takeaway-cup.svg"})
        self.assertEqual(out["assets"]["s01-dragon"]["path"], "library:props/dragon.svg")  # nothing close: left to fail loudly
        self.assertEqual(out["cast"][0]["states"]["neutral"]["expression_id"], "exasperated")
        self.assertEqual(out["cast"][0]["states"]["x"]["pose_id"], "neutral")  # unknown pose: neutral, and reported
        self.assertTrue(any("levitate unknown -> neutral" in c for c in changed))
        self.assertTrue(any(c.startswith("asset_substituted:s01-cup") for c in changed))


if __name__ == "__main__":
    unittest.main()
