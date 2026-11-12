"""Local idea backlog; it never changes production state or approvals."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from uuid import uuid4

from PySide6.QtWidgets import (QApplication, QComboBox, QFormLayout, QHBoxLayout,
    QLabel, QLineEdit, QListWidget, QListWidgetItem, QMessageBox, QPlainTextEdit,
    QPushButton, QVBoxLayout, QWidget)
from PySide6.QtCore import Qt
from tools.studio_qt.production_checklist import SIGN_LABELS


def validate_backlog(value: object) -> dict:
    if not isinstance(value, dict) or value.get("format") != "zodiac-planned-concepts@1" or not isinstance(value.get("concepts"), list):
        raise ValueError("Sai định dạng kho concept")
    seen = set()
    for row in value["concepts"]:
        if not isinstance(row, dict) or any(not isinstance(row.get(k), str) or not row[k].strip() for k in ("id", "title", "premise", "sign")):
            raise ValueError("Concept cần có tên, cung và ý tưởng")
        if row["id"] in seen or row["sign"] not in {"any", *SIGN_LABELS}:
            raise ValueError("Concept trùng ID hoặc sai cung")
        seen.add(row["id"])
    return value


class ConceptsScreen(QWidget):
    def __init__(self, path: Path, parent=None):
        super().__init__(parent)
        self.path = Path(path)
        self.rows = []
        self.selected_id = None
        self._source = None
        root = QVBoxLayout(self)
        root.addWidget(QLabel("Concept sắp làm", objectName="pageTitle"))
        hint = QLabel("1. Thêm concept → 2. Lưu dự kiến → 3. Sao chép brief và dán vào plugin Zodiac để bắt đầu.\nÝ tưởng dự kiến chưa phải concept được duyệt; tab này không tạo workspace hoặc tự chạy sản xuất.")
        hint.setWordWrap(True)
        root.addWidget(hint)
        self.notice = QLabel("", objectName="muted")
        self.notice.setWordWrap(True)
        root.addWidget(self.notice)
        body = QHBoxLayout()
        self.list = QListWidget()
        self.list.setAccessibleName("Danh sách concept dự kiến")
        self.list.currentItemChanged.connect(self._select)
        body.addWidget(self.list, 1)
        editor = QVBoxLayout()
        form = QFormLayout()
        self.title = QLineEdit(placeholderText="Tên concept / tên tập dự kiến")
        self.sign = QComboBox()
        self.sign.addItem("Chưa chọn cung", "any")
        for key, label in SIGN_LABELS.items():
            self.sign.addItem(label, key)
        self.premise = QPlainTextEdit()
        self.premise.setPlaceholderText("Ý tưởng cụ thể, mâu thuẫn hoặc câu hỏi muốn triển khai…")
        form.addRow("Tên concept", self.title)
        form.addRow("Cung", self.sign)
        form.addRow("Ý tưởng", self.premise)
        editor.addLayout(form)
        actions = QHBoxLayout()
        self.new_button = QPushButton("Thêm mới")
        self.new_button.clicked.connect(self._new)
        self.save_button = QPushButton("Lưu dự kiến", objectName="primary")
        self.save_button.clicked.connect(self._save)
        self.copy_button = QPushButton("Sao chép brief")
        self.copy_button.clicked.connect(self._copy)
        self.remove_button = QPushButton("Bỏ concept…")
        self.remove_button.clicked.connect(self._remove)
        for button in (self.new_button, self.save_button, self.copy_button, self.remove_button):
            actions.addWidget(button)
        editor.addLayout(actions)
        body.addLayout(editor, 2)
        root.addLayout(body, 1)
        self.reload()

    def reload(self):
        try:
            self._source = self.path.read_bytes() if self.path.exists() else None
            data = validate_backlog(json.loads(self._source.decode("utf-8"))) if self._source is not None else {"concepts": []}
            self.rows = data["concepts"]
        except (OSError, UnicodeError, ValueError) as exc:
            self.notice.setText(f"Không đọc được kho concept: {exc}. Giữ nguyên tệp; kiểm tra nguồn trước khi sửa.")
            for button in (self.save_button, self.remove_button):
                button.setEnabled(False)
            return
        self._fill()
        self._new()

    def _fill(self):
        self.list.clear()
        for row in self.rows:
            item = QListWidgetItem(f"{row['title']}\n{SIGN_LABELS.get(row['sign'], 'Chưa chọn cung')} · Dự kiến")
            item.setData(Qt.ItemDataRole.UserRole, row["id"])
            self.list.addItem(item)
        self.notice.setText(f"{len(self.rows)} concept dự kiến · Lưu tại {self.path}")

    def _new(self):
        self.list.clearSelection()
        self.selected_id = None
        self.title.clear()
        self.premise.clear()
        self.sign.setCurrentIndex(0)
        self.remove_button.setEnabled(False)

    def _select(self, item, _previous):
        if item is None:
            return
        row = next(row for row in self.rows if row["id"] == item.data(Qt.ItemDataRole.UserRole))
        self.selected_id = row["id"]
        self.title.setText(row["title"])
        self.premise.setPlainText(row["premise"])
        self.sign.setCurrentIndex(self.sign.findData(row["sign"]))
        self.remove_button.setEnabled(self.save_button.isEnabled())

    def _commit(self, rows):
        temp = None
        try:
            data = validate_backlog({"format": "zodiac-planned-concepts@1", "concepts": rows})
            current = self.path.read_bytes() if self.path.exists() else None
            if current != self._source:
                raise ValueError("Tệp đã đổi bên ngoài. Mở lại ứng dụng trước khi lưu để tránh ghi đè.")
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=self.path.parent, delete=False) as stream:
                temp = Path(stream.name)
                json.dump(data, stream, ensure_ascii=False, indent=2)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp, self.path)
            self._source = self.path.read_bytes()
        except (OSError, ValueError) as exc:
            self.notice.setText(f"Không lưu được: {exc}")
            return False
        finally:
            if temp is not None:
                temp.unlink(missing_ok=True)
        self.rows = rows
        self._fill()
        return True

    def _save(self):
        row = {"id": self.selected_id or str(uuid4()), "title": self.title.text().strip(),
               "sign": self.sign.currentData(), "premise": self.premise.toPlainText().strip()}
        rows = [row if old["id"] == row["id"] else old for old in self.rows]
        if not self.selected_id:
            rows.append(row)
        if self._commit(rows):
            index = next(i for i, value in enumerate(self.rows) if value["id"] == row["id"])
            self.list.setCurrentRow(index)

    def _copy(self):
        if not self.title.text().strip() or not self.premise.toPlainText().strip():
            self.notice.setText("Nhập tên concept và ý tưởng trước khi sao chép brief.")
            return
        QApplication.clipboard().setText(
            f"Bắt đầu tập Zodiac từ ý tưởng dự kiến sau. Đây chưa phải creative approval.\n"
            f"Tên: {self.title.text().strip()}\nCung: {self.sign.currentText()}\n"
            f"Ý tưởng: {self.premise.toPlainText().strip()}\n"
            "Dùng workflow Zodiac hiện hành, làm Evidence/Concept trước và giữ các gate review bắt buộc.")
        self.notice.setText("Đã sao chép brief. Dán vào chat có plugin Zodiac để bắt đầu; chưa chạy sản xuất.")

    def _remove(self):
        if self.selected_id and QMessageBox.question(self, "Bỏ concept dự kiến", "Bỏ concept đã chọn khỏi danh sách? Workspace và video không bị ảnh hưởng.") == QMessageBox.StandardButton.Yes:
            if self._commit([row for row in self.rows if row["id"] != self.selected_id]):
                self._new()
