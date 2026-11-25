"""Autopilot repair revises only the scenes the validator names, two agents at a time, and merges into one command."""
import copy
import json
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from tools.studio_project.models import StudioError
from tools.studio_project.pipeline.autopilot import Issue, _revise_scenes

INTENT = {"assets": {"keep": {"path": "library:props/phone.svg"}},
          "scenes": [{"id": f"s0{i}", "semantic_goal": f"goal {i}", "entities": [], "events": []} for i in range(1, 9)]}


def issue(scene_id, code="PASSIVE_STORYTELLING"):
    return Issue(code, "visual-intent", scene_id, code, "visual-intent:" + str(scene_id))


class FakeAgent:
    def __init__(self, fail=()):
        self.started, self.live, self.peak, self.lock = [], 0, 0, threading.Lock()
        self.tasks, self.fail = {}, set(fail)

    def start_scene_revision(self, project_id, scene_id, instruction):
        with self.lock:
            if self.live >= 2:
                raise StudioError("AGENT_BUSY", "full", "agent")
            self.live += 1
            self.peak = max(self.peak, self.live)
            self.started.append((scene_id, instruction))
        task_id = f"{scene_id:0<32}"[:32].replace("s", "a")
        self.tasks[task_id] = {"task_id": task_id, "scene_id": scene_id}
        return dict(self.tasks[task_id], status="RUNNING")

    def task(self, task_id):
        time.sleep(0.02)
        scene_id = self.tasks[task_id]["scene_id"]
        with self.lock:
            self.live = max(0, self.live - 1) if self.tasks[task_id].get("done") is None else self.live
            self.tasks[task_id]["done"] = True
        if scene_id in self.fail:
            return {"task_id": task_id, "status": "FAILED", "error": "boom"}
        intent = copy.deepcopy(INTENT)
        for scene in intent["scenes"]:
            if scene["id"] == scene_id:
                scene["semantic_goal"] = "REVISED " + scene_id
        intent["assets"][scene_id + "-new"] = {"path": "library:props/x.svg"}
        return {"task_id": task_id, "status": "COMPLETED", "dependencies": "fp-1",
                "suggestion": json.dumps({"kind": "source.replace", "payload": {"intent": intent}})}


def service_with(agent):
    return SimpleNamespace(agent=agent, visual=SimpleNamespace(snapshot=lambda pid: {"intent": copy.deepcopy(INTENT)}))


PILOT = SimpleNamespace(_state_lock=threading.RLock(), _stopped=False)


class ReviseScenesTests(unittest.TestCase):
    def run_repair(self, by_scene, agent=None):
        agent = agent or FakeAgent()
        with patch("tools.studio_project.pipeline.agent_runs.track"):  # tracking is covered by its own tests
            return agent, _revise_scenes(service_with(agent), "p", "checks", by_scene, PILOT)

    def test_only_the_named_scenes_are_revised_and_the_rest_are_byte_identical(self):
        agent, items = self.run_repair({"s03": [issue("s03")], "s08": [issue("s08")]})
        self.assertEqual(sorted(s for s, _ in agent.started), ["s03", "s08"])
        merged = items[0]["payload"]["payload"]["intent"]
        by_id = {s["id"]: s for s in merged["scenes"]}
        self.assertEqual(by_id["s03"]["semantic_goal"], "REVISED s03")
        self.assertEqual(by_id["s08"]["semantic_goal"], "REVISED s08")
        for sid in ("s01", "s02", "s04", "s05", "s06", "s07"):
            self.assertEqual(json.dumps(by_id[sid], sort_keys=True), json.dumps(next(s for s in INTENT["scenes"] if s["id"] == sid), sort_keys=True))
        self.assertIn("s03-new", merged["assets"])
        self.assertEqual(items[0]["voice_dependencies"], "fp-1")
        self.assertEqual(items[0]["kind"], "visual.intent")

    def test_each_agent_hears_only_its_own_scene_issues(self):
        agent, _ = self.run_repair({"s03": [issue("s03", "FRAME_OCCUPANCY_LOW")], "s08": [issue("s08", "PASSIVE_STORYTELLING")]})
        text = dict(agent.started)
        self.assertIn("FRAME_OCCUPANCY_LOW", text["s03"])
        self.assertNotIn("PASSIVE_STORYTELLING", text["s03"].split("Lỗi:")[-1])
        self.assertIn("PASSIVE_STORYTELLING", text["s08"])

    def test_two_agents_run_at_the_same_time_but_not_three(self):
        agent, _ = self.run_repair({f"s0{i}": [issue(f"s0{i}")] for i in (1, 2, 3, 4)})
        self.assertLessEqual(agent.peak, 2)
        self.assertEqual(len(agent.started), 4)

    def test_a_failed_revision_falls_back_to_none_so_the_caller_can_regenerate(self):
        _, items = self.run_repair({"s03": [issue("s03")], "s08": [issue("s08")]}, FakeAgent(fail={"s08"}))
        self.assertIsNone(items)

    def test_a_stopped_autopilot_raises_cancelled(self):
        pilot = SimpleNamespace(_state_lock=threading.RLock(), _stopped=True)
        with self.assertRaises(StudioError) as caught:
            _revise_scenes(service_with(FakeAgent()), "p", "checks", {"s03": [issue("s03")]}, pilot)
        self.assertEqual(caught.exception.code, "AGENT_CANCELLED")


if __name__ == "__main__":
    unittest.main()
