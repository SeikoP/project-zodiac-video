from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtWidgets import QFrame, QLabel, QToolButton, QVBoxLayout

STAGES = (
    ("PACKAGE", "01  Gói"),
    ("VOICE", "02  Giọng"),
    ("TIMING", "03  Timing"),
    ("PLAN", "04  Kế hoạch"),
    ("RENDER", "05  Render"),
    ("AUDIO", "06  Âm thanh"),
    ("OUTPUT", "07  Đầu ra"),
)
STATUS_TEXT = {
    "DONE": "✓ Xong",
    "RUNNING": "● Đang chạy",
    "FAILED": "! Cần xử lý",
    "CANCELLED": "‖ Đã dừng",
    "SKIPPED": "– Bỏ qua",
    "PENDING": "○ Chờ",
}


class StageRail(QFrame):
    stage_selected = Signal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("surface")
        self.setMinimumWidth(164)
        self.setMaximumWidth(180)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 10, 8, 10)
        layout.setSpacing(3)
        layout.addWidget(QLabel("CÁC BƯỚC", objectName="eyebrow"))
        self.buttons: dict[str, QToolButton] = {}
        self.rows: dict[str, dict] = {}
        self.selected_step: str | None = None
        for step, label in STAGES:
            button = QToolButton()
            button.setObjectName("stage")
            number, title = label.split("  ", 1)
            button.setText(f"{number}   {title}\n{STATUS_TEXT['PENDING']}")
            button.setCheckable(True)
            button.setToolTip(title)
            button.clicked.connect(lambda _checked=False, s=step: self.select_step(s, emit=True))
            layout.addWidget(button)
            self.buttons[step] = button
        layout.addStretch(1)

    def count(self) -> int:
        return len(self.buttons)

    def set_rows(self, rows: list[dict]) -> None:
        self.rows = {str(row.get("step")): row for row in rows}
        for step, label in STAGES:
            row = self.rows.get(step, {})
            status = str(row.get("status", "PENDING"))
            number, title = label.split("  ", 1)
            self.buttons[step].setText(f"{number}   {title}\n{STATUS_TEXT.get(status, status)}")
            self.buttons[step].setProperty("stageStatus", status)
            self.buttons[step].style().unpolish(self.buttons[step])
            self.buttons[step].style().polish(self.buttons[step])
            self.buttons[step].setAccessibleName(f"Bước {number}, {title}, {STATUS_TEXT.get(status, status)}")

    def select_step(self, step: str, *, emit: bool = False) -> None:
        if step not in self.buttons:
            return
        self.selected_step = step
        for name, button in self.buttons.items():
            button.setChecked(name == step)
        if emit:
            self.stage_selected.emit(step)
