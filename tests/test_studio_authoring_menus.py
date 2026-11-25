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
        present = props["present"]["items"]
        self.assertEqual(present["properties"]["entity_id"]["enum"], sorted(m["cast"]))
        self.assertEqual(present["properties"]["state_id"]["enum"], sorted({s for v in m["cast"].values() for s in v}))
        event = act["properties"]["events"]["items"]["properties"]
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

    def test_unknown_scene_is_an_error(self):
        with self.assertRaises(KeyError):
            menus_mod.scene_menus(capsule(), SKELETON, "s99", [])


if __name__ == "__main__":
    unittest.main()
