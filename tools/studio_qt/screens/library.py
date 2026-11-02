"""Kho: one list of every package, job and video, with safe cleanup."""

from __future__ import annotations

import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from tools.application import library

KIND = {"package": "Gói ZIP", "job": "Job", "legacy_job": "Job cũ", "cache": "Bộ nhớ đệm"}
HEADERS = ("Loại", "Trạng thái", "Nhóm", "Tên", "Ngày", "Dung lượng", "Video", "Ghi chú")


def _open_folder(path: Path) -> None:
    target = path if path.is_dir() else path.parent
    if sys.platform.startswith("win"):
        os.startfile(str(target))  # noqa: S606 - local file manager
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(target)])
    else:
        subprocess.Popen(["xdg-open", str(target)])


class LibraryScreen(QWidget):
    job_requested = Signal(str)
    changed = Signal()

    def __init__(self, project_root: Path, workspace: Path, parent=None) -> None:
        super().__init__(parent)
        self.project_root, self.workspace = project_root, workspace
        self._entries: list[library.Entry] = []
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(10)
        layout.addWidget(QLabel("KHO", objectName="eyebrow"))
        layout.addWidget(QLabel("Mọi gói, job và video ở một nơi", objectName="pageTitle"))
        self.summary = QLabel("", objectName="muted")
        layout.addWidget(self.summary)
        bar = QHBoxLayout()
        self.filter = QLineEdit(placeholderText="Lọc theo tên hoặc nhóm…")
        self.filter.textChanged.connect(self._fill)
        bar.addWidget(self.filter, 1)
        self.refresh_button = QPushButton("Làm mới")
        self.refresh_button.clicked.connect(self.refresh)
        self.folder_button = QPushButton("Mở thư mục")
        self.folder_button.clicked.connect(self._open_selected_folder)
        self.export_button = QPushButton("Xuất video có tên")
        self.export_button.setToolTip("Chép video mới nhất của mỗi job vào thư mục videos/ với tên <job>__r<bản>__<giờ render>.mp4")
        self.export_button.clicked.connect(self._export_videos)
        self.clean_button = QPushButton("Dọn bản cũ…")
        self.clean_button.clicked.connect(self._clean)
        self.undo_button = QPushButton("Hoàn tác lần dọn gần nhất")
        self.undo_button.clicked.connect(self._undo)
        for button in (self.refresh_button, self.folder_button, self.export_button, self.clean_button, self.undo_button):
            bar.addWidget(button)
        layout.addLayout(bar)
        self.table = QTableWidget(0, len(HEADERS))
        self.table.setHorizontalHeaderLabels(HEADERS)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.table.cellDoubleClicked.connect(self._double_clicked)
        layout.addWidget(self.table, 1)

    def refresh(self) -> None:
        self._entries = library.scan(self.project_root, self.workspace)
        self._fill()

    def _status(self, entry: library.Entry) -> str:
        if entry.is_latest:
            return "Mới nhất"
        return "Bản cũ" if entry.verdict == "archive" else "Giữ"

    def _fill(self) -> None:
        needle = self.filter.text().casefold().strip()
        rows = [e for e in sorted(self._entries, key=lambda e: (e.group or "~", -e.mtime))
                if not needle or needle in e.name.casefold() or needle in (e.group or "").casefold()]
        self.table.setRowCount(len(rows))
        for row, entry in enumerate(rows):
            when = datetime.fromtimestamp(entry.mtime).strftime("%Y-%m-%d %H:%M") if entry.mtime else "-"
            cells = (KIND[entry.kind], self._status(entry), entry.group or "", entry.name, when,
                     library.human_size(entry.size), str(len(entry.videos)) if entry.videos else "",
                     (entry.state + (" · " if entry.state and entry.reason else "") + entry.reason))
            for column, text in enumerate(cells):
                item = QTableWidgetItem(text)
                if column == 0:
                    item.setData(Qt.ItemDataRole.UserRole, str(entry.path))
                self.table.setItem(row, column, item)
        moves = library.plan_cleanup(self._entries)
        total = sum(e.size for e in self._entries)
        self.summary.setText(
            f"{len(self._entries)} mục · {library.human_size(total)} · "
            f"{len(moves)} bản cũ/trùng có thể dọn ({library.human_size(sum(m.size for m in moves))})")
        self.export_button.setEnabled(any(e.videos and e.verdict == "keep" for e in self._entries))
        self.clean_button.setEnabled(bool(moves))
        self.undo_button.setEnabled(self._latest_batch() is not None)

    def _selected_path(self) -> Path | None:
        row = self.table.currentRow()
        item = self.table.item(row, 0) if row >= 0 else None
        raw = item.data(Qt.ItemDataRole.UserRole) if item else None
        return Path(raw) if raw else None

    def _open_selected_folder(self) -> None:
        path = self._selected_path()
        if path:
            _open_folder(path)

    def _double_clicked(self, row: int, _column: int) -> None:
        item = self.table.item(row, 0)
        raw = item.data(Qt.ItemDataRole.UserRole) if item else None
        if raw and Path(raw).is_dir() and (Path(raw) / "package-manifest.json").is_file():
            self.job_requested.emit(raw)

    def _export_videos(self) -> None:
        destination = self.project_root / "videos"
        done = library.export_videos(self._entries, destination)
        if done:
            names = "\n".join(f"• {target.name}" for _, target in done[:15])
            QMessageBox.information(self, "Xuất video", f"Đã chép {len(done)} video vào {destination}:\n{names}")
        else:
            QMessageBox.information(self, "Xuất video", "Không có video mới cần chép.")
        if destination.is_dir():
            _open_folder(destination)

    def _clean(self) -> None:
        moves = library.plan_cleanup(self._entries)
        if not moves:
            return
        lines = "\n".join(f"• {m.source.name} — {m.reason}" for m in moves[:15])
        more = f"\n… và {len(moves) - 15} mục khác" if len(moves) > 15 else ""
        answer = QMessageBox.question(
            self, "Dọn bản cũ",
            f"Chuyển {len(moves)} mục ({library.human_size(sum(m.size for m in moves))}) vào _archive?\n"
            f"Không xóa; có thể hoàn tác.\n\n{lines}{more}")
        if answer == QMessageBox.StandardButton.Yes:
            library.apply_cleanup(moves, self.workspace)
            self.refresh()
            self.changed.emit()

    def _latest_batch(self) -> Path | None:
        base = self.workspace / library.ARCHIVE_DIR
        if not base.is_dir():
            return None
        batches = sorted((p for p in base.iterdir() if (p / "moved.json").is_file()), reverse=True)
        return batches[0] if batches else None

    def _undo(self) -> None:
        batch = self._latest_batch()
        if batch:
            library.restore(batch)
            library.purge_batch(batch)
            self.refresh()
            self.changed.emit()
