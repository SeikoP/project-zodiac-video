from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QSplitter,
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

        self.stage_rail = StageRail()
        self.stage_rail.stage_selected.connect(self.stage_selected)
        self.stage_rail.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        self.stage_scroll = QScrollArea()
        self.stage_scroll.setObjectName("stageScroll")
        self.stage_scroll.setWidgetResizable(True)
        self.stage_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.stage_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.stage_scroll.setWidget(self.stage_rail)
        self.stage_scroll.setMinimumWidth(168)
        self.stage_scroll.setMaximumWidth(184)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setChildrenCollapsible(False)
        current = _surface()
        current_layout = QVBoxLayout(current)
        current_layout.setContentsMargins(16, 14, 16, 14)
        current_layout.setSpacing(8)
        current_layout.addWidget(QLabel("TỔNG QUAN QUY TRÌNH", objectName="eyebrow"))
        self.status_label = QLabel("Sẵn sàng", objectName="status")
        self.status_label.setMinimumWidth(102)
        self.status_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.environment_status = QLabel("Môi trường chưa kiểm tra", objectName="status")
        self.environment_status.setMinimumWidth(170)
        self.environment_status.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.pipeline_summary = QLabel("Chưa có bước nào", objectName="sectionTitle")
        current_layout.addWidget(self.pipeline_summary)
        status_row = QHBoxLayout()
        status_row.addWidget(self.status_label)
        status_row.addStretch(1)
        current_layout.addLayout(status_row)
        environment_row = QHBoxLayout()
        environment_row.addWidget(self.environment_status)
        environment_row.addStretch(1)
        current_layout.addLayout(environment_row)
        self.pipeline_detail = QLabel("Trạng thái các bước sẽ hiện tại đây.", objectName="muted")
        self.pipeline_detail.setWordWrap(True)
        current_layout.addWidget(self.pipeline_detail)
        self.output_summary = QLabel("Chưa có video đầu ra", objectName="muted")
        self.output_summary.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        current_layout.addWidget(self.output_summary)
        current_layout.addWidget(QLabel("BƯỚC ĐANG XEM", objectName="eyebrow"))
        self.active_title = QLabel("Chọn một bước", objectName="sectionTitle")
        current_layout.addWidget(self.active_title)
        self.active_detail = QLabel("Trạng thái và hoạt động mới nhất sẽ hiện ở đây.", objectName="muted")
        self.active_detail.setWordWrap(True)
        current_layout.addWidget(self.active_detail)
        self.progress_text = QLabel("Sẵn sàng")
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        current_layout.addWidget(self.progress_text)
        current_layout.addWidget(self.progress_bar)
        current_layout.addStretch(1)
        current_layout.addWidget(QLabel("HOẠT ĐỘNG MỚI NHẤT", objectName="eyebrow"))
        self.latest_event = QLabel("Chưa có hoạt động mới.", objectName="muted")
        self.latest_event.setWordWrap(True)
        current_layout.addWidget(self.latest_event)
        log_row = QHBoxLayout()
        log_row.addWidget(QLabel("NHẬT KÝ QUY TRÌNH / BƯỚC", objectName="eyebrow"))
        log_row.addStretch(1)
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
        self.log_view.setMaximumBlockCount(0)
        self.log_view.setMinimumHeight(140)
        self.log_view.setToolTip("Nhật ký đầy đủ được lưu theo từng job; có thể chọn/copy văn bản")
        self.log_view.setVisible(True)
        current_layout.addWidget(self.log_view, 2)
        self._log_file: Path | None = None

        detail = _surface()
        detail_layout = QVBoxLayout(detail)
        detail_layout.setContentsMargins(14, 12, 14, 12)
        detail_layout.setSpacing(8)
        detail.setMinimumWidth(270)
        detail_layout.addWidget(QLabel("CHI TIẾT BƯỚC", objectName="eyebrow"))
        self.detail_title = QLabel("Chưa chọn", objectName="sectionTitle")
        detail_layout.addWidget(self.detail_title)
        self.detail_body = QLabel("Chọn một bước để xem trạng thái và đầu ra liên quan.", objectName="muted")
        self.detail_body.setWordWrap(True)
        detail_layout.addWidget(self.detail_body)
        self.output_path_label = QLabel("", objectName="outputPath")
        self.output_path_label.setWordWrap(True)
        self.output_path_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        detail_layout.addWidget(self.output_path_label)
        self.rerun_button = QPushButton("Chạy lại từ bước này")
        self.rerun_button.setEnabled(False)
        self.rerun_button.clicked.connect(lambda: self.rerun_requested.emit(self.stage_rail.selected_step or ""))
        detail_layout.addWidget(self.rerun_button, 0)
        detail_layout.addStretch(1)
        self.output_button = QPushButton("Xem video")
        self.output_button.setEnabled(False)
        self.output_button.clicked.connect(lambda: self.output_requested.emit("video"))
        self.folder_button = QPushButton("Duyệt Media")
        self.folder_button.setEnabled(False)
        self.folder_button.clicked.connect(lambda: self.output_requested.emit("folder"))
        media_actions = QHBoxLayout()
        media_actions.setSpacing(6)
        media_actions.addWidget(self.output_button, 1)
        media_actions.addWidget(self.folder_button, 1)
        detail_layout.addLayout(media_actions)

        splitter.addWidget(current)
        splitter.addWidget(detail)
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 2)

        workspace = QHBoxLayout()
        workspace.setSpacing(8)
        workspace.addWidget(self.stage_scroll)
        workspace.addWidget(splitter, 1)
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
        if percent is None:
            self.progress_bar.setRange(0, 0)
            self.progress_text.setText(f"Đang thực hiện: {STAGE_TITLES.get(step, step)}" if status == "RUNNING" else state_text)
        else:
            bounded = max(0.0, min(1.0, float(percent)))
            self.progress_bar.setRange(0, 100)
            self.progress_bar.setValue(round(bounded * 100))
            self.progress_text.setText(f"{round(bounded * 100)}% · {STAGE_TITLES.get(step, step)}")
        self.detail_title.setText(STAGE_TITLES.get(step, step))
        self.detail_body.setText(str(row.get("message") or row.get("detail") or row.get("status", "")))
        self.rerun_button.setEnabled(step != "PACKAGE" and row.get("status") != "RUNNING")

    def set_running(self, running: bool, *, busy: bool = False) -> None:
        enabled = not running and not busy
        self.continue_button.setEnabled(enabled)
        self.run_all_button.setEnabled(enabled)
        self.cancel_button.setVisible(running)
        self.cancel_button.setEnabled(running)
        self.rerun_button.setEnabled(enabled and self.stage_rail.selected_step not in (None, "PACKAGE"))

    def set_environment_state(self, ready: bool | None, detail: str = "") -> None:
        label = "Môi trường sẵn sàng" if ready else "Môi trường cần kiểm tra" if ready is False else "Môi trường chưa kiểm tra"
        self.environment_status.setText(label)
        self.environment_status.setToolTip(detail or label)
        self.environment_status.setProperty("severity", "success" if ready else "error" if ready is False else "")
        self.environment_status.style().unpolish(self.environment_status)
        self.environment_status.style().polish(self.environment_status)

    def set_log_file(self, location: Path) -> None:
        """Use one durable UTF-8 log per job; never mix different jobs."""
        self._log_file = Path(location)
        self.log_view.clear()
        try:
            if self._log_file.is_file():
                # Older logs can be large; the complete bytes remain on disk and
                # copy comes from that file, not from the visible widget.
                with self._log_file.open("r", encoding="utf-8", errors="replace") as stream:
                    content = stream.read()
                self.log_view.setPlainText(content)
                if content:
                    self.latest_event.setText(content.splitlines()[-1])
        except OSError as exc:
            self.latest_event.setText(f"Không đọc được nhật ký: {exc}")

    def append_activity(self, text: str) -> None:
        self.latest_event.setText(text)
        self.log_view.appendPlainText(text)
        if self._log_file is not None:
            try:
                self._log_file.parent.mkdir(parents=True, exist_ok=True)
                with self._log_file.open("a", encoding="utf-8", newline="\n") as stream:
                    stream.write(text + "\n")
            except OSError as exc:
                self.latest_event.setToolTip(f"Không lưu được nhật ký: {exc}")

    def _copy_log(self) -> None:
        content = self.log_view.toPlainText()
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
        self.output_button.setEnabled(bool(video_path))
        self.folder_button.setEnabled(bool(folder_path))

    def output_path(self, kind: str) -> str | None:
        return getattr(self, "_video_path" if kind == "video" else "_folder_path", None)

    def _toggle_logs(self, open_: bool) -> None:
        self.log_view.setVisible(open_)
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
