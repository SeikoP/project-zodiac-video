"""Regression coverage for render observability and artifact fingerprints."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from test_studio_pipeline import write_multi_scene_job
from tools.studio.observability import (
    PerformanceStore,
    artifact_fingerprints,
    step_input_fingerprint,
)


class ArtifactFingerprintTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        self.job = write_multi_scene_job(self.root)

    def tearDown(self):
        self._temp.cleanup()

    def test_renderer_fingerprint_ignores_node_modules_and_out(self):
        before = artifact_fingerprints(self.job)
        (self.job / "renderer" / "node_modules" / "pkg").mkdir(parents=True, exist_ok=True)
        (self.job / "renderer" / "node_modules" / "pkg" / "x.js").write_text("x", encoding="utf-8")
        (self.job / "out").mkdir(parents=True, exist_ok=True)
        (self.job / "out" / "temporary.bin").write_bytes(b"x")
        after = artifact_fingerprints(self.job)
        self.assertEqual(before["renderer"], after["renderer"])
        self.assertEqual(before["package"], after["package"])

    def test_asset_change_only_changes_relevant_render_inputs(self):
        before = artifact_fingerprints(self.job)
        asset = next((self.job / "assets").rglob("*.svg"))
        asset.write_text(asset.read_text(encoding="utf-8") + "\n<!-- changed -->\n", encoding="utf-8")
        after = artifact_fingerprints(self.job)

        self.assertNotEqual(before["assets"], after["assets"])
        self.assertEqual(before["production"], after["production"])
        self.assertEqual(before["renderer"], after["renderer"])
        self.assertNotEqual(
            step_input_fingerprint("RENDER_VIDEO", before),
            step_input_fingerprint("RENDER_VIDEO", after),
        )

    def test_publish_copy_change_does_not_change_renderer_or_voice(self):
        before = artifact_fingerprints(self.job)
        copy = self.job / "publish" / "publish-copy.txt"
        copy.write_text(copy.read_text(encoding="utf-8") + "\nALT HOOK:\nTest\n", encoding="utf-8")
        after = artifact_fingerprints(self.job)

        self.assertNotEqual(before["publish"], after["publish"])
        self.assertEqual(before["renderer"], after["renderer"])
        self.assertEqual(before["voice"], after["voice"])
        self.assertNotEqual(
            step_input_fingerprint("MIX_MUSIC", before),
            step_input_fingerprint("MIX_MUSIC", after),
        )


class PerformanceStoreTests(unittest.TestCase):
    def test_append_is_atomic_and_keeps_structured_records(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            store = PerformanceStore(root)
            store.append(
                step="RENDER_VIDEO",
                elapsed_ms=12.5,
                result="done",
                input_fingerprint="in",
                output_fingerprint="out",
                cache_hit=None,
            )
            payload = json.loads(
                (root / ".runtime" / "performance.json").read_text(encoding="utf-8")
            )
            self.assertEqual(payload["version"], 1)
            self.assertEqual(payload["records"][-1]["step"], "RENDER_VIDEO")
            self.assertEqual(payload["records"][-1]["elapsed_ms"], 12.5)
            self.assertIsNone(payload["records"][-1]["cache_hit"])
            self.assertEqual(
                list((root / ".runtime").glob("performance.json*.tmp")),
                [],
            )


if __name__ == "__main__":
    unittest.main()
