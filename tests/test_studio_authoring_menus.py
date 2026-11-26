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

    def test_anchors_carry_their_measured_time_when_words_are_known(self):
        text = "Chờ nhé, để xem."
        words = [{"startMs": 1000 + 300 * i, "endMs": 1250 + 300 * i, "source_range": [b0, b1]}
                 for i, (b0, b1) in enumerate(((0, 4), (5, 8), (10, 13), (14, 17)))]
        m = menus_mod.scene_menus(capsule(text), SKELETON, "s01", words)
        self.assertEqual([a["t"] for a in m["anchors"]], [0.0, 0.6])  # seconds from the scene's first word
        self.assertIsNone(menus()["anchors"][0]["t"])  # no timing, no time

    def test_accent_menu_lists_the_registered_scene_accents_with_what_they_read_as(self):
        m = menus()
        self.assertIn("scene-accent-clock", m["accents"])
        self.assertEqual(len(m["accents"]), 13)
        self.assertIn("clock", m["accent_reads"]["scene-accent-clock"])
        self.assertEqual(set(m["accent_reads"]), set(m["accents"]))

    def test_stage_schema_asks_for_a_setting_with_every_scene(self):
        m = menus()
        accent = menus_mod.stage_schema(m)["properties"]["accent"]
        self.assertEqual(accent["properties"]["accent_id"]["enum"], ["drawn", "none_fits"])  # the stage asks for a drawing; registered masters are not offered
        self.assertEqual(accent["properties"]["anchor_id"]["enum"], [a["id"] for a in m["anchors"]])
        self.assertEqual(accent["properties"]["setting"]["maxLength"], 80)
        self.assertEqual(accent["properties"]["visible_detail"]["maxLength"], 140)
        self.assertIn("accent", menus_mod.stage_schema(m)["required"])

    def test_stage_schema_offers_drawn_accents_with_parts(self):
        m = menus()
        accent = menus_mod.stage_schema(m)["properties"]["accent"]["properties"]
        self.assertEqual(accent["accent_id"]["enum"], ["drawn", "none_fits"])
        parts = accent["parts"]
        self.assertEqual(parts["maxItems"], 3)
        row = parts["items"]["properties"]
        self.assertEqual(row["part"]["enum"], sorted(m["accent_parts"]))
        self.assertEqual(row["at"]["enum"], ["left", "center", "right", "across"])
        self.assertEqual(row["size"]["enum"], ["small", "medium", "large"])
        self.assertIn("awning", m["accent_parts"])
        self.assertIn("shop awning", m["accent_parts"]["awning"])

    def test_unknown_scene_is_an_error(self):
        with self.assertRaises(KeyError):
            menus_mod.scene_menus(capsule(), SKELETON, "s99", [])


if __name__ == "__main__":
    unittest.main()


class AcceptedAccentTests(unittest.TestCase):
    def test_a_registered_or_a_drawn_accent_is_accepted_and_nothing_else(self):
        import tempfile
        from pathlib import Path
        from tools.studio_project import accent_art
        row = menus_mod.accent_registry()["scene-accent-clock"]
        registered = {"path": "library:scene-set/" + row["path"], "category": "scene_accent", "source_sha256": row["asset_sha256"]}
        with tempfile.TemporaryDirectory() as tmp:
            drawn = accent_art.normalized_accent({"parts": [{"part": "lamp", "at": "left", "size": "small"}]}, directory=Path(tmp), write=True)
            self.assertTrue(agent_authoring.accepted_accent(registered, Path(tmp)))
            self.assertTrue(agent_authoring.accepted_accent(drawn, Path(tmp)))
            self.assertFalse(agent_authoring.accepted_accent({**drawn, "source_sha256": "0" * 64}, Path(tmp)))
            self.assertFalse(agent_authoring.accepted_accent({"path": "assets/x.svg", "category": "scene_accent"}, Path(tmp)))


class RegisteredAccentTests(unittest.TestCase):
    """A proposal may carry scene accents, but only the registered masters, byte-for-byte."""

    def good(self):
        row = menus_mod.accent_registry()["scene-accent-clock"]
        return {"path": "library:scene-set/" + row["path"], "category": "scene_accent", "source_sha256": row["asset_sha256"]}

    def test_the_registered_accent_is_accepted(self):
        self.assertTrue(agent_authoring.is_registered_accent(self.good()))

    def test_anything_else_is_refused(self):
        bad_path = {**self.good(), "path": "library:scene-set/accents/scene-accent-castle.svg"}
        bad_hash = {**self.good(), "source_sha256": "0" * 64}
        extra = {**self.good(), "visual": {"type": "svg"}}
        wrong_category = {**self.good(), "category": "prop"}
        for asset in (bad_path, bad_hash, extra, wrong_category):
            self.assertFalse(agent_authoring.is_registered_accent(asset), asset)


class StageDataTests(unittest.TestCase):
    def test_the_stage_is_shown_the_drawing_parts_and_not_the_registered_cues(self):
        data = menus_mod.stage_data(menus(), "s01", TEXT, "goal")
        self.assertIn("accent_parts", data["menus"])
        self.assertNotIn("accents", data["menus"])
        self.assertNotIn("accent_reads", data["menus"])
        self.assertIn("across", data["accent_rules"])
