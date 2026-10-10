"""Streaming VieNeu feedback and operator controls."""
import importlib.util
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")


class VieNeuFeedbackTests(unittest.TestCase):
    def connector(self):
        self.assertIsNotNone(importlib.util.find_spec("tools.studio.vieneu_client"))
        from tools.studio import vieneu_client
        return vieneu_client

    def test_started_chunk_is_not_counted_as_completed(self):
        connector = self.connector()
        self.assertEqual(connector.chunk_progress("Đang xử lý đoạn 2/4..."), (1, 4))
        self.assertEqual(connector.chunk_progress("Đã xong 2/4 đoạn (ước tính còn lại: 2s)"), (2, 4))
        self.assertIsNone(connector.chunk_progress("lô 2 (3 đoạn, batch size 3)"))
        self.assertIsNone(connector.chunk_progress("Đang xử lý đoạn 5/4"))

    def test_stream_reports_intermediate_status_and_propagates_failure(self):
        connector = self.connector()
        class Job:
            tick = 0
            def status(self):
                return SimpleNamespace(code=SimpleNamespace(name="IN_QUEUE" if self.tick == 0 else "PROCESSING"), rank=2)
            def outputs(self):
                self.tick += 1
                return [(None, "Đang xử lý đoạn 1/2")] + (
                    [("sample.wav", "Hoàn tất")] if self.tick > 1 else [])
            def done(self):
                return self.tick > 1
            def result(self):
                return ("sample.wav", "Hoàn tất")
        client = SimpleNamespace(submit=lambda *a, **k: Job())
        messages = []
        with patch("tools.studio.vieneu_client.time.sleep"):
            result = connector.stream_prediction(client, [], "wrapper", messages.append)
        self.assertEqual(result[0], "sample.wav")
        self.assertEqual(messages.count("Đang xử lý đoạn 1/2"), 1)
        self.assertIn("Hoàn tất", messages)
        self.assertTrue(any("hàng đợi" in m and "2" in m for m in messages))
        with patch.object(Job, "result", side_effect=RuntimeError("server failed")):
            with self.assertRaisesRegex(RuntimeError, "server failed"):
                connector.stream_prediction(client, [], "wrapper", messages.append)


class VieNeuQtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from PySide6.QtWidgets import QApplication
        cls.app = QApplication.instance() or QApplication([])

    def tearDown(self):
        from PySide6.QtCore import QCoreApplication, QEvent
        for widget in self.app.topLevelWidgets():
            widget.close()
            widget.deleteLater()
        QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        self.app.processEvents()

    def test_server_voice_description_never_becomes_stored_voice_id(self):
        from tools.studio_qt.dialogs.settings import SettingsDialog
        dialog = SettingsDialog({"voice": "cuongdepzai"})
        self.assertTrue(hasattr(dialog, "set_server_voices"))
        dialog.set_server_voices({"choices": [["Cường — vui nhộn", "cuongdepzai"], ["Ly — nữ", "Ly"]]})
        self.assertEqual(dialog.voice.currentText(), "Cường — vui nhộn")
        self.assertEqual(dialog.values()["voice"], "cuongdepzai")
        dialog.voice.setCurrentIndex(1)
        self.assertEqual(dialog.values()["voice"], "Ly")
        dialog.set_server_voices({"choices": []})
        self.assertEqual(dialog.values()["voice"], "Ly")
        self.assertIn("giọng", dialog.voice_status.text())
        dialog.vieneu_url = "http://127.0.0.1:7860"
        from pathlib import Path
        dialog.tts_root = Path("vieneu")
        dialog.set_server_voices({"choices": [["Adam — nam", "Adam"]]})
        self.assertEqual(dialog.values()["voice"], "Ly")
        self.assertFalse(dialog.voice_preview.isEnabled())
        dialog.voice.setCurrentIndex(0)
        self.assertTrue(dialog.voice_preview.isEnabled())

    def test_connection_error_preserves_saved_voice_and_explains_failure(self):
        from tools.studio_qt.dialogs.settings import SettingsDialog
        dialog = SettingsDialog({"voice": "cuongdepzai"})
        dialog._voice_operation = "voices"
        dialog._voice_error = "Connection refused"
        dialog._voice_finished(1, None)
        self.assertEqual(dialog.values()["voice"], "cuongdepzai")
        self.assertIn("Connection refused", dialog.voice_status.text())

    def test_finished_voice_playback_restores_button_and_status(self):
        from PySide6.QtMultimedia import QMediaPlayer
        from tools.studio_qt.dialogs.settings import SettingsDialog
        dialog = SettingsDialog({"voice": "cuongdepzai"})
        dialog._voice_operation = "preview"
        dialog._voice_playback_changed(QMediaPlayer.PlaybackState.StoppedState)
        self.assertEqual(dialog.voice_preview.text(), "Nghe thử giọng")
        self.assertIn("kết thúc", dialog.voice_status.text())

    def test_streaming_stdout_reaches_widgets_through_qt_bridge(self):
        import json
        import tempfile
        from pathlib import Path
        from tools.studio_qt.app import ZodiacQtApp
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        with tempfile.TemporaryDirectory() as temp:
            window = ZodiacQtApp(workspace=Path(temp))
            window.workbench = WorkbenchScreen()
            w = window.workbench
            window.stack.addWidget(w)
            window.stack.setCurrentWidget(w)
            window.resize(1024, 680)
            window.show()
            window._running_stage = lambda: "VOICE"
            rows = [{"step": "VOICE", "status": "RUNNING"}]
            w.set_rows(rows)
            w.set_active_stage("VOICE", rows[0])
            event = dict(scene_id="S02", scene_index=2, scene_total=4, completed_scenes=1,
                         message="Đang xử lý đoạn 1/3", chunk_done=0, chunk_total=3)
            window.bridge.log_received.emit("VIENEU_EVENT " + json.dumps(event), "stdout")
            self.app.processEvents()
            self.assertEqual(w.progress_bar.value(), 25)
            self.assertEqual(w.voice_bar.value(), 0)
            self.assertIn("Đang xử lý đoạn 1/3", w.log_view.toPlainText())
            self.assertNotIn("VIENEU_EVENT", w.log_view.toPlainText())
            self.assertTrue(w.active_activity.isHidden())
            self.assertGreaterEqual(w.voice_detail.height(), w.voice_detail.fontMetrics().height() * 2)
            from PySide6.QtCore import QPoint
            output_row = w.stage_rail.row_widgets["OUTPUT"]
            bottom = output_row.mapTo(w.stage_scroll.viewport(), QPoint()).y() + output_row.height()
            self.assertLessEqual(bottom, w.stage_scroll.viewport().height())

    def test_voice_feedback_keeps_view_selection_and_two_progress_levels(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        w = WorkbenchScreen()
        rows = [{"step": "VOICE", "status": "RUNNING"}, {"step": "PLAN", "status": "PENDING"}]
        w.set_rows(rows)
        w.set_active_stage("PLAN", rows[1])
        self.assertTrue(hasattr(w, "set_voice_progress"))
        event = dict(scene_id="S02", scene_index=2, scene_total=4, completed_scenes=1,
                     message="Đang xử lý đoạn 2/3", chunk_done=1, chunk_total=3)
        w.set_voice_progress(event)
        self.assertEqual(w.stage_rail.selected_step, "PLAN")
        w.set_active_stage("VOICE", rows[0])
        self.assertEqual(w.progress_bar.value(), 25)
        self.assertEqual(w.voice_bar.value(), 33)
        self.assertIn("S02", w.voice_detail.text())
        self.assertIn("1/3", w.voice_detail.text())
        self.assertFalse(w.detail_body.isVisibleTo(w))
        w.reset_measured_progress()
        self.assertTrue(w.voice_detail.isHidden())
