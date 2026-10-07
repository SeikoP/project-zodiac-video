#!/usr/bin/env python3
"""Textual control plane for Zodiac local production.

Remotion Studio remains the visual workspace. This TUI owns project import,
pipeline orchestration, TTS/timing settings, logs and process controls.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

from textual import work
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
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
from tools.studio.messages_vi import ALIGN_MODEL_CHOICES, ALIGN_MODEL_DEFAULT
from tools.studio.pipeline import RUNNING
from tools.tui.file_picker import ChoiceDialog, FilePicker
from tools.tui.model import compact_pipeline_rows

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
    SUB_TITLE = "Local production control plane · Remotion = visual workspace"

    CSS = """
    Screen {
        background: $background;
    }
    #main {
        height: 1fr;
        padding: 0 1;
    }
    .card {
        border: round $panel;
        padding: 1;
        margin: 0 1 1 0;
    }
    #left {
        width: 42%;
    }
    #right {
        width: 58%;
    }
    #pipeline-table {
        height: 16;
    }
    #log {
        height: 1fr;
        min-height: 10;
        border: round $panel;
    }
    .section-title {
        text-style: bold;
        color: $accent;
        margin-bottom: 1;
    }
    .field-label {
        color: $text-muted;
        margin-top: 1;
    }
    .actions {
        height: auto;
        margin-top: 1;
    }
    Button {
        margin-right: 1;
    }
    #status-line {
        height: 3;
        padding: 1;
        border-top: solid $panel;
    }
    """

    BINDINGS = [
        ("i", "pick_zip", "Nạp ZIP"),
        ("r", "run_all", "Chạy"),
        ("c", "continue_pipeline", "Tiếp tục"),
        ("s", "toggle_studio", "Remotion Studio"),
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
        self._pending_conflict_archive: Path | None = None

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="main"):
            with Vertical(id="left"):
                with Vertical(classes="card"):
                    yield Label("DỰ ÁN", classes="section-title")
                    yield Static("Chưa chọn package", id="archive-label")
                    yield Select([], prompt="Chọn job đã nhập", id="job-select", allow_blank=True)
                    with Horizontal(classes="actions"):
                        yield Button("Nạp ZIP", id="pick-zip", variant="primary")
                        yield Button("Kiểm tra", id="check")
                with Vertical(classes="card"):
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
                    with Horizontal(classes="actions"):
                        yield Button("Chọn nhạc", id="pick-music")
                        yield Button("Bỏ nhạc", id="clear-music")
                    yield Label("Âm lượng nhạc (0–100)", classes="field-label")
                    yield Input(value="35", id="music-volume", type="number")
                with Vertical(classes="card"):
                    yield Label("ĐIỀU KHIỂN", classes="section-title")
                    with Horizontal(classes="actions"):
                        yield Button("Chạy toàn bộ", id="run-all", variant="success")
                        yield Button("Tiếp tục", id="continue")
                        yield Button("Dừng", id="stop", variant="error")
                    with Horizontal(classes="actions"):
                        yield Button("Mở Remotion Studio", id="studio", variant="primary")
                        yield Button("Mở video", id="open-video")
                        yield Button("Mở thư mục", id="open-folder")
            with Vertical(id="right"):
                with Vertical(classes="card"):
                    yield Label("QUY TRÌNH", classes="section-title")
                    yield DataTable(id="pipeline-table", zebra_stripes=True)
                yield Label("NHẬT KÝ", classes="section-title")
                yield RichLog(id="log", wrap=True, highlight=True, markup=True)
        yield Static("Chưa chạy", id="status-line")
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#pipeline-table", DataTable)
        table.add_columns("", "Stage", "Tiến độ", "Chi tiết")
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
        current = self.controller.job_name or Select.NULL
        select.set_options([(name, name) for name in self.controller.available_jobs()])
        if current != Select.NULL:
            select.value = current

    def _refresh_view(self) -> None:
        archive_text = str(self.controller.archive) if self.controller.archive else "Chưa chọn package"
        if self.controller.job:
            archive_text = f"{archive_text}\nJob: {self.controller.job_name}"
        self.query_one("#archive-label", Static).update(archive_text)
        self.query_one("#status-line", Static).update(self.controller.status_text)

        table = self.query_one("#pipeline-table", DataTable)
        table.clear()
        for row in compact_pipeline_rows(self.controller.pipeline_rows()):
            percent = int(round(row["progress"] * 100))
            detail = ""
            if row["scene_total"]:
                detail = f'{row["scene_done"]}/{row["scene_total"]} scenes'
            table.add_row(row["glyph"], row["label"], f"{percent}%", detail)

        studio_button = self.query_one("#studio", Button)
        studio_button.label = (
            "Dừng Remotion Studio" if self._studio_running() else "Mở Remotion Studio"
        )

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
        elif button_id == "check":
            self._check_environment()
        elif button_id == "run-all":
            self.action_run_all()
        elif button_id == "continue":
            self.action_continue_pipeline()
        elif button_id == "stop":
            self.action_stop()
        elif button_id == "studio":
            self.action_toggle_studio()
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
                # Load the existing state first, then compare its stored package
                # fingerprint with the selected ZIP. This avoids silently reusing
                # stale cached content when no job was active yet.
                self.controller.use_job(destination)
                self.controller.select_archive(path)
                if self.controller.package_changed:
                    self._pending_conflict_archive = path
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

    def _pick_music(self) -> None:
        self.push_screen(
            FilePicker(title="Chọn nhạc nền", start=Path.cwd(), suffixes=SUPPORTED_MUSIC),
            self._music_picked,
        )

    def _music_picked(self, path: Path | None) -> None:
        if path is None:
            return
        self.music_path = path
        self.query_one("#music-label", Static).update(str(path))
        if self.controller.job:
            self.controller.plan.apply_change("music")

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

    def _start_pipeline(self, *, resume: bool) -> None:
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
                self.call_from_thread(
                    self._write_log,
                    f"{mark} {item.label}: {item.message}",
                )
            severity = "error" if failures else "information"
            message = f"{len(failures)} kiểm tra lỗi" if failures else "Môi trường sẵn sàng"
            self.call_from_thread(self.notify, message, severity=severity)
            self.call_from_thread(self._refresh_view)
        except Exception as exc:
            self.call_from_thread(self.notify, str(exc), severity="error")

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
