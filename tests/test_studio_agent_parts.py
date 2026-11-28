"""Scene-by-scene authoring: prompts, per-scene checks, merge and the two-agent orchestration."""
import json
import pathlib
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from tools.studio_project import agent_bridge, agent_parts
from tools.studio_project.models import StudioError

GID = "a" * 32
CAPSULE = {
    "narration_sha256": "h", "instruction": "Soạn", "schema": {"video": {"fps": 30}, "grammar": {}, "experience_profile": "x", "scenes": "y", "assets": "z"},
    "catalog": {"props": [], "frames": [], "mechanics": []}, "required_story_visual_ids": ["SV01"],
    "scene_ranges": [{"id": "s01", "narration_range": [0, 10], "text": "Mở đầu rủ nhau."}, {"id": "s02", "narration_range": [10, 30], "text": "Hai lời rủ giống nhau."},
                     {"id": "s03", "narration_range": [30, 40], "text": "Kết thúc."}],
    "narrative_plan": {"story_visual_decision": {"mode": "required"}, "beats": [{"id": "B02", "voice_anchor": "Hai lời rủ"}],
                       "story_visuals": [{"id": "SV01", "beat_ids": ["B02"]}]},
}
SKELETON = {"kind": "authoring.skeleton", "payload": {"intent": {"cast": [{"entity_id": "hero", "states": {"neutral": {}, "react": {}}}],
            "assets": {"SV01": {"visual": {"type": "story_text"}, "category": "story_visual", "phase1_visual_id": "SV01"}}}}}


def scene_json(scene_id, **over):
    anchor = next((r["text"] for r in CAPSULE["scene_ranges"] if r["id"] == scene_id), "")
    scene = {"id": scene_id, "narration_range": [0, 0], "semantic_goal": GID, "grammar": {"frame_id": "f"},
             "entities": [{"id": "hero", "kind": "character"}],
             "events": [{"id": "e", "target": "hero", "action": "nghiêng người", "trigger": {"type": "voice_anchor", "text": anchor}}],
             "experience_profile": {"story_mode": "behavior"}}
    scene.update(over)
    return json.dumps({"kind": "scene.part", "payload": {"scene": scene, "assets": {scene_id + "-phone": {"path": "library:props/phone.svg", "category": "prop"}}}})


