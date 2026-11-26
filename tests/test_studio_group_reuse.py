"""Run again after a failure: the new run reuses what the failed run already got right, and redoes only the rest."""
import json
import unittest
from unittest.mock import patch

import tests.test_studio_p1_agent as base
from tools.studio_project import agent_authoring, agent_parts

CAPSULE = {"dependencies": "dep1", "source_hash": "h1", "catalog": {"props": []}, "instruction": "soạn",
           "scene_ranges": [{"id": s} for s in ("s01", "s02", "s03")]}
SKELETON = json.dumps({"kind": "authoring.skeleton", "payload": {"intent": {"cast": ["a"]}}})


class GroupReuseTests(unittest.TestCase):
    setUp = base.AgentTests.setUp

    def failed_group(self, **changes):
        task = {"task_id": "old", "project_id": self.project["project_id"], "kind": "episode.propose", "status": "FAILED",
                "dependencies": "dep1", "visual_source_hash": "h1", "instruction": "soạn",
                "catalog_hash": agent_authoring.canonical_hash(CAPSULE["catalog"]),
                "parts_rev": 2, "part_texts": {"skeleton": SKELETON, "s01": "S01", "s02": "S02"}}
        task.update(changes)
        self.manager._tasks[task["task_id"]] = task

    def reusable(self, **capsule):
        return self.manager._reusable_parts(self.project["project_id"], {**CAPSULE, **capsule})

    def test_the_latest_failed_run_with_the_same_inputs_is_reused(self):
        self.failed_group()
        self.assertEqual(self.reusable(), {"skeleton": SKELETON, "scenes": {"s01": "S01", "s02": "S02"}, "skeleton_error": None})

    def test_anything_that_changed_means_nothing_is_reused(self):
        for changes in ({"dependencies": "dep2"}, {"visual_source_hash": "h2"}, {"instruction": "khác"}, {"status": "COMPLETED"},
                        {"catalog_hash": "other"}):
            self.failed_group(**changes)
            self.assertEqual(self.reusable(), {}, changes)

    def run_group(self, fail_with=None):
        calls = []

        def part(group_id, project_id, part_id, task, **_):
            calls.append(part_id)
            return SKELETON if part_id == "skeleton" else "NEW-" + part_id

        with patch.object(self.manager, "_run_part", side_effect=part), \
                patch.object(agent_parts, "skeleton_task", return_value={}), patch.object(agent_parts, "scene_task", return_value={}), \
                patch.object(agent_parts, "existing_skeleton", return_value=None), \
                patch.object(agent_parts, "validate_skeleton", side_effect=lambda text, cap: text), \
                patch.object(agent_parts, "validate_scene", side_effect=lambda text, task: text), \
                patch.object(agent_parts, "merge", side_effect=lambda skel, texts, order: json.dumps(texts)), \
                patch.object(agent_authoring, "bind_proposal", side_effect=lambda text, cap: (text, [])), \
                patch.object(agent_authoring, "proposal", side_effect=fail_with or (lambda *a, **k: None)):
            real = self.manager._run_group
            with patch.object(self.manager, "_bin", return_value="x"), patch.object(self.manager, "_run_group", return_value=None):
                group = self.manager.start(self.project["project_id"], author_task={**CAPSULE, "revision": 1, "source_hash": "h1"}, group=True)
            real(group["task_id"], CAPSULE)
        return group["task_id"], calls

    def test_a_rerun_only_authors_what_the_failed_run_did_not_finish(self):
        self.failed_group()
        group_id, calls = self.run_group()
        self.assertEqual(calls, ["s03"])  # skeleton, s01 and s02 came from the failed run
        task = self.manager.task(group_id)
        self.assertEqual(task["status"], "COMPLETED")
        self.assertEqual(json.loads(task["suggestion"]), {"s01": "S01", "s02": "S02", "s03": "NEW-s03"})

    def test_a_run_from_before_part_texts_existed_is_rebuilt_from_its_finished_children(self):
        self.failed_group(parts_rev=None, part_texts=None, children=["c0", "c1", "c2", "c3"])
        children = {"c0": ("skeleton", None, "COMPLETED", SKELETON, 1), "c1": ("scene", "s01", "COMPLETED", "S01", 2),
                    "c2": ("scene", "s02", "FAILED", "", 3), "c3": ("scene", "s02", "COMPLETED", "S02-late", 4)}
        for cid, (part, sid, status, text, at) in children.items():
            self.manager._tasks[cid] = {"task_id": cid, "project_id": self.project["project_id"], "kind": "episode.part", "part": part,
                                        "scene_id": sid, "status": status, "suggestion": text, "started_at": at}
        self.assertEqual(self.reusable(), {"skeleton": SKELETON, "scenes": {"s01": "S01", "s02": "S02-late"}, "skeleton_error": None})

    def test_reused_parts_that_no_longer_validate_are_authored_again(self):
        self.failed_group()
        calls = []

        def part(group_id, project_id, part_id, task, **_):
            calls.append(part_id)
            return SKELETON if part_id == "skeleton" else "NEW-" + part_id

        def reject_s02(text, task):
            if text == "S02":
                raise ValueError("stale")
            return text
        with patch.object(self.manager, "_run_part", side_effect=part), \
                patch.object(agent_parts, "skeleton_task", return_value={}), patch.object(agent_parts, "scene_task", return_value={}), \
                patch.object(agent_parts, "existing_skeleton", return_value=None), \
                patch.object(agent_parts, "validate_skeleton", side_effect=lambda text, cap: text), \
                patch.object(agent_parts, "validate_scene", side_effect=reject_s02), \
                patch.object(agent_parts, "merge", side_effect=lambda skel, texts, order: json.dumps(texts)), \
                patch.object(agent_authoring, "bind_proposal", side_effect=lambda text, cap: (text, [])), \
                patch.object(agent_authoring, "proposal", return_value=None):
            real = self.manager._run_group
            with patch.object(self.manager, "_bin", return_value="x"), patch.object(self.manager, "_run_group", return_value=None):
                group = self.manager.start(self.project["project_id"], author_task={**CAPSULE, "revision": 1, "source_hash": "h1"}, group=True)
            real(group["task_id"], CAPSULE)
        self.assertEqual(sorted(calls), ["s02", "s03"])

    def test_a_cut_short_run_does_not_hide_what_an_older_one_finished(self):
        self.failed_group(task_id="older", started_at=1, part_texts={"skeleton": SKELETON, "s01": "S01", "s02": "S02", "s03": "S03"})
        self.manager._tasks["newer"] = {**self.manager._tasks["older"], "task_id": "newer", "started_at": 2, "status": "INTERRUPTED",
                                        "part_texts": {"skeleton": SKELETON, "s01": "S01-new"}}
        self.assertEqual(self.reusable()["scenes"], {"s01": "S01-new", "s02": "S02", "s03": "S03"})

    def test_a_scene_blamed_by_any_run_is_never_reused_from_an_older_one(self):
        self.failed_group(task_id="older", started_at=1, part_texts={"skeleton": SKELETON, "s01": "S01", "s02": "S02-bad"})
        self.manager._tasks["newer"] = {**self.manager._tasks["older"], "task_id": "newer", "started_at": 2,
                                        "part_texts": {"skeleton": SKELETON, "s01": "S01"}, "blamed": ["s02"]}
        self.assertEqual(self.reusable()["scenes"], {"s01": "S01"})

    def test_a_run_from_before_parts_rev_is_rebuilt_from_children_even_if_it_stored_only_a_skeleton(self):
        self.failed_group(parts_rev=None, part_texts={"skeleton": SKELETON}, children=["c1"])
        self.manager._tasks["c1"] = {"task_id": "c1", "project_id": self.project["project_id"], "kind": "episode.part", "part": "scene",
                                     "scene_id": "s01", "status": "COMPLETED", "suggestion": "S01", "started_at": 1}
        self.manager._tasks["c0"] = {"task_id": "c0", "project_id": self.project["project_id"], "kind": "episode.part", "part": "skeleton",
                                     "scene_id": None, "status": "COMPLETED", "suggestion": SKELETON, "started_at": 0}
        self.manager._tasks["old"]["children"] = ["c0", "c1"]
        self.assertEqual(self.reusable()["scenes"], {"s01": "S01"})

    def test_a_fresh_run_authors_everything_and_remembers_each_part(self):
        group_id, calls = self.run_group()
        self.assertEqual(sorted(calls), ["s01", "s02", "s03", "skeleton"])
        self.assertEqual(set(self.manager.task(group_id)["part_texts"]), {"skeleton", "s01", "s02", "s03"})

    def test_scenes_the_validator_blamed_are_not_remembered_for_the_next_run(self):
        from tools.studio_project.models import StudioError
        group_id, _ = self.run_group(fail_with=StudioError("AGENT_PROPOSAL_INVALID", "asset 's02-table' dùng library:props/table.svg", "agent"))
        task = self.manager.task(group_id)
        self.assertEqual(task["status"], "FAILED")
        self.assertEqual(set(task["part_texts"]), {"skeleton", "s01", "s03"})

    def test_an_error_that_names_no_scene_keeps_every_scene_and_marks_the_skeleton_for_repair(self):
        from tools.studio_project.models import StudioError
        group_id, _ = self.run_group(fail_with=StudioError("AGENT_PROPOSAL_INVALID", "không rõ cảnh nào", "agent"))
        task = self.manager.task(group_id)
        self.assertEqual(set(task["part_texts"]), {"skeleton", "s01", "s02", "s03"})
        self.assertEqual(task["skeleton_error"], "AGENT_PROPOSAL_INVALID: không rõ cảnh nào")

    def test_the_next_run_repairs_only_the_skeleton_with_the_error_and_keeps_the_scenes(self):
        self.failed_group(part_texts={"skeleton": SKELETON, "s01": "S01", "s02": "S02", "s03": "S03"}, skeleton_error="Cast x/y: lỗi")
        seen = []

        def part(group_id, project_id, part_id, task, **_):
            seen.append((part_id, task))
            return SKELETON

        with patch.object(self.manager, "_run_part", side_effect=part), \
                patch.object(agent_parts, "skeleton_task", side_effect=lambda cap, previous=None, error=None: {"previous": previous, "error": error}), \
                patch.object(agent_parts, "scene_task", return_value={}), patch.object(agent_parts, "existing_skeleton", return_value=None), \
                patch.object(agent_parts, "validate_skeleton", side_effect=lambda text, cap: text), \
                patch.object(agent_parts, "validate_scene", side_effect=lambda text, task: text), \
                patch.object(agent_parts, "merge", side_effect=lambda skel, texts, order: json.dumps(texts)), \
                patch.object(agent_authoring, "bind_proposal", side_effect=lambda text, cap: (text, [])), \
                patch.object(agent_authoring, "proposal", return_value=None):
            real = self.manager._run_group
            with patch.object(self.manager, "_bin", return_value="x"), patch.object(self.manager, "_run_group", return_value=None):
                group = self.manager.start(self.project["project_id"], author_task={**CAPSULE, "revision": 1, "source_hash": "h1"}, group=True)
            real(group["task_id"], CAPSULE)
        self.assertEqual([part for part, _ in seen], ["skeleton"])
        self.assertEqual(seen[0][1], {"previous": SKELETON, "error": "Cast x/y: lỗi"})


if __name__ == "__main__":
    unittest.main()
