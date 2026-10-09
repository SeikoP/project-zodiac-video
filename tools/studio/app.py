#!/usr/bin/env python3
"""Zodiac Studio v2: Vietnamese GUI on top of StudioController + PipelineWorker.

Tk is only touched from the main thread; worker events arrive through a queue.
"""

from __future__ import annotations

import os
import json
import gc
import queue
import re
import shutil
import signal
import subprocess
import sys
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import messagebox

from tools.control_plane.errors import ControlPlaneError
from tools.studio.controller import StudioController
from tools.studio.job_state import JobStateStore
from tools.studio.messages_vi import (
    APP_SUBTITLE,
    APP_TITLE,
    BTN_CANCEL,
    BTN_CHECK,
    BTN_CONTINUE,
    BTN_COPY_COMMAND,
    BTN_INSTALL_DEPS,
    BTN_OPEN_EDITOR,
    BTN_RUN_ALL,
    BTN_STUDIO_OPEN,
    BTN_STUDIO_STOP,
    CHECK_ONLY_MESSAGE,
    DEPS_ALREADY_OK_MESSAGE,
    DEPS_INSTALL_FAILED_MESSAGE,
    DEPS_INSTALLED_MESSAGE,
    EDITOR_OPEN_FAILED,
    ENV_BUSY,
    ENV_FAILED,
    ENV_READY,
    FINGERPRINT_CHANGED_MESSAGE,
    FINGERPRINT_CHANGED_TITLE,
    FINGERPRINT_CONFIRM_IMPORT,
    FINGERPRINT_CONFIRM_KEEP,
    NO_JOB_MESSAGE,
    SERVICE_MISSING,
    SERVICE_OFFLINE,
    SERVICE_ONLINE,
    SERVICE_STARTING,
    SERVICE_STOPPING,
    STATUS_FAILED,
    STATUS_IDLE,
    STATUS_RUNNING,
)
from tools.studio.pipeline import RUNNING
from tools.studio.preflight import PreflightChecker, Job5PreflightChecker
from tools.studio_v2.executor import ExecutorConfig
from tools.studio_v2.session import StudioV2Session, detect_job5_manifest
from tools.studio.views.audio_panel import AudioPanel
from tools.studio.views.common import FONT_BOLD, FONT_SMALL, FONT_TITLE, use_theme
from tools.studio.views.log_panel import LogPanel
from tools.studio.views.output_panel import OutputPanel
from tools.studio.views.pipeline_panel import PipelinePanel
from tools.studio.views.project_panel import ProjectPanel
from tools.studio.theme import COLORS
from tools.zodiac_local import build_audio_preview, observe_subprocess_output

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / ".zodiac-work"
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
DEFAULT_ARCHIVE = ROOT / "ready" / "zodiac-sun-gemini-render-ready.zip"
STUDIO_MARK = "●"


