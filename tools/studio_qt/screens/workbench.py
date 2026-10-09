from __future__ import annotations

from pathlib import Path
from datetime import datetime
from PySide6.QtGui import QColor, QSyntaxHighlighter, QTextCharFormat

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from tools.studio_qt.widgets.stage_rail import StageRail

STAGE_TITLES = {
    "PACKAGE": "Gói",
    "VOICE": "Giọng",
    "TIMING": "Timing",
    "PLAN": "Kế hoạch",
    "RENDER": "Render",
    "AUDIO": "Âm thanh",
    "OUTPUT": "Đầu ra",
}


def _surface() -> QFrame:
    return QFrame(objectName="surface")


class ConsoleHighlighter(QSyntaxHighlighter):
    """Highlight source-reported severity, not inferred success."""
    def highlightBlock(self, text: str) -> None:
        upper = text.upper()
        level = None
        if any(tag in upper for tag in ("[ERROR]", "[FAILED]")):
            level = "#E08A82"
        elif any(tag in upper for tag in ("[WARNING]", "[WARN]", "[CANCELLED]")):
            level = "#D7B36A"
        elif "[DONE]" in upper or "[SUCCESS]" in upper:
            level = "#86B89A"
        elif "[RUNNING]" in upper or "[START]" in upper:
            level = "#C6A76A"
        if level:
            fmt = QTextCharFormat()
            fmt.setForeground(QColor(level))
            self.setFormat(0, len(text), fmt)
        sep = text.find(" [")
        if sep > 0:
            fmt = QTextCharFormat()
            fmt.setForeground(QColor("#84908B"))
            self.setFormat(0, sep, fmt)


