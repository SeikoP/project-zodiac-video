import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.studio_v2.pipeline import DONE, FAILED, PENDING, PipelineStateV2
from tools.tui.v2_adapter import (
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


class TuiV2AdapterTests(unittest.TestCase):
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
