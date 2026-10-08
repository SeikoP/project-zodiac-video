#!/usr/bin/env python3
"""Responsive Textual control plane for Zodiac local production.

The TUI is intentionally operational. Remotion Studio support remains in the
local runtime, but the current TUI workflow runs straight through to final output.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import re
from datetime import datetime
import subprocess
import sys
from pathlib import Path

from rich.segment import Segment
from rich.style import Style

from textual import work
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, VerticalScroll
from textual.strip import Strip
from textual.widgets import Button, DataTable, Footer, Header, Input, Label, RichLog, Select, Static, ProgressBar

from tools.control_plane.errors import ControlPlaneError
from tools.studio.controller import StudioController
from tools.studio_v2.executor import ExecutorConfig
from tools.studio.messages_vi import ALIGN_MODEL_CHOICES, ALIGN_MODEL_DEFAULT, STEP_NAMES_VI
from tools.studio.pipeline import (
    ALIGN_TIMING,
    CONCAT_VOICE,
    DONE,
    MIX_MUSIC,
    RENDER_VIDEO,
    RUNNING,
    SKIPPED,
)
from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.tui.file_picker import ChoiceDialog, FilePicker
from tools.tui.model import compact_pipeline_rows, status_label
from tools.tui.v2_adapter import V2TuiSession, detect_job5_manifest
from tools.zodiac_local import (
    build_audio_preview,
    default_music_path,
    observe_subprocess_output,
)

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / ".zodiac-work"
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
SUPPORTED_MUSIC = (".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg")
COMPLETE = (DONE, SKIPPED)


class SelectableLog(RichLog):
    """RichLog with drag-select: releasing the mouse copies the selection to the clipboard."""

    ALLOW_SELECT = False
    SELECT_BG = "#28456f"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._select_anchor: tuple[int, int] | None = None
        self._select_end: tuple[int, int] | None = None

    def _pos_from_event(self, event) -> tuple[int, int]:
        scroll_x, scroll_y = self.scroll_offset
        col = max(0, scroll_x + event.x)
        row = max(0, min(len(self.lines) - 1, scroll_y + event.y))
        return row, col

    def on_mouse_down(self, event) -> None:
        if self.app.mouse_captured is not None:
            return
        if event.button == 0:
            self._select_anchor = self._pos_from_event(event)
            self._select_end = None
            self.capture_mouse()
            self.refresh()

    def on_mouse_move(self, event) -> None:
        if self._select_anchor is None:
            return
        self._select_end = self._pos_from_event(event)
        self.refresh()

    def on_mouse_up(self, event) -> None:
        if event.button == 0 and self._select_anchor is not None:
            self.release_mouse()
            if self._select_end is None:
                self._select_anchor = None
                self.refresh()
                return
            text = self._selected_text()
            self._select_anchor = None
            self._select_end = None
            self.refresh()
            if text:
                self.app._copy_text(text)

    def _selection_span(self) -> tuple[tuple[int, int], tuple[int, int]] | None:
        if self._select_anchor is None or self._select_end is None:
            return None
        (r1, c1), (r2, c2) = sorted((self._select_anchor, self._select_end))
        return (r1, c1), (r2, c2)

    def _span_for_row(self, y: int) -> tuple[int, int] | None:
        pair = self._selection_span()
        if pair is None:
            return None
        (r1, c1), (r2, c2) = pair
        row = self.scroll_offset.y + y
        if row < r1 or row > r2:
            return None
        if r1 == r2:
            return c1, c2
        row_end = self.lines[row].cell_length
        if row == r1:
            return c1, row_end
        if row == r2:
            return 0, c2
        return 0, row_end

    def render_line(self, y: int) -> Strip:
        strip = super().render_line(y)
        span = self._span_for_row(y)
        if span is None or span[0] >= span[1]:
            return strip
        scroll_x = self.scroll_offset.x
        start = max(0, span[0] - scroll_x)
        end = max(start, span[1] - scroll_x)
        if start >= end:
            return strip
        sel_style = Style(bgcolor=self.SELECT_BG)
        pre = strip.crop(0, start)._segments
        mid = [
            Segment(seg.text, (seg.style or Style()) + sel_style)
            for seg in strip.crop(start, end)._segments
        ]
        post = strip.crop(end, None)._segments
        return Strip([*pre, *mid, *post])

    def _selected_text(self) -> str:
        pair = self._selection_span()
        if pair is None:
            return ""
        (r1, c1), (r2, c2) = pair
        parts: list[str] = []
        for row in range(r1, r2 + 1):
            cells = self.lines[row].text
            if r1 == r2:
                parts.append(cells[c1:c2])
            elif row == r1:
                parts.append(cells[c1:])
            elif row == r2:
                parts.append(cells[:c2])
            else:
                parts.append(cells)
        return "\n".join(parts)


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

    Button {
        height: 3;
        min-height: 3;
        padding: 0 1;
        content-align: center middle;
    }

    Header {
        height: 1;
        background: #101620;
        color: #f4f7fb;
    }

    #pipeline-status {
        layout: horizontal;
        height: 2;
        min-height: 2;
        padding: 0 1;
        background: #151d2a;
        border-bottom: solid #273245;
    }

    .health-item {
        width: 1fr;
        min-width: 12;
        height: 1;
        padding: 0 1;
        content-align: left middle;
        color: #b8c3d2;
    }

    #workspace {
        layout: horizontal;
        height: 32;
        min-height: 32;
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

    #sidebar .section {
        height: auto;
    }

    .section {
        padding: 0 1;
        background: #111722;
        border-bottom: solid #273245;
    }

    #pipeline-section {
        height: 25;
        min-height: 25;
        max-height: 25;
    }

    #pipeline-top {
        layout: horizontal;
        height: 3;
        min-height: 3;
    }

    #pipeline-body {
        layout: horizontal;
        height: 1fr;
        min-height: 18;
    }

    #pipeline-left {
        width: 1fr;
        height: 1fr;
        padding-right: 1;
    }

    #pipeline-actions {
        width: 22;
        min-width: 20;
        max-width: 26;
        height: 1fr;
        padding-left: 1;
        border-left: solid #273245;
    }

    #pipeline-actions .section-title {
        height: 1;
        margin-bottom: 1;
    }

    #pipeline-actions Button {
        width: 1fr;
        height: 3;
        min-height: 3;
        margin-bottom: 1;
    }

    #output-section {
        height: 7;
        min-height: 7;
    }

    #log-section {
        height: 1fr;
        min-height: 4;
        padding: 0 1;
        layout: horizontal;
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

    #package-path, #workflow-hint, #output-summary {
        color: #8795a9;
        height: auto;
    }

    Button {
        min-height: 3;
        padding: 0 1;
        content-align: center middle;
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
        width: 12;
        padding: 0 1 0 0;
        content-align: left middle;
        color: #909db1;
    }

    .setting-row Select {
        width: 1fr;
        min-width: 18;
        height: 3;
        border-bottom: solid #354158;
        content-align: left middle;
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
        height: 3;
        margin-top: 1;
    }

    .button-row Button {
        width: 1fr;
        min-width: 7;
        margin-right: 1;
    }

    #pipeline-heading {
        width: 12;
        min-width: 12;
        content-align: left middle;
    }

    #pipeline-summary {
        width: 1fr;
        padding: 0 1;
        color: #b8c3d2;
        content-align: left middle;
    }

    #pipeline-table {
        height: 1fr;
        min-height: 7;
        background: #0c1119;
        border: none;
    }

    #workflow-hint {
        margin-top: 1;
        padding: 0 1;
    }

    #project-heading { height: 1; }
    #project-heading .section-title { width: 10; }
    #package-name { width: 1fr; height: 1; }
    .log-panel { height: 1fr; padding: 0 1; }
    #error-panel { width: 46%; border-right: solid #273245; }
    #workflow-panel { width: 1fr; }
    .log-heading {
        layout: horizontal;
        height: 3;
        min-height: 3;
    }
    .log-heading .section-title {
        width: 1fr;
        content-align: left middle;
    }
    .log-heading Button {
        width: 14;
        min-width: 14;
        height: 3;
    }
    .log-empty {
        height: 3;
        padding: 0 1;
        color: #8795a9;
        content-align: left middle;
    }
    .log-empty.hidden { display: none; }
    #workflow-task { height: 2; }
    #workflow-progress { height: 1; }
    #error-log, #log {
        height: 1fr;
        background: #090d13;
        border: none;
    }

    #command-bar {
        height: 1;
        min-height: 1;
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


    Footer {
        background: #090d13;
    }

    Screen.narrow #pipeline-status {
        layout: vertical;
        height: 4;
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
        height: 34;
        min-height: 32;
        max-height: 38;
    }

    Screen.narrow #pipeline-body {
        layout: vertical;
        height: 1fr;
    }

    Screen.narrow #pipeline-left {
        width: 1fr;
        height: 15;
        padding-right: 0;
    }

    Screen.narrow #pipeline-actions {
        width: 1fr;
        max-width: 100%;
        height: 13;
        padding-left: 0;
        border-left: none;
        border-top: solid #273245;
    }

    Screen.narrow #pipeline-actions {
        layout: grid;
        grid-size: 2 2;
        grid-gutter: 0 1;
    }

    Screen.narrow #pipeline-actions .section-title {
        display: none;
    }

    Screen.narrow #pipeline-actions Button {
        margin-bottom: 0;
    }

    Screen.narrow #command-status {
        width: 1fr;
        height: 1;
        padding: 0 1;
    }

    Screen.tiny #pipeline-top {
        layout: vertical;
        height: 4;
    }

    Screen.tiny #pipeline-heading {
        width: 1fr;
        height: 1;
    }

    Screen.tiny #pipeline-summary {
        width: 1fr;
        height: 3;
        padding: 0;
    }

    Screen.tiny .button-row {
        layout: vertical;
    }

    Screen.tiny .button-row Button {
        width: 1fr;
        margin-right: 0;
        margin-bottom: 1;
    }

    Screen.tiny #pipeline-actions {
        layout: vertical;
        height: 14;
    }

    Screen.tiny #pipeline-actions Button {
        width: 1fr;
        margin-bottom: 1;
    }

    Screen.tiny #command-bar {
        height: 1;
        padding: 0 1;
    }
    """

    BINDINGS = [
        ("i", "pick_zip", "Nạp ZIP"),
        ("r", "run_full", "Chạy toàn bộ"),
        ("l", "focus_log", "Log"),
        ("x", "stop", "Dừng"),
        ("q", "quit", "Thoát"),
    ]

    def __init__(self, workspace_root: Path | None = None) -> None:
        super().__init__()
        self.workspace_root = Path(workspace_root or WORKSPACE).resolve()
        self.controller = TuiStudioController(
            self.workspace_root,
            tts_root=TTS_ROOT,
            vieneu_url=TTS_URL,
            event_sink=self._engine_event_from_thread,
        )
        self.v2_session = V2TuiSession(self.workspace_root)
        self._pipeline_mode = "legacy"
        self.music_path = self._saved_music_path() or default_music_path()
        self.log_visible = True
        self.active_step = ""
        self.active_scene = ""
        self.voice_choices = saved_voices()
        self.pipeline_groups: list[dict] = []
        self._pipeline_table_key: tuple | None = None

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)

        with VerticalScroll(id="workspace"):
            with VerticalScroll(id="sidebar"):
                with Vertical(classes="section", id="project-section"):
                    with Horizontal(id="project-heading"):
                        yield Label("DỰ ÁN", classes="section-title")
                        yield Static("Chưa chọn package", id="package-name", markup=False)
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
                        yield Input(value="100", id="music-volume", type="number")
                    with Horizontal(classes="setting-row"):
                        yield Label("Nhạc", classes="setting-name")
                        yield Select(
                            self._music_options(),
                            value=self.music_path if self.music_path is not None else Select.NULL,
                            id="music-select",
                            prompt="Không dùng nhạc nền",
                            allow_blank=True,
                            compact=True,
                        )
                    with Container(classes="button-row"):
                        yield Button("Nghe thử", id="listen")
                        yield Button("Bỏ", id="clear-music")

            with Vertical(id="content"):
                with Vertical(classes="section", id="pipeline-section"):
                    with Container(id="pipeline-top"):
                        yield Label("QUY TRÌNH", id="pipeline-heading", classes="section-title")
                        yield Static("Nạp ZIP hoặc chọn job để bắt đầu.", id="pipeline-summary")
                    with Container(id="pipeline-status"):
                        yield Static("● JOB  Chưa chọn", id="health-job", classes="health-item")
                        yield Static("● ENV  Chưa kiểm tra", id="health-env", classes="health-item")
                        yield Static("● VIENEU  Chưa kiểm tra", id="health-tts", classes="health-item")
                        yield Static("● OUTPUT  Chưa render", id="health-output", classes="health-item")
                    with Container(id="pipeline-body"):
                        with Vertical(id="pipeline-left"):
                            yield DataTable(id="pipeline-table", zebra_stripes=False)
                            yield Static(
                                "Nạp ZIP  →  Chạy toàn bộ  →  Video cuối",
                                id="workflow-hint",
                            )
                        with Vertical(id="pipeline-actions"):
                            yield Label("THAO TÁC", classes="section-title")
                            yield Button("Chạy lại", id="rerun-stage")
                            yield Button("Chạy toàn bộ", id="run-full", variant="success")
                            yield Button("Dừng", id="stop", variant="error")

                with Vertical(classes="section", id="output-section"):
                    yield Label("KẾT QUẢ", classes="section-title")
                    yield Static("Chưa có output cho job hiện tại.", id="output-summary")
                    with Container(classes="button-row"):
                        yield Button("Mở video", id="open-video")
                        yield Button("Mở thư mục", id="open-folder")

        with Horizontal(id="log-section"):
            with Vertical(classes="section log-panel", id="error-panel"):
                with Horizontal(classes="log-heading"):
                    yield Label("LỖI", classes="section-title")
                    yield Button("Sao chép", id="copy-errors")
                yield Static("Không có lỗi. Chẩn đoán sẽ lưu lỗi và chi tiết bước thất bại.", id="error-empty", classes="log-empty", markup=False)
                yield SelectableLog(id="error-log", wrap=True, highlight=False, markup=False)
            with Vertical(classes="section log-panel", id="workflow-panel"):
                with Horizontal(classes="log-heading"):
                    yield Label("WORKFLOW", classes="section-title")
                    yield Button("Sao chép", id="copy-workflow")
                yield Static("Chưa chạy tác vụ.", id="workflow-task", markup=False)
                yield ProgressBar(total=100, show_eta=False, id="workflow-progress")
                yield Static("Tiến trình và đầu ra từng bước sẽ hiện ở đây.", id="workflow-empty", classes="log-empty", markup=False)
                yield SelectableLog(id="log", wrap=True, highlight=False, markup=False)

        with Container(id="command-bar"):
            yield Static("Chưa chạy", id="command-status")

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
            step = payload.get("step") or self.active_step
            channel = payload.get("channel") or "stdout"
            self._write_log(f"[{step or 'system'} / {channel}] {payload.get('text', '')}", error=channel == "stderr")
        elif kind == "STEP_STARTED":
            step = payload.get("step")
            self.active_step = step or ""
            self.active_scene = ""
            self._write_log(
                f"START {STEP_NAMES_VI.get(step, step or 'unknown')}"
            )
        elif kind == "STEP_PROGRESS":
            self.active_step = payload.get("step") or self.active_step
            self.active_scene = payload.get("scene_id") or ""
            self._write_log(f"TASK {self.active_step} queued_scene={self.active_scene}")
        elif kind == "STEP_DONE":
            step = payload.get("step")
            self._write_log(
                f"DONE  {STEP_NAMES_VI.get(step, step or 'unknown')}"
            )
        elif kind == "STEP_FAILED":
            step = payload.get("step")
            name = STEP_NAMES_VI.get(step, step or "unknown")
            code = payload.get("error_code") or "UNKNOWN"
            message = payload.get("message") or "Không có thông báo lỗi."
            self._write_log(f"FAIL  {name} [{step}] [{code}] {message}", error=True)
            details = str(payload.get("details") or "").strip()
            if details and details != message:
                self._write_log(details, error=True)
            self._set_log_visible(True)
        elif kind == "PIPELINE_CANCELLED":
            self._write_log("CANCEL Pipeline đã dừng theo yêu cầu.")
        elif kind == "PIPELINE_DONE":
            self._write_log("DONE  Pipeline hoàn tất.")
        self._refresh_view()

    def _write_log(self, text: str, *, error: bool = False) -> None:
        """Route each line to exactly one of the workflow or error logs."""
        rendered = str(text).replace("\r\n", "\n").replace("\r", "\n")
        for line in rendered.split("\n"):
            if line:
                stamped = f"{datetime.now():%H:%M:%S} {line}"
                is_error = error or re.search(
                    r"(?i)(?:\b(?:error|failed|exception|traceback|fatal)\b|^FAIL\b|^✕|\blỗi\b|\bthất bại\b)",
                    line,
                )
                if is_error:
                    self.query_one("#error-log", RichLog).write(stamped)
                    self.query_one("#error-empty", Static).add_class("hidden")
                else:
                    self.query_one("#log", RichLog).write(stamped)
                    self.query_one("#workflow-empty", Static).add_class("hidden")

    def _copy_log(self, selector: str, message: str) -> None:
        text = "\n".join(line.text for line in self.query_one(selector, RichLog).lines)
        if not text:
            self.notify("Chưa có log để sao chép.", severity="warning")
            return
        if self._copy_text(text):
            self.notify(message)

    def _copy_text(self, text: str) -> bool:
        try:
            if os.name == "nt":
                import ctypes
                from ctypes import wintypes

                user32 = ctypes.WinDLL("user32", use_last_error=True)
                kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
                user32.OpenClipboard.argtypes = [wintypes.HWND]
                user32.OpenClipboard.restype = wintypes.BOOL
                user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
                user32.SetClipboardData.restype = wintypes.HANDLE
                kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
                kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
                kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
                kernel32.GlobalLock.restype = ctypes.c_void_p
                kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
                kernel32.GlobalFree.argtypes = [wintypes.HGLOBAL]
                payload = (text + "\0").encode("utf-16-le")
                handle = kernel32.GlobalAlloc(0x0002, len(payload))
                if not handle:
                    raise ctypes.WinError(ctypes.get_last_error())
                locked = kernel32.GlobalLock(handle)
                if not locked:
                    kernel32.GlobalFree(handle)
                    raise ctypes.WinError(ctypes.get_last_error())
                ctypes.memmove(locked, payload, len(payload))
                kernel32.GlobalUnlock(handle)
                if not user32.OpenClipboard(None):
                    kernel32.GlobalFree(handle)
                    raise ctypes.WinError(ctypes.get_last_error())
                try:
                    if not user32.EmptyClipboard() or not user32.SetClipboardData(13, handle):
                        kernel32.GlobalFree(handle)
                        raise ctypes.WinError(ctypes.get_last_error())
                finally:
                    user32.CloseClipboard()
            else:
                self.copy_to_clipboard(text)
        except Exception as exc:
            self.notify(f"Không thể sao chép log: {exc}", severity="error")
            return False
        return True

    def notify(self, message, *, title="", severity="information", timeout=None):
        if severity == "error" and self.is_mounted and self.query("#error-log"):
            self._write_log(f"{title}: {message}" if title else str(message), error=True)
        return super().notify(message, title=title, severity=severity, timeout=timeout)

    def _refresh_jobs(self) -> None:
        select = self.query_one("#job-select", Select)
        jobs = self.controller.available_jobs()
        select.set_options([(name, name) for name in jobs])
        if self.controller.job_name in jobs:
            select.value = self.controller.job_name

    def _select_package_backend(self, path: Path) -> str:
        manifest = detect_job5_manifest(path)
        if manifest is None:
            self._pipeline_mode = "legacy"
            return "legacy"
        self.v2_session.import_archive(path)
        self._pipeline_mode = "v2"
        return "v2"

    def _active_pipeline_rows(self) -> list[dict]:
        if self._pipeline_mode == "v2" and self.v2_session.job is not None:
            return self.v2_session.pipeline_rows()
        return self.controller.pipeline_rows()

    def _active_job_path(self) -> Path | None:
        if self._pipeline_mode == "v2":
            return self.v2_session.job
        return self.controller.job

    def _active_video_path(self) -> Path | None:
        if self._pipeline_mode == "v2":
            return self.v2_session.video_path
        return self.controller.video_path

    def _refresh_view(self) -> None:
        if not self.screen_stack or any(
            not self.screen.query(selector)
            for selector in ("#package-name", "#workflow-task", "#workflow-progress", "#pipeline-table")
        ):
            return
        self._do_refresh()

    def _do_refresh(self) -> None:
        if self._pipeline_mode == "v2" and self.v2_session.job is not None:
            self._do_refresh_v2()
            return
        job = self.controller.job
        archive = self.controller.archive
        pipeline_rows = self.controller.pipeline_rows()
        worker_running = any(row["status"] == RUNNING for row in pipeline_rows)
        package_changed = self.controller.package_changed
        video = self.controller.video_path
        video_ready = self._final_complete()

        package_name = archive.name if archive else (job.name if job else "Chưa chọn package")
        package_path = str(archive.parent) if archive else (
            str(job) if job else "Nạp zodiac-job ZIP để bắt đầu"
        )
        self.query_one("#package-name", Static).update(package_name)
        self.query_one("#package-path", Static).update(package_path)
        self.query_one("#active-job", Static).update(job.name if job else "—")

        job_health_text = (
            "ZIP thay đổi"
            if package_changed
            else (job.name if job else "Chưa chọn")
        )
        self.query_one("#health-job", Static).update(
            self._status_light(
                "JOB",
                job_health_text,
                ok=(job is not None and not package_changed) if job is not None else None,
            )
        )
        self.query_one("#health-output", Static).update(
            self._status_light(
                "OUTPUT",
                "Sẵn sàng" if video_ready else "Chưa render",
                ok=video_ready if job is not None else None,
            )
        )
        self._refresh_health_from_checks()

        running = next((row for row in pipeline_rows if row["status"] == RUNNING), None)
        progress = self.query_one("#workflow-progress", ProgressBar)
        if running:
            scenes = running.get("scenes") or {}
            done = sum(item.get("status") == DONE for item in scenes.values())
            value = done / len(scenes) if scenes else float(running.get("progress") or 0)
            name = STEP_NAMES_VI.get(running["step"], running["step"])
            detail = f" • {done}/{len(scenes)} scene" if scenes else ""
            scene = f" • queued: {self.active_scene}" if self.active_scene and self.active_step == running["step"] else ""
            self.query_one("#workflow-task", Static).update(f"{name}{detail}{scene}")
            progress.update(total=100 if scenes or value > 0 else None, progress=value * 100)
        else:
            self.query_one("#workflow-task", Static).update(self._command_status())
            progress.update(total=100, progress=100 if self.controller.plan.finished else 0)

        self.pipeline_groups = compact_pipeline_rows(pipeline_rows)
        table_key = tuple(
            (
                row["label"],
                row["status"],
                round(float(row["progress"]), 4),
                row["scene_done"],
                row["scene_total"],
            )
            for row in self.pipeline_groups
        )
        if table_key != self._pipeline_table_key:
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
                    "Đang xử lý" if row["status"] == RUNNING and not row["scene_total"] and not percent else f"{percent}%",
                    detail,
                )
            if self.pipeline_groups:
                table.move_cursor(row=min(cursor_row, len(self.pipeline_groups) - 1))
            self._pipeline_table_key = table_key

        self.query_one("#pipeline-summary", Static).update(self._workflow_summary())
        self.query_one("#command-status", Static).update(self._command_status())
        self._refresh_output_summary()

        blocked = job is None or worker_running or package_changed
        self.query_one("#run-full", Button).disabled = blocked
        self.query_one("#run-full", Button).label = (
            "Render lại" if self._final_pipeline_settled() else "Chạy toàn bộ"
        )
        self.query_one("#rerun-stage", Button).disabled = blocked
        self.query_one("#stop", Button).disabled = not worker_running
        self.query_one("#open-video", Button).disabled = not video_ready
        self.query_one("#open-folder", Button).disabled = job is None

        # Never let the operator mutate project/settings while the worker is
        # consuming the same plan. This avoids cross-job event drift and plan
        # invalidation racing a render in progress.
        self.query_one("#pick-zip", Button).disabled = worker_running
        self.query_one("#job-select", Select).disabled = worker_running
        self.query_one("#check", Button).disabled = worker_running
        self.query_one("#install-deps", Button).disabled = worker_running
        self.query_one("#voice-select", Select).disabled = worker_running
        self.query_one("#align-select", Select).disabled = worker_running
        self.query_one("#music-volume", Input).disabled = worker_running
        self.query_one("#music-select", Select).disabled = worker_running
        self.query_one("#clear-music", Button).disabled = worker_running

        # The backend intentionally supports music-only audition before
        # voice.wav exists, so preview must not be gated on voice generation.
        self.query_one("#listen", Button).disabled = (
            worker_running or job is None or self.music_path is None
        )

    def _do_refresh_v2(self) -> None:
        job = self.v2_session.job
        archive = self.v2_session.archive
        rows = self.v2_session.pipeline_rows()
        worker_running = self.v2_session.running
        video = self.v2_session.video_path
        video_ready = self._final_complete()

        package_name = archive.name if archive else (job.name if job else "Chưa chọn package")
        package_path = str(archive.parent) if archive else (
            str(job) if job else "Nạp zodiac-job ZIP để bắt đầu"
        )
        revision = self.v2_session.package_revision
        active_name = job.name if job else "—"
        if revision:
            active_name = f"{active_name} · rev {revision}"

        self.query_one("#package-name", Static).update(package_name)
        self.query_one("#package-path", Static).update(package_path)
        self.query_one("#active-job", Static).update(active_name)
        self.query_one("#health-job", Static).update(
            self._status_light("JOB", active_name, ok=job is not None)
        )
        self.query_one("#health-output", Static).update(
            self._status_light(
                "OUTPUT",
                "Sẵn sàng" if video_ready else "Chưa render",
                ok=video_ready if job is not None else None,
            )
        )
        self._refresh_health_from_checks()

        self.pipeline_groups = rows
        table_key = tuple(
            (
                row["label"],
                row["status"],
                round(float(row["progress"]), 4),
                row.get("detail", ""),
                bool(row.get("reused")),
            )
            for row in rows
        )
        if table_key != self._pipeline_table_key:
            table = self.query_one("#pipeline-table", DataTable)
            cursor_row = table.cursor_coordinate.row if table.row_count else 0
            table.clear()
            for row in rows:
                percent = int(round(float(row["progress"]) * 100))
                table.add_row(
                    row["glyph"],
                    row["label"],
                    status_label(row["status"]),
                    f"{percent}%",
                    row.get("detail", ""),
                )
            if rows:
                table.move_cursor(row=min(cursor_row, len(rows) - 1))
            self._pipeline_table_key = table_key

        self.query_one("#pipeline-summary", Static).update(self._workflow_summary())
        self.query_one("#command-status", Static).update(self._command_status())
        self._refresh_output_summary()

        blocked = job is None or worker_running
        self.query_one("#run-full", Button).disabled = blocked
        self.query_one("#run-full", Button).label = (
            "Kiểm tra lại" if self._final_pipeline_settled() else "Chạy toàn bộ"
        )
        self.query_one("#rerun-stage", Button).disabled = True
        self.query_one("#stop", Button).disabled = True
        self.query_one("#open-video", Button).disabled = not video_ready
        self.query_one("#open-folder", Button).disabled = job is None

        self.query_one("#pick-zip", Button).disabled = worker_running
        self.query_one("#job-select", Select).disabled = worker_running
        self.query_one("#check", Button).disabled = worker_running
        self.query_one("#install-deps", Button).disabled = worker_running
        self.query_one("#voice-select", Select).disabled = worker_running
        self.query_one("#align-select", Select).disabled = worker_running
        self.query_one("#music-volume", Input).disabled = worker_running
        self.query_one("#music-select", Select).disabled = worker_running
        self.query_one("#clear-music", Button).disabled = worker_running
        self.query_one("#listen", Button).disabled = (
            worker_running or job is None or self.music_path is None
        )

    def _command_status(self) -> str:
        if self._pipeline_mode == "v2":
            if self.v2_session.job is None:
                return "Nạp ZIP hoặc chọn job để bắt đầu."
            return self.v2_session.status_text
        if self.controller.job is None:
            return "Nạp ZIP hoặc chọn job để bắt đầu."
        return self.controller.status_text

    def _workflow_summary(self) -> str:
        if self._pipeline_mode == "v2":
            if self.v2_session.job is None:
                return "Nạp ZIP hoặc chọn job để bắt đầu."
            cache_summary = self._v2_artifact_summary()
            if self._final_complete():
                return "Video cuối đã sẵn sàng. " + cache_summary
            for row in self.v2_session.pipeline_rows():
                if row["status"] != DONE:
                    return f"Studio v2 · tiếp theo: {row['label']} · {cache_summary}"
            return "Studio v2 đã hoàn tất."
        if self.controller.job is None:
            return "Nạp ZIP hoặc chọn job để bắt đầu."
        if self._final_complete():
            return "Video cuối đã sẵn sàng. Chạy lại chỉ khi cần render lại output."
        next_step = self.controller.plan.continue_from()
        if next_step:
            return f"Chạy toàn bộ · tiếp theo: {STEP_NAMES_VI.get(next_step, next_step)}"
        return "Chạy toàn bộ để tạo video cuối."

    def _v2_artifact_summary(self) -> str:
        job = self.v2_session.job
        if job is None:
            return ""
        path = job / ".runtime" / "artifacts" / "manifest.json"
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return "Cache chưa có chi tiết scene."
        records = payload.get("artifacts") if isinstance(payload, dict) else None
        if not isinstance(records, dict):
            return "Cache chưa có chi tiết scene."

        def count(artifact_type: str, reused_reason: str, dirty_reason: str) -> str:
            rows = [
                row
                for row in records.values()
                if isinstance(row, dict) and row.get("artifact_type") == artifact_type
            ]
            reused = sum(
                (row.get("provenance") or {}).get("cache_reason") == reused_reason
                for row in rows
            )
            dirty = sum(
                (row.get("provenance") or {}).get("cache_reason") == dirty_reason
                for row in rows
            )
            return f"{reused} dùng lại · {dirty} mới" if rows else "0 scene"

        return (
            "VOICE " + count("voice.scene", "REUSED_APPROVED", "GENERATED_NEW")
            + "  TIMING " + count("timing.scene", "REUSED_SCENE", "ALIGNED_NEW")
            + "  RENDER " + count("render.segment", "REUSED_SEGMENT", "RENDERED_NEW")
        )

    def _final_pipeline_settled(self) -> bool:
        if self._pipeline_mode == "v2":
            controller = self.v2_session.controller
            return bool(
                controller
                and controller.state.steps["OUTPUT"].status == DONE
            )
        return bool(
            self.controller.job
            and not self.controller.package_changed
            and self.controller.plan.status(RENDER_VIDEO) in COMPLETE
            and self.controller.plan.status(MIX_MUSIC) in COMPLETE
        )

    def _final_complete(self) -> bool:
        video = self._active_video_path()
        return bool(
            self._final_pipeline_settled()
            and video
            and video.is_file()
        )

    @staticmethod
    def _status_light(label: str, text: str, *, ok: bool | None) -> str:
        if ok is True:
            dot = "[bold green]●[/]"
        elif ok is False:
            dot = "[bold red]●[/]"
        else:
            dot = "[dim]●[/]"
        return f"{dot} {label}  {text}"

    def _refresh_health_from_checks(self) -> None:
        checks = self.controller.preflight_checks
        if not checks:
            self.query_one("#health-env", Static).update(
                self._status_light("ENV", "Chưa kiểm tra", ok=None)
            )
            self.query_one("#health-tts", Static).update(
                self._status_light("VIENEU", "Chưa kiểm tra", ok=None)
            )
            return
        vieneu = next((check for check in checks if check.code == "VIENEU"), None)
        env_checks = [check for check in checks if check.code != "VIENEU"]
        env_ok = bool(env_checks and all(check.ok for check in env_checks))
        tts_ok = bool(vieneu and vieneu.ok)
        self.query_one("#health-env", Static).update(
            self._status_light("ENV", "Sẵn sàng" if env_ok else "Cần xử lý", ok=env_ok)
        )
        self.query_one("#health-tts", Static).update(
            self._status_light("VIENEU", "Đã kết nối" if tts_ok else "Chưa kết nối", ok=tts_ok)
        )

    def _refresh_output_summary(self) -> None:
        if self._pipeline_mode == "v2":
            job = self.v2_session.job
            if job is None:
                self.query_one("#output-summary", Static).update("Chưa có output cho job hiện tại.")
                return
            controller = self.v2_session.controller
            voice = job / "voice.wav"
            timing = job / ".runtime" / "timing.json"
            video = self.v2_session.video_path
            parts = [
                "Voice ✓" if controller and controller.state.steps["VOICE"].status == DONE and voice.is_file() else "Voice ○",
                "Timing ✓" if controller and controller.state.steps["TIMING"].status == DONE and timing.is_file() else "Timing ○",
            ]
            if video and video.is_file() and self._final_complete():
                size_mb = video.stat().st_size / (1024 * 1024)
                parts.append(f"Video ✓ {size_mb:.1f} MB")
            else:
                parts.append("Video ○")
            self.query_one("#output-summary", Static).update("   ".join(parts))
            return
        if self.controller.job is None:
            self.query_one("#output-summary", Static).update("Chưa có output cho job hiện tại.")
            return
        job = self.controller.job
        video = self.controller.video_path
        voice = job / "voice.wav"
        timing = job / ".runtime" / "timing.json"
        voice_current = (
            voice.is_file()
            and self.controller.plan.status(CONCAT_VOICE) in COMPLETE
        )
        timing_current = (
            timing.is_file()
            and self.controller.plan.status(ALIGN_TIMING) in COMPLETE
        )
        parts = [
            (
                "Voice ✓"
                if voice_current
                else ("Voice cũ · cần cập nhật" if voice.is_file() else "Voice ○")
            ),
            (
                "Timing ✓"
                if timing_current
                else ("Timing cũ · cần cập nhật" if timing.is_file() else "Timing ○")
            ),
        ]
        if video and video.is_file() and self._final_complete():
            size_mb = video.stat().st_size / (1024 * 1024)
            parts.append(f"Video ✓ {size_mb:.1f} MB")
        elif video and video.is_file():
            parts.append("Video cũ · cần render lại")
        else:
            parts.append("Video ○")
        self.query_one("#output-summary", Static).update("   ".join(parts))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id
        if button_id == "copy-errors":
            self._copy_log("#error-log", "Đã sao chép log lỗi.")
        elif button_id == "copy-workflow":
            self._copy_log("#log", "Đã sao chép log workflow.")
        elif button_id == "pick-zip":
            self.action_pick_zip()
        elif button_id == "clear-music":
            self.music_path = None
            self.query_one("#music-select", Select).value = Select.NULL
            self._save_music_path()
            if self._pipeline_mode == "legacy" and self.controller.job:
                self.controller.apply_change("music")
            self._refresh_view()
        elif button_id == "listen":
            self._start_audio_preview()
        elif button_id == "check":
            self._check_environment()
        elif button_id == "install-deps":
            self._install_dependencies()
        elif button_id == "run-full":
            self.action_run_full()
        elif button_id == "rerun-stage":
            self._rerun_selected_stage()
        elif button_id == "toggle-log":
            self.action_toggle_log()
        elif button_id == "stop":
            self.action_stop()
        elif button_id == "open-video":
            self._open_path(self._active_video_path())
        elif button_id == "open-folder":
            job = self._active_job_path()
            self._open_path(job / "out" if job else None)

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "job-select" and event.value not in (None, Select.NULL):
            if self.controller.worker is not None and self.controller.worker.is_alive():
                self.notify("Pipeline đang chạy; hãy dừng trước khi đổi job.", severity="warning")
                return
            name = str(event.value)
            if name in self.controller.available_jobs():
                self._pipeline_mode = "legacy"
                self.controller.use_job(self.controller.job_path(name))
                self.controller.select_archive(None)
                self.controller.status_text = f"Đã chọn job: {name}"
                self._refresh_view()
                self._check_environment()
        elif event.select.id == "music-select":
            if self.controller.worker is not None and self.controller.worker.is_alive():
                return
            path = event.value
            self.music_path = path if path not in (None, Select.NULL) else None
            self._save_music_path()
            if self._pipeline_mode == "legacy" and self.controller.job:
                self.controller.apply_change("music")
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
            if self.controller.worker is not None and self.controller.worker.is_alive():
                self.call_from_thread(
                    self.notify,
                    "Pipeline đang chạy; hãy dừng trước khi đổi package.",
                    severity="warning",
                )
                return
            if self._select_package_backend(path) == "v2":
                self.call_from_thread(self._after_v2_project_change)
                return
            self.controller.select_archive(path)
            destination = self.controller.archive_destination(path)
            if destination.exists():
                self.controller.use_job(destination)
                self.controller.select_archive(path)
                if self.controller.package_changed:
                    if self.controller.is_versioned_patch_archive(path):
                        if not self.controller.accept_package_conflict("import"):
                            raise RuntimeError("Không thể nhập patch đã chọn.")
                        self.call_from_thread(self._after_project_change)
                        return
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

    def _after_v2_project_change(self) -> None:
        self._pipeline_table_key = None
        self._refresh_view()
        name = self.v2_session.job_name or "job@5"
        revision = self.v2_session.package_revision
        suffix = f" rev {revision}" if revision else ""
        self.notify(f"Đã nạp {name}{suffix}")

    def _show_package_conflict(self) -> None:
        self.controller.status_text = "Package đã thay đổi; cần chọn cách xử lý."
        self._refresh_view()
        self.push_screen(
            ChoiceDialog(
                title="Package đã thay đổi",
                message=(
                    "ZIP đang chọn khác với package đã nhập cho job này. "
                    "Nhập lại sẽ validate trước, cập nhật creative payload và giữ "
                    "voice/timing cache còn hợp lệ."
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

    def _music_options(self) -> list[tuple[str, Path]]:
        music_dir = ROOT / "assets" / "music"
        if not music_dir.is_dir():
            return []
        return sorted(
            (p.stem, p)
            for p in music_dir.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED_MUSIC
        )

    def _saved_music_path(self) -> Path | None:
        config = self.workspace_root / "tui-audio.json"
        if not config.is_file():
            return None
        raw = config.read_text(encoding="utf-8").strip()
        path = Path(raw) if raw else None
        return path if path is not None and path.is_file() else None

    def _save_music_path(self) -> None:
        config = self.workspace_root / "tui-audio.json"
        config.parent.mkdir(parents=True, exist_ok=True)
        config.write_text(str(self.music_path) if self.music_path else "", encoding="utf-8")

    def _pipeline_settings(self) -> tuple[str, str, float]:
        voice_value = self.query_one("#voice-select", Select).value
        voice = preferred_voice(self.voice_choices) if voice_value == Select.NULL else str(voice_value)
        align_value = self.query_one("#align-select", Select).value
        align_model = ALIGN_MODEL_DEFAULT if align_value == Select.NULL else str(align_value)
        raw_volume = self.query_one("#music-volume", Input).value.strip() or "100"
        volume = max(0.0, min(100.0, float(raw_volume))) / 100.0
        return voice, align_model, volume

    def action_run_full(self) -> None:
        """Run or resume the active backend straight through to final output."""
        if self._pipeline_mode == "v2":
            if self.v2_session.job is None:
                self.notify("Hãy nạp ZIP hoặc chọn job trước.", severity="warning")
                return
            self._run_v2_full()
            return
        if self.controller.job is None:
            self.notify("Hãy nạp ZIP hoặc chọn job trước.", severity="warning")
            return
        rerun = RENDER_VIDEO if self._final_pipeline_settled() else None
        self._start_pipeline(rerun=rerun)

    @work(thread=True, group="v2-pipeline", exclusive=True)
    def _run_v2_full(self) -> None:
        try:
            voice, align_model, volume = self.call_from_thread(self._pipeline_settings)
            config = ExecutorConfig(
                voice_profile=voice,
                tts_settings={
                    "mode": "v3turbo",
                    "vieneu_url": TTS_URL,
                    "tts_root": TTS_ROOT,
                    "scene_gap_ms": 0.0,
                },
                tts_engine_version="vieneu-v3turbo@local-v1",
                aligner_settings={
                    "model": align_model,
                    "device": "cpu",
                    "compute_type": "int8",
                    "scene_gap_ms": 0.0,
                    "sentence_pause_ms": 0.0,
                },
                aligner_version="faster-whisper@local-v1",
                compiler_version="1.0.0",
                renderer_version="2.0.0",
                renderer_hash="zodiac-renderer@2.0.0",
                music_path=Path(self.music_path) if self.music_path is not None else None,
                mix_settings={"volume": volume},
            )
            self.v2_session.run(config)
            self.call_from_thread(self._write_log, "DONE  Studio v2 hoàn tất.")
            self.call_from_thread(self.notify, "Studio v2 hoàn tất.")
        except ControlPlaneError as exc:
            self.call_from_thread(
                self._write_log,
                f"FAIL  {exc.stage} [{exc.code}] {exc.message}",
            )
            if exc.detail:
                self.call_from_thread(self._write_log, str(exc.detail))
            self.call_from_thread(self._set_log_visible, True)
            self.call_from_thread(self.notify, exc.message, severity="error")
        except Exception as exc:
            self.call_from_thread(self._set_log_visible, True)
            self.call_from_thread(self._write_log, f"Studio v2 lỗi: {exc}")
            self.call_from_thread(self.notify, str(exc), severity="error")
        finally:
            self.call_from_thread(self._refresh_view)

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
            self.call_from_thread(self._set_log_visible, True)
            self.controller.install_dependencies(
                log_callback=lambda line: self.call_from_thread(self._write_log, line)
            )
            severity = (
                "information"
                if self.controller.status_text.startswith("Đã cài")
                else "error"
            )
            self.call_from_thread(
                self.notify,
                self.controller.status_text,
                severity=severity,
            )
            self.call_from_thread(self._refresh_view)
        except Exception as exc:
            self.call_from_thread(self._set_log_visible, True)
            self.call_from_thread(self._write_log, f"Cài dependency lỗi: {exc}")
            self.call_from_thread(self.notify, str(exc), severity="error")

    def _start_audio_preview(self) -> None:
        job = self._active_job_path()
        music = self.music_path
        if job is None or music is None:
            self.notify("Chọn job và nhạc nền trước.", severity="warning")
            return
        try:
            _, _, volume = self._pipeline_settings()
        except ValueError:
            self.notify("Âm lượng phải là số từ 0 đến 100.", severity="error")
            return
        self._run_audio_preview(job, Path(music), volume)

    @work(thread=True, group="audio-preview", exclusive=True)
    def _run_audio_preview(self, job: Path, music: Path, volume: float) -> None:
        try:
            captured = io.StringIO()

            def log_child(line: str, *, channel: str = "stdout") -> None:
                self.call_from_thread(self._write_log, line)

            with observe_subprocess_output(log_child), contextlib.redirect_stdout(
                captured
            ), contextlib.redirect_stderr(captured):
                preview = build_audio_preview(
                    job,
                    music,
                    volume=volume,
                )

            output = captured.getvalue().strip()
            if output:
                self.call_from_thread(self._write_log, output)
            if not preview.is_file():
                raise RuntimeError("Không tìm thấy tệp nghe thử.")

            self.call_from_thread(self._play_audio_file, preview)
            self.call_from_thread(
                self.notify,
                "Đang phát bản nghe thử 10 giây.",
            )
        except Exception as exc:
            self.call_from_thread(self._set_log_visible, True)
            self.call_from_thread(self._write_log, f"Nghe thử lỗi: {exc}")
            self.call_from_thread(self.notify, str(exc), severity="error")

    def _play_audio_file(self, path: Path) -> None:
        """Play preview reliably on Windows without relying on file association."""
        if os.name == "nt":
            import winsound

            winsound.PlaySound(
                str(path.resolve()),
                winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT,
            )
            return
        self._open_path(path)

    def action_focus_log(self) -> None:
        self.query_one("#log", RichLog).focus()

    def action_toggle_log(self) -> None:
        self.action_focus_log()

    def _set_log_visible(self, visible: bool) -> None:
        self.log_visible = True

    def action_stop(self) -> None:
        if self._pipeline_mode == "v2":
            self.notify("Studio v2 chưa hỗ trợ hủy giữa stage; nút Dừng bị khóa khi chạy v2.", severity="warning")
            return
        if self.controller.worker is not None:
            self.controller.cancel()
        self._refresh_view()

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


def main() -> int:
    ZodiacTui().run()
    return 0
