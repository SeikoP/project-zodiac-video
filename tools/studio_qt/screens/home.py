from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
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
    job_requested = Signal(str)

    def __init__(self, recent_jobs: list[dict] | None = None, parent=None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(56, 40, 56, 40)
        layout.setSpacing(12)

        layout.addWidget(QLabel("ZODIAC STUDIO  /  WORKSPACE", objectName="eyebrow"))
        title_row = QHBoxLayout()
        title_row.addWidget(QLabel("Công việc video", objectName="pageTitle"), 1)
        self.import_button = QPushButton("Nhập gói video")
        self.import_button.setObjectName("primary")
        self.import_button.setMinimumWidth(190)
        self.import_button.setMinimumHeight(42)
        self.import_button.clicked.connect(self.import_requested)
        title_row.addWidget(self.import_button)
        layout.addLayout(title_row)
        layout.addWidget(QLabel("Mở lại job hoặc nhập một gói mới.", objectName="muted"))

        self.recent_frame = QFrame(objectName="surface")
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

        self.empty_state = QFrame(objectName="surface")
        empty_layout = QVBoxLayout(self.empty_state)
        empty_layout.setContentsMargins(24, 24, 24, 24)
        empty_layout.addStretch(1)
        empty_layout.addWidget(QLabel("Chưa có công việc nào", objectName="sectionTitle"), 0, Qt.AlignmentFlag.AlignHCenter)
        empty_layout.addWidget(QLabel("Công việc đã mở hoặc nhập sẽ xuất hiện tại đây.", objectName="muted"), 0, Qt.AlignmentFlag.AlignHCenter)
        empty_layout.addStretch(1)
        layout.addWidget(self.empty_state, 1)
        self.set_recent_jobs(recent_jobs or [])

    def set_recent_jobs(self, jobs: list[dict]) -> None:
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
        self.recent_frame.setVisible(bool(jobs))
        self.empty_state.setVisible(not jobs)
        self.open_job_button.setEnabled(False)

    def _update_open_button(self) -> None:
        self.open_job_button.setEnabled(bool(self.recent_list.selectedItems()))

    def _open_selected(self) -> None:
        selected = self.recent_list.selectedItems()
        if selected:
            self._activate_item(selected[0])

    def _activate_item(self, item: QListWidgetItem) -> None:
        self.job_requested.emit(item.data(256))
