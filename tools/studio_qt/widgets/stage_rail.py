from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QToolButton, QVBoxLayout, QWidget

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


class _ClickableStageRow(QWidget):
    """The full row, not only its title, selects its stage."""

    clicked = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.setAccessibleDescription("Nhấn Enter hoặc Space để xem chi tiết bước")

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self.rect().contains(event.position().toPoint()):
            self.clicked.emit()
            event.accept()
            return
        super().mouseReleaseEvent(event)

    def keyPressEvent(self, event):
        if event.key() in (Qt.Key.Key_Return, Qt.Key.Key_Enter, Qt.Key.Key_Space):
            self.clicked.emit()
            event.accept()
            return
        super().keyPressEvent(event)


class StageRail(QFrame):
    """Flat, separated step list. No enclosing card around individual steps."""

    stage_selected = Signal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("stageRailFlat")
        self.setMinimumWidth(238)
        self.setMaximumWidth(258)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 12, 10, 8)
        layout.setSpacing(2)
        layout.addWidget(QLabel("QUY TRÌNH · 7 BƯỚC", objectName="eyebrow"))

        self.buttons: dict[str, QToolButton] = {}
        self.row_widgets: dict[str, QWidget] = {}
        self.descriptions: dict[str, QLabel] = {}
        self.status_labels: dict[str, QLabel] = {}
        self.activity_labels: dict[str, QLabel] = {}
        self.rows: dict[str, dict] = {}
        self.activities: dict[str, str] = {}
        self.progress_units: dict[str, tuple[int, int, str]] = {}
        self.selected_step: str | None = None

        for step, number, title, purpose in STAGES:
            row = _ClickableStageRow()
            row.clicked.connect(lambda s=step: self.select_step(s, emit=True))
            row.setObjectName("stageLine")
            row.setProperty("selected", False)
            row_layout = QVBoxLayout(row)
            row_layout.setContentsMargins(8, 5, 8, 5)
            row_layout.setSpacing(2)

            heading = QHBoxLayout()
            heading.setSpacing(5)
            button = QToolButton()
            button.setObjectName("stage")
            button.setText(f"{number}  {title}")
            button.setCheckable(True)
            button.setToolTip(purpose)
            button.clicked.connect(lambda _checked=False, s=step: self.select_step(s, emit=True))
            heading.addWidget(button, 1)
            status_label = QLabel(STATUS_TEXT["PENDING"])
            status_label.setObjectName("stageState")
            status_label.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            status_label.setProperty("stageStatus", "PENDING")
            heading.addWidget(status_label)
            row_layout.addLayout(heading)

            purpose_label = QLabel(purpose)
            purpose_label.setObjectName("stagePurpose")
            purpose_label.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            purpose_label.setWordWrap(True)
            row_layout.addWidget(purpose_label)
            purpose_label.hide()
            activity = QLabel("")
            activity.setObjectName("stageActivity")
            activity.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            activity.setWordWrap(False)
            activity.setVisible(False)
            row_layout.addWidget(activity)

            layout.addWidget(row)
            separator = QFrame()
            separator.setObjectName("stageDivider")
            separator.setFrameShape(QFrame.Shape.HLine)
            layout.addWidget(separator)
            self.buttons[step] = button
            self.row_widgets[step] = row
            self.descriptions[step] = purpose_label
            self.status_labels[step] = status_label
            self.activity_labels[step] = activity
        layout.addStretch(1)

    def count(self) -> int:
        return len(self.buttons)

    @staticmethod
    def _shorten(value: str, limit: int = 43) -> str:
        value = " ".join(str(value).split())
        return value if len(value) <= limit else value[:limit - 1].rstrip() + "…"

    def set_activity(self, step: str, message: str) -> None:
        if step not in self.buttons:
            return
        message = " ".join(str(message).split())
        if not message:
            return
        self.activities[step] = message
        if self.rows.get(step, {}).get("status") == "RUNNING":
            self._show_activity(step, message)

    def set_progress(self, step: str, completed: int, total: int, unit: str) -> None:
        if step not in self.buttons or total <= 0 or completed < 0 or completed > total:
            return
        previous = self.progress_units.get(step)
        if previous is not None and previous[1] == total and completed < previous[0]:
            return
        self.progress_units[step] = (completed, total, unit)
        self.set_rows(list(self.rows.values()))

    def reset_progress(self, step: str | None = None) -> None:
        if step is None:
            self.progress_units.clear()
        else:
            self.progress_units.pop(step, None)
        # A fallback must also remove stale x/y text from the visible stage row.
        self.set_rows(list(self.rows.values()))

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
            state_label = STATUS_TEXT.get(status, status)
            if status == "DONE":
                if row.get("reused"):
                    state_label += " · cache"
                elif row.get("cache_reason") == "REBUILT":
                    state_label += " · mới"
            self.status_labels[step].setText(state_label)
            self.status_labels[step].setProperty("stageStatus", status)
            self.status_labels[step].style().unpolish(self.status_labels[step])
            self.status_labels[step].style().polish(self.status_labels[step])
            detail = str(row.get("detail") or row.get("message") or "")
            if status == "FAILED" and detail:
                self._show_activity(step, detail)
            elif status == "RUNNING":
                recent = self.activities.get(step) or detail
                if step in self.progress_units:
                    done, total, unit = self.progress_units[step]
                    recent = f"{done}/{total} {unit}" + (f" · {recent}" if recent else "")
                self._show_activity(step, recent)
            else:
                self._show_activity(step, "")
            self.row_widgets[step].setToolTip(f"{number} {title}\n{purpose}\n{state_label}\n{detail}")
            self.buttons[step].setToolTip(f"{number} {title}\n{purpose}\n{state_label}\n{detail}")
            self.buttons[step].setAccessibleName(f"Bước {number}, {title}, {state_label}")

    def select_step(self, step: str, *, emit: bool = False) -> None:
        if step not in self.buttons:
            return
        self.selected_step = step
        for key, button in self.buttons.items():
            button.setChecked(key == step)
            self.descriptions[key].setVisible(key == step)
            row = self.row_widgets[key]
            row.setProperty("selected", key == step)
            row.style().unpolish(row)
            row.style().polish(row)
        if emit:
            self.stage_selected.emit(step)
