import json
import unittest

from tools.studio_project import agent_authoring
from tools.studio_project.prop_families import (PropVariantRequired, build_manifest, check_model_consistency, diversity_hints, resolve,
                                                reuse_profile)


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.props = agent_authoring._library_props()
        self.manifest = build_manifest(self.props, agent_authoring.ASSETS)

    def test_every_v4_prop_maps_to_exactly_one_family_model_state(self):
        seen = {}
        for family in self.manifest["families"].values():
            for model_id, model in family["models"].items():
                for state_id, prop_id in model["states"].items():
                    self.assertNotIn(prop_id, seen)
                    seen[prop_id] = (family["id"], model_id, state_id)
        self.assertEqual(sorted(seen), sorted(p["id"] for p in self.props))
        self.assertEqual(self.manifest["by_prop"], {k: dict(zip(("family_id", "model_id", "state_id"), v)) for k, v in seen.items()})

    def test_the_five_v4_phone_files_are_one_physical_model(self):
        phone = self.manifest["families"]["phone"]
        v4 = phone["models"]["v4-default"]
        self.assertEqual(set(v4["states"].values()), {"phone", "phone-busy", "phone-ping", "phone-quiet", "phone-silent"})
        self.assertEqual(len({v4["geometry_sha256"]}), 1)

    def test_phone_masters_are_distinct_geometry_proven_from_the_svg(self):
        phone = self.manifest["families"]["phone"]
        self.assertEqual(set(phone["models"]), {"v4-default", "phone-rounded", "phone-compact", "phone-angular"})
        shas = [m["geometry_sha256"] for m in phone["models"].values()]
        self.assertEqual(len(shas), len(set(shas)))
        self.assertTrue(phone["distinct_geometry"])
        self.assertEqual(phone["models"]["phone-rounded"]["review"], "PENDING")  # masters stay unreviewed: nothing is auto-approved

    def test_single_model_family_is_not_claimed_as_variety(self):
        self.assertFalse(self.manifest["families"]["notebook"]["distinct_geometry"])


class ResolverTests(unittest.TestCase):
    def setUp(self):
        self.manifest = build_manifest(agent_authoring._library_props(), agent_authoring.ASSETS)

    def test_resolves_default_model_and_state(self):
        self.assertEqual(resolve(self.manifest, "phone")["prop_id"], "phone")
        self.assertEqual(resolve(self.manifest, "phone", state_id="ping")["prop_id"], "phone-ping")
        self.assertEqual(resolve(self.manifest, "phone", model_id="phone-rounded")["prop_id"], "phone-rounded")

    def test_missing_model_or_state_needs_a_new_master_not_a_substitute(self):
        for kwargs in ({"model_id": "phone-flip"}, {"state_id": "ping", "model_id": "phone-rounded"}, {"view_id": "side"}):
            with self.assertRaises(PropVariantRequired) as caught:
                resolve(self.manifest, "phone", **kwargs)
            self.assertEqual(caught.exception.code, "NEW_VARIANT_MASTER_REQUIRED")
        with self.assertRaises(PropVariantRequired):
            resolve(self.manifest, "dragon")


def intent(*paths):
    return {"assets": {f"a{i}": {"path": "library:" + p, "category": "prop"} for i, p in enumerate(paths)}}


class DiversityTests(unittest.TestCase):
    def setUp(self):
        self.manifest = build_manifest(agent_authoring._library_props(), agent_authoring.ASSETS)

    def test_profile_counts_distinct_episodes_and_is_bounded(self):
        episodes = [("e%d" % i, intent("props/phone.svg")) for i in range(12)]
        profile = reuse_profile(self.manifest, episodes, lookback=5)
        self.assertEqual(profile["episodes_considered"], 5)
        self.assertEqual(profile["usage"][0]["family_id"], "phone")
        self.assertEqual(profile["usage"][0]["episodes"], 5)

    def test_three_episodes_on_one_model_get_alternatives_not_a_ban(self):
        profile = reuse_profile(self.manifest, [("e%d" % i, intent("props/phone-ping.svg")) for i in range(3)])
        hint = diversity_hints(self.manifest, profile)[0]
        self.assertEqual((hint["family_id"], hint["model_id"]), ("phone", "v4-default"))
        self.assertEqual(set(hint["alternative_models"]), {"phone-rounded", "phone-compact", "phone-angular"})
        self.assertIn("không cấm", hint["note"])

    def test_single_model_family_gets_a_scarcity_warning_not_a_false_alternative(self):
        profile = reuse_profile(self.manifest, [("e%d" % i, intent("props/notebook.svg")) for i in range(3)])
        hint = next(h for h in diversity_hints(self.manifest, profile) if h["family_id"] == "notebook")
        self.assertEqual(hint["alternative_models"], [])
        self.assertEqual(hint["scarcity"], "NEW_VARIANT_MASTER_REQUIRED")

    def test_two_episodes_is_not_repetition(self):
        profile = reuse_profile(self.manifest, [("e%d" % i, intent("props/phone.svg")) for i in range(2)])
        self.assertEqual(diversity_hints(self.manifest, profile), [])


def scene(sid, *entities):
    return {"id": sid, "entities": list(entities)}


def prop(eid, *assets, owner=None):
    entity = {"id": eid, "kind": "object", "visual_role": "interactive_prop",
              "states": {f"s{i}": {"asset": a} for i, a in enumerate(assets)}}
    if owner:
        entity["owner_id"] = owner
    return entity


