#!/usr/bin/env python3
"""Responsive Textual control plane for Zodiac local production.

The TUI is intentionally operational. Remotion Studio is the visual preview /
authoring surface; final rendering stays behind an explicit review boundary.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

from textual import work
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, VerticalScroll
from textual.widgets import Button, DataTable, Footer, Header, Input, Label, RichLog, Select, Static

from tools.studio.controller import StudioController
from tools.studio.messages_vi import ALIGN_MODEL_CHOICES, ALIGN_MODEL_DEFAULT, STEP_NAMES_VI
from tools.studio.pipeline import (
    DONE,
    MIX_MUSIC,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    RUNNING,
    SKIPPED,
)
from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.tui.file_picker import ChoiceDialog, FilePicker
from tools.tui.model import compact_pipeline_rows, status_label

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / ".zodiac-work"
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
SUPPORTED_MUSIC = (".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg")
COMPLETE = (DONE, SKIPPED)


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
                # Observation must never make a successful pipeline operation fail.
                pass


class ZodiacTui(App):
    TITLE = "Zodiac"
    SUB_TITLE = "Production Control Plane"

    CSS = """
    Screen {
        background: #0d1016;
        color: #e8edf5;
    }

    Header {
        height: 1;
        background: #101620;
        color: #f4f7fb;
    }

    #status-strip {
        layout: horizontal;
        height: 1;
        padding: 0 1;
        background: #111722;
        border-bottom: solid #273245;
    }

    .health-item {
        width: 1fr;
        padding: 0 1;
        content-align: left middle;
        color: #b8c3d2;
    }

    #workspace {
        layout: horizontal;
        height: 1fr;
        padding: 0 1;
        scrollbar-size: 1 1;
    }

    #sidebar {
        width: 39%;
        min-width: 40;
        max-width: 58;
        height: 1fr;
        padding-right: 1;
    }

    #content {
        width: 1fr;
        height: 1fr;
    }

    .section {
        padding: 0 1;
        background: #111722;
        border-bottom: solid #273245;
    }

    #pipeline-section {
        height: 1fr;
        min-height: 12;
    }

    #output-section {
        height: auto;
    }

    #log-section {
        height: 1fr;
        min-height: 8;
        max-height: 20;
    }

    #log-section.hidden {
        display: none;
    }

    .section-title {
        color: #9fb8ff;
        text-style: bold;
    }

    .field-label {
        color: #909db1;
        margin-top: 1;
    }

    #package-name, #active-job {
        color: #f4f7fb;
        text-style: bold;
    }

    #package-path, #music-label, #workflow-hint, #output-summary {
        color: #8795a9;
        height: auto;
    }

    Button {
        min-height: 1;
        padding: 0 1;
    }

    Select {
        background: #0c1119;
    }

    Input {
        background: #0c1119;
        border: solid #354158;
        height: 3;
        min-height: 3;
    }

    #job-select {
        width: 1fr;
        margin-top: 1;
        border-bottom: solid #354158;
    }

    .setting-row {
        layout: horizontal;
        height: 3;
        margin-top: 1;
    }

    .setting-name {
        width: auto;
        padding: 0 1 0 0;
        content-align: left middle;
        color: #909db1;
    }

    .setting-row Select {
        width: 1fr;
        border-bottom: solid #354158;
        content-align: center middle;
    }

    .setting-row Input {
        width: 1fr;
        height: 3;
        min-height: 3;
    }

    .setting-row Static {
        width: 1fr;
        content-align: left middle;
        color: #8795a9;
    }

    .button-row {
        layout: horizontal;
        height: auto;
        margin-top: 1;
    }

    .button-row Button {
        width: 1fr;
        min-width: 7;
        margin-right: 1;
    }

    #pipeline-head {
        layout: horizontal;
        height: 3;
    }

    #pipeline-heading {
        width: auto;
        min-width: 12;
    }

    #pipeline-summary {
        width: 1fr;
        padding: 0 1;
        color: #b8c3d2;
    }

    #pipeline-tools {
        layout: horizontal;
        width: auto;
    }

    #pipeline-tools Button {
        min-width: 9;
        margin-left: 1;
    }

    #pipeline-table {
        height: 1fr;
        min-height: 9;
        background: #0c1119;
        border: none;
    }

    #workflow-hint {
        margin-top: 1;
        padding: 0 1;
    }

    #log {
        height: 1fr;
        background: #090d13;
        border: none;
    }

    #command-bar {
        layout: horizontal;
        height: 3;
        padding: 0 1;
        background: #101620;
        border-top: solid #273245;
    }

    #command-status {
        width: 1fr;
        padding: 0 1;
        color: #aab6c7;
        content-align: left middle;
    }

    #primary-actions {
        layout: horizontal;
        width: auto;
    }

    #primary-actions Button {
        min-width: 9;
        margin-left: 1;
    }

    Footer {
        background: #090d13;
    }

    Screen.narrow #status-strip {
        layout: vertical;
        height: 5;
        padding: 0 1;
    }

    Screen.narrow .health-item {
        width: 1fr;
        height: 1;
        padding: 0 1;
        border-left: none;
        content-align: left middle;
    }

    Screen.narrow #workspace {
        layout: vertical;
        height: 1fr;
    }

    Screen.narrow #sidebar {
        width: 1fr;
        min-width: 0;
        max-width: 100%;
        height: auto;
        padding-right: 0;
    }

    Screen.narrow #content {
        width: 1fr;
        height: auto;
    }

    Screen.narrow #pipeline-section {
        height: 20;
    }

    Screen.narrow #command-bar {
        layout: vertical;
        height: 6;
    }

    Screen.narrow #command-status {
        width: 1fr;
        height: 2;
        padding: 0 1;
    }

    Screen.narrow #primary-actions {
        width: 1fr;
    }

    Screen.narrow #primary-actions Button {
        width: 1fr;
        min-width: 8;
    }

    Screen.tiny #pipeline-head {
        layout: vertical;
        height: auto;
    }

    Screen.tiny #pipeline-summary {
        width: 1fr;
        height: 2;
        padding: 0;
    }

    Screen.tiny #pipeline-tools {
        width: 1fr;
    }

    Screen.tiny #pipeline-tools Button {
        width: 1fr;
        margin-left: 0;
        margin-right: 1;
    }

    Screen.tiny .button-row {
        layout: vertical;
    }

    Screen.tiny .button-row Button {
        width: 1fr;
        margin-right: 0;
        margin-bottom: 1;
    }

    Screen.tiny #command-bar {
        height: 11;
        padding: 1;
    }

    Screen.tiny #primary-actions {
        layout: vertical;
        height: auto;
    }

    Screen.tiny #primary-actions Button {
        width: 1fr;
        margin-left: 0;
        margin-bottom: 0;
    }
    """

    BINDINGS = [
        ("i", "pick_zip", "Nạp ZIP"),
        ("p", "prepare_studio", "Chuẩn bị"),
        ("s", "toggle_studio", "Studio"),
        ("r", "final_render", "Render"),
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
        self.voice_choices = saved_voices()
        self.pipeline_groups: list[dict] = []

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)

        with Container(id="status-strip"):
            yield Static("JOB  Chưa chọn", id="health-job", classes="health-item")
            yield Static("ENV  Chưa kiểm tra", id="health-env", classes="health-item")
            yield Static("VIENEU  Chưa kiểm tra", id="health-tts", classes="health-item")
            yield Static("STUDIO  Đã dừng", id="health-studio", classes="health-item")
            yield Static("OUTPUT  Chưa render", id="health-output", classes="health-item")

        with VerticalScroll(id="workspace"):
            with VerticalScroll(id="sidebar"):
                with Vertical(classes="section", id="project-section"):
                    yield Label("DỰ ÁN", classes="section-title")
                    yield Static("Chưa chọn package", id="package-name")
                    yield Static("Nạp zodiac-job ZIP để bắt đầu", id="package-path")
                    yield Select(
                        [],
                        prompt="Chọn job đã nhập",
                        id="job-select",
                        allow_blank=True,
                        compact=True,
                    )
                    yield Static("—", id="active-job")
                    with Container(classes="button-row"):
                        yield Button("Nạp ZIP", id="pick-zip", variant="primary")
                        yield Button("Kiểm tra", id="check")
                        yield Button("Cài deps", id="install-deps")

                with Vertical(classes="section", id="settings-section"):
                    yield Label("THIẾT LẬP", classes="section-title")
                    with Horizontal(classes="setting-row"):
                        yield Label("Giọng", classes="setting-name")
                        yield Select(
                            [(voice, voice) for voice in self.voice_choices],
                            value=preferred_voice(self.voice_choices),
                            id="voice-select",
                            allow_blank=False,
                            compact=True,
                        )
                    with Horizontal(classes="setting-row"):
                        yield Label("Căn Tg", classes="setting-name")
                        yield Select(
                            [(value, value) for value in ALIGN_MODEL_CHOICES],
                            value=ALIGN_MODEL_DEFAULT,
                            id="align-select",
                            allow_blank=False,
                            compact=True,
                        )
                    with Horizontal(classes="setting-row"):
                        yield Label("Âm lượng", classes="setting-name")
                        yield Input(value="35", id="music-volume", type="number")
                    with Horizontal(classes="setting-row"):
                        yield Label("Nhạc", classes="setting-name")
                        yield Static("Không dùng nhạc nền", id="music-label")
                    with Container(classes="button-row"):
                        yield Button("Chọn nhạc", id="pick-music")
                        yield Button("Nghe thử", id="listen")
                        yield Button("Bỏ", id="clear-music")

            with Vertical(id="content"):
                with Vertical(classes="section", id="pipeline-section"):
                    with Container(id="pipeline-head"):
                        yield Label("QUY TRÌNH", id="pipeline-heading", classes="section-title")
                        yield Static("Nạp ZIP hoặc chọn job để bắt đầu.", id="pipeline-summary")
                        with Container(id="pipeline-tools"):
                            yield Button("Chạy lại", id="rerun-stage")
                            yield Button("Hiện log", id="toggle-log")
                    yield DataTable(id="pipeline-table", zebra_stripes=False)
                    yield Static(
                        "1 Chuẩn bị Studio  →  2 Duyệt visual trong Studio  →  3 Render cuối",
                        id="workflow-hint",
                    )

                with Vertical(classes="section", id="output-section"):
                    yield Label("KẾT QUẢ", classes="section-title")
                    yield Static("Chưa có output cho job hiện tại.", id="output-summary")
                    with Container(classes="button-row"):
                        yield Button("Mở video", id="open-video")
                        yield Button("Mở thư mục", id="open-folder")

                with Vertical(classes="section", id="log-section"):
                    yield Label("NHẬT KÝ", classes="section-title")
                    yield RichLog(id="log", wrap=True, highlight=True, markup=True)

        with Container(id="command-bar"):
            yield Static("Chưa chạy", id="command-status")
            with Container(id="primary-actions"):
                yield Button("Chuẩn bị Studio", id="prepare-studio", variant="primary")
                yield Button("Mở Studio", id="studio")
                yield Button("Render cuối", id="final-render", variant="success")
                yield Button("Dừng", id="stop", variant="error")

        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#pipeline-table", DataTable)
        table.add_columns("", "Giai đoạn", "Trạng thái", "Tiến độ", "Chi tiết")
        table.cursor_type = "row"
        self._refresh_jobs()
        self._refresh_view()
        self.set_interval(0.5, self._refresh_view)

    def on_resize(self, event) -> None:
        width = event.size.width
        self.screen.set_class(width < 105, "narrow")
        self.screen.set_class(width < 76, "tiny")

    def _engine_event_from_thread(self, kind: str, payload: dict) -> None:
        try:
            self.call_from_thread(self._handle_engine_event, kind, payload)
        except RuntimeError:
            pass

    def _handle_engine_event(self, kind: str, payload: dict) -> None:
        if kind == "LOG_LINE":
            self._write_log(payload.get("text", ""))
        elif kind == "STEP_FAILED":
            self._set_log_visible(True)
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
        studio_ready = self._studio_ready()
        video = self.controller.video_path
        video_ready = bool(video and video.is_file())

        package_name = archive.name if archive else (job.name if job else "Chưa chọn package")
        package_path = str(archive.parent) if archive else (
            str(job) if job else "Nạp zodiac-job ZIP để bắt đầu"
        )
        self.query_one("#package-name", Static).update(package_name)
        self.query_one("#package-path", Static).update(package_path)
        self.query_one("#active-job", Static).update(job.name if job else "—")

        self.query_one("#health-job", Static).update(f"JOB  {job.name if job else 'Chưa chọn'}")
        self.query_one("#health-studio", Static).update(
            f"STUDIO  {'Đang chạy' if studio_running else ('Sẵn sàng' if studio_ready else 'Chưa chuẩn bị')}"
        )
        self.query_one("#health-output", Static).update(
            f"OUTPUT  {'Sẵn sàng' if video_ready else 'Chưa render'}"
        )
        self._refresh_health_from_checks()

        self.pipeline_groups = compact_pipeline_rows(self.controller.pipeline_rows())
        table = self.query_one("#pipeline-table", DataTable)
        cursor_row = table.cursor_coordinate.row if table.row_count else 0
        table.clear()
        for row in self.pipeline_groups:
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
        if self.pipeline_groups:
            table.move_cursor(row=min(cursor_row, len(self.pipeline_groups) - 1))

        self.query_one("#pipeline-summary", Static).update(self._workflow_summary())
        self.query_one("#command-status", Static).update(self.controller.status_text)
        self._refresh_output_summary()

        self.query_one("#prepare-studio", Button).disabled = job is None or worker_running or studio_ready
        self.query_one("#studio", Button).disabled = job is None or not studio_ready
        self.query_one("#studio", Button).label = "Dừng Studio" if studio_running else "Mở Studio"
        self.query_one("#final-render", Button).disabled = job is None or worker_running or not studio_ready
        self.query_one("#final-render", Button).label = (
            "Render lại" if self._final_complete() else "Render cuối"
        )
        self.query_one("#rerun-stage", Button).disabled = job is None or worker_running
        self.query_one("#stop", Button).disabled = not (worker_running or studio_running)
        self.query_one("#open-video", Button).disabled = not video_ready
        self.query_one("#open-folder", Button).disabled = job is None
        self.query_one("#listen", Button).disabled = job is None or self.music_path is None

    def _workflow_summary(self) -> str:
        if self.controller.job is None:
            return "Nạp ZIP hoặc chọn job để bắt đầu."
        if not self._studio_ready():
            next_step = self.controller.plan.continue_from()
            if next_step:
                return f"Chuẩn bị Studio · tiếp theo: {STEP_NAMES_VI.get(next_step, next_step)}"
            return "Chuẩn bị Studio trước khi duyệt visual."
        if self._studio_running():
            return "Studio đang mở · duyệt animation, caption, timing và bố cục trước Render cuối."
        if not self._final_complete():
            return "Studio đã sẵn sàng · mở Studio để duyệt visual, sau đó Render cuối."
        return "Video cuối đã có · mở Studio nếu cần kiểm tra lại visual trước khi render lại."

    def _studio_ready(self) -> bool:
        return bool(
            self.controller.job
            and self.controller.plan.status(PREPARE_RENDERER) in COMPLETE
        )

    def _final_complete(self) -> bool:
        return bool(
            self.controller.job
            and self.controller.plan.status(RENDER_VIDEO) in COMPLETE
            and self.controller.plan.status(MIX_MUSIC) in COMPLETE
        )

    def _refresh_health_from_checks(self) -> None:
        checks = self.controller.preflight_checks
        if not checks:
            self.query_one("#health-env", Static).update("ENV  Chưa kiểm tra")
            self.query_one("#health-tts", Static).update("VIENEU  Chưa kiểm tra")
            return
        vieneu = next((check for check in checks if check.code == "VIENEU"), None)
        env_checks = [check for check in checks if check.code != "VIENEU"]
        self.query_one("#health-env", Static).update(
            f"ENV  {'Sẵn sàng' if env_checks and all(check.ok for check in env_checks) else 'Cần xử lý'}"
        )
        self.query_one("#health-tts", Static).update(
            f"VIENEU  {'Đã kết nối' if vieneu and vieneu.ok else 'Chưa kết nối'}"
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
            f"Voice {'✓' if voice.is_file() else '○'}",
            f"Timing {'✓' if timing.is_file() else '○'}",
        ]
        if video and video.is_file():
            size_mb = video.stat().st_size / (1024 * 1024)
            parts.append(f"Video ✓ {size_mb:.1f} MB")
        else:
            parts.append("Video ○")
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
            if self.controller.job:
                self.controller.plan.apply_change("music")
            self._refresh_view()
        elif button_id == "listen":
            self._start_audio_preview()
        elif button_id == "check":
            self._check_environment()
        elif button_id == "install-deps":
            self._install_dependencies()
        elif button_id == "prepare-studio":
            self.action_prepare_studio()
        elif button_id == "studio":
            self.action_toggle_studio()
        elif button_id == "final-render":
            self.action_final_render()
        elif button_id == "rerun-stage":
            self._rerun_selected_stage()
        elif button_id == "toggle-log":
            self.action_toggle_log()
        elif button_id == "stop":
            self.action_stop()
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
        voice_value = self.query_one("#voice-select", Select).value
        voice = preferred_voice(self.voice_choices) if voice_value == Select.NULL else str(voice_value)
        align_value = self.query_one("#align-select", Select).value
        align_model = ALIGN_MODEL_DEFAULT if align_value == Select.NULL else str(align_value)
        raw_volume = self.query_one("#music-volume", Input).value.strip() or "35"
        volume = max(0.0, min(100.0, float(raw_volume))) / 100.0
        return voice, align_model, volume

    def action_prepare_studio(self) -> None:
        if self.controller.job is None:
            self.notify("Hãy nạp ZIP hoặc chọn job trước.", severity="warning")
            return
        if self._studio_ready():
            self.notify("Job đã sẵn sàng cho Remotion Studio.")
            return
        self._start_pipeline(stop_after=PREPARE_RENDERER)

    def action_final_render(self) -> None:
        if self.controller.job is None:
            self.notify("Hãy nạp ZIP hoặc chọn job trước.", severity="warning")
            return
        if not self._studio_ready():
            self.notify("Chuẩn bị Studio trước khi render cuối.", severity="warning")
            return

        rerun = None
        if self._final_complete():
            rerun = RENDER_VIDEO
        self._start_pipeline(rerun=rerun)

    def _rerun_selected_stage(self) -> None:
        if not self.pipeline_groups:
            self.notify("Chưa có pipeline để chạy lại.", severity="warning")
            return
        table = self.query_one("#pipeline-table", DataTable)
        index = table.cursor_coordinate.row
        if index < 0 or index >= len(self.pipeline_groups):
            self.notify("Chọn một hàng trong pipeline trước.", severity="warning")
            return

        group = self.pipeline_groups[index]
        steps = group["steps"]
        self._start_pipeline(
            rerun=group["rerun_step"],
            stop_after=steps[-1],
        )

    def _start_pipeline(
        self,
        *,
        rerun: str | None = None,
        stop_after: str | None = None,
    ) -> None:
        if self.controller.job is None:
            self.notify("Hãy nạp ZIP hoặc chọn job trước.", severity="warning")
            return
        try:
            voice, align_model, volume = self._pipeline_settings()
        except ValueError:
            self.notify("Âm lượng phải là số từ 0 đến 100.", severity="error")
            return
        started = self.controller.start_pipeline(
            resume=True,
            rerun=rerun,
            voice=voice,
            music=self.music_path,
            volume=volume,
            align_model=align_model,
            stop_after=stop_after,
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

    def _start_audio_preview(self) -> None:
        if self.controller.job is None or self.music_path is None:
            self.notify("Chọn job và nhạc nền trước.", severity="warning")
            return
        try:
            _, _, volume = self._pipeline_settings()
        except ValueError:
            self.notify("Âm lượng phải là số từ 0 đến 100.", severity="error")
            return
        self._run_audio_preview(volume)

    @work(thread=True, group="audio-preview", exclusive=True)
    def _run_audio_preview(self, volume: float) -> None:
        try:
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
            preview = self.controller.job / ".runtime" / "audio-preview.wav"
            if not preview.is_file():
                raise RuntimeError("Không tìm thấy tệp nghe thử.")
            self.call_from_thread(self._open_path, preview)
            self.call_from_thread(self.notify, "Đang phát bản nghe thử 10 giây.")
        except Exception as exc:
            self.call_from_thread(self.notify, str(exc), severity="error")

    def action_toggle_log(self) -> None:
        self._set_log_visible(not self.log_visible)

    def _set_log_visible(self, visible: bool) -> None:
        self.log_visible = visible
        section = self.query_one("#log-section", Vertical)
        section.set_class(not visible, "hidden")
        self.query_one("#toggle-log", Button).label = "Ẩn log" if visible else "Hiện log"

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
        if not self._studio_ready():
            self.notify("Bấm Chuẩn bị Studio trước.", severity="warning")
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