class PartsTests(unittest.TestCase):
    def task(self, scene_id="s01"):
        return agent_parts.scene_task(CAPSULE, SKELETON, scene_id)

    def test_story_visual_is_assigned_to_the_scene_holding_its_beat_anchor(self):
        self.assertEqual(agent_parts.story_visuals_by_scene(CAPSULE), {"s02": ["SV01"]})
        self.assertEqual(self.task("s02")["must_use_story_visuals"], ["SV01"])
        self.assertEqual(self.task("s01")["must_use_story_visuals"], [])

    def test_repeated_anchor_respects_approved_global_occurrence(self):
        context = {"narrative_plan": {"beats": [{"id": "B1", "voice_anchor": "same words", "occurrence": 2}],
                                      "story_visuals": [{"id": "V1", "beat_ids": ["B1"]}]},
                   "required_story_visual_ids": ["V1"],
                   "scene_ranges": [{"id": "s01", "text": "same words before. "},
                                    {"id": "s02", "text": "same words after."}]}
        self.assertEqual(agent_parts.story_visuals_by_scene(context), {"s02": ["V1"]})
        from tools.studio_project.scene_assembler import story_reveal_text
        self.assertIsNone(story_reveal_text(context, "s01"))
        self.assertEqual(story_reveal_text(context, "s02"), "same words")

    def test_anchor_occurrence_matches_contract(self):
        from tools.studio_project.narration_anchors import anchor_offset
        self.assertEqual(anchor_offset("abc abc abc", {"voice_anchor": "abc", "occurrence": 3}), 8)
        self.assertEqual(anchor_offset("aaaa", {"voice_anchor": "aa", "occurrence": 2}), 2)
        self.assertEqual(anchor_offset("abc", {"voice_anchor": "abc", "occurrence": 2}), -1)

    def test_scene_task_is_small_and_carries_cast_and_style(self):
        task = self.task("s02")
        self.assertEqual(task["cast"], [{"entity_id": "hero", "states": ["neutral", "react"]}])
        self.assertEqual(task["scene_text"], "Hai lời rủ giống nhau.")
        self.assertIn("limited 2D cut-out", agent_parts.scene_prompt(task))
        self.assertIn("VIETNAMESE", agent_parts.scene_prompt(task))

    def test_valid_scene_gets_core_owned_range_and_passes(self):
        out = json.loads(agent_parts.validate_scene(scene_json("s01"), self.task("s01")))
        self.assertEqual(out["payload"]["scene"]["narration_range"], [0, 10])

    def test_scene_problems_name_the_fix(self):
        task = self.task("s01")
        for text, needle in (
            (scene_json("s09"), "scene.id"),
            (scene_json("s01", entities=[{"id": "ghost", "kind": "character"}]), "không thuộc cast"),
            (scene_json("s01", events=[{"id": "e", "target": "hero", "action": "x", "trigger": {"text": "không có trong cảnh"}}]), "nguyên văn"),
            (scene_json("s01", events=[{"id": "e", "target": "hero", "trigger": {"text": "rủ nhau"}}]), "action"),
            (scene_json("s01", experience_profile={}), "experience_profile"),
            (scene_json("s01", entities=[{"id": "hero", "kind": "character", "states": {"neutral": {"layer": "character", "transform": {"x": 1, "y": 1, "width": 1, "height": 1}}}}]), "layer phải là số nguyên"),
            (scene_json("s01", entities=[{"id": "hero", "kind": "character", "states": {"neutral": {"layer": 20}}}]), "transform"),
        ):
            with self.assertRaises(ValueError) as caught:
                agent_parts.validate_scene(text, task)
            self.assertIn(needle, str(caught.exception))

    def test_core_replaces_slot_names_used_as_visual_role(self):
        entities = [{"id": "hero", "kind": "character", "visual_role": "speaker"}, {"id": "depth__table", "kind": "object", "visual_role": "set_dressing"},
                    {"id": "phone", "kind": "object"}, {"id": "SV01", "kind": "story_visual", "visual_role": "overlay"}]
        out = json.loads(agent_parts.validate_scene(scene_json("s01", entities=entities), self.task("s01")))["payload"]["scene"]["entities"]
        self.assertEqual([e["visual_role"] for e in out], ["character", "background", "interactive_prop", "overlay"])

    def test_unknown_transition_preset_is_rejected_absent_is_allowed_and_frames_are_clamped(self):
        task = self.task("s01")
        agent_parts.validate_scene(scene_json("s01"), task)  # absent: Core fills the default
        agent_parts.validate_scene(scene_json("s01", transition={"preset": "page-turn", "frames": 12}), task)
        with self.assertRaises(ValueError) as caught:  # an unknown preset is a real mistake: the model is told the valid ones
            agent_parts.validate_scene(scene_json("s01", transition={"preset": "spin", "frames": 12}), task)
        self.assertIn("cut, dissolve, paper-slide hoặc page-turn", str(caught.exception))
        for preset, frames in (("page-turn", 3), ("cut", 6), ("page-turn", 9999)):  # a frame count out of range is mechanical: clamped, not retried
            spec = agent_parts.TRANSITIONS["presets"][preset]
            out = json.loads(agent_parts.validate_scene(scene_json("s01", transition={"preset": preset, "frames": frames}), task))
            self.assertTrue(spec["min_frames"] <= out["payload"]["scene"]["transition"]["frames"] <= spec["max_frames"])

    def test_enter_events_are_normalised_to_scene_start_with_a_steady_state(self):
        task = self.task("s01")
        anchor = next(r["text"] for r in CAPSULE["scene_ranges"] if r["id"] == "s01")
        fly = {"id": "fly", "target": "hero", "state_before": "neutral", "state_after": "neutral", "action": "bay vào",
               "motion": {"preset": "enter", "duration_frames": 12, "params": {"from": "left"}}}
        agent_parts.validate_scene(scene_json("s01", events=[{**fly, "trigger": {"type": "scene_start"}},
            {"id": "e", "target": "hero", "action": "nghiêng", "trigger": {"type": "voice_anchor", "text": anchor}}]), task)
        out = json.loads(agent_parts.validate_scene(scene_json("s01", events=[{**fly, "trigger": {"type": "voice_anchor", "text": anchor}}]), task))
        self.assertEqual(out["payload"]["scene"]["events"][0]["trigger"], {"type": "scene_start"})

    def test_unprefixed_asset_keys_are_renamed_and_references_follow(self):
        data = json.loads(scene_json("s01", entities=[{"id": "depth__table", "kind": "object", "states": {"v": {"asset": "table", "layer": 10,
                          "transform": {"x": 0, "y": 0, "width": 1, "height": 1}}}}, {"id": "hero", "kind": "character"}]))
        data["payload"]["assets"] = {"table": {"path": "library:props/table.svg", "category": "prop"}}
        out = json.loads(agent_parts.validate_scene(json.dumps(data), self.task("s01")))["payload"]
        self.assertEqual(list(out["assets"]), ["s01-table"])
        self.assertEqual(out["scene"]["entities"][0]["states"]["v"]["asset"], "s01-table")

    def test_undeclared_asset_is_rejected_but_kept_from_the_previous_version(self):
        entities = [{"id": "hero", "kind": "character"}, {"id": "phone", "kind": "object", "states": {"v": {"asset": "s01-gone", "layer": 30,
                    "transform": {"x": 0, "y": 0, "width": 1, "height": 1}}}}]
        with self.assertRaises(ValueError) as caught:
            agent_parts.validate_scene(scene_json("s01", entities=entities), self.task("s01"))
        self.assertIn("chưa được khai báo", str(caught.exception))
        previous = json.dumps({"kind": "scene.part", "payload": {"scene": {}, "assets": {"s01-gone": {"path": "library:props/phone.svg", "category": "prop"}}}})
        task = agent_parts.scene_task(CAPSULE, SKELETON, "s01", previous=previous, error="x")
        out = json.loads(agent_parts.validate_scene(scene_json("s01", entities=entities), task))["payload"]["assets"]
        self.assertIn("s01-gone", out)

    def test_merge_orders_scenes_and_unions_assets_and_rejects_conflicts(self):
        texts = {s: agent_parts.validate_scene(scene_json(s), self.task(s)) for s in ("s01", "s02", "s03")}
        merged = json.loads(agent_parts.merge(json.dumps(SKELETON), texts, ["s03", "s01", "s02"]))["payload"]["intent"]
        self.assertEqual([s["id"] for s in merged["scenes"]], ["s03", "s01", "s02"])
        self.assertIn("s02-phone", merged["assets"])
        self.assertIn("SV01", merged["assets"])
        clash = json.loads(texts["s02"])
        clash["payload"]["assets"] = {"SV01": {"other": 1}}
        with self.assertRaises(ValueError):
            agent_parts.merge(json.dumps(SKELETON), {**texts, "s02": json.dumps(clash)}, ["s01", "s02", "s03"])

    def test_failing_scenes_are_read_from_the_validator_message(self):
        order = ["s01", "s02", "s03"]
        self.assertEqual(agent_parts.failing_scenes("VISUAL_GRAMMAR: s03 mechanic react ... S01/two-person", order), ["s01", "s03"])
        self.assertEqual(agent_parts.failing_scenes("No scene named", order), [])

    def test_skeleton_must_not_contain_scenes_and_binds_core_fields(self):
        task = agent_parts.skeleton_task(CAPSULE)
        bad = {**SKELETON, "payload": {"intent": {**SKELETON["payload"]["intent"], "scenes": [{}]}}}
        with self.assertRaises(ValueError):
            agent_parts.validate_skeleton(json.dumps(bad), task)
        out = json.loads(agent_parts.validate_skeleton(json.dumps(SKELETON), task))["payload"]["intent"]
        self.assertEqual((out["narration_sha256"], out["taxonomy_version"], out["story_visual_decision"]),
                         ("h", "story_visual@1", {"mode": "required"}))

    def test_repair_reuses_the_existing_skeleton_and_scene(self):
        previous = {"kind": "source.replace", "payload": {"intent": {"cast": [1], "scenes": [{"id": "s02", "events": []}]}}}
        capsule = {**CAPSULE, "previous_candidate": {"validator_error": "PASSIVE", "json": json.dumps(previous)}}
        self.assertEqual(json.loads(agent_parts.existing_skeleton(capsule))["payload"]["intent"], {"cast": [1]})
        task = agent_parts.scene_task(capsule, SKELETON, "s02")
        self.assertEqual(task["previous_candidate"]["validator_error"], "PASSIVE")
        self.assertEqual(json.loads(task["previous_candidate"]["json"])["payload"]["scene"]["id"], "s02")