ASSETS = {"ping": {"path": "library:props/phone-ping.svg", "category": "prop"},
          "busy": {"path": "library:props/phone-busy.svg", "category": "prop"},
          "round": {"path": "library:props/phone-rounded.svg", "category": "prop"},
          "angular": {"path": "library:props/phone-angular.svg", "category": "prop"},
          "story": {"path": ".authoring/agent-art/story-abc.svg", "category": "story_visual"}}


class OwnerConsistencyTests(unittest.TestCase):
    def setUp(self):
        self.manifest = build_manifest(agent_authoring._library_props(), agent_authoring.ASSETS)

    def check(self, *scenes):
        return check_model_consistency(self.manifest, {"assets": ASSETS, "scenes": list(scenes)})

    def test_states_of_one_model_may_change_within_a_scene(self):
        self.assertEqual(self.check(scene("s01", prop("phone", "ping", "busy"))), [])

    def test_a_prop_never_changes_physical_model_between_its_states(self):
        issues = self.check(scene("s01", prop("phone", "ping", "round")))
        self.assertEqual([(i["code"], i["scene_id"], i["entity_id"]) for i in issues], [("PROP_MODEL_CHANGED_WITHIN_ENTITY", "s01", "phone")])
        self.assertEqual(set(issues[0]["models"]), {"v4-default", "phone-rounded"})

    def test_one_owner_keeps_one_model_of_a_family_across_scenes(self):
        issues = self.check(scene("s01", prop("p1", "round", owner="lead")), scene("s02", prop("p2", "angular", owner="lead")))
        self.assertEqual([i["code"] for i in issues], ["PROP_OWNER_MODEL_DRIFT"])
        self.assertEqual(issues[0]["owner_id"], "lead")

    def test_different_owners_or_no_owner_may_use_different_models(self):
        self.assertEqual(self.check(scene("s01", prop("p1", "round", owner="lead")), scene("s02", prop("p2", "angular", owner="support"))), [])
        self.assertEqual(self.check(scene("s01", prop("p1", "round")), scene("s02", prop("p2", "angular"))), [])

    def test_assets_outside_the_library_are_ignored_here(self):
        self.assertEqual(self.check(scene("s01", prop("x", "story", "ping"))), [])


class AuthoringGateTests(unittest.TestCase):
    def test_proposals_that_swap_a_props_model_are_rejected_with_a_repairable_message(self):
        from tools.studio_project.models import StudioError
        bad = {"assets": ASSETS, "scenes": [scene("s01", prop("phone", "ping", "round"))]}
        with self.assertRaises(StudioError) as caught:
            agent_authoring.assert_prop_model_consistency(bad)
        self.assertEqual(caught.exception.code, "AGENT_PROPOSAL_INVALID")
        self.assertIn("s01/phone", str(caught.exception))
        agent_authoring.assert_prop_model_consistency({"assets": ASSETS, "scenes": [scene("s01", prop("phone", "ping", "busy"))]})


class UnknownPropMessageTests(unittest.TestCase):
    def test_the_error_names_the_scene_asset_and_real_alternatives_so_only_that_scene_is_redone(self):
        from tools.studio_project import agent_parts
        message = agent_authoring.unknown_prop_message({"s04-table": "library:props/table.svg", "s05-cup": "library:props/cup.svg"})
        self.assertIn("s04-table", message)
        self.assertIn("table.svg", message)
        self.assertIn("coffee-cup", message)  # a close real prop is offered
        self.assertIn("không có", message.lower())  # nothing close to a table: say so instead of leaving the model to guess
        self.assertEqual(agent_parts.failing_scenes(message, ["s03", "s04", "s05", "s06"]), ["s04", "s05"])

    def test_the_scene_dressing_rule_no_longer_points_at_a_prop_the_library_lacks(self):
        from pathlib import Path
        text = Path(agent_authoring.__file__).read_text(encoding="utf8")
        self.assertNotIn("such as a table", text)
        self.assertIn("NO table", text)


class VisualReuseWiringTests(unittest.TestCase):
    def service(self, rows, intents):
        class Visual:
            def snapshot(self_inner, project_id):
                if project_id == "boom":
                    raise RuntimeError("unreadable")
                return {"intent": intents.get(project_id)}

        class Service:
            visual = Visual()

            def list_projects(self_inner, limit=100):
                return rows
        return Service()

    def test_only_other_exported_episodes_count(self):
        rows = [{"project_id": "cur", "status": {"video": "EXPORTED"}}, {"project_id": "draft", "status": {"video": "UNKNOWN"}}] +                [{"project_id": f"e{i}", "status": {"video": "EXPORTED"}} for i in range(3)]
        intents = {pid: intent("props/phone.svg") for pid in ("cur", "draft", "e0", "e1", "e2")}
        reuse = agent_authoring.visual_reuse(self.service(rows, intents), "cur")
        self.assertEqual(reuse["episodes_considered"], 3)
        self.assertEqual(reuse["hints"][0]["family_id"], "phone")

    def test_a_broken_history_never_blocks_authoring(self):
        rows = [{"project_id": "boom", "status": {"video": "EXPORTED"}}]
        self.assertEqual(agent_authoring.visual_reuse(self.service(rows, {}), "cur"), {})
        self.assertEqual(agent_authoring.visual_reuse(object(), "cur"), {})


if __name__ == "__main__":
    unittest.main()