class WorkbenchScreen(QWidget):
    home_requested = Signal()
    import_requested = Signal()
    continue_requested = Signal()
    run_all_requested = Signal()
    cancel_requested = Signal()
    rerun_requested = Signal(str)
    stage_selected = Signal(str)
    output_requested = Signal(str)
    logs_toggled = Signal(bool)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        root = QVBoxLayout(self)
        root.setContentsMargins(16, 12, 16, 12)
        root.setSpacing(8)

        header = QHBoxLayout()
        header.setSpacing(8)
        self.home_button = QPushButton("←  Danh sách job")
        self.home_button.clicked.connect(self.home_requested)
        header.addWidget(self.home_button)
        identity = QVBoxLayout()
        self.job_title = QLabel("Chưa chọn job", objectName="pageTitle")
        self.job_title.setMinimumWidth(90)
        self.job_title.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.job_title.setWordWrap(False)
        self.job_revision = QLabel("", objectName="muted")
        identity.addWidget(self.job_title)
        identity.addWidget(self.job_revision)
        header.addLayout(identity, 1)
        self.more_button = QPushButton("Tác vụ khác ▾")
        self.more_button.setAccessibleName("Tác vụ khác")
        header.addWidget(self.more_button)
        root.addLayout(header)

        self._measured_progress: dict[str, tuple[int, int, str, str]] = {}
        self.stage_rail = StageRail()
        self.stage_rail.stage_selected.connect(self.stage_selected)
        self.stage_rail.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        self.stage_scroll = QScrollArea()
        self.stage_scroll.setObjectName("stageScroll")
        self.stage_scroll.setWidgetResizable(True)
        self.stage_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.stage_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.stage_scroll.setWidget(self.stage_rail)
        self.stage_scroll.setMinimumWidth(205)
        self.stage_scroll.setMaximumWidth(239)

        current = QWidget(objectName="workspaceMain")
        current_layout = QVBoxLayout(current)
        current_layout.setContentsMargins(18, 12, 12, 8)
        current_layout.setSpacing(8)
        current_layout.addWidget(QLabel("GIÁM SÁT QUY TRÌNH · TRẠNG THÁI THỰC", objectName="eyebrow"))
        self.status_label = QLabel("Sẵn sàng", objectName="status")
        self.status_label.setMinimumWidth(102)
        self.status_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.environment_status = QLabel("Môi trường chưa kiểm tra", objectName="status")
        self.environment_status.setMinimumWidth(170)
        self.environment_status.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.pipeline_summary = QLabel("Chưa có bước nào", objectName="sectionTitle")
        current_layout.addWidget(self.pipeline_summary)
        pipeline_progress_row = QHBoxLayout()
        self.pipeline_progress_label = QLabel("0% theo số bước · không phải thời gian", objectName="muted")
        self.pipeline_progress_label.setAccessibleName("Tiến độ tổng quy trình")
        pipeline_progress_row.addWidget(self.pipeline_progress_label)
        pipeline_progress_row.addStretch(1)
        current_layout.addLayout(pipeline_progress_row)
        self.pipeline_progress_bar = QProgressBar()
        self.pipeline_progress_bar.setObjectName("pipelineProgress")
        self.pipeline_progress_bar.setRange(0, 100)
        self.pipeline_progress_bar.setValue(0)
        self.pipeline_progress_bar.setTextVisible(False)
        self.pipeline_progress_bar.setAccessibleName("Tiến độ tổng theo số bước đã hoàn tất")
        current_layout.addWidget(self.pipeline_progress_bar)
        status_row = QHBoxLayout()
        status_row.addWidget(self.status_label)
        status_row.addWidget(self.environment_status)
        status_row.addStretch(1)
        current_layout.addLayout(status_row)
        self.pipeline_detail = QLabel("Trạng thái các bước sẽ hiện tại đây.", objectName="muted")
        self.pipeline_detail.setWordWrap(True)
        current_layout.addWidget(self.pipeline_detail)
        self.output_summary = QLabel("Chưa có video đầu ra", objectName="muted")
        self.output_summary.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        current_layout.addWidget(self.output_summary)
        overview_divider = QFrame(objectName="workspaceDivider")
        overview_divider.setFrameShape(QFrame.Shape.HLine)
        current_layout.addWidget(overview_divider)
        current_layout.addWidget(QLabel("BƯỚC ĐANG XEM", objectName="eyebrow"))
        self.active_title = QLabel("Chọn một bước", objectName="sectionTitle")
        current_layout.addWidget(self.active_title)
        self.active_detail = QLabel("Trạng thái và hoạt động mới nhất sẽ hiện ở đây.", objectName="muted")
        self.active_detail.setWordWrap(True)
        current_layout.addWidget(self.active_detail)
        self.active_activity = QLabel("", objectName="activeActivity")
        self.active_activity.setWordWrap(True)
        self.active_activity.setVisible(False)
        current_layout.addWidget(self.active_activity)
        self.progress_text = QLabel("Sẵn sàng")
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        current_layout.addWidget(self.progress_text)
        current_layout.addWidget(self.progress_bar)
        self.latest_event = QLabel("Chưa có hoạt động mới.", objectName="muted")
        self.latest_event.setWordWrap(True)
        current_layout.addWidget(self.latest_event)
        step_divider = QFrame(objectName="workspaceDivider")
        step_divider.setFrameShape(QFrame.Shape.HLine)
        current_layout.addWidget(step_divider)
        log_row = QHBoxLayout()
        log_row.addWidget(QLabel("LIVE CONSOLE", objectName="consoleHeading"))
        self.log_count = QLabel("0 dòng", objectName="muted")
        log_row.addWidget(self.log_count)
        log_row.addStretch(1)
        self.log_filter = QComboBox()
        self.log_filter.setObjectName("logFilter")
        self.log_filter.setAccessibleName("Lọc nhật ký theo mức độ")
        for label, value in (("Tất cả", "all"), ("Lỗi", "error"), ("Cảnh báo", "warning"), ("Trạng thái", "state"), ("stderr", "stderr")):
            self.log_filter.addItem(label, value)
        log_row.addWidget(self.log_filter)
        self.stage_log_filter = QComboBox()
        self.stage_log_filter.setObjectName("stageLogFilter")
        self.stage_log_filter.addItem("Mọi bước", "all")
        for code, label in STAGE_TITLES.items():
            self.stage_log_filter.addItem(label, code)
        log_row.addWidget(self.stage_log_filter)
        self.log_copy_button = QPushButton("Sao chép toàn bộ")
        self.log_copy_button.setToolTip("Sao chép toàn bộ nhật ký đã lưu trên đĩa")
        self.log_copy_button.clicked.connect(self._copy_log)
        log_row.addWidget(self.log_copy_button)
        self.log_toggle = QPushButton("Ẩn nhật ký")
        self.log_toggle.setObjectName("logToggle")
        self.log_toggle.setCheckable(True)
        self.log_toggle.setChecked(True)
        self.log_toggle.setToolTip("Hiện/ẩn nhật ký trong tổng quan (Ctrl+L)")
        self.log_toggle.toggled.connect(self._toggle_logs)
        log_row.addWidget(self.log_toggle)
        current_layout.addLayout(log_row)
        self.log_view = QPlainTextEdit(objectName="activityLog")
        self.log_view.setReadOnly(True)
        self.log_view.setMaximumBlockCount(3000)
        self.log_view.setMinimumHeight(280)
        self.log_view.setToolTip("Xem 3.000 dòng gần nhất; tất cả dòng được lưu trong studio-gui.log")
        self._highlighter = ConsoleHighlighter(self.log_view.document())
        self._records: list[str] = []
        self._visible_line_cap = 3000
        self._total_lines = 0
        self.log_filter.currentIndexChanged.connect(self._redraw_log)
        self.stage_log_filter.currentIndexChanged.connect(self._redraw_log)
        self.log_view.setVisible(True)
        current_layout.addWidget(self.log_view, 2)
        self._log_file: Path | None = None

        # Flat inspector/action strip: no third bordered card competing with console.
        self.detail_title = QLabel("Chưa chọn", objectName="detailSubheading")
        self.detail_body = QLabel("Chọn một bước để xem trạng thái và đầu ra liên quan.", objectName="muted")
        self.detail_body.setWordWrap(True)
        self.output_path_label = QLabel("", objectName="outputPathFlat")
        self.output_path_label.setWordWrap(True)
        self.output_path_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.rerun_button = QPushButton("Chạy lại bước")
        self.rerun_button.setEnabled(False)
        self.rerun_button.clicked.connect(lambda: self.rerun_requested.emit(self.stage_rail.selected_step or ""))
        self.media_button = QPushButton("Mở Media / Xem đầu ra  →")
        self.media_button.setObjectName("primary")
        self.media_button.setEnabled(False)
        self.media_button.setToolTip("Xem video, ảnh, âm thanh và tài liệu")
        self.media_button.clicked.connect(lambda: self.output_requested.emit("media"))

        inspector_row = QHBoxLayout()
        inspector_row.setSpacing(10)
        inspector_row.addWidget(QLabel("CHI TIẾT BƯỚC", objectName="eyebrow"))
        inspector_row.addWidget(self.detail_title)
        inspector_row.addStretch(1)
        inspector_row.addWidget(self.rerun_button)
        inspector_row.addWidget(self.media_button)
        current_layout.insertLayout(current_layout.indexOf(self.log_view), inspector_row)
        current_layout.insertWidget(current_layout.indexOf(self.log_view), self.detail_body)
        current_layout.insertWidget(current_layout.indexOf(self.log_view), self.output_path_label)

        workspace = QHBoxLayout()
        workspace.setSpacing(0)
        workspace.addWidget(self.stage_scroll)
        divider = QFrame(objectName="workspaceVerticalDivider")
        divider.setFrameShape(QFrame.Shape.VLine)
        workspace.addWidget(divider)
        workspace.addWidget(current, 1)
        root.addLayout(workspace, 1)

        footer = QHBoxLayout()
        footer.addStretch(1)
        self.continue_button = QPushButton("Tiếp tục")
        self.continue_button.setObjectName("primary")
        self.continue_button.setToolTip("Tiếp tục từ bước chưa hoàn tất (Ctrl+R)")
        self.continue_button.clicked.connect(self.continue_requested)
        footer.addWidget(self.continue_button)
        self.run_all_button = QPushButton("Chạy toàn bộ")
        self.run_all_button.setToolTip("Chạy lại từ đầu (Ctrl+Shift+R)")
        self.run_all_button.clicked.connect(self.run_all_requested)
        footer.addWidget(self.run_all_button)
        self.cancel_button = QPushButton("Dừng")
        self.cancel_button.setObjectName("danger")
        self.cancel_button.setToolTip("Yêu cầu dừng an toàn sau bước đang chạy")
        self.cancel_button.clicked.connect(self.cancel_requested)
        self.cancel_button.setVisible(False)
        footer.addWidget(self.cancel_button)
        root.addLayout(footer)

    def set_job(self, name: str, *, revision: str | None, mode: str, rows: list[dict]) -> None:
        self._full_job_title = name
        self.job_title.setToolTip(name)
        self.job_title.setAccessibleName(name)
        self._elide_job_title()
        self.job_revision.setText(f"Job@5 · revision {revision}" if mode == "job5" and revision else mode)
        self.set_rows(rows)

    def set_rows(self, rows: list[dict]) -> None:
        self.stage_rail.set_rows(rows)
        statuses = [str(row.get("status", "PENDING")) for row in rows]
        total = len(statuses)
        done = statuses.count("DONE")
        failed = statuses.count("FAILED")
        running = statuses.count("RUNNING")
        pending = statuses.count("PENDING")
        cancelled = statuses.count("CANCELLED")
        skipped = statuses.count("SKIPPED")
        self.pipeline_summary.setText(f"{done}/{total} bước hoàn tất" if total else "Chưa có bước nào")
        completed = done + skipped
        fraction = round(completed * 100 / total) if total else 0
        self.pipeline_progress_bar.setValue(fraction)
        self.pipeline_progress_label.setText(
            f"{fraction}% theo số bước hoàn tất"
            + (f" (gồm {skipped} bỏ qua)" if skipped else "")
            + " · không ước lượng thời gian"
        )
        self.pipeline_progress_bar.setToolTip(
            f"{completed}/{total} bước kết thúc; {done} hoàn tất, {skipped} bỏ qua."
            " Tỷ lệ này không dự đoán thời gian hoàn tất."
        )
        counts = (
            (failed, "bước cần xử lý"),
            (running, "đang chạy"),
            (pending, "đang chờ"),
            (cancelled, "đã dừng"),
            (skipped, "bỏ qua"),
        )
        details = [f"{count} {label}" for count, label in counts if count]
        self.pipeline_detail.setText(" · ".join(details) if details else "Không còn bước chờ hoặc lỗi")
        if failed:
            status, severity = "! Cần xử lý", "error"
        elif running:
            status, severity = "● Đang chạy", "warning"
        elif total and done + skipped == total:
            status, severity = "✓ Hoàn tất", "success"
        elif total:
            status, severity = "◷ Còn việc", "warning"
        else:
            status, severity = "Sẵn sàng", ""
        self.status_label.setText(status)
        self.status_label.setProperty("severity", severity)
        self.status_label.style().unpolish(self.status_label)
        self.status_label.style().polish(self.status_label)
        self.status_label.setAccessibleName(f"Trạng thái công việc: {status}")

    def set_active_stage(self, step: str, row: dict, *, percent: float | None = None) -> None:
        self.stage_rail.select_step(step)
        self.active_title.setText(STAGE_TITLES.get(step, step))
        detail = row.get("message") or row.get("detail") or row.get("status", "")
        self.active_detail.setText(str(detail))
        status = str(row.get("status", ""))
        self.progress_bar.setVisible(row.get("status") == "RUNNING")
        state_text = {
            "DONE": "Hoàn tất",
            "RUNNING": "Đang chạy",
            "FAILED": "Cần xử lý",
            "CANCELLED": "Đã dừng",
            "SKIPPED": "Đã bỏ qua",
            "PENDING": "Đang chờ",
        }.get(status, "Sẵn sàng")
        activity = self.stage_rail.activities.get(step) if status == "RUNNING" else ""
        if activity:
            self.active_activity.setText("Đã ghi nhận: " + self.stage_rail._shorten(activity, 112))
            self.active_activity.setToolTip(activity)
            self.active_activity.setVisible(True)
        else:
            self.active_activity.setVisible(False)

        unit_progress = self._measured_progress.get(step) if status == "RUNNING" else None
        if percent is None and unit_progress is not None:
            count, total, _unit, _label = unit_progress
            if total > 0:
                percent = count / total
        measured = (
            percent is not None and isinstance(percent, (float, int))
            and 0.0 <= float(percent) <= 1.0
        )
        # An indeterminate QProgressBar looks like a measurable progress
        # indication but provides no useful information. Show it only when
        # the runner really supplies a numerical fraction.
        self.progress_bar.setVisible(status == "RUNNING" and measured)
        if status == "RUNNING" and measured:
            self.progress_bar.setRange(0, 100)
            self.progress_bar.setValue(round(float(percent) * 100))
            progress_info = (
                f" · {unit_progress[0]}/{unit_progress[1]} {unit_progress[2]} đã xử lý"
                if unit_progress else ""
            )
            self.progress_text.setText(
                f"Đang thực hiện: {STAGE_TITLES.get(step, step)} · {round(float(percent)*100)}%"
                + progress_info
            )
        elif status == "RUNNING":
            self.progress_bar.setRange(0, 100)
            self.progress_bar.setValue(0)
            self.progress_text.setText(
                f"Đang thực hiện: {STAGE_TITLES.get(step, step)} · chưa có % đo được"
            )
        else:
            self.progress_bar.setVisible(False)
            self.progress_text.setText(state_text)
        self.detail_title.setText(STAGE_TITLES.get(step, step))
        self.detail_body.setText(str(row.get("message") or row.get("detail") or row.get("status", "")))
        self.rerun_button.setEnabled(step != "PACKAGE" and row.get("status") != "RUNNING")

    def reset_measured_progress(self) -> None:
        self._measured_progress.clear()
        self.stage_rail.reset_progress()

    def set_measured_progress(self, stage: str, completed: int, total: int,
                              unit: str, label: str) -> None:
        """Only completed real work units supplied by tqdm, never synthetic %."""
        if stage not in self.stage_rail.buttons:
            return
        if total <= 0:
            self._measured_progress.pop(stage, None)
            self.stage_rail.reset_progress(stage)
            return
        if completed < 0 or completed > total:
            return
        old = self._measured_progress.get(stage)
        if old and old[1] == total and completed < old[0]:
            return
        self._measured_progress[stage] = (completed, total, unit, label)
        self.stage_rail.set_progress(stage, completed, total, unit)
        row = self.stage_rail.rows.get(stage, {})
        if self.stage_rail.selected_step == stage and row.get("status") == "RUNNING":
            self.set_active_stage(stage, row, percent=completed / total)

    def set_stage_activity(self, stage: str | None, text: str) -> None:
        """Attach observed output to its stage without guessing a percentage."""
        if stage not in self.stage_rail.buttons:
            return
        self.stage_rail.set_activity(stage, text)
        if stage == self.stage_rail.selected_step and self.stage_rail.rows.get(stage, {}).get("status") == "RUNNING":
            self.active_activity.setText("Đã ghi nhận: " + self.stage_rail._shorten(text, 112))
            self.active_activity.setToolTip(text)
            self.active_activity.setVisible(True)

    def set_running(self, running: bool, *, busy: bool = False) -> None:
        enabled = not running and not busy
        self.continue_button.setEnabled(enabled)
        self.run_all_button.setEnabled(enabled)
        self.cancel_button.setVisible(running)
        self.cancel_button.setEnabled(running)
        self.rerun_button.setEnabled(enabled and self.stage_rail.selected_step not in (None, "PACKAGE"))

    def set_environment_progress(self, component: str, finished: int) -> None:
        label = f"Đang kiểm tra · {finished} mục"
        self.environment_status.setText(label)
        self.environment_status.setToolTip(f"Đang kiểm tra {component}. Các kết quả đã hoàn thành có trong Live Console.")
        self.environment_status.setProperty("severity", "warning")
        self.environment_status.style().unpolish(self.environment_status)
        self.environment_status.style().polish(self.environment_status)

    def set_environment_state(self, ready: bool | None, detail: str = "", *, completed: int | None = None,
                              failed: int = 0) -> None:
        if completed is None:
            label = "Môi trường sẵn sàng" if ready else "Môi trường cần kiểm tra" if ready is False else "Môi trường chưa kiểm tra"
        elif ready:
            label = f"Môi trường: {completed}/{completed} PASS"
        else:
            label = f"Môi trường: {failed}/{completed} lỗi"
        self.environment_status.setText(label)
        self.environment_status.setToolTip(detail or label)
        self.environment_status.setProperty("severity", "success" if ready else "error" if ready is False else "")
        self.environment_status.style().unpolish(self.environment_status)
        self.environment_status.style().polish(self.environment_status)

    @staticmethod
    def _format_entry(text: str, channel: str, stage: str | None) -> str:
        timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        step = f"[{stage}]" if stage else "[JOB]"
        return f"{timestamp} {step} [{channel.upper()}] {text}"

    def set_log_file(self, location: Path) -> None:
        """Load last visible lines; full append-only log lives on disk."""
        self._log_file = Path(location)
        self._records = []
        self._total_lines = 0
        try:
            if self._log_file.is_file():
                from collections import deque
                with self._log_file.open("r", encoding="utf-8", errors="replace") as stream:
                    tail = deque(maxlen=self._visible_line_cap)
                    for line in stream:
                        self._total_lines += 1
                        tail.append(line)
                    self._records = [line.rstrip("\r\n") for line in tail]
                if self._records:
                    self.latest_event.setText(self._records[-1])
        except OSError as exc:
            self.latest_event.setText(f"Không đọc được nhật ký: {exc}")
        self._redraw_log()

    def append_activity(self, text: str, *, channel: str = "info", stage: str | None = None) -> None:
        """Each received line gets one source, job step and local timestamp."""
        for raw in str(text).splitlines() or [""]:
            if not raw.strip():
                continue
            entry = self._format_entry(raw, channel, stage)
            self.latest_event.setText(entry)
            self._records.append(entry)
            self._total_lines += 1
            if len(self._records) > self._visible_line_cap:
                del self._records[:len(self._records) - self._visible_line_cap]
            if self._log_file is not None:
                try:
                    self._log_file.parent.mkdir(parents=True, exist_ok=True)
                    with self._log_file.open("a", encoding="utf-8", newline="\n") as stream:
                        stream.write(entry + "\n")
                except OSError as exc:
                    self.latest_event.setToolTip(f"Không lưu được nhật ký: {exc}")
            if self._matches_filter(entry):
                self.log_view.appendPlainText(entry)
        self.log_count.setText(f"{len(self._records)}/{self._total_lines} dòng gần nhất")

    def _matches_filter(self, entry: str) -> bool:
        level = self.log_filter.currentData()
        upper = entry.upper()
        if level == "error" and not any(tag in upper for tag in ("[ERROR]", "[FAILED]")):
            return False
        if level == "warning" and not any(tag in upper for tag in ("[WARNING]", "[WARN]", "[CANCELLED]")):
            return False
        if level == "state" and "[STATE]" not in upper:
            return False
        if level == "stderr" and "[STDERR]" not in upper:
            return False
        stage = self.stage_log_filter.currentData()
        return stage in (None, "all") or f"[{stage}]" in entry

    def _redraw_log(self, _value: int = -1) -> None:
        displayed = [line for line in self._records if self._matches_filter(line)]
        self.log_view.setPlainText("\n".join(displayed))
        bar = self.log_view.verticalScrollBar()
        bar.setValue(bar.maximum())
        self.log_count.setText(f"{len(displayed)} hiện / {self._total_lines} tổng")

    def _copy_log(self) -> None:
        content = "\n".join(self._records)
        if self._log_file is not None and self._log_file.is_file():
            try:
                content = self._log_file.read_text(encoding="utf-8", errors="replace")
            except OSError:
                pass
        QApplication.clipboard().setText(content)

    def set_output(self, video_path: str | None, folder_path: str | None = None) -> None:
        self._video_path = video_path
        self._folder_path = folder_path
        self.output_path_label.setText(video_path or folder_path or "Chưa có tệp đầu ra")
        self.output_path_label.setToolTip(video_path or folder_path or "Chưa có tệp đầu ra")
        self.output_summary.setText(f"Video đầu ra · {Path(video_path).name}" if video_path else "Chưa có video đầu ra")
        self.output_summary.setToolTip(video_path or "Chưa có video đầu ra")
        self.media_button.setEnabled(bool(video_path or folder_path))

    def output_path(self, kind: str) -> str | None:
        return getattr(self, "_video_path" if kind == "video" else "_folder_path", None)

    def _toggle_logs(self, open_: bool) -> None:
        self.log_view.setVisible(open_)
        self.log_filter.setVisible(open_)
        self.stage_log_filter.setVisible(open_)
        self.log_copy_button.setVisible(open_)
        self.log_toggle.setText("Ẩn nhật ký" if open_ else "Hiện nhật ký")
        self.logs_toggled.emit(open_)

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        margin = 16 if event.size().width() >= 1280 else 12
        self.layout().setContentsMargins(margin, 12, margin, 12)
        self._elide_job_title()

    def _elide_job_title(self) -> None:
        name = getattr(self, "_full_job_title", "Chưa chọn job")
        width = max(0, self.job_title.contentsRect().width() - 8)
        self.job_title.setText(self.job_title.fontMetrics().elidedText(name, Qt.TextElideMode.ElideMiddle, width))
