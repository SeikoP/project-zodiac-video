"""P0.4 receipt-driven statuses and evidence gates, never synthetic production approval."""
import hashlib
import json
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path

from tools.studio_project.evidence import evaluate_phase_gate
from tools.studio_project.importer import import_handoff
from tools.studio_project.registry import EpisodeRegistry
from tools.studio_project.status import resolve_episode_status
from tools.studio_project.models import ProjectHandle

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/studio_phase1_synthetic_fixture.mjs"
SHA = lambda data: hashlib.sha256(data).hexdigest()


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="zodiac-p0-evidence-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.reg = EpisodeRegistry(self.root / "projects")
        self.capsule = self.root / "synthetic-v2.zip"
        subprocess.run(["node", str(FIXTURE), str(self.capsule), "valid"], cwd=ROOT,
                       check=True, capture_output=True, text=True)
        self.project = import_handoff(self.root / "projects", self.capsule, self.reg)

    def test_content_bound_real_files_not_pipeline_status(self):
        status = resolve_episode_status(self.project)
        self.assertEqual(status.content, "APPROVED")
        self.assertEqual(status.voice, "UNKNOWN")
        self.assertEqual(status.visual, "UNKNOWN")
        self.assertEqual(status.video, "UNKNOWN")
        self.assertEqual(status.published, "UNKNOWN")

    def test_source_changed_after_import_blocks_content(self):
        (self.project.workspace / "narration.txt").write_text("altered", encoding="utf8")
        self.assertEqual(resolve_episode_status(self.project).content, "BLOCKED")

    def test_preferred_authoring_narration_drift_blocks(self):
        authoring = self.project.workspace / ".authoring/narration.txt"
        authoring.write_text("shadow narration that overrides approved source", encoding="utf8")
        self.assertEqual(resolve_episode_status(self.project).content, "BLOCKED")

    def test_pipeline_run_identity_drift_blocks(self):
        path = self.project.workspace / ".authoring/pipeline-state.json"
        state = json.loads(path.read_text("utf8"))
        state["run_id"] = "another-run-id"
        path.write_text(json.dumps(state), encoding="utf8")
        self.assertEqual(resolve_episode_status(self.project).content, "BLOCKED")

    def test_import_receipt_run_identity_drift_blocks(self):
        path = self.project.workspace / "studio-import-receipt.json"
        receipt = json.loads(path.read_text("utf8"))
        receipt["run_id"] = "another-run-id"
        path.write_text(json.dumps(receipt), encoding="utf8")
        self.assertEqual(resolve_episode_status(self.project).content, "BLOCKED")

    def test_missing_content_approval_receipt_blocks(self):
        (self.project.workspace / ".authoring/content-review-receipt.json").unlink()
        self.assertEqual(resolve_episode_status(self.project).content, "BLOCKED")

    def test_arbitrary_pass_word_is_not_evidence(self):
        state_file = self.project.workspace / ".authoring/pipeline-state.json"
        state = json.loads(state_file.read_text("utf8"))
        state["phases"]["02-visual-production"]["status"] = "PASS"
        state_file.write_text(json.dumps(state), encoding="utf8")
        status = resolve_episode_status(self.project)
        self.assertEqual(status.visual, "UNKNOWN")
        self.assertEqual(status.video, "UNKNOWN")

    def test_compatibility_approved_take_is_not_user_listened(self):
        self._voice_index("APPROVED", "studio-v2-compatibility")
        self.assertEqual(resolve_episode_status(self.project).voice, "COMPAT_MIGRATED")

    def test_unreviewed_take_stays_technical_valid(self):
        self._voice_index("APPROVED", "scripted-autogen")
        self.assertEqual(resolve_episode_status(self.project).voice, "TECHNICAL_VALID")

    def test_zip_and_mp4_on_disk_do_not_mean_export_or_publication(self):
        (self.project.workspace / "fake-job5.zip").write_bytes(b"ZIP file name only")
        (self.project.workspace / "video.mp4").write_bytes(b"not verified")
        (self.project.workspace / "publish").mkdir(exist_ok=True)
        (self.project.workspace / "publish/publish.json").write_text('{"status":"PUBLISHED"}')
        status = resolve_episode_status(self.project)
        self.assertEqual(status.video, "UNKNOWN")
        self.assertEqual(status.published, "UNKNOWN")

    def _voice_index(self, status, source):
        folder = self.project.workspace / ".runtime/artifacts/voice/S01"
        (folder / "takes").mkdir(parents=True, exist_ok=True)
        wav = folder / "takes/one.wav"
        with wave.open(str(wav), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(16000)
            handle.writeframes(b"\0\0" * 3200)
        data = {"version": 1, "scene_id": "S01", "active_take": "one",
                "takes": [{"take_id": "one", "status": status,
                           "path": wav.relative_to(self.project.workspace).as_posix(),
                           "wav_sha256": SHA(wav.read_bytes()),
                           "approval_source": source}]}
        (folder / "index.json").write_text(json.dumps(data), encoding="utf8")

    def _report(self):
        testlog = self.root / "ci-output.txt"
        testlog.write_text("10 tests ok, synthetic only\n", encoding="utf8")
        smoke = self.root / "smoke.txt"
        smoke.write_text("synthetic smoke artifact\n", encoding="utf8")
        reviewer = self.root / "review.txt"
        reviewer.write_text("reviewer diagnostic fixture only\n", encoding="utf8")
        return {
            "format": "zodiac-studio-phase-evidence@1",
            "phase_id": "P0", "task_id": "P0.3",
            "baseline_commit": "a" * 40, "implementation_commit": "b" * 40,
            "requirements": [{"id": "P0-IMPORT", "status": "TESTED",
                              "test_refs": ["import-pass"]}],
            "contracts": [{"name": "zodiac-phase1-handoff@2", "result": "PRESERVED"}],
            "reused_components": ["canonical-node-importer"],
            "changed_files": ["tools/studio_project/importer.py"],
            "test_runs": [{"id": "import-pass", "command": "python -m unittest ...",
                           "status": "PASS", "exit_code": 0,
                           "log_ref": "ci-output.txt", "log_sha256": SHA(testlog.read_bytes())}],
            "smoke_artifacts": [{"path": "smoke.txt", "sha256": SHA(smoke.read_bytes())}],
            "review_gates": [{"id": "P0-REVIEW", "status": "REVIEWED",
                              "evidence_ref": "review.txt",
                              "evidence_sha256": SHA(reviewer.read_bytes())}],
            "risks": [], "deferred": [],
            "rollback": "Revert only new Studio P0 adapter, retain Job@5",
            "handoff_ready": True,
        }

    def test_gate_accepts_complete_fingerprinted_test_only_report(self):
        result = evaluate_phase_gate(self._report(), {"P0-IMPORT"}, evidence_root=self.root)
        self.assertEqual(result["status"], "MERGE_READY")

    def test_required_item_or_failed_test_blocks(self):
        report = self._report()
        self.assertEqual(evaluate_phase_gate(report, {"P0-IMPORT", "P0-STATUS"},
                                             evidence_root=self.root)["status"], "BLOCKED")
        report["test_runs"][0]["exit_code"] = 1
        self.assertEqual(evaluate_phase_gate(report, {"P0-IMPORT"}, evidence_root=self.root)["status"], "BLOCKED")

    def test_missing_or_tampered_artifact_blocks(self):
        report = self._report()
        (self.root / "smoke.txt").write_text("mutated", encoding="utf8")
        self.assertEqual(evaluate_phase_gate(report, {"P0-IMPORT"}, evidence_root=self.root)["status"], "BLOCKED")

    def test_missing_reviewer_or_unsupported_human_approval_blocks(self):
        report = self._report()
        report["review_gates"][0]["status"] = "PENDING"
        self.assertEqual(evaluate_phase_gate(report, {"P0-IMPORT"}, evidence_root=self.root)["status"], "BLOCKED")

    def test_malformed_evidence_fields_block_without_exception(self):
        report = self._report()
        for field in ("contracts", "requirements", "smoke_artifacts", "review_gates",
                      "test_runs", "reused_components", "changed_files"):
            with self.subTest(field=field):
                malformed = {**report, field: None}
                self.assertEqual(
                    evaluate_phase_gate(malformed, {"P0-IMPORT"}, evidence_root=self.root)["status"],
                    "BLOCKED",
                )

    def test_traversal_and_unlinked_test_are_not_evidence(self):
        report = self._report()
        report["test_runs"][0]["log_ref"] = "../outside.log"
        self.assertEqual(evaluate_phase_gate(report, {"P0-IMPORT"}, evidence_root=self.root)["status"], "BLOCKED")
        report = self._report()
        report["requirements"][0]["test_refs"] = ["does-not-exist"]
        self.assertEqual(evaluate_phase_gate(report, {"P0-IMPORT"}, evidence_root=self.root)["status"], "BLOCKED")


if __name__ == "__main__":
    unittest.main()