class GroupTests(unittest.TestCase):
    """Orchestration with stubbed child agents: two at a time, only the named scenes redone."""

    def manager(self):
        service = type("S", (), {})()
        service.project = lambda pid: {"revision": 1, "source_sha256": "x", "status": {}}
        service.registry = type("R", (), {"root": pathlib.Path(tempfile.mkdtemp())})()
        return agent_bridge.AgentManager(service)

    def run_group(self, manager, proposal_errors):
        calls, live, peak = [], [0], [0]
        lock = threading.Lock()

        def run_part(group_id, project_id, part_id, part_task, tries=2):
            with lock:
                live[0] += 1
                peak[0] = max(peak[0], live[0])
                calls.append(part_id)
            time.sleep(0.05)
            with lock:
                live[0] -= 1
            if part_id == "skeleton":
                return json.dumps(SKELETON)
            return agent_parts.validate_scene(scene_json(part_id), agent_parts.scene_task(CAPSULE, SKELETON, part_id))
        errors = list(proposal_errors)

        def proposal(text, service, pid, **kw):
            if errors:
                raise StudioError("VISUAL_BUILD_BLOCKED", errors.pop(0), "visual")
        with manager._lock:
            manager._tasks[GID] = {"task_id": GID, "project_id": "p", "status": "STARTING", "kind": "episode.propose", "parts": [], "children": []}
        with patch.object(manager, "_run_part", side_effect=run_part), patch.object(agent_bridge.agent_authoring, "proposal", side_effect=proposal), \
                patch.object(agent_bridge.agent_authoring, "bind_proposal", side_effect=lambda text, ctx: (text, [])):
            manager._run_group(GID, CAPSULE)
        return manager.task(GID), calls, peak[0]

    def test_scenes_run_two_at_a_time_and_complete(self):
        task, calls, peak = self.run_group(self.manager(), [])
        self.assertEqual(task["status"], "COMPLETED", task.get("error"))
        self.assertEqual(sorted(c for c in calls if c != "skeleton"), ["s01", "s02", "s03"])
        self.assertEqual(peak, 2)
        scenes = json.loads(task["suggestion"])["payload"]["intent"]["scenes"]
        self.assertEqual([s["id"] for s in scenes], ["s01", "s02", "s03"])

    def test_only_the_named_scene_is_redone(self):
        task, calls, _ = self.run_group(self.manager(), ["VISUAL_GRAMMAR_COMPILE_INVALID: s02 mechanic react cannot bind"])
        self.assertEqual(task["status"], "COMPLETED")
        self.assertEqual(calls.count("s02"), 2)
        self.assertEqual((calls.count("s01"), calls.count("s03"), calls.count("skeleton")), (1, 1, 1))
        self.assertEqual(len(task["validation_attempts"]), 1)

    def test_an_unattributable_error_fails_the_group_with_the_message(self):
        task, calls, _ = self.run_group(self.manager(), ["something global broke"])
        self.assertEqual(task["status"], "FAILED")
        self.assertIn("something global", task["error"])


if __name__ == "__main__":
    unittest.main()
