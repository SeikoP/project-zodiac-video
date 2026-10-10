from __future__ import annotations

import tomllib
import threading
import tempfile
import time
import unittest
import zipfile
from unittest.mock import Mock, patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class QtLauncherTests(unittest.TestCase):
    def test_zodiac_launcher_uses_qt_and_tk_studio_is_removed(self):
        config = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
        scripts = config["project"]["scripts"]

        self.assertEqual(scripts["zodiac"], "tools.zodiac_qt:main")
        self.assertNotIn("zodiac-qt", scripts)
        self.assertFalse((ROOT / "tools" / "zodiac_gui.py").exists())
        self.assertFalse((ROOT / "tools" / "studio" / "app.py").exists())

    def test_qt_dependencies_are_installed_by_default_on_supported_python(self):
        config = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
        project = config["project"]

        self.assertEqual(project["requires-python"], ">=3.9")
        dependencies = project["dependencies"]
        self.assertTrue(any(item.startswith("PySide6-Essentials>=6.10,<7;") for item in dependencies))
        self.assertTrue(any(item.startswith("PySide6-Addons>=6.10,<7;") for item in dependencies))
        self.assertNotIn("qt", project["optional-dependencies"])

    def test_qt_import_does_not_load_tk_modules(self):
        import subprocess
        import sys

        result = subprocess.run(
            [sys.executable, "-c", "import sys; import tools.zodiac_qt; assert 'tkinter' not in sys.modules"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_qt_app_import_does_not_load_tk_modules(self):
        import subprocess
        import sys

        result = subprocess.run(
            [sys.executable, "-c", "import sys; import tools.studio_qt.app; assert 'tkinter' not in sys.modules"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_obsidian_theme_keeps_focus_and_status_labels_visible(self):
        from tools.studio_qt.theme import stylesheet

        style = stylesheet()

        self.assertIn("#121516", style)
        self.assertIn("#C6A76A", style)
        self.assertIn(":focus", style)
        self.assertIn("stageStatus=", style)


class TaskWorkbenchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from PySide6.QtWidgets import QApplication
        except ImportError:
            raise unittest.SkipTest("PySide6 Essentials is not installed")
        cls.qt_app = QApplication.instance() or QApplication([])

    def tearDown(self):
        from PySide6.QtCore import QCoreApplication, QEvent

        for widget in self.qt_app.topLevelWidgets():
            widget.close()
            widget.deleteLater()
        QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        self.qt_app.processEvents()

    def test_home_screen_offers_import_and_recent_jobs_without_empty_panels(self):
        from tools.studio_qt.screens.home import HomeScreen

        screen = HomeScreen(recent_jobs=[])

        self.assertEqual(screen.import_button.text(), "Chọn ZIP từ máy…")
        self.assertEqual(screen.recent_list.count(), 0)
        self.assertTrue(screen.recent_frame.isHidden())
        self.assertFalse(screen.empty_state.isHidden())
        self.assertFalse(screen.findChild(type(screen.import_button), "pipeline_panel"))
        self.assertFalse(screen.findChild(type(screen.import_button), "settings_panel"))

    def test_recent_job_has_a_visible_open_action(self):
        from tools.studio_qt.screens.home import HomeScreen

        screen = HomeScreen([{"name": "bocap", "state": "Cần tiếp tục", "path": "job-path"}])
        opened = []
        screen.job_requested.connect(opened.append)
        screen.recent_list.setCurrentRow(0)
        self.assertTrue(screen.open_job_button.isEnabled())
        screen.open_job_button.click()
        self.assertEqual(opened, ["job-path"])

    def test_home_shows_recent_job_count(self):
        from tools.studio_qt.screens.home import HomeScreen

        screen = HomeScreen([{"name": "bocap", "state": "Hoàn tất · 7/7 bước", "path": "job-path"}])

        self.assertEqual(screen.job_count.text(), "1 công việc")
        self.assertIn("Hoàn tất", screen.recent_list.item(0).text())
        self.assertFalse(screen.recent_frame.isHidden())
        self.assertTrue(screen.empty_state.isHidden())

    def test_recent_job5_state_comes_from_persisted_pipeline_steps(self):
        from tools.studio_qt.app import ZodiacQtApp

        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp)
            state_file = job / ".runtime" / "studio-v2-state.json"
            state_file.parent.mkdir()
            state_file.write_text(
                '{"steps":{"PACKAGE":{"status":"DONE"},"VOICE":{"status":"DONE"},'
                '"TIMING":{"status":"DONE"},"PLAN":{"status":"DONE"},'
                '"RENDER":{"status":"DONE"},"AUDIO":{"status":"DONE"},'
                '"OUTPUT":{"status":"FAILED"}}}',
                encoding="utf-8",
            )

            self.assertEqual(ZodiacQtApp._job5_recent_state(job), "Cần xử lý · Đầu ra")

    def test_workbench_uses_stage_rail_and_truthful_indeterminate_progress(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen

        screen = WorkbenchScreen()
        screen.set_job("scorpio-job", revision="2.6", mode="job5", rows=[
            {"step": step, "status": "PENDING", "progress": 0.0}
            for step in ("PACKAGE", "VOICE", "TIMING", "PLAN", "RENDER", "AUDIO", "OUTPUT")
        ])
        screen.set_active_stage(
            "RENDER",
            {"status": "RUNNING", "detail": "Đang kết xuất", "progress": 0.5},
            percent=None,
        )

        self.assertEqual(screen.stage_rail.count(), 7)
        self.assertEqual(screen.job_title.text(), "scorpio-job")
        self.assertIn("Đang", screen.progress_text.text())
        self.assertNotIn("50%", screen.progress_text.text())
        self.assertIn("Đang thực hiện", screen.progress_text.text())
        self.assertFalse(screen.home_button.isHidden())

    def test_workbench_shows_only_a_measured_percentage(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen

        screen = WorkbenchScreen()
        screen.set_active_stage("RENDER", {"status": "RUNNING"}, percent=0.25)

        self.assertIn("25%", screen.progress_text.text())

    def test_workbench_summarizes_real_stage_counts_and_output(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen

        with tempfile.TemporaryDirectory() as temp:
            video = Path(temp) / "zodiac-story.mp4"
            video.write_bytes(b"video")
            rows = [
                {"step": step, "status": "DONE"}
                for step in ("PACKAGE", "VOICE", "TIMING", "PLAN", "AUDIO", "OUTPUT")
            ] + [{"step": "RENDER", "status": "FAILED"}]
            screen = WorkbenchScreen()

            screen.set_job("songtu", revision="1.0.1", mode="job5", rows=rows)
            output_row = next(row for row in rows if row["step"] == "OUTPUT")
            screen.set_active_stage("OUTPUT", output_row, percent=None)
            screen.set_output(str(video), temp)

            self.assertIsNotNone(getattr(screen, "pipeline_summary", None))
            self.assertIsNotNone(getattr(screen, "pipeline_detail", None))
            self.assertIsNotNone(getattr(screen, "output_summary", None))
            self.assertEqual(screen.pipeline_summary.text(), "6/7 bước hoàn tất")
            self.assertEqual(screen.pipeline_detail.text(), "1 bước cần xử lý")
            self.assertEqual(screen.status_label.text(), "! Cần xử lý")
            self.assertEqual(screen.output_summary.text(), "Video đầu ra · zodiac-story.mp4")
            self.assertIs(screen.status_label.parentWidget(), screen.pipeline_summary.parentWidget())
            self.assertIs(screen.environment_status.parentWidget(), screen.pipeline_summary.parentWidget())

    def test_workbench_status_indicators_fit_overview_at_minimum_width(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen

        screen = WorkbenchScreen()
        screen.resize(1008, 640)
        screen.show()
        screen.set_job("songtu", revision="1.0.1", mode="job5", rows=[])
        self.qt_app.processEvents()

        for label in (screen.status_label, screen.environment_status):
            self.assertLessEqual(label.geometry().right(), label.parentWidget().width())
            self.assertGreater(label.geometry().height(), 0)

        screen.close()

    def test_workbench_elides_long_job_title_without_losing_full_tooltip(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen

        name = "songtu-" + ("job-name-" * 12)
        screen = WorkbenchScreen()
        screen.resize(1024, 600)
        screen.set_job(name, revision="1.0.1", mode="job5", rows=[])
        screen.layout().activate()
        self.qt_app.processEvents()

        self.assertIn("…", screen.job_title.text())
        self.assertEqual(screen.job_title.toolTip(), name)
        self.assertFalse(hasattr(screen, "settings_button"))
        self.assertGreater(screen.status_label.width(), 0)
        self.assertGreater(screen.environment_status.width(), 0)

    def test_media_preview_can_shrink_in_compact_workbench_window(self):
        from tools.studio_qt.screens.media import MediaWorkspace

        screen = MediaWorkspace()

        self.assertLessEqual(screen.preview_label.minimumHeight(), 200)

    def test_worker_events_are_delivered_on_the_qt_thread(self):
        from PySide6.QtCore import QThread, QObject, Slot
        from tools.studio_qt.events import WorkerEventBridge

        class Receiver(QObject):
            def __init__(self):
                super().__init__()
                self.received_on_gui_thread = False
                self.message = ""

            @Slot(str, dict)
            def receive(self, _kind, payload):
                self.message = payload["text"]
                self.received_on_gui_thread = QThread.currentThread() == self.thread()

        bridge = WorkerEventBridge()
        receiver = Receiver()
        bridge.event_received.connect(receiver.receive)
        worker = threading.Thread(target=lambda: bridge.event_received.emit("LOG_LINE", {"text": "render segment 2/4"}))
        worker.start()
        worker.join()
        self.qt_app.processEvents()

        self.assertEqual(receiver.message, "render segment 2/4")
        self.assertTrue(receiver.received_on_gui_thread)

    def test_settings_volume_uses_zero_to_one_hundred_percent(self):
        from tools.studio_qt.dialogs.settings import SettingsDialog

        dialog = SettingsDialog({"voice": "Hải Đăng", "music": "", "volume": 0.25, "align_model": "small"})
        self.assertEqual(dialog.volume.value(), 25)
        dialog.volume.setValue(0)
        self.assertEqual(dialog.values()["volume"], 0.0)
        dialog.volume.setValue(100)
        self.assertEqual(dialog.values()["volume"], 1.0)

    def test_settings_actions_use_vietnamese_labels(self):
        from PySide6.QtWidgets import QDialogButtonBox
        from tools.studio_qt.dialogs.settings import SettingsDialog

        dialog = SettingsDialog({})
        buttons = dialog.findChild(QDialogButtonBox)

        self.assertEqual(buttons.button(QDialogButtonBox.StandardButton.Save).text(), "Lưu")
        self.assertEqual(buttons.button(QDialogButtonBox.StandardButton.Cancel).text(), "Hủy")

    def test_settings_do_not_open_while_pipeline_is_running(self):
        from tools.studio_qt.app import ZodiacQtApp

        with tempfile.TemporaryDirectory() as workspace:
            window = ZodiacQtApp(workspace=Path(workspace))
            window.pipeline_running = True

            with patch("tools.studio_qt.dialogs.settings.SettingsDialog") as dialog:
                window._open_settings()
                opened = dialog.called

            window.pipeline_running = False
            window.close()
            self.assertFalse(opened)

    def test_qt_window_starts_on_new_workbench_home(self):
        from tools.studio_qt.app import ZodiacQtApp

        with tempfile.TemporaryDirectory() as workspace:
            window = ZodiacQtApp(workspace=Path(workspace))
            self.qt_app.processEvents()
            self.assertIs(window.stack.currentWidget(), window.home)
            self.assertEqual(window.windowTitle(), "Zodiac Studio · Task Workbench")
            self.assertEqual(len(window._shortcuts), 5)
            window.close()

    def test_app_exposes_one_shared_workspace_and_one_media_tab(self):
        from tools.studio_qt.app import ZodiacQtApp

        with tempfile.TemporaryDirectory() as workspace:
            window = ZodiacQtApp(workspace=Path(workspace))
            self.assertEqual(
                [window.main_tabs.tabText(index) for index in range(window.main_tabs.count())],
                ["Công việc / Workspace", "Media"],
            )
            self.assertIs(window.main_tabs.widget(0), window.stack)
            window.close()

    def test_closed_qt_window_releases_multimedia_children(self):
        from PySide6.QtCore import QCoreApplication, QEvent
        from tools.studio_qt.app import ZodiacQtApp

        with tempfile.TemporaryDirectory() as workspace:
            window = ZodiacQtApp(workspace=Path(workspace))
            self.qt_app.processEvents()
            window.close()
            QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
            self.qt_app.processEvents()
            self.assertNotIn(window, self.qt_app.topLevelWidgets())

    def test_output_video_opens_inside_media_workspace(self):
        from tools.studio_qt.app import ZodiacQtApp
        from tools.studio_qt.screens.workbench import WorkbenchScreen

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / ".zodiac-work"
            output = workspace / "v2" / "jobs" / "job-with-output" / "out"
            output.mkdir(parents=True)
            (output.parent / "package-manifest.json").touch()
            video = output / "zodiac-story.mp4"
            video.touch()
            window = ZodiacQtApp(workspace=workspace)
            window.workbench = WorkbenchScreen()
            window.workbench.set_output(str(video), str(output))
            window.media.open_media = Mock()

            window._open_output("video")

            self.assertEqual(window.main_tabs.currentIndex(), 1)
            window.media.open_media.assert_called_once_with(video)
            window.close()

    def test_media_file_classification_excludes_non_media_assets(self):
        from tools.studio_qt.screens.media import media_kind

        self.assertEqual(media_kind(Path("final.mp4")), "video")
        self.assertEqual(media_kind(Path("music.wav")), "audio")
        self.assertEqual(media_kind(Path("cover.png")), "image")
        self.assertIsNone(media_kind(Path("render-plan.json")))

    def test_media_size_label_matches_binary_units(self):
        from tools.studio_qt.screens.media import MediaWorkspace

        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.bin"
            path.write_bytes(b"x" * 1536)
            self.assertEqual(MediaWorkspace._format_size(path), "1.5 KiB")

    def test_media_file_tree_lists_every_file_in_the_job_output_folder(self):
        from PySide6.QtCore import QUrl
        from tools.studio_qt.screens.media import MediaWorkspace

        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp) / "songtu-job"
            root = job / "out"
            (root / "metadata").mkdir(parents=True)
            for name in ("final.mp4", "music.wav", "cover.png", "publish.json", "publish-copy.txt"):
                (root / name).touch()
            (root / "metadata" / "render-plan.json").touch()
            media = MediaWorkspace()
            media.set_jobs([{
                "group": "Job@5",
                "name": job.name,
                "path": str(job),
                "out_path": str(root),
            }])
            names = []
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                self.qt_app.processEvents()
                root_index = media.files.rootIndex()
                names = [
                    media.proxy.data(media.proxy.index(row, 0, root_index))
                    for row in range(media.proxy.rowCount(root_index))
                ]
                if len(names) == 4:
                    break
                time.sleep(0.01)
            self.assertEqual(set(names), {"final.mp4", "music.wav", "cover.png", "metadata"})
            type_by_name = {
                media.proxy.data(media.proxy.index(row, 0, root_index)):
                media.proxy.data(media.proxy.index(row, 2, root_index))
                for row in range(media.proxy.rowCount(root_index))
            }
            self.assertEqual(type_by_name["final.mp4"], "Video")
            self.assertNotIn("publish.json", type_by_name)
            self.assertNotIn("publish-copy.txt", type_by_name)
            nested_source = media.file_model.index(str(root / "metadata"))
            nested = media.proxy.mapFromSource(nested_source)
            media.files.expand(nested)
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                self.qt_app.processEvents()
                nested = media.proxy.mapFromSource(media.file_model.index(str(root / "metadata")))
                if media.proxy.rowCount(nested):
                    break
                time.sleep(0.01)
            self.assertEqual(media.proxy.data(media.proxy.index(0, 0, nested)), "render-plan.json")
            media.player.setSource(QUrl())
            media.close()

    def test_media_groups_jobs_and_keeps_selection_separate_from_active_job(self):
        from tools.studio_qt.screens.media import MediaWorkspace

        with tempfile.TemporaryDirectory() as temp:
            first = Path(temp) / "job-a"
            second = Path(temp) / "job-b"
            first_out = first / "out"
            second_out = second / "out"
            first_out.mkdir(parents=True)
            second_out.mkdir(parents=True)
            media = MediaWorkspace()
            media.set_jobs([
                {"group": "Job@5", "name": first.name, "path": str(first), "out_path": str(first_out)},
                {"group": "Job local", "name": second.name, "path": str(second), "out_path": str(second_out)},
            ], selected_path=first)

            self.assertEqual(media.job_picker.currentText(), first.name)
            self.assertEqual(Path(media.file_model.rootPath()), first_out.resolve())
            media.set_output(None, str(second_out), job_path=second)
            self.assertEqual(Path(media.file_model.rootPath()), first_out.resolve())
            self.assertEqual(media.job_picker.count(), 4)
            external_video = Path(temp) / "outside.mp4"
            external_video.touch()
            media.open_media(external_video)
            self.assertEqual(Path(media.file_model.rootPath()), first_out.resolve())
            self.assertIn("out/", media.status_label.text())
            media.close()

    def test_media_with_no_output_jobs_does_not_expose_filesystem_root(self):
        from tools.studio_qt.screens.media import MediaWorkspace

        media = MediaWorkspace()
        media.set_jobs([])

        self.assertTrue(media.files.isHidden())
        self.assertFalse(media.files.isEnabled())
        self.assertFalse(media.job_picker.isEnabled())
        media.close()

    def test_app_lists_all_jobs_with_out_folders_grouped_by_job_type(self):
        from tools.studio_qt.app import ZodiacQtApp

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            v2 = workspace / "v2" / "jobs"
            local = workspace / "jobs"
            valid_v2 = v2 / "v2-job"
            valid_local = local / "local-job"
            missing_out = local / "no-output"
            for job in (valid_v2, valid_local, missing_out):
                job.mkdir(parents=True)
            (valid_v2 / "package-manifest.json").touch()
            (valid_v2 / "out").mkdir()
            (valid_local / "out").mkdir()

            window = ZodiacQtApp(workspace=workspace)
            jobs = window._media_jobs()

            self.assertEqual([(job["group"], job["name"]) for job in jobs], [
                ("Job@5", "v2-job"),
                ("Job local", "local-job"),
            ])
            self.assertEqual(Path(jobs[0]["out_path"]), (valid_v2 / "out").resolve())
            window.close()

    def test_multimedia_views_exit_cleanly_after_teardown(self):
        import os
        import subprocess
        import sys

        script = (
            "from PySide6.QtWidgets import QApplication; "
            "from tools.studio_qt.screens.media import MediaWorkspace; "
            "from tools.studio_qt.dialogs.settings import SettingsDialog; "
            "app=QApplication([]); "
            "views=[MediaWorkspace() for _ in range(4)]; "
            "dialogs=[SettingsDialog({}) for _ in range(4)]; "
            "del views, dialogs; app.processEvents()"
        )
        env = os.environ.copy()
        env["QT_QPA_PLATFORM"] = "offscreen"
        result = subprocess.run([sys.executable, "-c", script], cwd=ROOT, env=env, capture_output=True, text=True)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_music_audition_uses_embedded_player(self):
        import wave

        from tools.studio_qt.dialogs.settings import SettingsDialog

        with tempfile.TemporaryDirectory() as temp:
            audio = Path(temp) / "music.wav"
            with wave.open(str(audio), "wb") as handle:
                handle.setnchannels(1)
                handle.setsampwidth(2)
                handle.setframerate(8000)
                handle.writeframes(b"\x00\x00" * 800)
            dialog = SettingsDialog({"music": str(audio), "volume": 0.25})
            dialog.audition_button.click()
            self.assertEqual(Path(dialog.player.source().toLocalFile()), audio.resolve())
            self.assertEqual(dialog.audio_output.volume(), 0.25)
            dialog.player.stop()
            from PySide6.QtCore import QUrl

            dialog.player.setSource(QUrl())
            self.qt_app.processEvents()

    def test_job5_import_and_continue_flow_through_qt_workbench(self):
        from tools.studio_qt.app import ZodiacQtApp

        package = ROOT / "tests" / "fixtures" / "scorpio-two-versions" / "package"
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "workspace"
            archive = Path(temp) / "job5.zip"
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as handle:
                for item in package.rglob("*"):
                    if item.is_file():
                        handle.write(item, item.relative_to(package).as_posix())

            window = ZodiacQtApp(workspace=workspace)
            window._check_environment = Mock()
            window._run_operation("import", archive)
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and window.workbench is None:
                self.qt_app.processEvents()
                time.sleep(0.01)

            self.assertIsNotNone(window.workbench)
            self.assertEqual(window.mode, "job5")
            self.assertEqual(window.workbench.job_title.text(), "bocap-hai-phien-ban")
            self.assertEqual(window.workbench.stage_rail.count(), 7)

            window._environment_ready = True
            with patch.object(window.v2_session, "run") as run:
                window.workbench.continue_button.click()
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline and not run.called:
                    self.qt_app.processEvents()
                    time.sleep(0.01)
                self.assertTrue(run.called)
                self.assertIsNone(run.call_args.kwargs["rerun_from"])
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline and window.pipeline_running:
                    self.qt_app.processEvents()
                    time.sleep(0.01)
            self.assertFalse(window.pipeline_running)
            self.assertFalse(window.workbench.cancel_button.isVisible())
            window.close()


if __name__ == "__main__":
    unittest.main()
