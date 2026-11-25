import json
import tempfile
import unittest
from pathlib import Path

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import autopilot as autopilot_module
from tools.studio_project.pipeline.api import pipeline_get
from tools.studio_project.pipeline.receipts import write_receipt
from tools.studio_project.pipeline.review import (confirm_visual_review, issue_playback, review_receipt_valid,
                                                  visual_review_status)

RUNTIME = Path(".runtime/visual-workspace")


class ReviewCase(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix="zodiac-review-")
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.service = FakeService(self.root, visual=visual_state(), voice=voice_state())
        self.write_state(source_hash="h1")
        for name, build in (("checks", None), ("assets", None), ("cover", None), ("publish", None), ("inspect", "b1")):
            write_receipt(self.root, name, source_hash="h1", build_id=build)

    def write_state(self, source_hash):
        build_dir = self.root / RUNTIME / "builds" / "b1"
        build_dir.mkdir(parents=True, exist_ok=True)
        (build_dir / "manifest.json").write_text('{"scenes": []}', encoding="utf-8")
        state = {"revision": 5, "source_hash": source_hash, "build": {"id": "b1"}}
        (self.root / RUNTIME / "state.json").write_text(json.dumps(state), encoding="utf-8")
        return state

    def confirm(self, playback_id=None, **over):
        playback_id = playback_id or issue_playback(self.service, "p", "b1")["playback_id"]
        args = dict(base_revision=5, build_id="b1", playback_id=playback_id)
        args.update(over)
        return confirm_visual_review(self.service, "p", **args)


class ReviewTests(ReviewCase):
    def test_status_visual_unknown_without_receipt(self):
        self.assertEqual(visual_review_status(self.root), "UNKNOWN")

    def test_gate_awaits_user_once_evidence_is_complete(self):
        nodes = {n["id"]: n["status"] for n in pipeline_get(self.service, "p")["nodes"]}
        self.assertEqual(nodes["visual_review"], "AWAITING_USER")

    def test_confirm_requires_issued_playback_id(self):
        with self.assertRaises(StudioError) as ctx:
            self.confirm(playback_id="made-up")
        self.assertEqual(ctx.exception.code, "PIPELINE_PLAYBACK_REQUIRED")
        self.assertEqual(visual_review_status(self.root), "UNKNOWN")

    def test_confirm_too_soon_after_opening_the_preview_is_refused(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {"ZODIAC_REVIEW_MIN_SECONDS": "30"}):
            with self.assertRaises(StudioError) as ctx:
                self.confirm()
        self.assertEqual(ctx.exception.code, "PIPELINE_PLAYBACK_TOO_SHORT")
        self.assertEqual(visual_review_status(self.root), "UNKNOWN")

    def test_playback_is_single_use(self):
        token = issue_playback(self.service, "p", "b1")["playback_id"]
        self.confirm(playback_id=token)
        with self.assertRaises(StudioError):
            self.confirm(playback_id=token)

    def test_confirm_binds_build_and_source_hash(self):
        self.confirm()
        receipt = json.loads((self.root / RUNTIME / "review.json").read_text("utf-8"))
        self.assertEqual(receipt["format"], "zodiac-visual-review@1")
        self.assertEqual((receipt["build_id"], receipt["source_hash"], receipt["revision"]), ("b1", "h1", 5))
        self.assertEqual(receipt["proof"]["kind"], "user_gui")
        self.assertEqual(len(receipt["build_manifest_sha256"]), 64)
        self.assertEqual(visual_review_status(self.root), "APPROVED")
        nodes = {n["id"]: n["status"] for n in pipeline_get(self.service, "p")["nodes"]}
        self.assertEqual(nodes["visual_review"], "DONE")

    def test_edit_after_review_makes_receipt_stale(self):
        self.confirm()
        state = self.write_state(source_hash="h2")  # source edited after approval
        self.assertEqual(visual_review_status(self.root), "STALE")
        self.assertFalse(review_receipt_valid(self.root, state))

    def test_rebuild_after_review_makes_receipt_stale(self):
        self.confirm()
        (self.root / RUNTIME / "builds/b1/manifest.json").write_text('{"scenes": [1]}', encoding="utf-8")
        self.assertEqual(visual_review_status(self.root), "STALE")

    def test_agent_cannot_confirm(self):
        token = issue_playback(self.service, "p", "b1")["playback_id"]
        for caller in ("agent", "autopilot"):
            with self.assertRaises(StudioError) as ctx:
                confirm_visual_review(self.service, "p", 5, "b1", token, caller=caller)
            self.assertEqual(ctx.exception.code, "COMMAND_SCOPE_FORBIDDEN")
        self.assertEqual(visual_review_status(self.root), "UNKNOWN")
        for word in ("confirm_visual_review", "pipeline.review"):
            self.assertNotIn(word, open(autopilot_module.__file__, encoding="utf-8").read())

    def test_stale_revision_and_wrong_build_rejected(self):
        with self.assertRaises(StudioError) as ctx:
            self.confirm(base_revision=4)
        self.assertEqual(ctx.exception.code, "REVISION_CONFLICT")
        with self.assertRaises(StudioError) as ctx:
            self.confirm(build_id="b2")
        self.assertEqual(ctx.exception.code, "PIPELINE_BUILD_MISMATCH")

    def test_playback_unavailable_until_agent_work_is_done(self):
        (self.root / ".runtime/pipeline/receipts/cover.json").unlink()
        with self.assertRaises(StudioError) as ctx:
            issue_playback(self.service, "p", "b1")
        self.assertEqual(ctx.exception.code, "PIPELINE_GATE_NOT_READY")

    def test_episode_status_reports_visual_from_receipt(self):
        from tools.studio_project import status as status_module
        self.assertEqual(status_module.visual_status(self.root), "UNKNOWN")
        self.confirm()
        self.assertEqual(status_module.visual_status(self.root), "APPROVED")


