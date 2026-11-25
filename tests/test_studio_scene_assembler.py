"""Core assembles a scene from menu choices (constructive pipeline, Task 2)."""
import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.studio_project import agent_authoring, agent_parts, authoring_menus, scene_assembler

ROOT = Path(__file__).resolve().parents[1]
TEXT = "Song Tử hỏi thêm câu 1."
RANGE = [0, len(TEXT.encode())]
CAPSULE = {"scene_ranges": [{"id": "s01", "narration_range": RANGE, "text": TEXT}]}
SKELETON = {"cast": [{"entity_id": "gemini", "states": {"neutral": {}, "asking": {}, "realizing": {}}}]}
GOAL = "Gemini hỏi thêm và nhận ra điều gì đó."


def node(payload):
    with tempfile.TemporaryDirectory() as tmp:
        source, result = Path(tmp, "in.json"), Path(tmp, "out.json")
        source.write_text(json.dumps(payload), "utf8")
        subprocess.run(["node", str(ROOT / "tools/studio_project/visual_compiler.mjs"), str(source), str(result)],
                       cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf8")
        return json.loads(result.read_text("utf8"))


def fixture_intent():
    script = ("import('./tests/studio_p34_fixture.mjs').then(m=>console.log(JSON.stringify(m.makeFixture(%s))))" % json.dumps(TEXT))
    out = subprocess.run(["node", "-e", script], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf8")
    return json.loads(out.stdout)


def choices(menus, **over):
    anchors = menus["anchors"]
    stage = {"frame_id": "single-character-focus", "mechanic_id": "explain",
             "present": [{"entity_id": "gemini", "state_id": "neutral"}],
             "props": [{"prop_id": "phone", "role": "focus"}], "dressing": "laptop"}
    act = {"events": [{"anchor_id": anchors[0]["id"], "target": "gemini", "action": "Hỏi thêm", "state_after": "asking"}] if anchors else []}
    stage.update(over.pop("stage", {}))
    act.update(over.pop("act", {}))
    return stage, act


def assemble(stage=None, act=None, **kw):
    menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
    base_stage, base_act = choices(menus)
    return menus, scene_assembler.assemble_scene(menus, {**base_stage, **(stage or {})}, {**base_act, **(act or {})}, "s01", RANGE, TEXT, GOAL, **kw)


def task():
    return {"scene_id": "s01", "scene_range": RANGE, "scene_text": TEXT,
            "cast": [{"entity_id": "gemini", "states": ["neutral", "asking", "realizing"]}], "story_visual_assets": {}}


class AssemblerTests(unittest.TestCase):
    def test_assembled_scene_passes_part_validation_and_compiler(self):
        _, part = assemble()
        text = json.dumps(part, ensure_ascii=False)
        validated = json.loads(agent_parts.validate_scene(text, task()))
        self.assertEqual(validated["payload"]["scene"], part["payload"]["scene"])  # validate_scene had nothing to change
        intent = fixture_intent()
        intent["scenes"] = [part["payload"]["scene"]]
        intent["assets"].update(part["payload"]["assets"])
        result = node({"action": "validate_authoring", "intent": intent, "narration": TEXT})
        self.assertEqual(result["status"], "VALID")

    def test_no_geometry_faults(self):
        _, part = assemble()
        intent = fixture_intent()
        intent["scenes"] = [part["payload"]["scene"]]
        intent["assets"].update(part["payload"]["assets"])
        self.assertEqual(node({"action": "autofix_geometry", "intent": intent, "theme": "light"})["changes"], [])

    def test_every_frame_places_inside_the_story_field(self):
        for frame, slots in scene_assembler.PLACEMENT.items():
            for slot, box in slots.items():
                self.assertGreaterEqual(box["x"], 0, (frame, slot))
                self.assertLessEqual(box["x"] + box["width"], 1080, (frame, slot))
                self.assertGreaterEqual(box["y"], 0, (frame, slot))
                self.assertLessEqual(box["y"] + box["height"], 1400, (frame, slot))

    def test_scene_without_characters(self):
        menus, part = assemble(stage={"present": [], "props": [], "dressing": "none"},
                               act={"events": []}, story_visuals={"s01-chat": "chat_compare"})
        scene = part["payload"]["scene"]
        self.assertEqual([e["kind"] for e in scene["entities"]], ["story_visual"])
        self.assertEqual(scene["events"][0]["state_after"], "shown")
        skeleton_task = {**task(), "cast": [], "story_visual_assets": {"s01-chat": "chat_compare"}}
        agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), skeleton_task)

    def test_dressing_is_added_by_core_and_not_in_story_focus(self):
        _, part = assemble()
        scene = part["payload"]["scene"]
        dressing = [e for e in scene["entities"] if e["id"].startswith("depth__")]
        self.assertEqual([e["id"] for e in dressing], ["depth__laptop"])
        profile = json.dumps(scene["experience_profile"])
        self.assertNotIn("depth__", profile)
        self.assertEqual(scene["experience_profile"]["story_focus"]["focal_entity_id"], "phone")

    def test_unknown_ids_are_rejected_not_repaired(self):
        menus = authoring_menus.scene_menus(CAPSULE, SKELETON, "s01", [])
        stage, act = choices(menus)
        cases = [({**stage, "props": [{"prop_id": "table", "role": "focus"}]}, act),
                 ({**stage, "present": [{"entity_id": "gemini", "state_id": "side-eye"}]}, act),
                 ({**stage, "frame_id": "nope"}, act),
                 (stage, {"events": [{**act["events"][0], "anchor_id": "a99"}]})]
        for bad_stage, bad_act in cases:
            with self.assertRaises(ValueError):
                scene_assembler.assemble_scene(menus, bad_stage, bad_act, "s01", RANGE, TEXT, GOAL)

    def test_frame_that_cannot_host_the_cast_is_substituted_and_reported(self):
        _, part = assemble(stage={"frame_id": "two-person-offset"})
        self.assertEqual(part["payload"]["scene"]["grammar"]["frame_id"], "single-character-focus")
        self.assertTrue(part["core_notes"])

    def test_scene_without_anchors_still_has_an_acting_event(self):
        menus = authoring_menus.scene_menus({"scene_ranges": [{"id": "s01", "narration_range": RANGE, "text": "Chào."}]},
                                            SKELETON, "s01", [])
        stage, _ = choices(menus)
        part = scene_assembler.assemble_scene(menus, stage, {"events": []}, "s01", RANGE, "Chào.", GOAL)
        self.assertEqual(part["payload"]["scene"]["events"][0]["trigger"], {"type": "scene_start"})
        self.assertEqual(part["payload"]["scene"]["events"][0]["motion"]["preset"], "enter")


if __name__ == "__main__":
    unittest.main()
