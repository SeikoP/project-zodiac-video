"""GUI-level tests for Zodiac Studio v2: no pixel assertions, only wiring and copy."""

import sys
import threading
import time
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from test_studio_pipeline import WorkerHarness, write_multi_scene_job
from tools.studio.pipeline import DONE, STEP_ORDER


def _tk_root():
    try:
        import tkinter as tk
    except ImportError:  # pragma: no cover - tkinter is part of the stdlib on CI images
        return None
    try:
        root = tk.Tk()
    except Exception:
        return None
    root.withdraw()
    return root


class StudioAppTests(unittest.TestCase):
    """Runs only where a display exists; skipped headless."""

    @classmethod
    def setUpClass(cls):
        cls.root = _tk_root()
        if cls.root is None:
            raise unittest.SkipTest("no display available")

    @classmethod
    def tearDownClass(cls):
        if cls.root is not None:
            cls.root.destroy()

    def _app(self, workspace: Path):
        from tools.studio.app import ZodiacStudioApp

        with patch("tools.studio.app.WORKSPACE", workspace), patch(
            "tools.studio.app.TTS_ROOT", Path("no-tts")
        ):
            app = ZodiacStudioApp()
        self.addCleanup(app.destroy)
        return app

    def test_app_builds_with_vietnamese_titles(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            labels = _all_text(app)
            for expected in ("DỰ ÁN", "THIẾT LẬP", "QUY TRÌNH", "NHẬT KÝ"):
                self.assertIn(expected, labels)
            for expected in ("Tiếp tục", "Chạy toàn bộ", "Dừng", "Mở Editor", "Kiểm tra"):
                self.assertIn(expected, labels)

    def test_app_has_no_english_operational_strings(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            labels = _all_text(app)
            for forbidden in ("Local voice, preview", "Video package", "All files", "Stop server", "Done", "Failed"):
                self.assertNotIn(forbidden, labels)

    def test_continue_button_follows_plan_resumability(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            self.assertEqual(str(app.continue_button.cget("state")), "disabled")

            job = write_multi_scene_job(Path(temp))
            app.controller.use_job(job)
            app._refresh_buttons()
            self.assertEqual(str(app.continue_button.cget("state")), "normal")

            for step in STEP_ORDER:
                app.controller.plan.mark(step, DONE)
            app._refresh_buttons()
            self.assertEqual(str(app.continue_button.cget("state")), "disabled")

            app.controller.plan.mark("MIX_MUSIC", "PENDING")
            app._refresh_buttons()
            self.assertEqual(str(app.continue_button.cget("state")), "normal")

    def test_job_selector_switches_the_active_job(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "ws"
            jobs_dir = workspace / "jobs"
            jobs_dir.mkdir(parents=True)
            for index, name in enumerate(("zebra", "alpha")):
                write_multi_scene_job(Path(temp) / f"src{index}").rename(jobs_dir / name)
            app = self._app(workspace)
            names = app.project.job_choices()
            self.assertEqual(names, ["alpha", "zebra"])
            app.project.choose_job("zebra")
            app._refresh_buttons()
            self.assertEqual(app.controller.job.name, "zebra")
            self.assertEqual(app.project.job_name.get(), "zebra")

    def test_importing_a_new_zip_makes_it_the_active_job(self):
        import tempfile

        from test_studio_pipeline import write_multi_scene_job

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "ws"
            app = self._app(workspace)
            app.controller.use_job(write_multi_scene_job(Path(temp) / "first"))
            second = write_multi_scene_job(Path(temp) / "second")
            second.rename(second.parent / "second")  # package root name becomes the job name
            archive = self._zip(Path(temp) / "second")
            self.assertTrue(archive.is_file())
            app.project.archive.set(str(archive))
            app.controller.select_archive(archive)
            app._project_changed()
            self.assertEqual(app.controller.job.name, "second")
            self.assertEqual(app.project.job_name.get(), "second")

    def _zip(self, source: Path) -> Path:
        """Zip the job directory itself, so production.json sits at the package root."""
        import zipfile

        job = next(item for item in source.iterdir() if item.is_dir())
        path = source.parent / f"{job.name}-render-ready.zip"
        with zipfile.ZipFile(path, "w") as handle:
            for item in sorted(job.rglob("*")):
                if item.is_file() and ".runtime" not in item.parts:
                    handle.write(item, f"{job.name}/{item.relative_to(job).as_posix()}")
        return path

    def test_startup_stays_blank_when_every_job_is_finished(self):
        import tempfile

        from tools.studio.job_state import JobStateStore
        from tools.studio.pipeline import STEP_ORDER

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "ws"
            job = write_multi_scene_job(Path(temp))
            (workspace / "jobs").mkdir(parents=True)
            done_job = workspace / "jobs" / "done-job"
            job.rename(done_job)
            plan = JobStateStore(done_job).open()
            for step in STEP_ORDER:
                plan.mark(step, "DONE")
            JobStateStore(done_job).save(plan)

            app = self._app(workspace)
            app.update()
            self.assertIsNone(app.controller.job)
            self.assertEqual(app.project.archive.get(), "")

    def test_startup_reopens_a_job_with_unfinished_work(self):
        import tempfile

        from tools.studio.job_state import JobStateStore

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "ws"
            job = write_multi_scene_job(Path(temp))
            (workspace / "jobs").mkdir(parents=True)
            unfinished = workspace / "jobs" / "unfinished"
            job.rename(unfinished)
            JobStateStore(unfinished).save(JobStateStore(unfinished).open())

            app = self._app(workspace)
            app._resume_unfinished_job()
            self.assertEqual(app.controller.job.name, "unfinished")
            self.assertEqual(app.project.archive.get(), "")

    def test_pipeline_progress_is_visible_while_the_worker_runs(self):
        import tempfile

        from tools.studio.job_state import JobStateStore

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            job = write_multi_scene_job(Path(temp))
            app.controller.use_job(job)
            plan = JobStateStore(job).open()
            for scene_id in ("S01", "S02"):
                plan.set_scene_state("VOICE_SCENES", scene_id, "DONE")
            app.controller.plan = plan

            class _Alive:
                def is_alive(self):
                    return True

            app.controller.worker = _Alive()
            app._refresh_buttons()
            detail = app.pipeline.rows["VOICE_SCENES"]["detail"].cget("text")
            self.assertEqual(detail, "2/2 scene xong")

    def test_align_model_is_selectable_in_the_gui(self):
        import tempfile

        from tools.studio.messages_vi import ALIGN_MODEL_CHOICES

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            self.assertEqual(app.audio.align_model.get(), "small")
            app.audio.align_model.set("large-v3")
            self.assertEqual(app.audio.values()["align_model"], "large-v3")
            self.assertIn("medium", ALIGN_MODEL_CHOICES)

    def test_install_button_follows_preflight(self):
        import tempfile

        from tools.studio.preflight import Check

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            ready = [Check(code="FASTER_WHISPER", label="faster-whisper", ok=True)]
            missing = [
                Check(
                    code="FASTER_WHISPER",
                    label="faster-whisper",
                    ok=False,
                    error_code="DEPENDENCY_MISSING",
                    missing=["faster-whisper"],
                )
            ]
            with patch.object(app.controller, "run_preflight", return_value=missing):
                app._refresh_environment()
                deadline = time.time() + 2
                while time.time() < deadline and app._environment_refresh_running:
                    app.update()
                    time.sleep(0.01)
                self.assertEqual(str(app.install_button.cget("state")), "normal")
            with patch.object(app.controller, "run_preflight", return_value=ready):
                app._refresh_environment()
                deadline = time.time() + 2
                while time.time() < deadline and app._environment_refresh_running:
                    app.update()
                    time.sleep(0.01)
                self.assertEqual(str(app.install_button.cget("state")), "disabled")

    def test_worker_events_reach_the_ui_through_the_queue(self):
        import tempfile

        from tools.studio.worker import LOG_LINE, STEP_DONE

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            app._on_worker_event(LOG_LINE, {"text": "dòng nhật ký"})
            app._on_worker_event(STEP_DONE, {"step": "IMPORT_PACKAGE"})
            deadline = time.time() + 5
            while time.time() < deadline and app.log.text.get("end-1c", "end").strip() != "dòng nhật ký":
                app.update()
                time.sleep(0.05)
            self.assertIn("dòng nhật ký", app.log.text.get("1.0", "end"))

    def test_job5_archive_uses_v2_pipeline_and_output(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            package = Path(__file__).parent / "fixtures" / "scorpio-two-versions" / "package"
            archive = Path(temp) / "job5.zip"
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as handle:
                for item in package.rglob("*"):
                    if item.is_file():
                        handle.write(item, item.relative_to(package).as_posix())

            app.project.archive.set(str(archive))
            app.controller.select_archive(archive)
            app._project_changed()
            deadline = time.time() + 10
            while time.time() < deadline and app._v2_importing:
                app.update()
                time.sleep(0.01)
            app.update()

            self.assertEqual(app._pipeline_mode, "v2")
            self.assertEqual(app.project.job_name.get(), "bocap-hai-phien-ban")
            self.assertEqual(app.pipeline.mode, "v2")
            self.assertEqual(app.output.video_path_provider(), app.v2_session.job / "out" / "zodiac-story.mp4")
            self.assertEqual(str(app.studio_button.cget("state")), "disabled")
            app.audio.music.set("")
            app.audio.volume.set(0.73)
            with patch("tools.studio.app.threading.Thread") as worker:
                app._start_v2()
            config = worker.call_args.kwargs["args"][0]
            self.assertEqual(config.voice_profile, app.audio.voice.get())
            self.assertEqual(config.mix_settings, {"volume": 0.73})
            self.assertIsNone(config.music_path)

    def test_refresh_keeps_action_status_for_loaded_legacy_job(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            app.controller.use_job(write_multi_scene_job(Path(temp)))
            app.project.refresh()
            app.status_text.set("Bản nghe thử đã tạo.")
            app._refresh_buttons()
            self.assertEqual(app.status_text.get(), "Bản nghe thử đã tạo.")

    def test_job5_reopens_without_source_zip_and_restores_settings(self):
        import tempfile
        import shutil
        from tools.studio_v2.state import save_state
        from tools.control_plane.package_validation import validate_job5_package_root

        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "ws"
            job = workspace / "v2" / "jobs" / "bocap-hai-phien-ban"
            source = Path(__file__).parent / "fixtures" / "scorpio-two-versions" / "package"
            shutil.copytree(source, job)
            app = self._app(workspace)
            app.v2_session.open_workspace(job)
            app._pipeline_mode = "v2"
            app.v2_session.controller.state.steps["TIMING"].status = "RUNNING"
            save_state(job, app.v2_session.controller.state)
            app.audio.voice.set("saved-voice")
            app.audio.volume.set(0.67)
            app._save_gui_session()
            app.v2_session._job = None
            app.audio.voice.set("different-voice")
            app.audio.volume.set(0.11)
            app._pipeline_mode = "legacy"
            app._resume_unfinished_job()
            deadline = time.time() + 5
            while time.time() < deadline and app._v2_importing:
                app.update()
                time.sleep(0.01)
            self.assertEqual(app._pipeline_mode, "v2")
            self.assertEqual(app.audio.voice.get(), "saved-voice")
            self.assertAlmostEqual(app.audio.volume.get(), 0.67)
            self.assertEqual(app.v2_session.controller.state.steps["TIMING"].status, "PENDING")
            validate_job5_package_root(job, local_workspace=True)
            self.assertIn("Job@5 · bocap-hai-phien-ban", app.project.job_choices())
            app.pipeline._select("AUDIO")
            self.assertEqual(str(app.pipeline.rerun_button.cget("state")), "normal")
            with patch("tools.studio.app.threading.Thread") as worker:
                app._run_all()
            self.assertEqual(worker.call_args.kwargs["args"][1], "VOICE")
            app._v2_running = False

    def test_job5_close_waits_for_safe_stop(self):
        import tempfile
        from tools.control_plane.errors import ControlPlaneError

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            app._pipeline_mode = "v2"
            app.v2_session._job = Path(temp) / "ws" / "v2" / "jobs" / "test-job"
            app.audio.music.set("")
            started = threading.Event()
            finish_step = threading.Event()
            def run(config, **kwargs):
                started.set()
                finish_step.wait(3)
                raise ControlPlaneError(code="PIPELINE_CANCELLED", stage="TIMING",
                                        message="Đã dừng an toàn.")
            with patch.object(app.v2_session, "run", side_effect=run):
                app._continue()
                self.assertTrue(started.wait(2))
                app._close_requested()
                self.assertTrue(app.v2_session.cancel_event.is_set())
                self.assertTrue(app.winfo_exists())
                finish_step.set()
                deadline = time.time() + 5
                while time.time() < deadline and not app._closing:
                    app.update()
                    time.sleep(0.01)
                self.assertTrue(app._closing)

    def test_music_dropdown_selects_library_file_and_can_disable_music(self):
        import tempfile
        from tools.studio.views.audio_panel import NO_MUSIC

        with tempfile.TemporaryDirectory() as temp:
            library = Path(temp) / "assets" / "music"
            library.mkdir(parents=True)
            track = library / "comedy.mp3"
            track.write_bytes(b"track")
            (library / "notes.txt").write_text("not audio")
            with patch("tools.studio.views.audio_panel.MUSIC_DIRECTORIES", (library,)):
                app = self._app(Path(temp) / "ws")
                self.assertIn("comedy.mp3", app.audio.music_picker.cget("values"))
                self.assertNotIn("notes.txt", app.audio.music_picker.cget("values"))
                app.audio.music_selection.set("comedy.mp3")
                app.audio._select_music()
                self.assertEqual(Path(app.audio.values()["music"]), track.resolve())
                app.audio.music_selection.set(NO_MUSIC)
                app.audio._select_music()
                self.assertEqual(app.audio.values()["music"], "")

    def test_music_audition_works_without_job_and_recovers_button(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            track = Path(temp) / "chosen.mp3"
            track.write_bytes(b"track")
            app.audio.music.set(str(track))
            app.audio.volume.set(0.35)
            self.assertIsNone(app._active_job_path())
            with patch("tools.studio.app.threading.Thread") as worker:
                app.audio._listen()
                app.audio._listen()
            self.assertEqual(worker.call_count, 1)
            audition, source, volume = worker.call_args.kwargs["args"]
            self.assertEqual(audition, app.v2_session.workspace_root / ".runtime" / "music-audition")
            self.assertEqual(source, track)
            self.assertEqual(volume, 0.35)
            preview = audition / ".runtime" / "audio-preview.wav"
            app.events.put(("listen_ready", (preview,)))
            with patch.object(app, "_play_preview") as play:
                app._pump()
            play.assert_called_once_with(preview)
            self.assertFalse(app._listen_running)
            self.assertEqual(str(app.audio.listen_button.cget("state")), "normal")

    def test_job5_check_reports_real_failure_and_keeps_status(self):
        import tempfile
        from tools.studio.preflight import Check

        with tempfile.TemporaryDirectory() as temp:
            app = self._app(Path(temp) / "ws")
            app._pipeline_mode = "v2"
            app.v2_session._job = Path(temp) / "ws" / "v2" / "jobs" / "test-job"
            failure = Check("PACKAGE", "Gói Job@5", False, "Narration sai", "Nhập lại gói.")
            with patch("tools.studio.app.Job5PreflightChecker.run", return_value=[failure]), \
                 patch("tools.studio.app.messagebox.showwarning") as warning:
                app._check()
                deadline = time.time() + 5
                while time.time() < deadline and app._environment_refresh_running:
                    app.update()
                    time.sleep(0.01)
                self.assertTrue(warning.called)
                self.assertIn("Nhập lại gói", warning.call_args.args[1])
                app._refresh_buttons()
                self.assertIn("phát hiện lỗi", app.status_text.get())


def _all_text(widget) -> str:
    """Every user-visible string currently in the widget tree."""
    import tkinter as tk
    from tkinter import ttk

    chunks = []

    def walk(node):
        try:
            children = node.winfo_children()
        except Exception:
            children = []
        for child in children:
            for option in ("text", "title"):
                try:
                    value = child.cget(option)
                except Exception:
                    continue
                if isinstance(value, str):
                    chunks.append(value)
            if isinstance(child, (tk.Button, tk.Label, tk.Checkbutton)) or isinstance(child, ttk.Combobox):
                try:
                    chunks.append(str(child.cget("text")))
                except Exception:
                    pass
            walk(child)

    walk(widget)
    return "\n".join(chunks)


class StudioProbeThreadingTests(unittest.TestCase):
    def test_service_poll_does_not_call_network_inline(self):
        import inspect
        from tools.studio.app import ZodiacStudioApp

        source = inspect.getsource(ZodiacStudioApp._poll_service)
        self.assertIn("threading.Thread", source)
        self.assertNotIn("online = self._service_online()", source)

    def test_environment_refresh_runs_preflight_in_worker_thread(self):
        import inspect
        from tools.studio.app import ZodiacStudioApp

        source = inspect.getsource(ZodiacStudioApp._refresh_environment)
        self.assertIn("threading.Thread", source)
        self.assertNotIn("self.controller.run_preflight()", source)


class ControllerThreadingTests(WorkerHarness):
    def test_start_pipeline_returns_immediately(self):
        from tools.studio.controller import StudioController

        controller = StudioController(workspace=self.root / "ws")
        controller.use_job(self.job)
        self.stub_pipeline()

        started = time.time()
        self.assertTrue(controller.start_pipeline())
        elapsed = time.time() - started
        self.assertLess(elapsed, 2.0, "controller must not run the pipeline inline")
        self.assertTrue(controller.worker.is_alive() or controller.worker.is_alive() is False)
        controller.worker.join(timeout=30)

    def test_continue_uses_the_failed_step_after_a_restart(self):
        from tools.studio.controller import StudioController

        self.fail_render = True
        self.make_worker().run_to_completion()

        controller = StudioController(workspace=self.root / "ws")
        controller.use_job(self.job)
        self.assertEqual(controller.plan.status("RENDER_VIDEO"), "FAILED")
        self.assertEqual(controller.continue_from_label(), "Kết xuất video")
        self.assertTrue(controller.can_continue())

        self.stub_pipeline()
        self.fail_render = False
        self.tts_calls.clear()
        controller.start_pipeline()
        controller.worker.join(timeout=30)
        self.assertEqual(controller.plan.status("RENDER_VIDEO"), DONE)
        self.assertEqual(self.tts_calls, [], "resume must not regenerate finished voice work")


if __name__ == "__main__":
    unittest.main()
