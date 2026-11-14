"""P1 vertical slice: Project Core read/command contract, never source editing."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.studio_project.models import StudioError
from tools.studio_project.service import StudioProjectService

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/studio_phase1_synthetic_fixture.mjs"


class P1ProjectServiceTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix="zodiac-p1-service-")
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.service = StudioProjectService(self.root / "projects")
        self.archive = self.root / "synthetic-approved.zip"
        subprocess.run(["node", str(FIXTURE), str(self.archive), "valid"],
                       cwd=ROOT, check=True, capture_output=True, encoding="utf-8")
        self.source_sha = __import__("hashlib").sha256(self.archive.read_bytes()).hexdigest()

    def _register(self):
        return self.service.import_capsule(self.archive)

    def test_import_list_reopen_is_idempotent(self):
        first = self._register()
        second = self._register()
        self.assertEqual(first["project_id"], second["project_id"])
        self.assertEqual(first["source_sha256"], second["source_sha256"])
        self.assertEqual(len(self.service.list_projects()), 1)
        after = StudioProjectService(self.root / "projects")
        self.assertEqual(after.project(first["project_id"])["status"]["content"], "APPROVED")
        self.assertEqual(after.project(first["project_id"])["revision"], 0)
        self.assertEqual(self.source_sha, __import__("hashlib").sha256(self.archive.read_bytes()).hexdigest())

    def test_safe_note_command_emits_one_revisioned_event(self):
        project = self._register()
        pid = project["project_id"]
        command = {"project_id": pid, "command_id": "note-1", "base_revision": 0,
                   "kind": "project.note", "payload": {"text": "Check caption readability."}}
        first = self.service.command(command)
        second = self.service.command(command)
        self.assertEqual(first, second)
        self.assertEqual(first["revision"], 1)
        self.assertEqual(self.service.project(pid)["revision"], 1)
        events = self.service.events(pid, after_seq=0)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["kind"], "project.note")
        self.assertEqual(self.service.events(pid, after_seq=events[0]["event_seq"]), [])
        self.assertEqual(self.service.project(pid)["status"]["content"], "APPROVED")

    def test_stale_revision_and_duplicate_command_are_rejected(self):
        pid = self._register()["project_id"]
        self.service.command({"project_id": pid, "command_id": "note-1",
                              "base_revision": 0, "kind": "project.note", "payload": {"text": "a"}})
        with self.assertRaises(StudioError) as err:
            self.service.command({"project_id": pid, "command_id": "note-2",
                                  "base_revision": 0, "kind": "project.note", "payload": {"text": "b"}})
        self.assertEqual(err.exception.code, "REVISION_CONFLICT")
        with self.assertRaises(StudioError) as err:
            self.service.command({"project_id": pid, "command_id": "note-1",
                                  "base_revision": 0, "kind": "project.note", "payload": {"text": "changed"}})
        self.assertEqual(err.exception.code, "COMMAND_IDEMPOTENCY_CONFLICT")

    def test_no_impersonated_approval_or_arbitrary_files(self):
        pid = self._register()["project_id"]
        for kind in ("voice.approve", "phase.approve", "scene.apply_patch", "project.delete"):
            with self.subTest(kind=kind):
                with self.assertRaises(StudioError):
                    self.service.command({"project_id": pid, "command_id": "invalid",
                                          "base_revision": 0, "kind": kind,
                                          "payload": {"status": "APPROVED"}})
        with self.assertRaises(StudioError):
            self.service.command({"project_id": pid, "command_id": "bad-payload",
                                  "base_revision": 0, "kind": "project.note",
                                  "payload": {"text": "ok", "path": "../../outside.txt"}})
        self.assertEqual(self.service.project(pid)["revision"], 0)

    def test_rejects_unsafe_note_payload_and_ids(self):
        pid = self._register()["project_id"]
        for payload in ({"text": ""}, {"text": "x" * 2001},
                        {"text": "a\u0000b"}, {"text": "yes", "approved": True},
                        {"text": 42}, {"tag": "tag"}):
            with self.subTest(payload=payload):
                with self.assertRaises(StudioError):
                    self.service.command({"project_id": pid, "command_id": "a",
                                          "base_revision": 0, "kind": "project.note",
                                          "payload": payload})
        with self.assertRaises(StudioError):
            self.service.project("../outside")
        with self.assertRaises(StudioError):
            self.service.events(pid, after_seq=-1)

    def test_actual_prop_catalog_is_read_only_unranked_and_has_real_digests(self):
        assets = self.service.assets(limit=200)
        self.assertEqual(assets["format"], "zodiac-studio-asset-index@1")
        self.assertFalse(assets["ranked"])
        phone = next(x for x in assets["items"] if x["id"] == "phone")
        self.assertEqual(phone["role"], "story_prop")
        self.assertEqual(len(phone["sha256"]), 64)
        self.assertEqual(phone["source"], "asset-library-v4")
        self.assertNotIn("scene-set-home", [x["id"] for x in assets["items"]])
        self.assertEqual(self.service.assets(query="not-present")["items"], [])
        self.assertEqual(self.service.assets(query="phone")["total"] >= 1, True)

    def test_project_pages_keep_projects_after_first_hundred(self):
        from tools.studio_project.models import ProjectHandle
        for index in range(101):
            ident = f"studio-p1-test-{index:03d}"
            handle = ProjectHandle(ident, self.service.registry.root / "episodes" / ident,
                                   f"{index + 1:064x}", f"ep-{index:03d}")
            self.service.registry.register(handle, "d" * 64)
        first = self.service.list_projects(limit=100)
        second = self.service.list_projects(limit=100, after_project_id=first[-1]["project_id"])
        self.assertEqual(len(first), 100)
        self.assertEqual(len(second), 1)
        self.assertEqual(second[0]["project_id"], "studio-p1-test-100")
        with self.assertRaises(StudioError):
            self.service.list_projects(limit=100, after_project_id="../../outside")

    def test_unknown_project_yields_typed_error(self):
        with self.assertRaises(StudioError) as cm:
            self.service.project("missing")
        self.assertEqual(cm.exception.code, "PROJECT_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
