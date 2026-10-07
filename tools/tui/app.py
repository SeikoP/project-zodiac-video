#!/usr/bin/env python3
"""Textual control plane for Zodiac local production.

Remotion Studio is the visual workspace. This TUI owns package/job selection,
production settings, pipeline orchestration, health/status, logs and outputs.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

from textual import work
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.widgets import (
    Button,
    DataTable,
    Footer,
    Header,
    Input,
    Label,
    RichLog,
    Select,
    Static,
)

from tools.studio.controller import StudioController
from tools.studio.messages_vi import ALIGN_MODEL_CHOICES, ALIGN_MODEL_DEFAULT, STEP_NAMES_VI
from tools.studio.pipeline import RUNNING, STEP_ORDER
from tools.tui.file_picker import ChoiceDialog, FilePicker
from tools.tui.model import compact_pipeline_rows, status_label

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / ".zodiac-work"
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
SUPPORTED_MUSIC = (".mp3", ".wav", ".m4a", ".aac", ".ogg")


class TuiStudioController(StudioController):
    """Controller adapter that mirrors engine events into Textual."""

    def __init__(self, *args, event_sink=None, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.event_sink = event_sink

    def handle_event(self, kind: str, payload: dict) -> None:
        super().handle_event(kind, payload)
        if self.event_sink is not None:
            try:
                self.event_sink(kind, dict(payload))
            except Exception:
                # UI observation must never turn a successful pipeline step into a failure.
                pass


class ZodiacTui(App):
    TITLE = "Zodiac"
    SUB_TITLE = "Production Control Plane"

    CSS = """
    Screen {
        background: #0d1016;
        color: #e9edf5;
    }

    Header {
        background: #111722;
        color: #f4f7fb;
        height: 3;
    }

    #health-strip {
        height: 5;
        padding: 0 1;
        background: #0d1016;
    }

    .health-card {
        width: 1fr;
        height: 4;
        margin-right: 1;
        padding: 0 1;
        border: round #273245;
        background: #121824;
    }

    .health-title {
        color: #7f8da3;
        text-style: bold;
    }

    .health-value {
        color: #f4f7fb;
    }

    #workspace {
        height: 1fr;
        padding: 0 1;
    }

    #sidebar {
        width: 39%;
        min-width: 36;
        max-width: 58;
        height: 1fr;
        padding-right: 1;
    }

    #content {
        width: 1fr;
        height: 1fr;
    }

    .card {
        border: round #273245;
        background: #121824;
        padding: 1 2;
        margin-bottom: 1;
    }

    .section-title {
        text-style: bold;
        color: #9fb8ff;
        margin-bottom: 1;
    }

    .field-label {
        color: #9aa7ba;
        margin-top: 1;
    }

    .inline-row {
        height: auto;
        margin-top: 1;
    }

    Button {
        margin-right: 1;
        min-width: 12;
    }

    Input, Select {
        border: tall #273245;
        background: #0f141e;
    }

    #project-card {
        min-height: 14;
    }

    #settings-card {
        min-height: 22;
    }

    #package-name, #active-job {
        text-style: bold;
        color: #f4f7fb;
    }

    #package-path, #music-label {
        color: #7f8da3;
        height: auto;
    }

    #pipeline-card {
        height: 1fr;
        min-height: 21;
    }

    #pipeline-head {
        height: auto;
        margin-bottom: 1;
    }

    #pipeline-summary {
        width: 1fr;
        color: #b9c4d4;
    }

    #pipeline-table {
        height: 1fr;
        min-height: 11;
        border: none;
        background: #0f141e;
    }

    #rerun-select {
        width: 1fr;
    }

    #output-card {
        min-height: 9;
    }

    #output-summary {
        color: #b9c4d4;
        height: auto;
    }

    #log-card {
        height: 12;
    }

    #log-card.hidden {
        display: none;
    }

    #log {
        height: 1fr;
        background: #0b0f16;
        border: none;
    }

    #command-bar {
        dock: bottom;
        height: 5;
        padding: 1;
        background: #111722;
        border-top: solid #273245;
    }

    #command-status {
        width: 1fr;
        padding: 1 1 0 1;
        color: #aab6c7;
    }

    #primary-actions {
        width: auto;
        align-horizontal: right;
    }

    Footer {
        background: #0b0f16;
    }
    """

    BINDINGS = [
        ("i", "pick_zip", "Nạp ZIP"),
        ("r", "run_all", "Chạy"),
        ("c", "continue_pipeline", "Tiếp tục"),
        ("s", "toggle_studio", "Remotion"),
        ("l", "toggle_log", "Log"),
        ("x", "stop", "Dừng"),
        ("q", "quit", "Thoát"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.controller = TuiStudioController(
            WORKSPACE,
            tts_root=TTS_ROOT,
            vieneu_url=TTS_URL,
            event_sink=self._engine_event_from_thread,
        )
        self.studio_process: subprocess.Popen | None = None
        self.music_path: Path | None = None
        self.log_visible = True

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        with Horizontal(id="health-strip"):
            yield self._health_card("JOB", "Chưa chọn", "health-job")
            yield self._health_card("MÔI TRƯỜNG", "Chưa kiểm tra", "health-env")
            yield self._health_card("VIENEU", "Chưa kiểm tra", "health-tts")
            yield self._health_card("REMOTION", "Đã dừng", "health-studio")
            yield self._health_card("OUTPUT", "Chưa render", "health-output")

        with Horizontal(id="workspace"):
            with VerticalScroll(id="sidebar"):
                with Vertical(classes="card", id="project-card"):
                    yield Label("DỰ ÁN", classes="section-title")
                    yield Static("Chưa chọn package", id="package-name")
                    yield Static("Nạp zodiac-job ZIP để bắt đầu", id="package-path")
                    yield Label("Job đang dùng", classes="field-label")
                    yield Select([], prompt="Chọn job đã nhập", id="job-select", allow_blank=True)
                    yield Static("—", id="active-job")
                    with Horizontal(classes="inline-row"):
                        yield Button("Nạp ZIP", id="pick-zip", variant="primary")
                        yield Button("Kiểm tra", id="check")
                        yield Button("Cài dependency", id="install-deps")

                with Vertical(classes="card", id="settings-card"):
                    yield Label("THIẾT LẬP", classes="section-title")
                    yield Label("Giọng đọc", classes="field-label")
                    yield Input(value="Hải Đăng", id="voice-input")
                    yield Label("Căn thời gian từ", classes="field-label")
                    yield Select(
                        [(value, value) for value in ALIGN_MODEL_CHOICES],
                        value=ALIGN_MODEL_DEFAULT,
                        id="align-select",
                        allow_blank=False,
                    )
                    yield Label("Nhạc nền", classes="field-label")
                    yield Static("Không dùng nhạc nền", id="music-label")
                    with Horizontal(classes="inline-row"):
                        yield Button("Chọn nhạc", id="pick-music")
                        yield Button("Nghe thử", id="listen")
                        yield Button("Bỏ nhạc", id="clear-music")
                    yield Label("Âm lượng nhạc 0–100", classes="field-label")
                    yield Input(value="35", id="music-volume", type="number")

            with Vertical(id="content"):
                with Vertical(classes="card", id="pipeline-card"):
                    with Horizontal(id="pipeline-head"):
                        yield Label("QUY TRÌNH", classes="section-title")
                        yield Static("Chọn job để xem trạng thái", id="pipeline-summary")
                        yield Button("Ẩn log", id="toggle-log")
                    yield DataTable(id="pipeline-table", zebra_stripes=False)
                    with Horizontal(classes="inline-row"):
                        yield Select(
                            [(STEP_NAMES_VI[step], step) for step in STEP_ORDER],
                            prompt="Chọn bước cần chạy lại",
                            id="rerun-select",
                            allow_blank=True,
                        )
                        yield Button("Chạy lại bước", id="rerun-step")

                with Vertical(classes="card", id="output-card"):
                    yield Label("KẾT QUẢ", classes="section-title")
                    yield Static("Chưa có output cho job hiện tại.", id="output-summary")
                    with Horizontal(classes="inline-row"):
                        yield Button("Mở video", id="open-video")
                        yield Button("Mở thư mục", id="open-folder")

                with Vertical(classes="card", id="log-card"):
                    yield Label("NHẬT KÝ", classes="section-title")
                    yield RichLog(id="log", wrap=True, highlight=True, markup=True)

        with Horizontal(id="command-bar"):
            yield Static("Chưa chạy", id="command-status")
            with Horizontal(id="primary-actions"):
                yield Button("Tiếp tục", id="continue", variant="primary")
                yield Button("Chạy toàn bộ", id="run-all", variant="success")
                yield Button("Mở Remotion", id="studio")
                yield Button("Dừng", id="stop", variant="error")
        yield Footer()

    @staticmethod
    def _health_card(title: str, value: str, value_id: str) -> Vertical:
        return Vertical(
            Static(title, classes="health-title"),
            Static(value, id=value_id, classes="health-value"),
            classes="health-card",
        )

    def on_mount(self) -> None:
        table = self.query_one("#pipeline-table", DataTable)
        table.add_columns("", "Giai đoạn", "Trạng thái", "Tiến độ", "Chi tiết")
        table.cursor_type = "row"
        self._refresh_jobs()
        self._refresh_view()
        self.set_interval(0.5, self._refresh_view)

    def _engine_event_from_thread(self, kind: str, payload: dict) -> None:
        try:
            self.call_from_thread(self._handle_engine_event, kind, payload)
        except RuntimeError:
            pass

    def _handle_engine_event(self, kind: str, payload: dict) -> None:
        if kind == "LOG_LINE":
            self._write_log(payload.get("text", ""))
        self._refresh_view()

    def _write_log(self, text: str) -> None:
        self.query_one("#log", RichLog).write(text)

    def _refresh_jobs(self) -> None:
        select = self.query_one("#job-select", Select)
        jobs = self.controller.available_jobs()
        select.set_options([(name, name) for name in jobs])
        if self.controller.job_name in jobs:
            select.value = self.controller.job_name

    def _refresh_view(self) -> None:
        job = self.controller.job
        archive = self.controller.archive
        worker_running = any(row["status"] == RUNNING for row in self.controller.pipeline_rows())
        studio_running = self._studio_running()
        video = self.controller.video_path
        video_ready = bool(video and video.is_file())

        package_name = archive.name if archive else (job.name if job else "Chưa chọn package")
        package_path = str(archive.parent) if archive else (
            str(job) if job else "Nạp zodiac-job ZIP để bắt đầu"
        )
        self.query_one("#package-name", Static).update(package_name)
        self.query_one("#package-path", Static).update(package_path)
        self.query_one("#active-job", Static).update(job.name if job else "—")

        self.query_one("#health-job", Static).update(job.name if job else "Chưa chọn")
        self.query_one("#health-studio", Static).update("Đang chạy" if studio_running else "Đã dừng")
        self.query_one("#health-output", Static).update("Sẵn sàng" if video_ready else "Chưa render")
        self._refresh_health_from_checks()

        compact = compact_pipeline_rows(self.controller.pipeline_rows())
        table = self.query_one("#pipeline-table", DataTable)
        table.clear()
        for row in compact:
            percent = int(round(row["progress"] * 100))
            detail = ""
            if row["scene_total"]:
                detail = f'{row["scene_done"]}/{row["scene_total"]} scene'
            table.add_row(
                row["glyph"],
                row["label"],
                status_label(row["status"]),
                f"{percent}%",
                detail,
            )

        next_step = self.controller.plan.continue_from() if job else None
        if next_step:
            summary = f"Tiếp theo: {STEP_NAMES_VI.get(next_step, next_step)}"
        elif job:
            summary = "Pipeline đã hoàn tất hoặc không còn bước cần chạy."
        else:
            summary = "Nạp ZIP hoặc chọn job để bắt đầu."
        self.query_one("#pipeline-summary", Static).update(summary)
        self.query_one("#command-status", Static).update(self.controller.status_text)
        self._refresh_output_summary()

        self.query_one("#continue", Button).disabled = job is None or worker_running
        self.query_one("#run-all", Button).disabled = job is None or worker_running
        self.query_one("#rerun-step", Button).disabled = job is None or worker_running
        self.query_one("#studio", Button).disabled = job is None
        self.query_one("#studio", Button).label = "Dừng Remotion" if studio_running else "Mở Remotion"
        self.query_one("#stop", Button).disabled = not (worker_running or studio_running)
        self.query_one("#open-video", Button).disabled = not video_ready
        self.query_one("#open-folder", Button).disabled = job is None
        self.query_one("#listen", Button).disabled = job is None or self.music_path is None

    def _refresh_health_from_checks(self) -> None:
        checks = self.controller.preflight_checks
        if not checks:
            self.query_one("#health-env", Static).update("Chưa kiểm tra")
            self.query_one("#health-tts", Static).update("Chưa kiểm tra")
            return
        vieneu = next((check for check in checks if check.code == "VIENEU"), None)
        env_checks = [check for check in checks if check.code != "VIENEU"]
        self.query_one("#health-env", Static).update(
            "Sẵn sàng" if env_checks and all(check.ok for check in env_checks) else "Cần xử lý"
        )
        self.query_one("#health-tts", Static).update(
            "Đã kết nối" if vieneu and vieneu.ok else "Chưa kết nối"
        )

    def _refresh_output_summary(self) -> None:
        if self.controller.job is None:
            self.query_one("#output-summary", Static).update("Chưa có output cho job hiện tại.")
            return
        job = self.controller.job
        video = self.controller.video_path
        voice = job / "voice.wav"
        timing = job / ".runtime" / "timing.json"
        parts = [
            f"Voice: {'✓' if voice.is_file() else '○'}",
            f"Timing: {'✓' if timing.is_file() else '○'}",
        ]
        if video and video.is_file():
            size_mb = video.stat().st_size / (1024 * 1024)
            parts.append(f"Video: ✓ {video.name} · {size_mb:.1f} MB")
        else:
            parts.append("Video: ○ chưa render")
        self.query_one("#output-summary", Static).update("   ".join(parts))

    def _studio_running(self) -> bool:
        return self.studio_process is not None and self.studio_process.poll() is None

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id
        if button_id == "pick-zip":
            self.action_pick_zip()
        elif button_id == "pick-music":
            self._pick_music()
        elif button_id == "clear-music":
            self.music_path = None
            self.query_one("#music-label", Static).update("Không dùng nhạc nền")
        elif button_id == "listen":
            self._listen_audio()
        elif button_id == "check":
            self._check_environment()
        elif button_id == "install-deps":
            self._install_dependencies()
        elif button_id == "run-all":
            self.action_run_all()
        elif button_id == "continue":
            self.action_continue_pipeline()
        elif button_id == "rerun-step":
            self._rerun_selected_step()
        elif button_id == "stop":
            self.action_stop()
        elif button_id == "studio":
            self.action_toggle_studio()
        elif button_id == "toggle-log":
            self.action_toggle_log()
        elif button_id == "open-video":
            self._open_path(self.controller.video_path)
        elif button_id == "open-folder":
            self._open_path(self.controller.job / "out" if self.controller.job else None)

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "job-select" and event.value not in (None, Select.NULL):
            name = str(event.value)
            if name in self.controller.available_jobs():
                self.controller.use_job(self.controller.job_path(name))
                self.controller.select_archive(None)
                self.controller.status_text = f"Đã chọn job: {name}"
                self._refresh_view()
                self._check_environment()

    def action_pick_zip(self) -> None:
        self.push_screen(
            FilePicker(title="Chọn zodiac-job ZIP", start=Path.cwd(), suffixes=(".zip",)),
            self._zip_picked,
        )

    def _zip_picked(self, path: Path | None) -> None:
        if path is not None:
            self._load_archive(path)

    @work(thread=True, group="package", exclusive=True)
    def _load_archive(self, path: Path) -> None:
        try:
            self.controller.select_archive(path)
            name = self.controller.job_name_for(path)
            destination = self.controller.job_path(name)
            if destination.exists():
                self.controller.use_job(destination)
                self.controller.select_archive(path)
                if self.controller.package_changed:
                    self.call_from_thread(self._show_package_conflict)
                    return
            if not self.controller.sync_package():
                raise RuntimeError("Không thể nhập package đã chọn.")
            self.controller.status_text = f"Đã nhập: {self.controller.job_name}"
            self.call_from_thread(self._after_project_change)
        except Exception as exc:
            self.controller.status_text = f"Import thất bại: {exc}"
            self.call_from_thread(self.notify, str(exc), severity="error")
            self.call_from_thread(self._refresh_view)

    def _show_package_conflict(self) -> None:
        self.controller.status_text = "Package đã thay đổi; cần chọn cách xử lý."
        self._refresh_view()
        self.push_screen(
            ChoiceDialog(
                title="Package đã thay đổi",
                message=(
                    "ZIP đang chọn khác với package đã nhập cho job này. "
                    "Nhập lại sẽ validate ở thư mục tạm trước khi thay job cũ."
                ),
            ),
            self._package_conflict_choice,
        )

    def _package_conflict_choice(self, choice: str | None) -> None:
        if choice is None:
            self.controller.status_text = "Đã hủy import package mới."
            self._refresh_view()
            return
        self._resolve_package_conflict(choice)

    @work(thread=True, group="package-conflict", exclusive=True)
    def _resolve_package_conflict(self, choice: str) -> None:
        try:
            replaced = self.controller.accept_package_conflict(choice)
            if choice == "import" and not replaced:
                raise RuntimeError("Không thể nhập lại package mới.")
            self.controller.status_text = (
                f"Đã nhập lại: {self.controller.job_name}"
                if choice == "import"
                else f"Giữ job cũ: {self.controller.job_name}"
            )
            self.call_from_thread(self._after_project_change)
        except Exception as exc:
            self.controller.status_text = f"Xử lý package thất bại: {exc}"
            self.call_from_thread(self.notify, str(exc), severity="error")
            self.call_from_thread(self._refresh_view)

    def _after_project_change(self) -> None:
        self._refresh_jobs()
        self._refresh_view()
        self.notify(f"Đã nạp {self.controller.job_name}")
        self._check_environment()

    def _pick_music(self) -> None:
        start = self.music_path.parent if self.music_path else Path.cwd()
        self.push_screen(
            FilePicker(title="Chọn nhạc nền", start=start, suffixes=SUPPORTED_MUSIC),
            self._music_picked,
        )

    def _music_picked(self, path: Path | None) -> None:
        if path is None:
            return
        self.music_path = path
        self.query_one("#music-label", Static).update(path.name)
        if self.controller.job:
            self.controller.plan.apply_change("music")
        self._refresh_view()

    def _pipeline_settings(self) -> tuple[str, str, float]:
        voice = self.query_one("#voice-input", Input).value.strip() or "Hải Đăng"
        align_value = self.query_one("#align-select", Select).value
        align_model = ALIGN_MODEL_DEFAULT if align_value == Select.NULL else str(align_value)
        raw_volume = self.query_one("#music-volume", Input).value.strip() or "35"
        volume = max(0.0, min(100.0, float(raw_volume))) / 100.0
        return voice, align_model, volume

    def action_run_all(self) -> None:
        self._start_pipeline(resume=False)

    def action_continue_pipeline(self) -> None:
        self._start_pipeline(resume=True)

    def _rerun_selected_step(self) -> None:
        selected = self.query_one("#rerun-select", Select).value
        if selected in (None, Select.NULL):
            self.notify("Chọn bước cần chạy lại trước.", severity="warning")
            return
        self._start_pipeline(resume=True, rerun=str(selected))

    def _start_pipeline(self, *, resume: bool, rerun: str | None = None) -> None:
        if self.controller.job is None:
            self.notify("Hãy nạp ZIP hoặc chọn job trước.", severity="warning")
            return
        try:
            voice, align_model, volume = self._pipeline_settings()
        except ValueError:
            self.notify("Âm lượng phải là số từ 0 đến 100.", severity="error")
            return
        started = self.controller.start_pipeline(
            resume=resume,
            rerun=rerun,
            voice=voice,
            music=self.music_path,
            volume=volume,
            align_model=align_model,
        )
        if not started:
            self.notify(self.controller.status_text, severity="warning")
        self._refresh_view()

    @work(thread=True, group="checks", exclusive=True)
    def _check_environment(self) -> None:
        try:
            checks = self.controller.check_only()
            failures = [item for item in checks if not item.ok]
            for item in checks:
                mark = "✓" if item.ok else "✕"
                self.call_from_thread(self._write_log, f"{mark} {item.label}: {item.message}")
            severity = "error" if failures else "information"
            message = f"{len(failures)} kiểm tra lỗi" if failures else "Môi trường sẵn sàng"
            self.call_from_thread(self.notify, message, severity=severity)
            self.call_from_thread(self._refresh_view)
        except Exception as exc:
            self.call_from_thread(self.notify, str(exc), severity="error")

    @work(thread=True, group="install", exclusive=True)
    def _install_dependencies(self) -> None:
        try:
            self.controller.install_dependencies()
            self.call_from_thread(self._write_log, self.controller.status_text)
            self.call_from_thread(self.notify, self.controller.status_text)
            self.call_from_thread(self._refresh_view)
        except Exception as exc:
            self.call_from_thread(self.notify, str(exc), severity="error")

    @work(thread=True, group="audio-preview", exclusive=True)
    def _listen_audio(self) -> None:
        if self.controller.job is None or self.music_path is None:
            self.call_from_thread(self.notify, "Chọn job và nhạc nền trước.", severity="warning")
            return
        try:
            _, _, volume = self._pipeline_settings()
            command = [
                sys.executable,
                str(ROOT / "tools" / "zodiac_local.py"),
                "--workspace",
                str(WORKSPACE),
                "audio-preview",
                self.controller.job.name,
                "--music",
                str(self.music_path),
                "--music-volume",
                f"{volume:.3f}",
            ]
            result = subprocess.run(
                command,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=False,
            )
            if result.stdout.strip():
                self.call_from_thread(self._write_log, result.stdout.strip())
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or "Không tạo được audio preview.")
            self.call_from_thread(self.notify, "Đã mở bản nghe thử 10 giây.")
        except Exception as exc:
            self.call_from_thread(self.notify, str(exc), severity="error")

    def action_toggle_log(self) -> None:
        self.log_visible = not self.log_visible
        card = self.query_one("#log-card", Vertical)
        card.set_class(not self.log_visible, "hidden")
        self.query_one("#toggle-log", Button).label = "Ẩn log" if self.log_visible else "Hiện log"

    def action_stop(self) -> None:
        if self.controller.worker is not None:
            self.controller.cancel()
        if self._studio_running():
            self._stop_studio_process()
        self._refresh_view()

    def action_toggle_studio(self) -> None:
        if self._studio_running():
            self._stop_studio_process()
            return
        if self.controller.job is None:
            self.notify("Chưa có job để mở Remotion Studio.", severity="warning")
            return
        self._launch_studio()

    @work(thread=True, group="studio", exclusive=True)
    def _launch_studio(self) -> None:
        command = [
            sys.executable,
            str(ROOT / "tools" / "zodiac_local.py"),
            "preview",
            self.controller.job.name,
            "--workspace",
            str(WORKSPACE),
        ]
        try:
            self.studio_process = subprocess.Popen(
                command,
                cwd=str(ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0),
                start_new_session=(os.name != "nt"),
                shell=False,
            )
            self.controller.status_text = "Remotion Studio đang chạy."
            self.call_from_thread(self._refresh_view)
            for line in self.studio_process.stdout or ():
                if line.strip():
                    self.call_from_thread(self._write_log, line.rstrip())
        except Exception as exc:
            self.controller.status_text = f"Remotion Studio lỗi: {exc}"
            self.call_from_thread(self.notify, str(exc), severity="error")
        finally:
            self.studio_process = None
            self.call_from_thread(self._refresh_view)

    def _stop_studio_process(self) -> None:
        process = self.studio_process
        if process is None or process.poll() is not None:
            return
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                shell=False,
            )
        else:
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                process.terminate()
        self.controller.status_text = "Đã dừng Remotion Studio."
        self.studio_process = None

    def _open_path(self, path: Path | None) -> None:
        if path is None or not path.exists():
            self.notify("Chưa có output để mở.", severity="warning")
            return
        if os.name == "nt":
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)], shell=False)
        else:
            subprocess.Popen(["xdg-open", str(path)], shell=False)

    def on_unmount(self) -> None:
        if self.controller.worker is not None:
            try:
                if any(row["status"] == RUNNING for row in self.controller.pipeline_rows()):
                    self.controller.cancel()
            except Exception:
                pass
        if self._studio_running():
            self._stop_studio_process()


def main() -> int:
    ZodiacTui().run()
    return 0
