from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QToolButton, QVBoxLayout

STAGES = (
    ("PACKAGE", "01", "Gói", "Kiểm tra gói và tài nguyên"),
    ("VOICE", "02", "Giọng", "Tạo lời đọc cho từng cảnh"),
    ("TIMING", "03", "Timing", "Đồng bộ giọng và thời gian"),
    ("PLAN", "04", "Kế hoạch", "Lập kế hoạch khung hình"),
    ("RENDER", "05", "Render", "Dựng hình ảnh thành video"),
    ("AUDIO", "06", "Âm thanh", "Trộn giọng, SFX và nhạc"),
    ("OUTPUT", "07", "Đầu ra", "Kiểm tra và xuất thành phẩm"),
)
STATUS_TEXT = {
    "DONE": "✓ Hoàn tất",
    "RUNNING": "● Đang chạy",
    "FAILED": "✕ Có lỗi",
    "CANCELLED": "‖ Đã dừng",
    "SKIPPED": "– Bỏ qua",
    "PENDING": "○ Chờ thực hiện",
}


class StageRail(QFrame):
    """Navigation with actual state, stable purpose and latest observed activity."""

    stage_selected = Signal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("stageRail")
        self.setMinimumWidth(205)
        self.setMaximumWidth(230)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 10, 8, 10)
        layout.setSpacing(7)
        layout.addWidget(QLabel("TIẾN TRÌNH · 7 BƯỚC", objectName="eyebrow"))

        self.buttons: dict[str, QToolButton] = {}
        self.cards: dict[str, QFrame] = {}
        self.descriptions: dict[str, QLabel] = {}
        self.status_labels: dict[str, QLabel] = {}
        self.activity_labels: dict[str, QLabel] = {}
        self.rows: dict[str, dict] = {}
        self.activities: dict[str, str] = {}
        self.selected_step: str | None = None
        for step, number, title, purpose in STAGES:
            card = QFrame()
            card.setObjectName("stageCard")
            card.setProperty("stageStatus", "PENDING")
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(9, 8, 9, 8)
            card_layout.setSpacing(3)

            heading = QHBoxLayout()
            heading.setSpacing(4)
            button = QToolButton()
            button.setObjectName("stage")
            button.setText(f"{number}   {title}")
            button.setCheckable(True)
            button.setToolTip(purpose)
            button.setSizePolicy(button.sizePolicy().horizontalPolicy(), button.sizePolicy().verticalPolicy())
            button.clicked.connect(lambda _checked=False, s=step: self.select_step(s, emit=True))
            heading.addWidget(button, 1)
            card_layout.addLayout(heading)

            description = QLabel(purpose)
            description.setObjectName("stagePurpose")
            description.setWordWrap(True)
            card_layout.addWidget(description)

            status_label = QLabel(STATUS_TEXT["PENDING"])
            status_label.setObjectName("stageState")
            status_label.setProperty("stageStatus", "PENDING")
            card_layout.addWidget(status_label)

            activity = QLabel("")
            activity.setObjectName("stageActivity")
            activity.setWordWrap(False)
            activity.setVisible(False)
            card_layout.addWidget(activity)

            layout.addWidget(card)
            self.buttons[step] = button
            self.cards[step] = card
            self.descriptions[step] = description
            self.status_labels[step] = status_label
            self.activity_labels[step] = activity
        layout.addStretch(1)

    def count(self) -> int:
        return len(self.buttons)

    @staticmethod
    def _shorten(value: str, limit: int = 43) -> str:
        text = " ".join(str(value).split())
        return text if len(text) <= limit else text[:limit - 1].rstrip() + "…"

    def set_activity(self, step: str, message: str) -> None:
        if step not in self.buttons:
            return
        clean = " ".join(str(message).split())
        if not clean:
            return
        self.activities[step] = clean
        if self.rows.get(step, {}).get("status") == "RUNNING":
            self._show_activity(step, clean)

    def _show_activity(self, step: str, message: str) -> None:
        label = self.activity_labels[step]
        label.setText(self._shorten(message))
        label.setToolTip(message)
        label.setVisible(bool(message))

    def set_rows(self, rows: list[dict]) -> None:
        self.rows = {str(row.get("step")): row for row in rows}
        for step, number, title, purpose in STAGES:
            row = self.rows.get(step, {})
            status = str(row.get("status", "PENDING"))
            text = STATUS_TEXT.get(status, status)
            if status == "DONE":
                if row.get("reused"):
                    text += " · cache"
                elif row.get("cache_reason") == "REBUILT":
                    text += " · dựng mới"
            elif status == "RUNNING":
                done = row.get("scene_done")
                total = row.get("scene_total")
                if isinstance(done, int) and isinstance(total, int) and total > 0:
                    text += f" · {done}/{total} cảnh"
            self.status_labels[step].setText(text)
            self.status_labels[step].setProperty("stageStatus", status)
            self.cards[step].setProperty("stageStatus", status)
            for widget in (self.status_labels[step], self.cards[step]):
                widget.style().unpolish(widget)
                widget.style().polish(widget)
            detail = str(row.get("detail") or row.get("message") or "")
            if status == "FAILED" and detail:
                self._show_activity(step, detail)
            elif status == "RUNNING":
                self._show_activity(step, self.activities.get(step) or detail)
            else:
                self._show_activity(step, "")
            self.buttons[step].setToolTip(f"{number} {title}\n{purpose}\n{text}\n{detail}")
            self.buttons[step].setAccessibleName(f"Bước {number}, {title}, {text}")

    def select_step(self, step: str, *, emit: bool = False) -> None:
        if step not in self.buttons:
            return
        self.selected_step = step
        for name, button in self.buttons.items():
            button.setChecked(name == step)
            self.cards[name].setProperty("selected", name == step)
            self.cards[name].style().unpolish(self.cards[name])
            self.cards[name].style().polish(self.cards[name])
        if emit:
            self.stage_selected.emit(step)
