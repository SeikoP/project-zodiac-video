#!/usr/bin/env python3
"""Zodiac Studio v2: Vietnamese GUI on top of StudioController + PipelineWorker.

Tk is only touched from the main thread; worker events arrive through a queue.
"""

from __future__ import annotations

import os
import queue
import re
import shutil
import signal
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

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
from tools.studio.preflight import PreflightChecker
from tools.studio.views.audio_panel import AudioPanel
from tools.studio.views.common import FONT_BOLD, FONT_SMALL, FONT_TITLE, use_theme
from tools.studio.views.log_panel import LogPanel
from tools.studio.views.output_panel import OutputPanel
from tools.studio.views.pipeline_panel import PipelinePanel
from tools.studio.views.project_panel import ProjectPanel
from tools.studio.theme import COLORS

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / ".zodiac-work"
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
DEFAULT_ARCHIVE = ROOT / "ready" / "zodiac-sun-gemini-render-ready.zip"
STUDIO_MARK = "●"


class ZodiacStudioApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_TITLE} — {APP_SUBTITLE}")
        self.geometry("1180x860")
        self.minsize(940, 700)
        self.configure(bg=COLORS["bg"])
        use_theme(self)

        self.controller = StudioController(WORKSPACE, tts_root=TTS_ROOT, vieneu_url=TTS_URL)
        self.events: queue.Queue = queue.Queue()
        self.studio_process: subprocess.Popen | None = None
        self.status_text = tk.StringVar(value=STATUS_IDLE)
        self.service_text = tk.StringVar(value=SERVICE_OFFLINE)
        self.environment_text = tk.StringVar(value=ENV_BUSY)

        self.body = tk.Frame(self, bg=COLORS["bg"], padx=20)
        self.project = ProjectPanel(self.body, self.controller, on_changed=self._project_changed)
        self.audio = AudioPanel(self.body, self.controller, on_listen=self._listen)
        self.pipeline = PipelinePanel(self.body, self.controller, on_rerun=self._rerun_step)
        self.output = OutputPanel(self.body, self.controller, on_open=self._open_path)
        self.log = LogPanel(self.body)

        self._build(self.project, self.audio)
        self.protocol("WM_DELETE_WINDOW", self.destroy)

        # Nothing is preselected: the project starts blank, except that a job with
        # unfinished work is reopened so 'Tiếp tục' has something to resume.
        self.after(120, self._pump)
        self.after(600, self._refresh_environment)
        self.after(1200, self._poll_service)
        self.after(400, self._resume_unfinished_job)

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
    def _project_changed(self) -> None:
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
        """Reopen only a job that still has work left; finished jobs stay untouched."""
        if self.controller.job is not None:
            return
        for path in sorted(item for item in self.controller.jobs_dir.glob("*") if item.is_dir()):
            plan = JobStateStore(path).open()
            if plan.can_resume and not plan.finished:
                self.controller.use_job(path)
                self.status_text.set(f"Tiếp tục công việc dang dở: {path.name}")
                break
        self.project.refresh()
        self._refresh_buttons()

    # ---- pipeline ----------------------------------------------------
    def _start(self, *, resume: bool, rerun: str | None = None) -> None:
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

    def _continue(self) -> None:
        self._start(resume=True)

    def _run_all(self) -> None:
        self._start(resume=False)

    def _rerun_step(self, step: str) -> None:
        self._start(resume=True, rerun=step)

    def _cancel(self) -> None:
        if self.controller.worker is not None:
            self.controller.cancel()
            self.status_text.set("Đang dừng…")
            return
        if self.studio_process is not None and self.studio_process.poll() is None:
            _terminate_tree(self.studio_process)
            self.studio_button.configure(text=BTN_STUDIO_OPEN)
            self.status_text.set("Đã dừng Remotion Studio.")

    def _check(self) -> None:
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
        missing = self.controller.dependencies_missing()
        if not missing:
            self.status_text.set(DEPS_ALREADY_OK_MESSAGE)
            return
        checker = PreflightChecker(self.controller.job, tts_root=TTS_ROOT, vieneu_url=TTS_URL)
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

    def _listen(self, volume: float) -> None:
        if self.controller.job is None:
            self.status_text.set(NO_JOB_MESSAGE)
            return
        music = self.audio.values()["music"].strip()
        if not music:
            self.status_text.set("Chọn nhạc nền trước khi nghe thử.")
            return
        command = [
            sys.executable,
            "tools/zodiac_local.py",
            "--workspace",
            str(WORKSPACE),
            "audio-preview",
            self.controller.job.name,
            "--music",
            music,
            "--music-volume",
            f"{volume:.3f}",
        ]
        threading.Thread(target=self._run_listen, args=(command,), daemon=True).start()

    def _run_listen(self, command: list[str]) -> None:
        result = subprocess.run(command, cwd=str(ROOT), capture_output=True, text=True,
                                encoding="utf-8", errors="replace", shell=False)
        self.events.put(("listen", (result.returncode, result.stdout or "", result.stderr or "")))

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
            elif channel == "listen":
                self._handle_listen(*payload)
            elif channel == "install":
                self._handle_install(*payload)
            elif channel == "studio_done":
                self.studio_button.configure(text=BTN_STUDIO_OPEN)
                self.studio_process = None
        self._refresh_buttons()
        self.after(120, self._pump)

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
            self.pipeline.refresh()
        elif kind == STEP_FAILED:
            self.pipeline.refresh()
            step = payload.get("step", "")
            title = self.controller.error_title(step)
            body = payload.get("message") or "Bước này thư bại."
            details = payload.get("details") or ""
            self.log.append(f"[{payload.get('error_code')}] {details}")
            messagebox.showerror(title, body + (f"\n\nChi tiết: {details}" if details else ""), parent=self)
        elif kind in (PIPELINE_DONE, PIPELINE_CANCELLED):
            self.pipeline.refresh()
            self.status_text.set(
                "Da dung. Tiep tuc se chay lai buoc dang dung."
                if kind == PIPELINE_CANCELLED
                else "Da hoan tat toan bo quy trinh."
            )
        self._refresh_buttons()

    def _handle_listen(self, code: int, out: str, err: str) -> None:
        if code:
            self.status_text.set("Không tạo được bản nghe thử.")
            self.log.append(err.strip())
            messagebox.showerror("Nghe thử không thành công", (err.strip().splitlines() or [""])[-1], parent=self)
            return
        self.status_text.set("Đã tạo bản nghe thử.")
        self.log.append(out.strip())
        preview = self.controller.job / ".runtime" / "audio-preview.wav"
        if preview.is_file():
            self._open_path(preview)

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
        checks = self.controller.run_preflight()
        ready = PreflightChecker.ready(checks)
        self.environment_text.set(ENV_READY if ready else ENV_FAILED)
        self.environment_dot.configure(fg=COLORS["sage"] if ready else COLORS["danger"])
        missing = [check for check in PreflightChecker.failures(checks) if check.missing]
        self.install_button.configure(state="normal" if missing else "disabled")
        return None

    def _poll_service(self) -> None:
        online = self._service_online()
        self.service_text.set(SERVICE_ONLINE if online else SERVICE_OFFLINE)
        self.service_dot.configure(fg=COLORS["sage"] if online else COLORS["accent"])
        self.after(2500, self._poll_service)

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
        running = self.controller.worker is not None and self.controller.worker.is_alive()
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
            STATUS_RUNNING if running else (STATUS_IDLE if has_job else NO_JOB_MESSAGE)
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