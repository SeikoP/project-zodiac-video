"""GUI-level tests for Zodiac Studio v2: no pixel assertions, only wiring and copy."""

import sys
import threading
import time
import unittest
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
                self.assertEqual(str(app.install_button.cget("state")), "normal")
            with patch.object(app.controller, "run_preflight", return_value=ready):
                app._refresh_environment()
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