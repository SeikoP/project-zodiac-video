"""Per-scene menus and the JSON Schemas the model must answer with (constructive pipeline, Task 1)."""
import unittest

from tools.studio_project import agent_authoring, authoring_menus as menus_mod

TEXT = "Bạn nhắn tin rồi chờ, để xem họ trả lời không. Họ im lặng, để xem bạn chịu được bao lâu!"
SKELETON = {"cast": [{"entity_id": "ban", "states": {"neutral": {}, "reaction": {}}},
                     {"entity_id": "nguoi_kia", "states": {"neutral": {}, "smug": {}}}]}


def capsule(text=TEXT):
    return {"scene_ranges": [{"id": "s01", "narration_range": [0, len(text.encode())], "text": text},
                             {"id": "s02", "narration_range": [len(text.encode()), len(text.encode()) + 4], "text": "Hết."}]}


def menus(text=TEXT, scene="s01"):
    return menus_mod.scene_menus(capsule(text), SKELETON, scene, [])


def walk(schema):
    yield schema
    for value in schema.values() if isinstance(schema, dict) else []:
        if isinstance(value, dict):
            yield from walk(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    yield from walk(item)


class MenuTests(unittest.TestCase):
    def test_menus_list_only_real_ids(self):
        m = menus()
        real = {p["id"] for p in agent_authoring._library_props()}
        self.assertTrue(m["props"])
        self.assertTrue(set(m["props"]) <= real)
        self.assertFalse([p for p in m["props"] + m["dressing"] if p.startswith("meme-label-")])
        self.assertEqual(m["dressing"][-1], "none")
        self.assertTrue(set(m["dressing"][:-1]) <= real)
        self.assertEqual(m["cast"], {"ban": ["neutral", "reaction"], "nguoi_kia": ["neutral", "smug"]})
        frames = {f["id"] for f in agent_authoring.catalog()["frames"]}
        self.assertEqual(set(m["frames"]), frames)
        self.assertEqual(set(m["mechanics"]), {x["id"] for x in agent_authoring.catalog()["mechanics"]})

    def test_anchors_are_unique_phrases_in_scene_order(self):
        anchors = menus()["anchors"]
        self.assertEqual([a["id"] for a in anchors], [f"a{i}" for i in range(1, len(anchors) + 1)])
        self.assertGreaterEqual(len(anchors), 2)
        offsets = []
        for a in anchors:
            self.assertIn(a["text"], TEXT)
            self.assertTrue(2 <= len(a["text"].split()) <= 6, a)
            offsets.append(a["at"])
            self.assertEqual(TEXT[a["at"]:a["at"] + len(a["text"])], a["text"])
        self.assertEqual(offsets, sorted(set(offsets)))  # each anchor is a different occurrence, in order

    def test_repeated_phrase_maps_to_first_unused_occurrence(self):
        text = "Chờ nhé, để xem. Rồi, để xem."
        anchors = menus(text)["anchors"]
        same = [x for x in anchors if x["text"] == "để xem"]
        self.assertEqual([x["id"] for x in same], ["a2", "a3"])
        self.assertEqual([x["at"] for x in same], [text.index("để xem"), text.rindex("để xem")])

    def test_schemas_enumerate_menus(self):
        m = menus()
        stage, act = menus_mod.stage_schema(m), menus_mod.act_schema(m)
        props = stage["properties"]
        self.assertEqual(props["frame_id"]["enum"], m["frames"])
        self.assertEqual(props["mechanic_id"]["enum"], m["mechanics"])
        self.assertEqual(props["props"]["items"]["properties"]["prop_id"]["enum"], m["props"])
        self.assertEqual(props["props"]["items"]["properties"]["role"]["enum"], ["focus", "support"])
        self.assertEqual(props["dressing"]["enum"], m["dressing"])
        present = props["present"]["items"]["anyOf"]
        self.assertEqual([v["properties"]["entity_id"]["enum"] for v in present], [[e] for e in sorted(m["cast"])])
        for variant in present:  # a state is only offered with the entity that owns it
            self.assertEqual(variant["properties"]["state_id"]["enum"], m["cast"][variant["properties"]["entity_id"]["enum"][0]])
        events = act["properties"]["events"]["items"]["anyOf"]
        for event in (v["properties"] for v in events):
            self.assertEqual(event["anchor_id"]["enum"], [a["id"] for a in m["anchors"]])
            self.assertEqual(event["action"]["maxLength"], 80)
        for schema in (stage, act):
            for node in walk(schema):
                if node.get("type") == "object":
                    self.assertIs(node.get("additionalProperties"), False)
                    self.assertEqual(sorted(node["required"]), sorted(node["properties"]))

    def test_empty_and_large_menus(self):
        empty = menus("Chào.")
        self.assertEqual(empty["anchors"], [])
        act = menus_mod.act_schema(empty)
        self.assertEqual(act["properties"]["events"]["maxItems"], 0)
        clauses = ", ".join(f"câu số {n} có nhiều từ" for n in range(14)) + "."
        big = menus(clauses)
        self.assertGreaterEqual(len(big["anchors"]), 12)
        self.assertLessEqual(menus_mod.act_schema(big)["properties"]["events"]["maxItems"], 8)

    def test_act_states_belong_to_their_target(self):
        m = menus()
        variants = {v["properties"]["target"]["enum"][0]: v["properties"]["state_after"]["enum"]
                    for v in menus_mod.act_schema(m)["properties"]["events"]["items"]["anyOf"] if len(v["properties"]["target"]["enum"]) == 1}
        self.assertEqual(variants["ban"], ["neutral", "reaction", "same"])
        self.assertEqual(variants["nguoi_kia"], ["neutral", "smug", "same"])
        props = next(v for v in menus_mod.act_schema(m)["properties"]["events"]["items"]["anyOf"] if "phone" in v["properties"]["target"]["enum"])
        self.assertEqual(props["properties"]["state_after"]["enum"], ["same"])  # a prop has no states to move to

    def test_act_schema_for_a_stage_only_offers_whoever_is_in_it(self):
        m = menus()
        stage = {"present": [{"entity_id": "ban", "state_id": "neutral"}], "props": [{"prop_id": "phone", "role": "focus"}]}
        targets = sorted(t for v in menus_mod.act_schema(m, stage)["properties"]["events"]["items"]["anyOf"]
                         for t in v["properties"]["target"]["enum"])
        self.assertEqual(targets, ["ban", "phone"])
        good = {"events": [{"anchor_id": "a1", "target": "ban", "action": "x", "state_after": "reaction"}]}
        bad = {"events": [{"anchor_id": "a1", "target": "ban", "action": "x", "state_after": "smug"}]}
        self.assertEqual(menus_mod.schema_errors(good, menus_mod.act_schema(m, stage)), [])
        self.assertTrue(menus_mod.schema_errors(bad, menus_mod.act_schema(m, stage)))

    def test_unknown_scene_is_an_error(self):
        with self.assertRaises(KeyError):
            menus_mod.scene_menus(capsule(), SKELETON, "s99", [])


if __name__ == "__main__":
    unittest.main()
