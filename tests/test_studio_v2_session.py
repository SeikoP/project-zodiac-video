import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.studio_v2.pipeline import DONE, FAILED, PENDING, PipelineStateV2
from tools.studio_v2.session import (
    StudioV2Session,
    detect_job5_manifest,
    job5_workspace_path,
    v2_pipeline_rows,
)


def manifest(*, job_id="scorpio-two-versions", revision="1.0.0"):
    return {
        "format": "zodiac-job@5",
        "job": {"id": job_id, "revision": revision},
        "contract": {
            "id": "zodiac-authoring-ir",
            "version": "1.0.0",
            "sha256": canonical_contract_hash("authoring-ir-v1"),
        },
        "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
        "producer": {"plugin": "test", "version": "2.0.0"},
    }


class StudioV2SessionTests(unittest.TestCase):
    def test_detects_job5_manifest_inside_wrapper_zip(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "renamed-anything.zip"
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr(
                    "wrapper/package-manifest.json",
                    json.dumps(manifest()),
                )
            found = detect_job5_manifest(archive)
            self.assertEqual(found["format"], "zodiac-job@5")
            self.assertEqual(found["job"]["id"], "scorpio-two-versions")

    def test_workspace_uses_manifest_job_id_not_zip_filename(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first = job5_workspace_path(
                root,
                manifest(revision="1.0.0"),
                archive_name="zodiac-bocap-v1.zip",
            )
            second = job5_workspace_path(
                root,
                manifest(revision="1.1.0"),
                archive_name="totally-renamed.zip",
            )
            self.assertEqual(first, second)
            self.assertEqual(first.name, "scorpio-two-versions")

    def test_pipeline_rows_show_all_seven_v2_stages_and_reuse(self):
        state = PipelineStateV2(workspace_id="scorpio-two-versions")
        state.mark_done(
            "PACKAGE",
            input_hash="pkg",
            output_hash="pkg",
            reused=False,
        )
        state.mark_done(
            "VOICE",
            input_hash="voice",
            output_hash="wav",
            reused=True,
        )
        rows = v2_pipeline_rows(state)
        self.assertEqual(
            [row["label"] for row in rows],
            ["GÓI", "GIỌNG", "TIMING", "KẾ HOẠCH", "RENDER", "ÂM THANH", "OUTPUT"],
        )
        self.assertEqual(rows[1]["detail"], "Dùng lại")
        self.assertEqual(rows[0]["detail"], "Tạo mới")
        self.assertEqual(rows[2]["status"], PENDING)


    def test_v2_session_keeps_same_workspace_across_patch_zip_names(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            source.mkdir()
            (source / "production.ir.json").write_text(
                json.dumps({
                    "format": "zodiac-authoring-ir@1",
                    "fps": 24,
                    "video": {"width": 1080, "height": 1920},
                    "assets": {},
                    "scenes": [{
                        "id": "S01",
                        "voice": "xin chao",
                        "duration_hint_frames": 48,
                        "entities": [],
                        "events": [],
                    }],
                }),
                encoding="utf-8",
            )
            (source / "design-token.json").write_text(
                json.dumps({
                    "id": "zodiac-paper-doodle-meme-v4",
                    "version": "4.0",
                    "style_family": "paper-doodle-chibi-meme",
                    "handmade_profile": "human-stroke-v2",
                    "motion_defaults": {},
                }),
                encoding="utf-8",
            )
            (source / "narration.txt").write_text("xin chao\n", encoding="utf-8")
            publish = source / "publish"
            publish.mkdir()
            (publish / "publish.json").write_text(
                json.dumps({"format": "zodiac-publish@1", "source": {"narration": "narration.txt", "production": "production.ir.json"}}),
                encoding="utf-8",
            )
            (publish / "publish-copy.txt").write_text("xin chao\n", encoding="utf-8")

            (source / "package-manifest.json").write_text(
                json.dumps(manifest(revision="1.0.0")),
                encoding="utf-8",
            )
            first_zip = root / "zodiac-bocap-hai-phien-ban.zip"
            with zipfile.ZipFile(first_zip, "w") as handle:
                for path in source.rglob("*"):
                    if path.is_file():
                        handle.write(path, path.relative_to(source).as_posix())

            session = StudioV2Session(root / "workspace")
            session.import_archive(first_zip)
            first_workspace = session.job
            self.assertEqual(first_workspace.name, "scorpio-two-versions")
            self.assertEqual(session.package_revision, "1.0.0")

            (source / "package-manifest.json").write_text(
                json.dumps(manifest(revision="1.0.1")),
                encoding="utf-8",
            )
            second_zip = root / "renamed-patch-v1.zip"
            with zipfile.ZipFile(second_zip, "w") as handle:
                for path in source.rglob("*"):
                    if path.is_file():
                        handle.write(path, path.relative_to(source).as_posix())

            session.import_archive(second_zip)
            self.assertEqual(session.job, first_workspace)
            self.assertEqual(session.package_revision, "1.0.1")
            self.assertEqual(session.archive.name, "renamed-patch-v1.zip")
            self.assertEqual(len(session.pipeline_rows()), 7)

    def test_v2_session_exposes_output_path_inside_stable_workspace(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            session = StudioV2Session(root)
            session._job = root / "v2" / "jobs" / "scorpio-two-versions"
            self.assertEqual(
                session.video_path,
                session._job / "out" / "zodiac-story.mp4",
            )

    def test_structured_error_detail_is_presented_directly(self):
        state = PipelineStateV2(workspace_id="scorpio-two-versions")
        state.mark_failed(
            "PLAN",
            error={
                "ok": False,
                "code": "TIMELINE_TARGET_CONFLICT",
                "stage": "PLAN",
                "message": "E22 cannot fit",
                "scene_id": "S02",
                "event_id": "E22",
                "target": "scorpio",
                "detail": {"required_drift_frames": 12},
            },
        )
        row = next(item for item in v2_pipeline_rows(state) if item["step"] == "PLAN")
        self.assertEqual(row["status"], FAILED)
        self.assertIn("TIMELINE_TARGET_CONFLICT", row["detail"])
        self.assertIn("E22 cannot fit", row["detail"])
        self.assertNotIn("NODE_MISSING", row["detail"])


if __name__ == "__main__":
    unittest.main()