class ZodiacStudioApp(tk.Tk):
    def __init__(self) -> None:
        # Finalize closed Tk windows on the UI thread before starting new workers.
        gc.collect()
        super().__init__()
        self.title(f"{APP_TITLE} — {APP_SUBTITLE}")
        self.geometry("1180x860")
        self.minsize(940, 700)
        self.configure(bg=COLORS["bg"])
        use_theme(self)

        self.controller = StudioController(WORKSPACE, tts_root=TTS_ROOT, vieneu_url=TTS_URL)
        self.v2_session = StudioV2Session(WORKSPACE)
        self._pipeline_mode = "legacy"
        self._v2_running = False
        self._v2_importing = False
        self._listen_running = False
        self._preview_playing = False
        self._close_when_stopped = False
        self._report_environment = False
        self._environment_checks = []
        self._closing = False
        self._after_ids: set[str] = set()
        self.events: queue.Queue = queue.Queue()
        self.studio_process: subprocess.Popen | None = None
        self.status_text = tk.StringVar(value=STATUS_IDLE)
        self.service_text = tk.StringVar(value=SERVICE_OFFLINE)
        self.environment_text = tk.StringVar(value=ENV_BUSY)
        self._environment_refresh_running = False
        self._service_probe_running = False

        self.body = tk.Frame(self, bg=COLORS["bg"], padx=20)
        self.project = ProjectPanel(self.body, self.controller, on_changed=self._project_changed,
                                    extra_jobs=self._v2_job_choices, on_select=self._select_job)
        self.audio = AudioPanel(self.body, self.controller, on_listen=self._listen)
        self.pipeline = PipelinePanel(self.body, self.controller, on_rerun=self._rerun_step)
        self.output = OutputPanel(
            self.body,
            self.controller,
            on_open=self._open_path,
            video_path=self._active_video_path,
            job_path=self._active_job_path,
        )
        self.log = LogPanel(self.body)

        self._build(self.project, self.audio)
        self.protocol("WM_DELETE_WINDOW", self._close_requested)

        # Nothing is preselected: the project starts blank, except that a job with
        # unfinished work is reopened so 'Tiếp tục' has something to resume.
        self._schedule(120, self._pump)
        self._schedule(600, self._refresh_environment)
        self._schedule(1200, self._poll_service)
        self._schedule(400, self._resume_unfinished_job)

    def _schedule(self, delay: int, callback) -> None:
        if self._closing:
            return
        callback_id: str | None = None

        def run() -> None:
            self._after_ids.discard(callback_id)
            if not self._closing:
                callback()

        callback_id = self.after(delay, run)
        self._after_ids.add(callback_id)

    def _close_requested(self) -> None:
        if self._v2_running:
            self._close_when_stopped = True
            self._cancel()
            return
        worker = self.controller.worker
        if worker is not None and worker.is_alive():
            self._close_when_stopped = True
            self._cancel()
            return
        if self._v2_importing:
            self.status_text.set("Đợi nhập gói hoàn tất trước khi đóng.")
            return
        self.destroy()

    def destroy(self) -> None:
        if self._closing:
            return
        self._save_gui_session()
        self.v2_session.cancel()
        self._closing = True
        self._stop_preview()
        for callback_id in tuple(self._after_ids):
            try:
                self.after_cancel(callback_id)
            except tk.TclError:
                pass
        self._after_ids.clear()
        super().destroy()

    # ---- layout ------------------------------------------------------
    def _build(self, project, audio) -> None:
        header = tk.Frame(self, bg=COLORS["bg"], padx=20, pady=16)
        header.pack(fill="x")
        tk.Label(header, text=APP_TITLE.upper(), bg=COLORS["bg"], fg=COLORS["fg"], font=FONT_TITLE).pack(side="left")
        tk.Label(header, text=APP_SUBTITLE, bg=COLORS["bg"], fg=COLORS["muted"], font=FONT_SMALL).pack(side="left", padx=(12, 0))

        status_row = tk.Frame(header, bg=COLORS["bg"])
        status_row.pack(side="right")
        self.service_dot = tk.Label(status_row, text=STUDIO_MARK, bg=COLORS["bg"], fg=COLORS["accent"], font=FONT_SMALL)
        self.service_dot.pack(side="left", padx=(0, 6))
        tk.Label(status_row, textvariable=self.service_text, bg=COLORS["bg"], fg=COLORS["muted"], font=FONT_SMALL).pack(side="left")
        self.environment_dot = tk.Label(status_row, text=STUDIO_MARK, bg=COLORS["bg"], fg=COLORS["muted"], font=FONT_SMALL)
        self.environment_dot.pack(side="left", padx=(16, 6))
        tk.Label(status_row, textvariable=self.environment_text, bg=COLORS["bg"], fg=COLORS["muted"], font=FONT_SMALL).pack(side="left")

        body = self.body
        body.pack(fill="both", expand=True)
        body.grid_columnconfigure(0, weight=3)
        body.grid_columnconfigure(1, weight=2)
        body.grid_rowconfigure(0, weight=3)
        body.grid_rowconfigure(1, weight=2)
        project.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 12))
        audio.grid(row=2, column=0, sticky="nsew")
        self.pipeline.grid(row=2, column=1, sticky="nsew", padx=(12, 0))
        body.grid_rowconfigure(2, weight=1)
        self.output.grid(row=3, column=0, sticky="ew", pady=(12, 0))
        self.log.grid(row=4, column=0, columnspan=2, sticky="nsew")

        actions = tk.Frame(self, bg=COLORS["bg"], padx=20, pady=12)
        actions.pack(fill="x")
        self.continue_button = self._button(actions, BTN_CONTINUE, self._continue, primary=True)
        self.continue_button.pack(side="left")
        self.run_button = self._button(actions, BTN_RUN_ALL, self._run_all)
        self.run_button.pack(side="left", padx=(8, 0))
        self.cancel_button = self._button(actions, BTN_CANCEL, self._cancel)
        self.cancel_button.pack(side="left", padx=(8, 0))
        self.editor_button = self._button(actions, BTN_OPEN_EDITOR, self._open_editor)
        self.editor_button.pack(side="left", padx=(8, 0))
        self._button(actions, BTN_CHECK, self._check).pack(side="left", padx=(8, 0))
        self.studio_button = self._button(actions, BTN_STUDIO_OPEN, self._toggle_studio)
        self.studio_button.pack(side="left", padx=(8, 0))
        self.install_button = self._button(actions, BTN_INSTALL_DEPS, self._install_dependencies)
        self.install_button.pack(side="right")

        footer = tk.Frame(self, bg=COLORS["panel"], padx=20, pady=8)
        footer.pack(fill="x", side="bottom")
        tk.Label(footer, textvariable=self.status_text, bg=COLORS["panel"], fg=COLORS["muted"],
                 font=FONT_SMALL, anchor="w").pack(fill="x")
        self._refresh_buttons()

    def _button(self, parent, text: str, command, *, primary: bool = False) -> tk.Button:
        from tools.studio.views.common import Button

        return Button(parent, text, command, primary=primary)

    # ---- project -----------------------------------------------------
    def _v2_job_choices(self) -> list[str]:
        jobs = self.v2_session.workspace_root / "v2" / "jobs"
        return [f"Job@5 · {path.name}" for path in sorted(jobs.glob("*"))
                if path.is_dir() and (path / "package-manifest.json").is_file()]

    def _select_job(self, name: str) -> None:
        worker = self.controller.worker
        if self._v2_running or self._v2_importing or (worker is not None and worker.is_alive()):
            self.status_text.set("Đợi quy trình hiện tại dừng trước khi đổi job.")
            self.project.refresh()
            return
        self._save_gui_session()
        if name.startswith("Job@5 · "):
            if name not in self._v2_job_choices():
                return
            path = self.v2_session.workspace_root / "v2" / "jobs" / name[len("Job@5 · "):]
            self._v2_importing = True
            threading.Thread(target=self._load_v2_workspace, args=(path,), daemon=True).start()
            return
        if name not in self.controller.available_jobs():
            return
        self.controller.use_job(self.controller.job_path(name))
        self._pipeline_mode = "legacy"
        self.studio_button.configure(state="normal")
        self.project.archive.set("")
        self.controller.select_archive(None)
        self.project.set_external_job(None)
        self._restore_job_settings()
        self._save_gui_session()
        self._refresh_environment()
        self.status_text.set(f"Đã mở job: {name}")

    def _load_v2_workspace(self, path: Path) -> None:
        try:
            self.v2_session.open_workspace(path)
        except Exception as exc:
            self.events.put(("v2_import_error", (path, exc)))
        else:
            self.events.put(("v2_imported", (path,)))

    def _save_gui_session(self) -> None:
        job = self._active_job_path()
        if job is None:
            return
        try:
            settings = self.audio.values()
            path = job / ".runtime" / "gui-settings.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            temp = path.with_suffix(".json.tmp")
            temp.write_text(json.dumps(settings, ensure_ascii=False) + "\n", encoding="utf-8")
            os.replace(temp, path)
            path = self.v2_session.workspace_root / "gui-session.json"
            payload = {"mode": self._pipeline_mode,
                       "job": job.resolve().relative_to(self.v2_session.workspace_root).as_posix()}
            temp = path.with_suffix(".json.tmp")
            temp.write_text(json.dumps(payload) + "\n", encoding="utf-8")
            os.replace(temp, path)
        except (OSError, ValueError, tk.TclError) as exc:
            self.log.append(f"Không lưu được phiên GUI: {exc}")

    def _restore_job_settings(self) -> None:
        job = self._active_job_path()
        if job is None:
            return
        try:
            settings = json.loads((job / ".runtime" / "gui-settings.json").read_text(encoding="utf-8"))
            if not isinstance(settings, dict):
                return
            for name in ("voice", "music", "align_model"):
                if isinstance(settings.get(name), str):
                    getattr(self.audio, name).set(settings[name])
            volume = settings.get("volume")
            if isinstance(volume, (int, float)) and 0 <= volume <= 1:
                self.audio.volume.set(volume)
                self.audio.volume_label.configure(text=f"{volume:.0%}")
            self.audio.refresh()
        except (OSError, UnicodeDecodeError, ValueError) as exc:
            if not isinstance(exc, FileNotFoundError):
                self.log.append(f"Không đọc được thiết lập đã lưu: {exc}")

    def _project_changed(self) -> None:
        legacy_worker = self.controller.worker
        if self._v2_running or self._v2_importing or (
            legacy_worker is not None and legacy_worker.is_alive()
        ):
            messagebox.showwarning(
                "Quy trình đang chạy",
                "Đợi quy trình hiện tại hoàn tất trước khi đổi package.",
                parent=self,
            )
            self.project.archive.set("")
            self.controller.select_archive(None)
            self.project.refresh()
            return
        self._save_gui_session()
        archive_text = self.project.archive.get().strip()
        if archive_text:
            archive = Path(archive_text).expanduser()
            try:
                if detect_job5_manifest(archive) is not None:
                    self.controller.select_archive(None)
                    self._v2_importing = True
                    self.status_text.set("Đang nhập và kiểm tra Job@5…")
                    threading.Thread(target=self._import_v2_archive, args=(archive,), daemon=True).start()
                    return
            except Exception as exc:
                self.log.append(str(exc))
                messagebox.showerror("Không nhập được gói video", str(exc), parent=self)
                self.project.archive.set("")
                self.controller.select_archive(None)
                self.project.refresh()
                return

        was_v2 = self._pipeline_mode == "v2"
        self._pipeline_mode = "legacy"
        self.project.set_external_job(None)
        if was_v2:
            self.studio_button.configure(state="normal")
            self._refresh_environment()
        if archive_text:
            self.controller.select_archive(Path(archive_text).expanduser())
        try:
            imported = self.controller.sync_package()
        except Exception as exc:
            self.log.append(str(exc))
            messagebox.showerror("Không nhập được gói video", str(exc), parent=self)
            self.project.archive.set("")
            self.controller.select_archive(None)
            return
        if imported:
            self.project.refresh()
            self._refresh_buttons()
            self.status_text.set(f"Đã nhập gói video: {self.controller.job.name}")
            return
        if self.controller.package_changed:
            self._ask_package_conflict()
        else:
            self._refresh_buttons()

    def _import_v2_archive(self, archive: Path) -> None:
        try:
            self.v2_session.import_archive(archive)
        except Exception as exc:
            self.events.put(("v2_import_error", (archive, exc)))
        else:
            self.events.put(("v2_imported", (archive,)))

    def _active_job_path(self) -> Path | None:
        return self.v2_session.job if self._pipeline_mode == "v2" else self.controller.job

    def _active_video_path(self) -> Path | None:
        return self.v2_session.video_path if self._pipeline_mode == "v2" else self.controller.video_path

    def _ask_package_conflict(self) -> None:
        from tkinter import simpledialog

        choice = self._conflict_dialog()
        if choice is None:
            return
        self.controller.accept_package_conflict(choice)
        self.project.refresh()
        self._refresh_buttons()

    def _conflict_dialog(self) -> str | None:
        dialog = tk.Toplevel(self)
        dialog.title(FINGERPRINT_CHANGED_TITLE)
        dialog.configure(bg=COLORS["panel"])
        dialog.transient(self)
        dialog.resizable(False, False)
        result: dict = {"choice": None}
        tk.Label(dialog, text=FINGERPRINT_CHANGED_MESSAGE, bg=COLORS["panel"], fg=COLORS["fg"],
                 font=FONT_SMALL, justify="left", padx=20, pady=16).pack(anchor="w")
        row = tk.Frame(dialog, bg=COLORS["panel"], padx=20, pady=16)
        row.pack(fill="x")

        from tools.studio.views.common import Button

        def choose(choice: str) -> None:
            result["choice"] = choice
            dialog.destroy()

        Button(row, FINGERPRINT_CONFIRM_IMPORT, lambda: choose("import"), primary=True).pack(side="left")
        Button(row, FINGERPRINT_CONFIRM_KEEP, lambda: choose("keep")).pack(side="left", padx=(8, 0))
        dialog.bind("<Escape>", lambda _event: dialog.destroy())
        self.wait_window(dialog)
        return result["choice"]

    def _resume_unfinished_job(self) -> None:
        """Reopen the last session, or discover unfinished work when none was saved."""
        if self.controller.job is not None or self.v2_session.job is not None or self._v2_importing:
            return
        try:
            saved = json.loads((self.v2_session.workspace_root / "gui-session.json").read_text(encoding="utf-8"))
            if isinstance(saved, dict) and isinstance(saved.get("job"), str):
                path = (self.v2_session.workspace_root / saved["job"]).resolve()
                if saved.get("mode") == "v2" and path.parent == self.v2_session.workspace_root / "v2" / "jobs":
                    choice = f"Job@5 · {path.name}"
                elif path.parent == self.controller.jobs_dir.resolve():
                    choice = path.name
                else:
                    choice = ""
                if choice in self.controller.available_jobs() + self._v2_job_choices():
                    self._select_job(choice)
                    return
        except (OSError, ValueError):
            pass
        for choice in reversed(self._v2_job_choices()):
            from tools.studio_v2.state import load_state
            path = self.v2_session.workspace_root / "v2" / "jobs" / choice[len("Job@5 · "):]
            state = load_state(path)
            if state is not None and state.steps["OUTPUT"].status != "DONE":
                self._select_job(choice)
                return
        for path in sorted(item for item in self.controller.jobs_dir.glob("*") if item.is_dir()):
            plan = JobStateStore(path).open()
            if plan.can_resume and not plan.finished:
                self.controller.use_job(path)
                self.status_text.set(f"Tiếp tục công việc dang dở: {path.name}")
                break
        self.project.refresh()
        self._restore_job_settings()
        self._save_gui_session()
        self._refresh_buttons()

    # ---- pipeline ----------------------------------------------------
    def _start(self, *, resume: bool, rerun: str | None = None) -> None:
        if self._pipeline_mode == "v2":
            self._start_v2(resume=resume, rerun=rerun)
            return
        if self.controller.job is None:
            self.status_text.set(NO_JOB_MESSAGE)
            return
        if self.controller.package_changed:
            self._ask_package_conflict()
            return
        settings = self.audio.values()
        music = Path(settings["music"]).expanduser() if settings["music"].strip() else None
        if music is not None and not music.is_file():
            self.status_text.set("Chưa thấy file nhạc nền đã chọn.")
            return

        started = self.controller.start_pipeline(
            resume=resume,
            rerun=rerun,
            voice=settings["voice"],
            music=music,
            volume=settings["volume"],
            align_model=settings.get("align_model"),
        )
        if started and self.controller.worker is not None:
            # the controller already started the worker thread; forward its events
            self.controller.worker.on_event = self._on_worker_event
            self.status_text.set("Đang chạy quy trình…")
        self._refresh_buttons()

    def _start_v2(self, *, resume: bool = True, rerun: str | None = None) -> None:
        if self.v2_session.job is None:
            self.status_text.set(NO_JOB_MESSAGE)
            return
        if self._v2_running or self._v2_importing:
            return
        settings = self.audio.values()
        music = Path(settings["music"]).expanduser() if settings["music"].strip() else None
        if music is not None and not music.is_file():
            self.status_text.set("Chưa thấy file nhạc nền đã chọn.")
            return
        try:
            volume = max(0.0, min(1.0, float(settings["volume"])))
        except (TypeError, ValueError):
            self.status_text.set("Âm lượng không hợp lệ.")
            return
        config = ExecutorConfig(
            voice_profile=settings["voice"],
            tts_settings={
                "mode": "v3turbo",
                "vieneu_url": TTS_URL,
                "tts_root": TTS_ROOT,
                "scene_gap_ms": 0.0,
            },
            tts_engine_version="vieneu-v3turbo@local-v1",
            aligner_settings={
                "model": settings["align_model"],
                "device": "cpu",
                "compute_type": "int8",
                "scene_gap_ms": 0.0,
                "sentence_pause_ms": 0.0,
            },
            aligner_version="faster-whisper@local-v1",
            renderer_version="2.0.0",
            renderer_hash="zodiac-renderer@2.0.0",
            music_path=music,
            mix_settings={"volume": volume},
        )
        self._save_gui_session()
        self.v2_session.cancel_event.clear()
        self._v2_running = True
        self.status_text.set("Đang chạy Job@5…")
        self.log.append(f"Bắt đầu Job@5: {self.v2_session.job_name}")
        self._refresh_buttons()
        threading.Thread(target=self._run_v2, args=(config, rerun or (None if resume else "VOICE")), daemon=True).start()

    def _run_v2(self, config: ExecutorConfig, rerun_from: str | None = None) -> None:
        def emit_line(line: str, channel: str = "stdout") -> None:
            self.events.put(("v2_log", (line, channel)))

        try:
            with observe_subprocess_output(emit_line):
                self.v2_session.run(config, rerun_from=rerun_from)
        except Exception as exc:
            self.events.put(("v2_error", (exc,)))
        else:
            self.events.put(("v2_done", ()))

    def _continue(self) -> None:
        self._start(resume=True)

    def _run_all(self) -> None:
        self._start(resume=False)

    def _rerun_step(self, step: str) -> None:
        self._start(resume=True, rerun=step)

    def _cancel(self) -> None:
        if self._v2_running:
            self.v2_session.cancel()
            self.status_text.set("Đang chờ bước hiện tại hoàn tất để dừng an toàn…")
            return
        if self.controller.worker is not None:
            self.controller.cancel()
            self.status_text.set("Đang dừng…")
            return
        if self.studio_process is not None and self.studio_process.poll() is None:
            _terminate_tree(self.studio_process)
            self.studio_button.configure(text=BTN_STUDIO_OPEN)
            self.status_text.set("Đã dừng Remotion Studio.")

    def _check(self) -> None:
        if self._pipeline_mode == "v2":
            if self.v2_session.job is None:
                self.status_text.set(NO_JOB_MESSAGE)
                return
            self._report_environment = True
            self.status_text.set("Đang kiểm tra gói và môi trường Job@5…")
            self._refresh_environment()
            return
        self.status_text.set(CHECK_ONLY_MESSAGE)
        failures = [check for check in self.controller.check_only() if not check.ok]
        self._refresh_environment()
        if failures:
            messagebox.showerror(
                "Kiểm tra không đạt",
                "\n".join(f"• {check.label}: {check.message}" for check in failures),
                parent=self,
            )

    def _install_dependencies(self) -> None:
        if self._pipeline_mode == "v2":
            missing = "\n".join(check.message for check in self._environment_checks
                                if check.error_code == "DEPENDENCY_MISSING")
        else:
            missing = self.controller.dependencies_missing()
        if not missing:
            self.status_text.set(DEPS_ALREADY_OK_MESSAGE)
            return
        checker = PreflightChecker(self._active_job_path(), tts_root=TTS_ROOT, vieneu_url=TTS_URL)
        answer = messagebox.askyesno(
            "Môi trường chưa sẵn sàng",
            f"Thiếu:\n{missing}\n\nChạy lệnh này?\n{checker.install_command_text()}",
            parent=self,
        )
        if not answer:
            return

        def install() -> None:
            result = subprocess.run(
                checker.install_command(),
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=False,
            )
            self.events.put(("install", (result.returncode, result.stdout[-2000:], result.stderr[-2000:])))

        threading.Thread(target=install, daemon=True).start()
        self.status_text.set("Đang cài dependency…")

    def _toggle_studio(self) -> None:
        if self._pipeline_mode == "v2":
            self.status_text.set("Remotion Studio riêng hiện chưa hỗ trợ Job@5.")
            return
        if self.studio_process is not None and self.studio_process.poll() is None:
            self._cancel()
            return
        if self.controller.job is None:
            self.status_text.set(NO_JOB_MESSAGE)
            return
        from tools.studio.worker import PipelineWorker

        self.status_text.set("Đang mở Remotion Studio…")
        pipeline_worker = PipelineWorker(self.controller.job, tts_root=TTS_ROOT)
        pipeline_worker.attach_process
        process = subprocess.Popen(
            [sys.executable, "tools/zodiac_local.py", "preview", self.controller.job.name,
             "--workspace", str(WORKSPACE)],
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
        )
        self.studio_process = process
        self.studio_button.configure(text=BTN_STUDIO_STOP)
        threading.Thread(target=self._watch_studio, daemon=True).start()

    def _watch_studio(self) -> None:
        for line in self.studio_process.stdout or ():
            if line.strip():
                self.events.put(("log", (line.rstrip(),)))
        self.events.put(("studio_done", ()))

    def _open_editor(self) -> None:
        if self._pipeline_mode == "v2":
            self.status_text.set("Editor hiện chưa hỗ trợ Job@5.")
            return
        from tools.editor.workspace import open_editor

        try:
            open_editor(self, self.controller.job)
        except Exception as exc:
            messagebox.showerror(EDITOR_OPEN_FAILED, str(exc), parent=self)

    def _open_path(self, path: Path) -> None:
        path = Path(path)
        if not path.exists():
            return
        if sys.platform == "win32":
            os.startfile(str(path))
            return
        launcher = shutil.which("open" if sys.platform == "darwin" else "xdg-open")
        if launcher:
            subprocess.Popen([launcher, str(path)], stdout=subprocess.DEVNULL, shell=False)

    def _stop_preview(self) -> None:
        if self._preview_playing and os.name == "nt":
            import winsound
            winsound.PlaySound(None, 0)
        self._preview_playing = False

    def _play_preview(self, path: Path) -> None:
        if os.name == "nt":
            try:
                import winsound

                winsound.PlaySound(
                    str(Path(path).resolve()),
                    winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT,
                )
                self.status_text.set("Đang phát bản nghe thử.")
                self._preview_playing = True
                return
            except Exception as exc:
                self.log.append(f"Phát trực tiếp thất bại: {exc}")
        self._open_path(path)

    def _listen(self, volume: float) -> None:
        if self._listen_running:
            return
        music = self.audio.values()["music"].strip()
        if not music:
            self.status_text.set("Chọn nhạc nền trước khi nghe thử.")
            return
        source = Path(music).expanduser()
        if not source.is_file():
            self.status_text.set("Không tìm thấy file nhạc; chọn lại nhạc nền.")
            return
        self._stop_preview()
        self._listen_running = True
        self.audio.listen_button.configure(state="disabled", text="Đang chuẩn bị…")
        self.status_text.set("Đang tạo bản nghe thử…")
        audition = self.v2_session.workspace_root / ".runtime" / "music-audition"
        threading.Thread(target=self._run_music_listen,
                         args=(audition, source, volume), daemon=True).start()

    def _run_music_listen(self, job: Path, music: Path, volume: float) -> None:
        try:
            with observe_subprocess_output(
                lambda line, channel="stdout": self.events.put(("log", (line,)))
            ):
                preview = build_audio_preview(job, music, volume=volume)
        except Exception as exc:
            self.events.put(("listen_error", (exc,)))
        else:
            self.events.put(("listen_ready", (preview,)))

    # ---- events from worker threads ---------------------------------
    def _on_worker_event(self, kind: str, payload: dict) -> None:
        self.events.put(("worker", (kind, payload)))

    def _pump(self) -> None:
        while True:
            try:
                channel, payload = self.events.get_nowait()
            except queue.Empty:
                break
            if channel == "worker":
                self._handle_worker(payload[0], payload[1])
            elif channel == "log":
                self.log.append(payload[0])
            elif channel == "v2_log":
                self._handle_v2_log(*payload)
            elif channel == "v2_imported":
                self._v2_importing = False
                self._pipeline_mode = "v2"
                self.project.set_external_job(self.v2_session.job_name)
                self._restore_job_settings()
                self._save_gui_session()
                self.pipeline.show_v2(self.v2_session.pipeline_rows())
                self._refresh_environment()
                self.status_text.set(self.v2_session.status_text)
                self.log.append(f"Đã nạp Job@5: {self.v2_session.job_name}")
            elif channel == "v2_import_error":
                archive, error = payload
                self._v2_importing = False
                self.log.append(str(error))
                # Import failure does not replace the active job; make that
                # explicit instead of leaving green results from the old job
                # next to a failed new-archive selection.
                previous = self._active_job_path()
                previous_label = previous.name if previous is not None else "không có"
                self.status_text.set(
                    f"Không nhập được Job@5. Job hiện tại vẫn là: {previous_label}."
                )
                if self.project.archive.get().strip() == str(archive):
                    self.project.archive.set("")
                    self.controller.select_archive(None)
                self.project.refresh()
                self._refresh_buttons()
                messagebox.showerror(
                    "Không nhập được gói Job@5",
                    f"{error}\\n\\nJob hiện tại không thay đổi: {previous_label}.",
                    parent=self,
                )
            elif channel == "v2_done":
                self._v2_running = False
                self.status_text.set(self.v2_session.status_text)
                self.log.append("Job@5 hoàn tất.")
                self._save_gui_session()
            elif channel == "v2_error":
                self._v2_running = False
                self._handle_v2_error(payload[0])
            elif channel == "listen_ready":
                self._listen_running = False
                self.audio.listen_button.configure(state="normal", text="Nghe thử")
                self.status_text.set("Đã tạo bản nghe thử.")
                self._play_preview(payload[0])
            elif channel == "listen_error":
                self._listen_running = False
                self.audio.listen_button.configure(state="normal", text="Nghe thử")
                self.status_text.set("Không tạo được bản nghe thử.")
                self.log.append(str(payload[0]))
                messagebox.showerror("Nghe thử không thành công", str(payload[0]), parent=self)
            elif channel == "install":
                self._handle_install(*payload)
            elif channel == "environment":
                self._environment_refresh_running = False
                if payload[1] == (self._pipeline_mode, str(self._active_job_path())):
                    self._apply_environment(payload[0])
                else:
                    self._refresh_environment()
            elif channel == "environment_error":
                self._environment_refresh_running = False
                self.environment_text.set(ENV_FAILED)
                self.environment_dot.configure(fg=COLORS["danger"])
                self.log.append(payload[0])
            elif channel == "service":
                self._service_probe_running = False
                online = bool(payload[0])
                self.service_text.set(SERVICE_ONLINE if online else SERVICE_OFFLINE)
                self.service_dot.configure(fg=COLORS["sage"] if online else COLORS["accent"])
            elif channel == "studio_done":
                self.studio_button.configure(text=BTN_STUDIO_OPEN)
                self.studio_process = None
        worker = self.controller.worker
        if self._close_when_stopped and not self._v2_running and not (
            worker is not None and worker.is_alive()
        ):
            self.destroy()
            return
        self._refresh_buttons()
        self._schedule(120, self._pump)

    def _handle_v2_log(self, line: str, channel: str = "stdout") -> None:
        line = str(line).rstrip()
        if not line:
            return
        stamped = f"{datetime.now():%H:%M:%S} [{channel}] {line}"
        self.log.append(stamped)
        job = self.v2_session.job
        if job is not None:
            try:
                log_dir = job / ".runtime" / "logs"
                log_dir.mkdir(parents=True, exist_ok=True)
                with (log_dir / "gui-live.log").open("a", encoding="utf-8") as stream:
                    stream.write(stamped + "\n")
            except OSError:
                pass

    def _handle_v2_error(self, error: Exception) -> None:
        if isinstance(error, ControlPlaneError) and error.code == "PIPELINE_CANCELLED":
            self.status_text.set(error.message)
            self.log.append(error.message)
            self._save_gui_session()
            return
        if isinstance(error, ControlPlaneError):
            title = f"Job@5 · {error.stage} [{error.code}]"
            body = error.message
            details = str(error.detail or "").strip()
        else:
            title = "Job@5 không hoàn tất"
            body = str(error)
            details = ""
        self.status_text.set(self.v2_session.status_text)
        self.log.append(f"{title}: {body}")
        if details:
            self.log.append(details)
        messagebox.showerror(title, body + (f"\n\nChi tiết: {details}" if details else ""), parent=self)

    def _handle_worker(self, kind: str, payload: dict) -> None:
        from tools.studio.worker import (
            LOG_LINE,
            PIPELINE_CANCELLED,
            PIPELINE_DONE,
            STEP_FAILED,
            STEP_PROGRESS,
            STEP_STARTED,
        )

        if kind == LOG_LINE:
            self.log.append(payload["text"])
        elif kind in (STEP_STARTED, STEP_PROGRESS):
            self.status_text.set(STATUS_RUNNING)
            self.pipeline.refresh()
        elif kind == STEP_FAILED:
            self.pipeline.refresh()
            step = payload.get("step", "")
            title = self.controller.error_title(step)
            body = payload.get("message") or "Bước này thất bại."
            details = payload.get("details") or ""
            self.status_text.set(f"{title}: {body}")
            self.log.append(f"[{payload.get('error_code')}] {details}")
            messagebox.showerror(title, body + (f"\n\nChi tiết: {details}" if details else ""), parent=self)
        elif kind in (PIPELINE_DONE, PIPELINE_CANCELLED):
            self.pipeline.refresh()
            self.status_text.set(
                "Đã dừng. Có thể tiếp tục từ bước còn dang dở."
                if kind == PIPELINE_CANCELLED
                else "Đã hoàn tất toàn bộ quy trình."
            )
        self._refresh_buttons()

    def _handle_install(self, code: int, out: str, err: str) -> None:
        if code:
            self.status_text.set(DEPS_INSTALL_FAILED_MESSAGE)
            self.log.append(err.strip() or out.strip())
            messagebox.showerror(
                "Cài dependency thất bại",
                "Không cài được dependency còn thiếu.\nChi tiết kỹ thuật nằm trong NHẬT KÝ.",
                parent=self,
            )
        else:
            self.status_text.set(DEPS_INSTALLED_MESSAGE)
            self.log.append(out.strip())
        self._refresh_environment()

    # ---- header state -------------------------------------------------
    def _refresh_environment(self) -> None:
        """Run potentially slow dependency/service checks away from the Tk thread."""
        if self._environment_refresh_running:
            return
        self._environment_refresh_running = True
        self.environment_text.set(ENV_BUSY)
        checker_class = Job5PreflightChecker if self._pipeline_mode == "v2" else PreflightChecker
        checker = checker_class(self._active_job_path(), tts_root=TTS_ROOT, vieneu_url=TTS_URL)
        music = self.audio.music.get().strip()
        checker.require_music = bool(music)
        checker.music_path = Path(music).expanduser() if music else None
        key = (self._pipeline_mode, str(self._active_job_path()))
        threading.Thread(target=self._run_environment_refresh, args=(checker, key), daemon=True).start()

    def _run_environment_refresh(self, checker, key) -> None:
        try:
            checks = checker.run() if key[0] == "v2" else self.controller.run_preflight()
        except Exception as exc:
            self.events.put(("environment_error", (str(exc),)))
            return
        self.events.put(("environment", (checks, key)))

    def _apply_environment(self, checks: list) -> None:
        self._environment_checks = checks
        if self._report_environment:
            self._report_environment = False
            failures = PreflightChecker.failures(checks)
            for check in checks:
                self.log.append(f"{'✓' if check.ok else '✕'} {check.label}: {check.message}")
            self.status_text.set("Môi trường sẵn sàng." if not failures else "Kiểm tra phát hiện lỗi; xem nhật ký.")
            if failures:
                messagebox.showwarning("Môi trường chưa sẵn sàng", "\n\n".join(
                    f"{check.label}: {check.message}\n{check.details}" for check in failures), parent=self)
        ready = PreflightChecker.ready(checks)
        self.environment_text.set(ENV_READY if ready else ENV_FAILED)
        self.environment_dot.configure(fg=COLORS["sage"] if ready else COLORS["danger"])
        missing = [check for check in PreflightChecker.failures(checks) if check.missing]
        self.install_button.configure(state="normal" if missing else "disabled")

    def _poll_service(self) -> None:
        """Poll VieNeu without blocking Tk when the service is offline or slow."""
        if not self._service_probe_running:
            self._service_probe_running = True
            threading.Thread(target=self._run_service_probe, daemon=True).start()
        self._schedule(2500, self._poll_service)

    def _run_service_probe(self) -> None:
        self.events.put(("service", (self._service_online(),)))

    def _service_online(self) -> bool:
        import urllib.error
        import urllib.request

        try:
            request = urllib.request.Request(TTS_URL + "/config", headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=1.0) as response:
                return response.status == 200
        except (OSError, urllib.error.URLError):
            return False

    def _refresh_buttons(self) -> None:
        if self._v2_importing:
            for button in (self.continue_button, self.run_button, self.cancel_button,
                           self.editor_button, self.studio_button, self.install_button):
                button.configure(state="disabled")
            self.status_text.set("Đang nhập và kiểm tra Job@5…")
            return
        if self._pipeline_mode == "v2":
            running = self._v2_running or self.v2_session.running
            has_job = self.v2_session.job is not None
            can_run = has_job and not running and not self._v2_importing
            self.continue_button.configure(state="normal" if can_run else "disabled")
            self.run_button.configure(state="normal" if can_run else "disabled")
            self.cancel_button.configure(state="normal" if running else "disabled")
            self.editor_button.configure(state="disabled")
            self.studio_button.configure(state="disabled", text=BTN_STUDIO_OPEN)
            can_install = not running and any(check.error_code == "DEPENDENCY_MISSING"
                                               for check in self._environment_checks)
            self.install_button.configure(state="normal" if can_install else "disabled")
            self.pipeline.busy = running
            self.pipeline.show_v2(self.v2_session.pipeline_rows())
            self.project.refresh()
            self.output.refresh()
            if running:
                self.status_text.set("Đang chờ bước hiện tại hoàn tất để dừng an toàn…"
                                     if self.v2_session.cancel_event.is_set() else "Đang chạy Job@5…")
            elif not has_job:
                self.status_text.set(NO_JOB_MESSAGE)
            return

        running = self.controller.worker is not None and self.controller.worker.is_alive()
        self.pipeline.busy = running
        plan = self.controller.plan
        has_job = self.controller.job is not None
        self.continue_button.configure(state="normal" if has_job and plan.can_resume and not running else "disabled")
        self.run_button.configure(state="normal" if has_job and not running else "disabled")
        self.cancel_button.configure(state="normal" if running else "disabled")
        self.editor_button.configure(
            state="normal" if self.controller.editor_available() else "disabled"
        )
        # Always repaint: scene progress advances while a step is running, and a
        # stale 0/N counter reads as a hang even though the worker is fine.
        self.pipeline.refresh()
        self.project.refresh()
        self.output.refresh()
        self.status_text.set(
            STATUS_RUNNING if running else (NO_JOB_MESSAGE if not has_job else self.status_text.get())
        )


def _terminate_tree(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True, check=False, shell=False)
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        return


def main() -> int:
    ZodiacStudioApp().mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
