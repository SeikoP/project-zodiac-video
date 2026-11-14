"""P0.3 source-bound Phase 1 import. All approval fixtures are synthetic test-only."""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.studio_project.importer import import_handoff
from tools.studio_project.models import StudioError
from tools.studio_project.registry import EpisodeRegistry

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/studio_phase1_synthetic_fixture.mjs"
BRIDGE = ROOT / "tools/studio_project/handoff_bridge.mjs"


def synthetic_capsule(directory: Path, mode="valid") -> Path:
    archive = directory / (mode + ".zip")
    subprocess.run(["node", str(FIXTURE), str(archive), mode], cwd=ROOT, check=True,
                   capture_output=True, text=True)
    return archive


class ImportTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="zodiac-p0-import-test-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.registry = EpisodeRegistry(self.root / "projects")

    def _import(self, mode="valid", **kwargs):
        zip_path = synthetic_capsule(self.root, mode)
        return import_handoff(self.root / "projects", zip_path, self.registry, **kwargs)

    def test_valid_v2_source_immutable_and_reopen(self):
        zip_path = synthetic_capsule(self.root)
        original = hashlib.sha256(zip_path.read_bytes()).hexdigest()
        project = import_handoff(self.root / "projects", zip_path, self.registry)
        self.assertEqual(self.registry.get(project.project_id), project)
        self.assertEqual(hashlib.sha256(zip_path.read_bytes()).hexdigest(), original)
        self.assertEqual((project.workspace / "narration.txt").read_text("utf8"),
                         "Câu duyệt giả lập riêng cho unit test.\n")
        self.assertEqual(self.registry.project_count(), 1)
        self.assertEqual(self.registry.current_revision(project.project_id), 0)

    def test_same_approved_source_is_idempotent_and_no_duplicate(self):
        a = synthetic_capsule(self.root)
        first = import_handoff(self.root / "projects", a, self.registry)
        second = import_handoff(self.root / "projects", a, EpisodeRegistry(self.root / "projects"))
        self.assertEqual(first, second)
        self.assertEqual(self.registry.project_count(), 1)

    def test_invalid_zip_never_creates_episode(self):
        with self.assertRaises(StudioError):
            self._import("invalid-zip")
        self.assertEqual(self.registry.project_count(), 0)
        self.assertEqual(list((self.root / "projects" / "episodes").glob("studio-*")), [])

    def test_recomputed_archive_hash_with_drift_is_blocked(self):
        with self.assertRaises(StudioError) as cm:
            self._import("drift")
        self.assertIn("CONTENT_APPROVAL_SOURCE_DRIFT", cm.exception.message)
        self.assertEqual(self.registry.project_count(), 0)

    def test_missing_review_or_mismatch_proof_blocks(self):
        for mode in ("missing-approval", "proof-mismatch", "receipt-mismatch"):
            with self.subTest(mode=mode):
                with self.assertRaises(StudioError):
                    self._import(mode)
                self.assertEqual(self.registry.project_count(), 0)

    def test_missing_node_returns_typed_error(self):
        with self.assertRaises(StudioError) as cm:
            self._import(node_executable="NO-SUCH-NODE-EXECUTABLE")
        self.assertEqual(cm.exception.code, "NODE_RUNTIME_MISSING")
        self.assertEqual(self.registry.project_count(), 0)

    def test_existing_source_mutation_blocks_reopen(self):
        capsule = synthetic_capsule(self.root)
        episode = import_handoff(self.root / "projects", capsule, self.registry)
        (episode.workspace / "narration.txt").write_text("unauthorized mutation", encoding="utf8")
        with self.assertRaises(StudioError) as cm:
            import_handoff(self.root / "projects", capsule, self.registry)
        self.assertIn("STUDIO_MATERIALIZED_SOURCE_DRIFT", cm.exception.message)
        self.assertEqual(self.registry.project_count(), 1)

    def test_crash_after_publish_before_register_adopts_only_verified_files(self):
        cap = synthetic_capsule(self.root)
        with self.assertRaises(RuntimeError):
            import_handoff(self.root / "projects", cap, self.registry,
                           fault_after_publish=True)
        self.assertEqual(self.registry.project_count(), 0)
        restored = import_handoff(self.root / "projects", cap, self.registry)
        self.assertTrue(restored.workspace.exists())
        self.assertEqual(self.registry.project_count(), 1)

    def test_adoption_rejects_orphan_with_modified_narration(self):
        cap = synthetic_capsule(self.root)
        with self.assertRaises(RuntimeError):
            import_handoff(self.root / "projects", cap, self.registry, fault_after_publish=True)
        episodes = list((self.root / "projects" / "episodes").glob("studio-*"))
        self.assertEqual(len(episodes), 1)
        (episodes[0] / "narration.txt").write_text("tampered", encoding="utf8")
        with self.assertRaises(StudioError):
            import_handoff(self.root / "projects", cap, self.registry)
        self.assertEqual(self.registry.project_count(), 0)

    def test_two_simultaneous_imports_reuse_one_identity(self):
        from concurrent.futures import ThreadPoolExecutor
        cap = synthetic_capsule(self.root)
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(import_handoff, self.root / "projects", cap,
                                       self.registry) for _ in range(2)]
            outputs = [f.result(timeout=30) for f in futures]
        self.assertEqual(outputs[0], outputs[1])
        self.assertEqual(self.registry.project_count(), 1)

    def test_missing_capsule_is_typed_and_does_not_publish(self):
        with self.assertRaises(StudioError) as cm:
            import_handoff(self.root / "projects", self.root / "missing.zip", self.registry)
        self.assertEqual(cm.exception.code, "HANDOFF_SOURCE_INVALID")
        self.assertEqual(self.registry.project_count(), 0)

    def test_symlinked_source_escape_blocks_reopen(self):
        capsule = synthetic_capsule(self.root)
        episode = import_handoff(self.root / "projects", capsule, self.registry)
        content = episode.workspace / "narration.txt"
        outside = self.root / "outside-narration.txt"
        outside.write_bytes(content.read_bytes())
        content.unlink()
        try:
            content.symlink_to(outside)
        except (OSError, NotImplementedError) as exc:
            self.skipTest(f"Platform lacks symlink privileges: {exc}")
        with self.assertRaises(StudioError) as cm:
            import_handoff(self.root / "projects", capsule, self.registry)
        self.assertEqual(cm.exception.code, "STUDIO_MATERIALIZED_SYMLINK_ESCAPE")

    def test_unsafe_legacy_zip_path_is_rejected(self):
        import zipfile
        bad = self.root / "unsafe.zip"
        with zipfile.ZipFile(bad, "w") as archive:
            archive.writestr("../escape.txt", "not an approved capsule")
        with self.assertRaises(StudioError):
            import_handoff(self.root / "projects", bad, self.registry)
        self.assertEqual(self.registry.project_count(), 0)

    def test_bridge_inspect_and_materialize_emit_one_machine_json(self):
        zip_path = synthetic_capsule(self.root)
        inspect = subprocess.run(["node", str(BRIDGE), "inspect", str(zip_path)],
                                 cwd=ROOT, text=True, capture_output=True, check=True)
        data = json.loads(inspect.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["manifest"]["contract_major"], 2)
        self.assertEqual(len(data["source_sha256"]), 64)
        self.assertNotIn("APPROVED: true", inspect.stdout)


if __name__ == "__main__":
    unittest.main()
