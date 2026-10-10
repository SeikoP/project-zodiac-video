from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QVBoxLayout,
    QWidget,
)


class HomeScreen(QWidget):
    import_requested = Signal()
    ready_import_requested = Signal(str)
    ready_refresh_requested = Signal()
    job_requested = Signal(str)

    def __init__(self, recent_jobs: list[dict] | None = None, parent=None) -> None:
        super().__init__(parent)
        self._busy = False
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(12)

        layout.addWidget(QLabel("ZODIAC STUDIO  /  WORKSPACE", objectName="eyebrow"))
        title_row = QHBoxLayout()
        title_row.addWidget(QLabel("Công việc video", objectName="pageTitle"), 1)
        self.import_button = QPushButton("Chọn ZIP từ máy…")
        self.import_button.setMinimumWidth(190)
        self.import_button.setMinimumHeight(42)
        self.import_button.clicked.connect(self.import_requested)
        title_row.addWidget(self.import_button)
        layout.addLayout(title_row)
        layout.addWidget(QLabel("Nhập gói → Thiết lập → Chạy quy trình → Xem Media", objectName="muted"))
        self.operation_status = QLabel("Chọn gói sẵn sàng hoặc mở lại job bên dưới.", objectName="muted")
        self.operation_status.setWordWrap(True)
        self.operation_status.setTextFormat(Qt.TextFormat.PlainText)
        layout.addWidget(self.operation_status)

        self.ready_frame = QFrame(objectName="workspaceMain")
        ready_layout = QVBoxLayout(self.ready_frame)
        ready_layout.setContentsMargins(18, 12, 18, 12)
        ready_layout.setSpacing(8)
        ready_layout.addWidget(QLabel("GÓI SẴN SÀNG · ready/", objectName="eyebrow"))
        ready_row = QHBoxLayout()
        self.ready_picker = QComboBox()
        self.ready_picker.setObjectName("readyArchivePicker")
        self.ready_picker.setAccessibleName("Chọn ZIP trong thư mục ready")
        self.ready_picker.setMinimumWidth(180)
        self.ready_picker.currentIndexChanged.connect(self._update_ready_button)
        ready_row.addWidget(self.ready_picker, 1)
        self.ready_refresh_button = QPushButton("Làm mới")
        self.ready_refresh_button.clicked.connect(self.ready_refresh_requested)
        ready_row.addWidget(self.ready_refresh_button)
        self.ready_import_button = QPushButton("Nhập ZIP đã chọn")
        self.ready_import_button.setObjectName("primary")
        self.ready_import_button.clicked.connect(self._import_ready)
        ready_row.addWidget(self.ready_import_button)
        ready_layout.addLayout(ready_row)
        ready_layout.addWidget(QLabel("Nhập xong sẽ mở Workspace và tự kiểm tra môi trường.", objectName="muted"))
        layout.addWidget(self.ready_frame)
        self.set_ready_packages([])

        self.recent_frame = QFrame(objectName="workspaceMain")
        recent_layout = QVBoxLayout(self.recent_frame)
        recent_layout.setContentsMargins(18, 14, 18, 14)
        recent_header = QHBoxLayout()
        recent_header.addWidget(QLabel("Job gần đây", objectName="sectionTitle"), 1)
        self.job_count = QLabel("0 công việc", objectName="muted")
        recent_header.addWidget(self.job_count)
        recent_layout.addLayout(recent_header)
        self.recent_list = QListWidget(objectName="recentJobs")
        self.recent_list.itemActivated.connect(self._activate_item)
        self.recent_list.itemSelectionChanged.connect(self._update_open_button)
        self.recent_list.setAccessibleName("Danh sách job gần đây")
        self.recent_list.setUniformItemSizes(True)
        recent_layout.addWidget(self.recent_list)
        actions = QHBoxLayout()
        actions.addStretch(1)
        self.open_job_button = QPushButton("Mở job")
        self.open_job_button.setMinimumWidth(120)
        self.open_job_button.setEnabled(False)
        self.open_job_button.clicked.connect(self._open_selected)
        actions.addWidget(self.open_job_button)
        recent_layout.addLayout(actions)
        layout.addWidget(self.recent_frame, 1)

        self.empty_state = QFrame(objectName="workspaceMain")
        empty_layout = QVBoxLayout(self.empty_state)
        empty_layout.setContentsMargins(24, 24, 24, 24)
        empty_layout.addStretch(1)
        empty_layout.addWidget(QLabel("Chưa có công việc nào", objectName="sectionTitle"), 0, Qt.AlignmentFlag.AlignHCenter)
        empty_layout.addWidget(QLabel("Công việc đã mở hoặc nhập sẽ xuất hiện tại đây.", objectName="muted"), 0, Qt.AlignmentFlag.AlignHCenter)
        empty_layout.addStretch(1)
        layout.addWidget(self.empty_state, 1)
        self.set_recent_jobs(recent_jobs or [])

    def set_recent_jobs(self, jobs: list[dict]) -> None:
        previous = self.recent_list.currentItem()
        previous_path = previous.data(256) if previous else None
        scroll = self.recent_list.verticalScrollBar().value()
        self.recent_list.clear()
        count = len(jobs)
        self.job_count.setText(f"{count} công việc")
        for job in jobs:
            name = str(job.get("name", "Job"))
            state = str(job.get("state", ""))
            item = QListWidgetItem(f"{name}\n{state}" if state else name)
            item.setData(256, str(job.get("path", name)))
            item.setToolTip(str(job.get("path", name)))
            self.recent_list.addItem(item)
            if item.data(256) == previous_path:
                self.recent_list.setCurrentItem(item)
        self.recent_frame.setVisible(bool(jobs))
        self.empty_state.setVisible(not jobs)
        self.recent_list.verticalScrollBar().setValue(scroll)
        self._update_open_button()

    def set_busy(self, busy: bool, message: str = "") -> None:
        self._busy = busy
        self.import_button.setEnabled(not busy)
        self.ready_picker.setEnabled(not busy and bool(self.ready_picker.currentData()))
        self.ready_refresh_button.setEnabled(not busy)
        self.recent_list.setEnabled(not busy)
        self._update_open_button()
        self._update_ready_button()
        if message:
            self.operation_status.setText(message)

    def _update_open_button(self) -> None:
        self.open_job_button.setEnabled(not self._busy and bool(self.recent_list.selectedItems()))

    def _open_selected(self) -> None:
        selected = self.recent_list.selectedItems()
        if selected:
            self._activate_item(selected[0])

    def _activate_item(self, item: QListWidgetItem) -> None:
        if not self._busy:
            self.job_requested.emit(item.data(256))

    def set_ready_packages(self, paths: list[str]) -> None:
        previous = self.ready_picker.currentData()
        self.ready_picker.blockSignals(True)
        self.ready_picker.clear()
        for path in paths:
            from pathlib import Path
            file_path = Path(path)
            self.ready_picker.addItem(file_path.name, str(file_path))
            self.ready_picker.setItemData(self.ready_picker.count() - 1, str(file_path), 3)
        if not paths:
            self.ready_picker.addItem("Chưa có ZIP trong ready/", None)
        elif previous:
            selected = self.ready_picker.findData(previous)
            if selected >= 0:
                self.ready_picker.setCurrentIndex(selected)
        self.ready_picker.blockSignals(False)
        self.ready_picker.setEnabled(bool(paths) and not self._busy)
        self._update_ready_button()

    def _update_ready_button(self, _index: int = -1) -> None:
        self.ready_import_button.setEnabled(not self._busy and bool(self.ready_picker.currentData()))

    def _import_ready(self) -> None:
        path = self.ready_picker.currentData()
        if path and not self._busy:
            self.ready_import_requested.emit(str(path))
