"""Regression coverage for the PySide6 operator usability upgrades."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from PySide6.QtWidgets import QApplication
from tools.studio_qt.publish_copy import publish_text_for_job


class WorkbenchUsabilityTests(unittest.TestCase):
    def test_media_position_updates_do_not_seek_and_keyboard_changes_do(self):
        from tools.studio_qt.screens.media import MediaWorkspace
        media = MediaWorkspace()
        with patch.object(media.player, "isSeekable", return_value=True), \
             patch.object(media.player, "position", return_value=0), \
             patch.object(media.player, "setPosition") as seek:
            media._duration_changed(60000)
            media._position_changed(12000)
            self.assertEqual(media.position_slider.value(), 12000)
            seek.assert_not_called()
            media.position_slider.setValue(30000)
            seek.assert_called_once_with(30000)
            self.assertEqual(media.position_label.text(), "00:30 / 01:00")
            media._seekable_changed(False)
            self.assertFalse(media.position_slider.isEnabled())
            media._duration_changed(0)
            seek.assert_called_once_with(30000)

    def test_media_track_click_seeks_to_clicked_position(self):
        from PySide6.QtCore import QPoint, Qt
        from PySide6.QtTest import QTest
        from tools.studio_qt.screens.media import SeekSlider
        slider = SeekSlider(Qt.Orientation.Horizontal)
        slider.setRange(0, 60000)
        slider.resize(400, 30)
        slider.show()
        self.app.processEvents()
        QTest.mouseClick(slider, Qt.MouseButton.LeftButton, pos=QPoint(300, 15))
        self.assertGreater(slider.value(), 40000)
        self.assertLess(slider.value(), 50000)

    def test_reopening_same_media_clears_source_before_loading(self):
        from PySide6.QtCore import QUrl
        from tools.studio_qt.screens.media import MediaWorkspace
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp).resolve()
            out = job / "out"
            out.mkdir()
            audio = out / "voice.wav"
            audio.touch()
            media = MediaWorkspace()
            media.set_jobs([{"group": "Job local", "name": job.name, "path": str(job), "out_path": str(out)}])
            with patch.object(media.player, "setSource") as source:
                media.open_media(audio)
                media.open_media(audio)
                self.assertEqual([call.args[0] for call in source.call_args_list],
                                 [QUrl(), QUrl.fromLocalFile(str(audio))] * 2)

    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def tearDown(self):
        """Flush queued Qt multimedia deletion before QApplication teardown."""
        from PySide6.QtCore import QCoreApplication, QEvent
        for widget in list(self.app.topLevelWidgets()):
            widget.close()
            widget.deleteLater()
        QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        self.app.processEvents()

    def test_ready_dropdown_emits_selected_zip(self):
        from tools.studio_qt.screens.home import HomeScreen
        home = HomeScreen()
        picked = []
        home.ready_import_requested.connect(picked.append)
        self.assertFalse(home.ready_import_button.isEnabled())
        home.set_ready_packages(["/workspace/ready/b.zip", "/workspace/ready/a.zip"])
        home.ready_picker.setCurrentIndex(1)
        home.ready_import_button.click()
        self.assertEqual([Path(p) for p in picked], [Path("/workspace/ready/a.zip")])
        home.set_ready_packages([])
        self.assertFalse(home.ready_import_button.isEnabled())
        home.close()

    def test_home_refresh_preserves_selection_and_busy_blocks_actions(self):
        from tools.studio_qt.screens.home import HomeScreen
        jobs = [{"name": name, "path": name} for name in ("first", "second")]
        home = HomeScreen(jobs)
        home.set_ready_packages(["ready/first.zip"])
        home.recent_list.setCurrentRow(1)
        home.set_recent_jobs(jobs)
        self.assertEqual(home.recent_list.currentItem().data(256), "second")
        self.assertTrue(home.open_job_button.isEnabled())
        home.set_busy(True, "Đang nhập…")
        home.set_ready_packages(["ready/first.zip"])
        self.assertFalse(home.ready_import_button.isEnabled())
        self.assertFalse(home.import_button.isEnabled())
        self.assertFalse(home.open_job_button.isEnabled())
        home.set_busy(False)
        self.assertTrue(home.ready_import_button.isEnabled())
        self.assertTrue(home.open_job_button.isEnabled())

    def test_media_prioritizes_output_and_preserves_file_on_refresh(self):
        from tools.studio_qt.screens.media import MediaWorkspace
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp).resolve()
            out = job / "out"
            out.mkdir()
            (out / "zodiac-story.mp4").touch()
            details = out / "details.txt"
            details.write_text("details", encoding="utf-8")
            jobs = [{"group": "Job@5", "name": job.name, "path": str(job), "out_path": str(out)}]
            media = MediaWorkspace()
            # Avoid decoding a synthetic MP4; exercise the real selection logic.
            with patch.object(media.player, "setSource"):
                media.set_jobs(jobs)
                self.assertEqual(media._selected_path, out / "zodiac-story.mp4")
                media.open_media(details)
                media.set_jobs(jobs)
                self.assertEqual(media._selected_path, details)
                self.assertEqual(media.text_preview.toPlainText(), "details")
            opened = []
            media.workspace_requested.connect(opened.append)
            media.workspace_button.click()
            self.assertEqual(opened, [str(job)])
            media.set_jobs([])
            self.assertFalse(media.workspace_button.isEnabled())
            self.assertFalse(media.video_button.isEnabled())

    def test_primary_action_checks_environment_before_continue(self):
        from tools.studio_qt.app import ZodiacQtApp
        with tempfile.TemporaryDirectory() as temp:
            window = ZodiacQtApp(workspace=Path(temp))
            with patch.object(window, "_legacy_rows", return_value=[{"status": "PENDING"}]), \
                 patch.object(window, "_check_environment") as check, \
                 patch.object(window, "_start") as start:
                window._continue_workflow()
                check.assert_called_once_with(show_result=False)
                start.assert_not_called()
                window._environment_ready = True
                window._continue_workflow()
                start.assert_called_once_with(resume=True)
            video = Path(temp) / "output.mp4"
            video.touch()
            with patch.object(window, "_legacy_rows", return_value=[{"status": "DONE"}]), \
                 patch.object(window, "_active_video", return_value=video), \
                 patch.object(window, "_open_output") as opened, \
                 patch.object(window, "_start") as start:
                window._continue_workflow()
                opened.assert_called_once_with("video")
                start.assert_not_called()

    def test_ready_scanner_is_workspace_scoped_and_ignores_non_zip(self):
        from tools.studio_qt.app import ZodiacQtApp
        with tempfile.TemporaryDirectory() as temp:
            ws = Path(temp)
            ready = ws / "ready"
            ready.mkdir()
            (ready / "a.zip").write_bytes(b"zip-marker")
            (ready / "B.ZIP").write_bytes(b"zip-marker")
            (ready / "ignore.txt").write_text("no")
            with patch("tools.studio_qt.app.ROOT", ws):
                app = ZodiacQtApp(workspace=ws)
                self.assertEqual({Path(p).name for p in app._ready_archives()}, {"a.zip", "B.ZIP"})
                self.assertEqual(app.home.ready_picker.count(), 2)
            app.close()

    def test_repo_ready_folder_is_also_discovered(self):
        from tools.studio_qt.app import ZodiacQtApp
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo_ready = base / "ready"
            repo_ready.mkdir()
            (repo_ready / "repo.zip").write_bytes(b"zip-marker")
            (base / "workspace" / "ready").mkdir(parents=True)
            (base / "workspace" / "ready" / "local.zip").write_bytes(b"zip-marker")
            with patch("tools.studio_qt.app.ROOT", base):
                window = ZodiacQtApp(workspace=base / "workspace")
                self.assertEqual(
                    {Path(x).name for x in window._ready_archives()},
                    {"repo.zip", "local.zip"}
                )
                window.close()

    def test_log_is_visible_inside_overview_and_preserved_per_job(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / ".runtime" / "studio-gui.log"
            workbench = WorkbenchScreen()
            workbench.set_log_file(path)
            self.assertTrue(workbench.log_view.isVisibleTo(workbench) or not workbench.log_view.isHidden())
            workbench.append_activity("[stdout] Một dòng log")
            workbench.append_activity("[stderr] Không bỏ dòng lỗi")
            self.assertIn("Không bỏ dòng lỗi", path.read_text(encoding="utf-8"))
            workbench._copy_log()
            self.assertIn("[stdout] Một dòng log", QApplication.clipboard().text())
            workbench.set_log_file(Path(temp) / "other" / "studio-gui.log")
            self.assertNotIn("Không bỏ dòng", workbench.log_view.toPlainText())
            workbench.close()

    def test_media_previews_text_and_json_instead_of_metadata_only(self):
        from tools.studio_qt.screens.media import MediaWorkspace
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp) / "nhanma"
            out = job / "out"
            out.mkdir(parents=True)
            (out / "publish-copy.txt").write_text("TIKTOK CAPTION: Nội dung mẫu\nHASHTAGS: #NhanMa", encoding="utf-8")
            (out / "trace.json").write_text('{"event":"giơ bản đồ"}', encoding="utf-8")
            media = MediaWorkspace()
            media.set_jobs([{"group": "Job@5", "name": job.name, "path": str(job), "out_path": str(out)}])
            media.open_media(out / "trace.json")
            self.assertIs(media.preview_stack.currentWidget(), media.text_preview)
            self.assertIn("giơ bản đồ", media.text_preview.toPlainText())
            media.open_media(out / "publish-copy.txt")
            self.assertIn("#NhanMa", media.text_preview.toPlainText())
            self.assertTrue(media.copy_publish_button.isEnabled())
            self.assertEqual(media.publish_preview.toPlainText(), "Nội dung mẫu\n\n#NhanMa")
            self.assertNotIn("TIKTOK CAPTION", media.publish_preview.toPlainText())
            media._copy_publish()
            self.assertEqual(QApplication.clipboard().text(), "Nội dung mẫu\n\n#NhanMa")
            media.player.stop()
            media.close()

    def test_structured_runner_native_command_lines_keep_stdout_and_stderr(self):
        import sys
        from tools.studio_v2.runner import run_structured_command, observe_structured_command_output
        received = []
        with observe_structured_command_output(lambda line, channel, stage: received.append((line, channel, stage))):
            result = run_structured_command(
                [sys.executable, "-c", "import sys; print('native start', flush=True); print('native error', file=sys.stderr, flush=True)"],
                stage="RENDER", fallback_code="RENDER_FAILED",
            )
        self.assertEqual(result.returncode, 0)
        self.assertIn(("native start", "stdout", "RENDER"), received)
        self.assertIn(("native error", "stderr", "RENDER"), received)

    def test_console_shows_state_and_severity_filters_without_dropping_disk_log(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        with tempfile.TemporaryDirectory() as temp:
            w = WorkbenchScreen()
            logfile = Path(temp) / "log.txt"
            w.set_log_file(logfile)
            w.append_activity("[RUNNING] Giọng đọc", channel="state", stage="VOICE")
            w.append_activity("ffmpeg: progress 50%", channel="stderr", stage="RENDER")
            w.append_activity("[FAILED] Render · RENDER_FAILED", channel="state", stage="RENDER")
            w.append_activity("[DONE] Gói", channel="state", stage="PACKAGE")
            w.log_filter.setCurrentIndex(w.log_filter.findData("error"))
            self.assertIn("RENDER_FAILED", w.log_view.toPlainText())
            self.assertNotIn("progress 50%", w.log_view.toPlainText())
            self.assertNotIn("Giọng đọc", w.log_view.toPlainText())
            w.log_filter.setCurrentIndex(w.log_filter.findData("stderr"))
            self.assertIn("progress 50%", w.log_view.toPlainText())
            self.assertNotIn("RENDER_FAILED", w.log_view.toPlainText())
            self.assertIn("Giọng đọc", logfile.read_text(encoding="utf-8"))
            w.log_filter.setCurrentIndex(w.log_filter.findData("all"))
            w.stage_log_filter.setCurrentIndex(w.stage_log_filter.findData("VOICE"))
            self.assertIn("Giọng đọc", w.log_view.toPlainText())
            self.assertNotIn("progress 50%", w.log_view.toPlainText())
            w.close()

    def test_unknown_publish_technical_keys_do_not_leak_to_clipboard(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "publish").mkdir()
            (root / "publish" / "publish-copy.txt").write_text(
                "COVER IDENTITY: NHÂN MÃ\nHOOK: Chấm nhỏ ấy có gì?\n",
                encoding="utf-8",
            )
            self.assertEqual(publish_text_for_job(root), "")

    def test_auto_preflight_always_writes_a_final_summary(self):
        from tools.studio.preflight import Check
        from tools.studio_qt.app import ZodiacQtApp
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        with tempfile.TemporaryDirectory() as folder:
            window = ZodiacQtApp(workspace=Path(folder))
            window.workbench = WorkbenchScreen()
            window.workbench.set_log_file(Path(folder) / "studio-gui.log")
            window._preflight_origin = "tự động"
            window._on_preflight_update("start", "RENDERER")
            self.assertIn("RENDERER", window.workbench.environment_status.toolTip())
            window._on_preflight_update("result", Check("RENDERER", "Renderer", True, "CLI sẵn sàng"))
            window._on_operation_finished("preflight", (True, "", False, True))
            self.assertIn("1/1 PASS", window.workbench.log_view.toPlainText())
            self.assertIn("1/1 PASS", window.workbench.environment_status.text())
            self.assertFalse(window.busy)
            window.close()

    def test_manual_preflight_returns_all_failures_and_interrupted_check_is_reported(self):
        from tools.studio.preflight import Check
        from tools.studio_qt.app import ZodiacQtApp
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        with tempfile.TemporaryDirectory() as folder:
            window = ZodiacQtApp(workspace=Path(folder))
            window.workbench = WorkbenchScreen()
            window.workbench.set_log_file(Path(folder) / "studio-gui.log")
            window._preflight_origin = "thủ công"
            window._on_preflight_update("result", Check("NODE", "Node.js", True, "Đã có"))
            window._on_preflight_update("result", Check("VIENEU", "VieNeu", False, "Không kết nối", "Mở cổng 7860"))
            with patch("tools.studio_qt.app.QMessageBox.warning") as warning:
                window._on_operation_finished("preflight", (False, "VieNeu: Không kết nối\nMở cổng 7860", True, True))
            self.assertEqual(warning.call_count, 1)
            self.assertIn("VieNeu", warning.call_args.args[2])
            self.assertIn("1/2 PASS", window.workbench.log_view.toPlainText())
            window._preflight_results = []
            window._on_preflight_update("result", Check("PYTHON", "Python", True, "Có"))
            window._on_operation_finished("preflight", (False, "Renderer timeout", False, False))
            self.assertIn("bị gián đoạn", window.workbench.log_view.toPlainText())
            self.assertIn("Renderer timeout", window.workbench.log_view.toPlainText())
            window.close()

    def test_real_seven_step_progress_is_measured_by_completed_steps(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        from tools.studio_qt.widgets.stage_rail import STAGES
        w = WorkbenchScreen()
        rows = [{"step": step, "status": "DONE", "reused": step == "RENDER"}
                for step, *_ in STAGES[:6]]
        rows.append({"step": "OUTPUT", "status": "RUNNING", "progress": None})
        w.set_rows(rows)
        self.assertEqual(w.pipeline_progress_bar.value(), 86)
        self.assertIn("86%", w.pipeline_progress_label.text())
        self.assertIn("không ước lượng thời gian", w.pipeline_progress_label.text())
        self.assertIn("cache", w.stage_rail.status_labels["RENDER"].text())
        w.set_active_stage("OUTPUT", rows[-1], percent=None)
        self.assertFalse(w.progress_bar.isVisibleTo(w))
        self.assertNotIn("50%", w.progress_text.text())
        self.assertIn("chưa có % đo được", w.progress_text.text())
        w.set_stage_activity("OUTPUT", "SPATIAL_BINDINGS_VALID")
        self.assertIn("SPATIAL_BINDINGS_VALID", w.stage_rail.activity_labels["OUTPUT"].text())
        self.assertIn("SPATIAL_BINDINGS_VALID", w.active_activity.text())
        w.close()

    def test_stage_cards_are_actionable_and_show_true_failure_reason(self):
        from tools.studio_qt.widgets.stage_rail import StageRail
        rail = StageRail()
        selected = []
        rail.stage_selected.connect(selected.append)
        rail.set_rows([
            {"step": "RENDER", "status": "FAILED", "detail": "RENDER_FAILED: segment S04"},
            {"step": "VOICE", "status": "DONE", "reused": True},
        ])
        self.assertIn("Có lỗi", rail.status_labels["RENDER"].text())
        self.assertIn("RENDER_FAILED", rail.activity_labels["RENDER"].toolTip())
        self.assertIn("cache", rail.status_labels["VOICE"].text())
        self.assertIn("Tạo lời đọc", rail.descriptions["VOICE"].text())
        rail.buttons["RENDER"].click()
        self.assertEqual(selected, ["RENDER"])
        self.assertEqual(rail.selected_step, "RENDER")
        rail.close()

    def test_flat_workbench_uses_separators_not_step_cards(self):
        from PySide6.QtWidgets import QFrame, QWidget
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        window = WorkbenchScreen()
        self.assertEqual(window.stage_rail.objectName(), "stageRailFlat")
        self.assertFalse(hasattr(window.stage_rail, "cards"))
        self.assertEqual(len(window.stage_rail.findChildren(QFrame, "stageDivider")), 7)
        self.assertIsNotNone(window.findChild(QFrame, "workspaceVerticalDivider"))
        self.assertGreaterEqual(len(window.findChildren(QFrame, "workspaceDivider")), 2)
        self.assertIsNotNone(window.findChild(QWidget, "workspaceMain"))
        self.assertIsNone(window.findChild(QFrame, "stageCard"))
        window.close()

    def test_tqdm_render_units_display_measured_progress_only_when_present(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        from tools.studio_qt.widgets.stage_rail import STAGES
        window = WorkbenchScreen()
        rows = [{"step": step, "status": "RUNNING" if step == "RENDER" else "PENDING"}
                for step, *_ in STAGES]
        window.set_rows(rows)
        window.set_active_stage("RENDER", rows[4], percent=None)
        self.assertIn("chưa có % đo được", window.progress_text.text())
        self.assertEqual(window.pipeline_progress_bar.value(), 0)
        window.set_measured_progress("RENDER", 2, 5, "phân đoạn", "Render phân đoạn")
        self.assertEqual(window.progress_bar.value(), 40)
        self.assertIn("2/5 phân đoạn", window.progress_text.text())
        self.assertIn("2/5 phân đoạn", window.stage_rail.activity_labels["RENDER"].text())
        window.set_active_stage("RENDER", rows[4], percent=None)
        self.assertIn("2/5 phân đoạn", window.progress_text.text())
        window.set_measured_progress("RENDER", 0, 0, "phân đoạn", "Fallback")
        window.set_active_stage("RENDER", rows[4], percent=None)
        self.assertIn("chưa có % đo được", window.progress_text.text())
        self.assertNotIn("phân đoạn", window.stage_rail.activity_labels["RENDER"].text())
        window.close()

    def test_nested_frames_progress_and_fallback_resets_both_levels(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        from tools.studio_qt.widgets.stage_rail import STAGES
        window = WorkbenchScreen()
        rows = [{"step": step, "status": "RUNNING" if step == "RENDER" else "PENDING"}
                for step, *_ in STAGES]
        window.set_rows(rows)
        window.set_active_stage("RENDER", rows[4], percent=None)
        window.set_measured_progress("RENDER", 2, 5, "phân đoạn", "Render")
        window.set_frame_progress("seg03", 90, 180, "rendering")
        self.assertEqual(window.progress_bar.value(), 40)
        self.assertEqual(window.frame_bar.value(), 50)
        self.assertIn("90/180", window.frame_detail.text())
        window.set_frame_progress("seg03", 180, 180, "encoding")
        self.assertIn("Mã hóa", window.frame_detail.text())
        window.clear_frame_progress()
        self.assertIsNone(window._frame_status)
        window.set_frame_progress("seg04", 12, 90, "rendering")
        self.assertEqual(window.frame_bar.value(), 13)
        window.set_measured_progress("RENDER", 0, 0, "phân đoạn", "Fallback")
        window.set_active_stage("RENDER", rows[4], percent=None)
        self.assertIn("chưa có % đo được", window.progress_text.text())
        self.assertFalse(window.frame_detail.isVisibleTo(window))
        self.assertIsNone(window._frame_status)
        window.close()

    def test_qt_signal_e2e_measured_segment_and_frame_progress(self):
        """WorkerEventBridge signals -> app slots -> visible Workbench widgets."""
        from tools.studio_qt.app import ZodiacQtApp
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        from tools.studio_qt.widgets.stage_rail import STAGES
        with tempfile.TemporaryDirectory() as temp:
            window = ZodiacQtApp(workspace=Path(temp))
            window.workbench = WorkbenchScreen()
            rows = [{"step": step, "status": "RUNNING" if step == "RENDER" else "PENDING"}
                    for step, *_ in STAGES]
            window.workbench.set_rows(rows)
            window.workbench.set_active_stage("RENDER", rows[4], percent=None)
            window.bridge.native_progress.emit("RENDER", 1, 3, "phân đoạn", "Render phân đoạn")
            window.bridge.native_frame_progress.emit("seg01", 6, 12, "rendering")
            self.app.processEvents()
            self.assertEqual(window.workbench.progress_bar.value(), 33)
            self.assertEqual(window.workbench.frame_bar.value(), 50)
            self.assertIn("6/12", window.workbench.frame_detail.text())
            window.bridge.native_frame_progress.emit("seg01", 12, 12, "encoding")
            self.app.processEvents()
            self.assertIn("Mã hóa", window.workbench.frame_detail.text())
            window.bridge.native_progress.emit("RENDER", 2, 3, "phân đoạn", "Render phân đoạn")
            self.app.processEvents()
            self.assertIsNone(window.workbench._frame_status)
            self.assertEqual(window.workbench.progress_bar.value(), 67)
            window.close()

    def test_single_publish_source_preferred_over_legacy_copy(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "out").mkdir()
            (root / "publish").mkdir()
            (root / "out" / "publish.json").write_text(json.dumps({
                "caption": "Bản chính", "hashtags": ["#Bungmoto", "#NhanMa"]
            }), encoding="utf-8")
            (root / "publish" / "publish-copy.txt").write_text("TIKTOK CAPTION: Cũ\nHASHTAGS: #cu", encoding="utf-8")
            self.assertEqual(publish_text_for_job(root), "Bản chính\n\n#Bungmoto #NhanMa")


if __name__ == "__main__":
    unittest.main()
