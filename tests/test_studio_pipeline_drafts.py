import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import drafts
from tools.studio_project.pipeline.derive import PipelineEvidence
from tools.studio_project.pipeline.proposals import validate_proposal

INTENT = {"opening": {"sign": "Nhân Mã", "topic": "Cách Nhân Mã yêu thật lòng"}, "assets": {},
          "scenes": [{"id": "s01", "semantic_goal": "Mở chủ đề"}, {"id": "s02", "semantic_goal": "Đối chiếu"}]}


def service(intent=INTENT, build=None):
    root = tempfile.mkdtemp(prefix="zodiac-drafts-")
    (Path(root) / ".authoring").mkdir()
    (Path(root) / ".authoring/narrative-plan.json").write_text(json.dumps({"sign": "Nhân Mã", "core_premise": "Nhân Mã chốt giờ với người ấy."}), encoding="utf-8")
    state = {"intent": intent, "source_hash": "h1", "build": build}
    return SimpleNamespace(visual=SimpleNamespace(snapshot=lambda pid: state), project=lambda pid: {"display_title": "Tập thử"},
                           registry=SimpleNamespace(get=lambda pid: SimpleNamespace(workspace=root)))


def evidence():
    return PipelineEvidence(content_approved=True, scene_ids=("s01", "s02"), visual_revision=1, visual_source_hash="h1")


class DraftTests(unittest.TestCase):
    def valid(self, kind, payload):
        self.assertEqual(validate_proposal(kind, payload, evidence()), ())

    def test_cover_uses_the_authored_opening_topic_on_the_first_scene(self):
        kind, payload = drafts.draft(service(), "p", "cover")
        self.assertEqual((kind, payload), ("cover.design", {"headline": "Cách Nhân Mã yêu thật lòng", "scene_id": "s01"}))
        self.valid(kind, payload)

    def test_publish_copy_is_valid_and_tagged_with_the_sign(self):
        kind, payload = drafts.draft(service(), "p", "publish")
        self.valid(kind, payload)
        self.assertEqual(payload["title"], "Nhân Mã: Cách Nhân Mã yêu thật lòng")
        self.assertIn("#NhânMã", payload["hashtags"])
        self.assertTrue(payload["description"].startswith("Nhân Mã chốt giờ"))

    def test_inspect_reports_build_warnings_and_marks_the_rest_ok(self):
        build = {"id": "b1", "qa": {"issues": [], "review_warnings": [{"scene_id": "s02", "detail": "Cảnh dài nhưng ít thay đổi"}]}}
        kind, payload = drafts.draft(service(build=build), "p", "inspect")
        self.valid(kind, payload)
        self.assertEqual({f["scene_id"]: f["severity"] for f in payload["findings"] if f["scene_id"] != "episode"}, {"s02": "warn", "s01": "ok"})
        self.assertEqual(payload["method"], "structural")

    def test_inspect_needs_a_build_and_everything_needs_an_intent(self):
        with self.assertRaises(StudioError):
            drafts.draft(service(), "p", "inspect")
        with self.assertRaises(StudioError):
            drafts.draft(service(intent=None), "p", "cover")

    def test_assets_receipt_requires_every_library_reference_to_resolve(self):
        bad = {**INTENT, "assets": {"x": {"path": "library:props/does-not-exist.svg", "category": "prop"}}}
        with self.assertRaises(StudioError) as caught:
            drafts.record_assets(service(intent=bad), "p")
        self.assertEqual(caught.exception.code, "ASSETS_UNRESOLVED")
        drafts.record_assets(service(), "p")  # no references: resolves trivially and writes the receipt


if __name__ == "__main__":
    unittest.main()
