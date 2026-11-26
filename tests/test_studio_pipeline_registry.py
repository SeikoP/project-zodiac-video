import json
import tempfile
import unittest
from pathlib import Path

from tools.studio_project.models import StudioError
from tools.studio_project.pipeline.registry import load_registry


def manifest(nodes):
    directory = tempfile.mkdtemp()
    path = Path(directory) / "nodes.json"
    path.write_text(json.dumps({"format": "zodiac-pipeline-nodes@1", "nodes": nodes}), encoding="utf-8")
    return path


class RegistryTests(unittest.TestCase):
    def test_default_manifest_is_valid_dag_in_topological_order(self):
        registry = load_registry()
        seen = set()
        for node in registry.nodes:
            self.assertTrue(set(node.inputs) <= seen, node.id)
            seen.add(node.id)
        self.assertEqual(registry.nodes[0].id, "content")
        self.assertEqual(registry.nodes[-1].id, "export")

    def test_gates_have_no_executor(self):
        registry = load_registry()
        gates = {n.id for n in registry.nodes if n.kind == "gate"}
        self.assertEqual(gates, {"content", "voice_review", "visual_review"})
        self.assertTrue(all(registry.spec(g).executor is None for g in gates))

    def test_cycle_rejected(self):
        path = manifest([
            {"id": "a", "kind": "step", "inputs": ["b"], "executor": "voice.start"},
            {"id": "b", "kind": "step", "inputs": ["a"], "executor": "voice.start"}])
        with self.assertRaises(StudioError) as ctx:
            load_registry(path)
        self.assertEqual(ctx.exception.code, "PIPELINE_REGISTRY_INVALID")

    def test_unknown_input_rejected(self):
        path = manifest([{"id": "a", "kind": "step", "inputs": ["ghost"], "executor": "voice.start"}])
        with self.assertRaises(StudioError):
            load_registry(path)

    def test_unknown_executor_rejected(self):
        path = manifest([{"id": "a", "kind": "step", "inputs": [], "executor": "shell.exec"}])
        with self.assertRaises(StudioError) as ctx:
            load_registry(path)
        self.assertEqual(ctx.exception.code, "PIPELINE_REGISTRY_INVALID")

    def test_gate_with_executor_rejected(self):
        path = manifest([{"id": "g", "kind": "gate", "inputs": [], "executor": "voice.start"}])
        with self.assertRaises(StudioError):
            load_registry(path)

    def test_agent_block_validated(self):
        for agent in ({"max_attempts": 2}, {"proposal_kind": "x", "max_attempts": 0},
                      {"proposal_kind": "x", "max_attempts": 4}):
            path = manifest([{"id": "a", "kind": "step", "inputs": [], "executor": "voice.start", "agent": agent}])
            with self.assertRaises(StudioError):
                load_registry(path)

    def test_visual_review_inputs_include_inspect_cover_publish(self):
        self.assertEqual(set(load_registry().spec("visual_review").inputs), {"inspect", "cover", "publish"})

    def test_new_node_needs_no_code_change(self):
        base = json.loads((Path(__file__).parents[1] / "tools/studio_project/pipeline/nodes.json").read_text("utf-8"))["nodes"]
        index = next(i for i, n in enumerate(base) if n["id"] == "timing")
        base.insert(index + 1, {"id": "music", "title": "Nhạc nền", "kind": "step", "inputs": ["timing"], "executor": "audio.mix"})
        path = manifest(base)
        with self.assertRaises(StudioError):
            load_registry(path)
        registry = load_registry(path, extra_executors=["audio.mix"])
        self.assertIn("music", [n.id for n in registry.nodes])

    def test_expand_fan_nodes(self):
        nodes = load_registry().expand(["s01", "s02"])
        by_id = {n.node_id: n for n in nodes}
        self.assertEqual(by_id["scene:s01"].inputs, ("assets",))
        self.assertEqual(by_id["scene:s02"].scene_id, "s02")
        self.assertEqual(by_id["build"].inputs, ("scene:s01", "scene:s02"))

    def test_expand_without_scenes_keeps_dependants_waiting(self):
        by_id = {n.node_id: n for n in load_registry().expand([])}
        self.assertNotIn("scene:s01", by_id)
        self.assertEqual(by_id["build"].inputs, ("assets",))


if __name__ == "__main__":
    unittest.main()
