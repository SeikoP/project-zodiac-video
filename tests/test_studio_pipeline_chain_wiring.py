"""The chain is the default authoring run (ZODIAC_STUDIO_CHAIN=off keeps the old path); a finished proposal is applied, not redone."""
import json
import os
import pathlib
import tempfile
import threading
import unittest
from unittest.mock import patch

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project import agent_bridge, authoring_chain
from tools.studio_project.authoring_chain import Card
from tools.studio_project.pipeline import agent_runs, cards
from tools.studio_project.pipeline.runner import run_node


class SwitchTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-chain-wiring-")
        self.addCleanup(context.cleanup)
        self.workspace = pathlib.Path(context.name)

    def service(self):
        return FakeService(self.workspace, visual=visual_state(intent=None, build=None, source_hash=None), voice=voice_state())

    def test_chain_is_the_default_and_off_keeps_the_old_path(self):
        for value, expected in ((None, "agent.start_authoring_chain"), ("on", "agent.start_authoring_chain"),
                                ("off", "agent.start_authoring_scenes"), ("0", "agent.start_authoring_scenes")):
            env = {"ZODIAC_STUDIO_CHAIN": value} if value else {}
            with patch.dict(os.environ, env, clear=False):
                if value is None:
                    os.environ.pop("ZODIAC_STUDIO_CHAIN", None)
                service = self.service()
                run_node(service, "p", "visual", 5, caller="gui")
                self.assertEqual(service.calls[0][0], expected, value)

    def test_a_repair_always_edits_scenes_the_old_way(self):
        calls = []
        service = type("S", (), {"agent": type("A", (), {
            "start_authoring_chain": lambda *a, **k: calls.append("chain"),
            "start_authoring_scenes": lambda *a, **k: calls.append("scenes")})()})()
        with patch.dict(os.environ, {"ZODIAC_STUDIO_CHAIN": "on"}):
            agent_runs.start_authoring(service, "p", "sửa", repair=True)
            agent_runs.start_authoring(service, "p", "soạn")
        self.assertEqual(calls, ["scenes", "chain"])


class FakeLive:
    """LiveIO stand-in with three finished scenes and one owner card."""
    on_save = None

    def __init__(self, *a, **k):
        self.stored = {}

    def fingerprint(self):
        return "f"

    def scene_ids(self):
        return ["s01", "s02"]

    def load(self):
        return self.stored

    def save(self, state):
        self.stored = state
        if self.on_save:
            self.on_save(state)

    def skeleton(self):
        return "SKELETON"

    def stage_request(self, *a):
        return {}, {"scene": a[1]}

    act_request = stage_request

    def choose(self, kind, schema, data):
        return {}

    def assemble(self, skeleton, sid, stage, act):
        return {"text": f"text-{sid}", "asset_requests": [{"wanted": "một quầy"}] if sid == "s02" else []}

    def check_scene(self, *a):
        return []

    def core_fix(self, sid, text, issues):
        return text

    def merge(self, skeleton, texts, order):
        return json.dumps({"merged": order})


class ChainGroupTests(unittest.TestCase):
    def manager(self):
        self.workspace = pathlib.Path(tempfile.mkdtemp())
        service = type("S", (), {})()
        service.project = lambda pid: {"revision": 1, "source_sha256": "x", "status": {}}
        service.registry = type("R", (), {"root": self.workspace, "get": lambda s, pid: type("H", (), {"workspace": self.workspace})()})()
        return agent_bridge.AgentManager(service)

    def run_group(self, manager, **patches):
        gid = "a" * 32
        with manager._lock:
            manager._tasks[gid] = {"task_id": gid, "project_id": "p", "status": "STARTING", "kind": "episode.propose", "parts": [], "children": []}
        capsule = {"scene_ranges": [{"id": "s01"}, {"id": "s02"}], "instruction": "soạn"}
        with patch.object(agent_bridge.authoring_chain, "LiveIO", FakeLive), \
                patch.object(agent_bridge.agent_authoring, "bind_proposal", side_effect=lambda text, ctx: (text, [])), \
                patch.object(agent_bridge.agent_authoring, "proposal", side_effect=patches.get("proposal", lambda *a, **k: None)):
            manager._run_chain_group(gid, capsule)
        return manager.task(gid)

    def test_a_finished_chain_completes_the_task_like_the_old_group_and_saves_cards(self):
        manager = self.manager()
        task = self.run_group(manager)
        self.assertEqual(task["status"], "COMPLETED", task.get("error"))
        self.assertEqual(json.loads(task["suggestion"]), {"merged": ["s01", "s02"]})
        self.assertEqual([c.scene_id for c in cards.list_cards(self.workspace)], ["s02"])
        self.assertEqual({p["id"]: p["status"] for p in task["parts"]}, {"s01": "DONE", "s02": "DONE"})

    def test_a_proposal_the_validator_refuses_fails_the_task_with_the_message(self):
        def refuse(*a, **k):
            raise ValueError("VISUAL_BUILD_BLOCKED: s02")
        task = self.run_group(self.manager(), proposal=refuse)
        self.assertEqual(task["status"], "FAILED")
        self.assertIn("VISUAL_BUILD_BLOCKED", task["error"])

    def test_the_running_group_does_not_block_its_own_choices(self):
        manager = self.manager()
        with manager._lock:
            manager._tasks["g"] = {"task_id": "g", "project_id": "p", "status": "RUNNING", "kind": "episode.propose"}
        with patch.object(manager, "_bin", return_value="x"), patch.object(manager, "_run", return_value=None):
            first = manager.start_choice("p", {"type": "object", "properties": {"a": {}}}, {})
            second = manager.start_choice("p", {"type": "object", "properties": {"a": {}}}, {})
            with self.assertRaises(agent_bridge.StudioError) as full:
                manager.start_choice("p", {"type": "object", "properties": {"a": {}}}, {})
        self.assertEqual(full.exception.code, "AGENT_BUSY")
        self.assertNotEqual(first["task_id"], second["task_id"])


if __name__ == "__main__":
    unittest.main()
