"""Crash/replay and isolation tests for the Studio P0 metadata-only ledger."""
import tempfile
import unittest
from pathlib import Path

from tools.studio_project.models import ProjectHandle, StudioError
from tools.studio_project.registry import EpisodeRegistry


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="zodiac-studio-registry-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = ProjectHandle(
            project_id="ep-gemini",
            workspace=self.root / "episodes" / "gemini",
            imported_source_sha256="a" * 64,
            episode_id="gemini-2026",
        )
        self.registry = EpisodeRegistry(self.root)

    def test_register_and_reopen_same_source(self):
        self.assertEqual(self.registry.register(self.project, "b" * 64), self.project)
        reopened = EpisodeRegistry(self.root)
        self.assertEqual(reopened.get("ep-gemini"), self.project)
        self.assertEqual(reopened.find_by_source("a" * 64), self.project)
        self.assertEqual(reopened.register(self.project, "b" * 64), self.project)
        self.assertEqual(reopened.project_count(), 1)

    def test_duplicate_source_with_alternate_id_returns_original_identity(self):
        self.registry.register(self.project, "b" * 64)
        other = ProjectHandle("fresh-duplicate", self.root / "episodes" / "other", "a" * 64, "other")
        self.assertEqual(self.registry.register(other, "b" * 64), self.project)
        self.assertEqual(self.registry.project_count(), 1)

    def test_reject_identity_collision_and_source_manifest_drift(self):
        self.registry.register(self.project, "b" * 64)
        colliding = ProjectHandle("ep-gemini", self.root / "episodes" / "other", "c" * 64, "other")
        with self.assertRaises(StudioError) as err:
            self.registry.register(colliding, "d" * 64)
        self.assertEqual(err.exception.code, "PROJECT_IDENTITY_CONFLICT")
        with self.assertRaises(StudioError) as err2:
            self.registry.register(self.project, "d" * 64)
        self.assertEqual(err2.exception.code, "SOURCE_MANIFEST_DRIFT")

    def test_replay_events_after_restart(self):
        self.registry.register(self.project, "b" * 64)
        a = self.registry.record_command("ep-gemini", "cmd1", 0, "project.note", {"text": "source ready"})
        b = self.registry.record_command("ep-gemini", "cmd2", 1, "project.note", {"text": "QC pending"})
        new = EpisodeRegistry(self.root)
        self.assertEqual([x["command_id"] for x in new.events_since("ep-gemini", 0)], ["cmd1", "cmd2"])
        self.assertEqual(new.events_since("ep-gemini", a["event_seq"])[0]["command_id"], "cmd2")
        self.assertEqual(b["revision"], 2)
        self.assertEqual(new.current_revision("ep-gemini"), 2)

    def test_stale_revision_conflicts_without_side_effects(self):
        self.registry.register(self.project, "b" * 64)
        self.registry.record_command("ep-gemini", "cmd1", 0, "project.note", {"text": "one"})
        with self.assertRaises(StudioError) as err:
            self.registry.record_command("ep-gemini", "stale", 0, "project.note", {"text": "two"})
        self.assertEqual(err.exception.code, "REVISION_CONFLICT")
        self.assertEqual(self.registry.current_revision("ep-gemini"), 1)
        self.assertEqual(len(self.registry.events_since("ep-gemini", 0)), 1)

    def test_repeated_command_is_idempotent_but_modified_payload_is_rejected(self):
        self.registry.register(self.project, "b" * 64)
        first = self.registry.record_command("ep-gemini", "cmd1", 0, "project.note", {"text": "one"})
        self.assertEqual(self.registry.record_command("ep-gemini", "cmd1", 0, "project.note", {"text": "one"}), first)
        with self.assertRaises(StudioError) as err:
            self.registry.record_command("ep-gemini", "cmd1", 0, "project.note", {"text": "changed"})
        self.assertEqual(err.exception.code, "COMMAND_IDEMPOTENCY_CONFLICT")
        self.assertEqual(self.registry.current_revision("ep-gemini"), 1)

    def test_agent_cannot_approve_voice_or_visuals_via_event(self):
        self.registry.register(self.project, "b" * 64)
        for kind in ("voice.approve", "visual.approve", "content.approve", "arbitrary.write"):
            with self.subTest(kind=kind):
                with self.assertRaises(StudioError) as err:
                    self.registry.record_command("ep-gemini", kind, 0, kind, {})
                self.assertEqual(err.exception.code, "COMMAND_SCOPE_FORBIDDEN")
        self.assertEqual(self.registry.events_since("ep-gemini", 0), [])

    def test_failed_payload_write_leaves_no_partial_event(self):
        self.registry.register(self.project, "b" * 64)
        with self.assertRaises(StudioError) as err:
            self.registry.record_command("ep-gemini", "bad-json", 0, "project.note", {"bad": object()})
        self.assertEqual(err.exception.code, "COMMAND_PAYLOAD_INVALID")
        self.assertEqual(self.registry.current_revision("ep-gemini"), 0)
        self.assertEqual(self.registry.events_since("ep-gemini", 0), [])

    def test_external_workspace_and_invalid_digest_rejected(self):
        outside = ProjectHandle("outside", self.root.parent / "escape", "c" * 64, "unsafe")
        with self.assertRaises(StudioError) as err:
            self.registry.register(outside, "d" * 64)
        self.assertEqual(err.exception.code, "WORKSPACE_OUTSIDE_ROOT")
        with self.assertRaises(StudioError):
            self.registry.register(self.project, "not-a-sha")
        self.assertEqual(self.registry.project_count(), 0)


if __name__ == "__main__":
    unittest.main()
