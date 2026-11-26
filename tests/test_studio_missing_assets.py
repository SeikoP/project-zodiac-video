"""A prop the library does not have: set dressing gets the nearest real prop, everything else is asked for, never invented."""
import json
import tempfile
import unittest
from pathlib import Path

from tools.studio_project import agent_authoring, catalog_v5 as v5

CONTEXT = {"narration_sha256": "n", "scene_ranges": [], "schema": {"video": {}}, "narrative_plan": {}}


def intent(entity_id, asset_key="s04-table", path="library:props/table.svg"):
    return {"narration_sha256": "n", "video": {}, "taxonomy_version": "story_visual@1", "cast": [],
            "assets": {asset_key: {"path": path, "category": "prop"}},
            "scenes": [{"id": "s04", "entities": [{"id": entity_id, "kind": "object", "states": {"on": {"asset": asset_key}}}]}]}


def bind(data):
    text, changed = agent_authoring.bind_proposal(json.dumps({"kind": "source.replace", "payload": {"intent": data}}), CONTEXT)
    return json.loads(text)["payload"]["intent"], changed


class DressingAliasTests(unittest.TestCase):
    def test_every_alias_points_at_a_real_library_prop(self):
        ids = {p["id"] for p in agent_authoring._library_props()}
        self.assertEqual({v for v in v5.DRESSING_ALIASES.values()} - ids, set())

    def test_a_missing_table_in_scene_dressing_becomes_a_real_prop_and_is_recorded(self):
        out, changed = bind(intent("depth__rear"))
        self.assertEqual(out["assets"]["s04-table"]["path"], "library:props/laptop.svg")
        self.assertTrue(any(c.startswith("dressing_substituted:s04-table") for c in changed))

    def test_a_story_prop_is_never_swapped_for_something_else(self):
        out, changed = bind(intent("phone"))
        self.assertEqual(out["assets"]["s04-table"]["path"], "library:props/table.svg")
        self.assertFalse(changed)

    def test_dressing_with_no_alias_is_left_for_the_request_path(self):
        out, _ = bind(intent("depth__rear", "s04-dragon", "library:props/dragon.svg"))
        self.assertEqual(out["assets"]["s04-dragon"]["path"], "library:props/dragon.svg")


class AssetRequestTests(unittest.TestCase):
    def test_requests_are_recorded_once_per_wanted_prop_and_never_approve_anything(self):
        with tempfile.TemporaryDirectory() as folder:
            workspace = Path(folder)
            bad = {"s04-table": "library:props/table.svg", "s05-table": "library:props/table.svg", "s06-dragon": "library:props/dragon.svg"}
            agent_authoring.record_asset_requests(workspace, bad)
            agent_authoring.record_asset_requests(workspace, bad)  # a retry does not duplicate
            data = json.loads((workspace / ".authoring/asset-requests.json").read_text(encoding="utf8"))
            wanted = {r["wanted"]: r for r in data["requests"]}
            self.assertEqual(set(wanted), {"table", "dragon"})
            self.assertEqual(wanted["table"]["scene_ids"], ["s04", "s05"])
            self.assertEqual(wanted["table"]["status"], "OPEN")
            self.assertTrue(data["not_an_approval"])


if __name__ == "__main__":
    unittest.main()
