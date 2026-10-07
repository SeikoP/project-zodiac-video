"""Pure tests for the operator-facing TUI pipeline projection."""

import unittest

from tools.studio.pipeline import (
    ALIGN_TIMING,
    CONCAT_VOICE,
    DONE,
    FAILED,
    IMPORT_PACKAGE,
    MIX_MUSIC,
    PENDING,
    PREFLIGHT,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    RUNNING,
    SKIPPED,
    VALIDATE_RUNTIME,
    VOICE_SCENES,
)
from tools.tui.model import compact_pipeline_rows, status_glyph, status_label


class TuiModelTests(unittest.TestCase):
    def _rows(self, status=PENDING):
        return [
            {"step": step, "status": status, "progress": 0.0, "scenes": {}}
            for step in (
                IMPORT_PACKAGE,
                PREFLIGHT,
                VOICE_SCENES,
                CONCAT_VOICE,
                ALIGN_TIMING,
                VALIDATE_RUNTIME,
                PREPARE_RENDERER,
                RENDER_VIDEO,
                MIX_MUSIC,
            )
        ]

    def test_collapses_internal_dag_to_six_operator_stages(self):
        rows = compact_pipeline_rows(self._rows())
        self.assertEqual(
            [row["label"] for row in rows],
            ["GÓI", "GIỌNG", "TIMING", "STUDIO", "RENDER", "ÂM THANH"],
        )

    def test_failure_dominates_a_group(self):
        rows = self._rows(DONE)
        next(row for row in rows if row["step"] == CONCAT_VOICE)["status"] = FAILED
        compact = compact_pipeline_rows(rows)
        voice = next(row for row in compact if row["label"] == "GIỌNG")
        self.assertEqual(voice["status"], FAILED)
        self.assertEqual(voice["glyph"], "✕")

    def test_running_stage_is_visible(self):
        rows = self._rows(DONE)
        next(row for row in rows if row["step"] == RENDER_VIDEO)["status"] = RUNNING
        compact = compact_pipeline_rows(rows)
        render = next(row for row in compact if row["label"] == "RENDER")
        self.assertEqual(render["status"], RUNNING)
        self.assertEqual(status_glyph(RUNNING), "●")
        self.assertEqual(status_label(RUNNING), "Đang chạy")

    def test_voice_scene_progress_is_preserved(self):
        rows = self._rows(DONE)
        voice = next(row for row in rows if row["step"] == VOICE_SCENES)
        voice["scenes"] = {
            "S01": {"status": DONE},
            "S02": {"status": PENDING},
            "S03": {"status": DONE},
        }
        compact = compact_pipeline_rows(rows)
        voice_group = next(row for row in compact if row["label"] == "GIỌNG")
        self.assertEqual((voice_group["scene_done"], voice_group["scene_total"]), (2, 3))

    def test_skipped_step_counts_as_complete_progress(self):
        rows = self._rows(DONE)
        audio = next(row for row in rows if row["step"] == MIX_MUSIC)
        audio["status"] = SKIPPED
        audio["progress"] = 0.0
        compact = compact_pipeline_rows(rows)
        audio_group = next(row for row in compact if row["label"] == "ÂM THANH")
        self.assertEqual(audio_group["status"], DONE)
        self.assertEqual(audio_group["progress"], 1.0)


if __name__ == "__main__":
    unittest.main()