class EvidenceTests(ReviewCase):
    def test_evidence_returns_receipt_payloads_and_build_for_the_review_panel(self):
        from tools.studio_project.pipeline.api import pipeline_evidence
        write_receipt(self.root, "publish", source_hash="h1", payload={"title": "T", "description": "D", "hashtags": []})
        evidence = pipeline_evidence(self.service, "p")
        self.assertEqual(evidence["build_id"], "b1")
        self.assertEqual(evidence["source_hash"], "h1")
        self.assertEqual(evidence["publish"]["title"], "T")
        self.assertIsNone(evidence["checks"])  # no validation report written yet
        self.assertEqual(evidence["cover"], {})

    def test_evidence_rpc_is_read_only_and_exact(self):
        from tools.studio_project.rpc_stdio import dispatch
        self.assertIn("inspect", dispatch(self.service, "pipeline.evidence", {"project_id": "p"}))
        with self.assertRaises(StudioError):
            dispatch(self.service, "pipeline.evidence", {"project_id": "p", "extra": 1})


class RpcTests(ReviewCase):
    def test_gate_rpcs_issue_playback_then_confirm_and_resume_autopilot(self):
        from tools.studio_project.rpc_stdio import dispatch
        playback = dispatch(self.service, "pipeline.gate.playback", {"project_id": "p", "gate": "visual_review", "build_id": "b1"})
        out = dispatch(self.service, "pipeline.gate.confirm", {"project_id": "p", "gate": "visual_review", "base_revision": 5,
                                                              "build_id": "b1", "playback_id": playback["playback_id"]})
        self.assertEqual(out["status"], "APPROVED")

    def test_only_visual_review_gate_is_supported(self):
        from tools.studio_project.rpc_stdio import dispatch
        with self.assertRaises(StudioError) as ctx:
            dispatch(self.service, "pipeline.gate.confirm", {"project_id": "p", "gate": "content", "base_revision": 5,
                                                            "build_id": "b1", "playback_id": "x"})
        self.assertEqual(ctx.exception.code, "PIPELINE_GATE_UNSUPPORTED")


if __name__ == "__main__":
    unittest.main()
