"""Kho: one list of every package, job and video, with safe cleanup."""

from __future__ import annotations

import os
import sys
import subprocess
import threading
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTabWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from tools.application import library
from tools.studio_qt.screens.concepts import ConceptsScreen

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
    scan_finished = Signal(object, str)

    def __init__(self, project_root: Path, workspace: Path, parent=None, *, checklist=None) -> None:
        super().__init__(parent)
        self.project_root, self.workspace = project_root, workspace
        self._entries: list[library.Entry] = []
        self._scanning = False
        self._loaded = False
        self.scan_finished.connect(self._scan_complete)
        shell = QVBoxLayout(self)
        self.pages = QTabWidget()
        files_page = QWidget()
        self.concepts = ConceptsScreen(workspace / "planned-concepts.json")
        if checklist is not None:
            self.pages.addTab(checklist, "Tập & concept")
        self.pages.addTab(files_page, "Gói & video")
        self.pages.addTab(self.concepts, "Ý tưởng nháp")
        shell.addWidget(self.pages)
        layout = QVBoxLayout(files_page)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(10)
        layout.addWidget(QLabel("KHO", objectName="eyebrow"))
        layout.addWidget(QLabel("Mọi gói, job và video ở một nơi", objectName="pageTitle"))
        self.summary = QLabel("", objectName="sectionTitle")
        layout.addWidget(self.summary)
        bar = QHBoxLayout()
        self.filter = QLineEdit(placeholderText="Lọc theo tên hoặc nhóm…")
        self.filter.textChanged.connect(self._fill)
        bar.addWidget(self.filter, 1)
        self.scope = QComboBox()
        self.scope.setAccessibleName("Lọc kho theo loại hoặc đầu ra")
        for label, value in (("Tất cả", "all"), ("Job có video", "videos"), ("Gói ZIP", "package"),
                             ("Job hiện tại", "job"), ("Job cũ", "legacy_job"), ("Có thể dọn", "archive")):
            self.scope.addItem(label, value)
        self.scope.currentIndexChanged.connect(self._fill)
        bar.addWidget(self.scope)
        self.refresh_button = QPushButton("Làm mới")
        self.refresh_button.clicked.connect(self.refresh)
        self.folder_button = QPushButton("Mở thư mục")
        self.folder_button.clicked.connect(self._open_selected_folder)
        self.export_button = QPushButton("Xuất video toàn kho")
        self.export_button.setToolTip("Chép video mới nhất của mỗi job vào thư mục videos/ với tên <job>__r<bản>__<giờ render>.mp4")
        self.export_button.clicked.connect(self._export_videos)
        self.clean_button = QPushButton("Dọn tất cả bản cũ…")
        self.clean_button.setToolTip("Xem và xác nhận danh sách dọn trên toàn kho; bộ lọc không giới hạn phạm vi dọn.")
        self.clean_button.clicked.connect(self._clean)
        self.undo_button = QPushButton("Hoàn tác lần dọn gần nhất")
        self.undo_button.clicked.connect(self._undo)
        bar.addWidget(self.refresh_button)
        layout.addLayout(bar)
        self.table = QTableWidget(0, len(HEADERS))
        self.table.setHorizontalHeaderLabels(HEADERS)
        self.table.setAlternatingRowColors(True)
        self.table.setShowGrid(False)
        self.table.setWordWrap(False)
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.table.itemSelectionChanged.connect(self._update_selection)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.table.cellDoubleClicked.connect(self._double_clicked)
        layout.addWidget(self.table, 1)
        self.empty_label = QLabel("Không có mục phù hợp. Đổi bộ lọc hoặc làm mới kho.", objectName="muted")
        layout.addWidget(self.empty_label)
        selection = QFrame(objectName="surface")
        selection_layout = QVBoxLayout(selection)
        self.selection_label = QLabel("Chọn một mục để xem đường dẫn và thao tác.", objectName="sectionTitle")
        self.selection_label.setWordWrap(True)
        self.selection_path = QLabel("", objectName="muted")
        self.selection_path.setWordWrap(True)
        self.selection_path.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        selection_layout.addWidget(self.selection_label)
        selection_layout.addWidget(self.selection_path)
        actions = QHBoxLayout()
        self.open_job_button = QPushButton("Mở job trong Workspace", objectName="primary")
        self.open_job_button.clicked.connect(lambda: self._double_clicked(self.table.currentRow(), 0))
        actions.addWidget(self.open_job_button)
        actions.addWidget(self.folder_button)
        actions.addStretch(1)
        actions.addWidget(self.export_button)
        selection_layout.addLayout(actions)
        layout.addWidget(selection)
        maintenance = QHBoxLayout()
        maintenance.addWidget(QLabel("DỌN DẸP · chuyển vào lưu trữ, có thể hoàn tác", objectName="muted"))
        maintenance.addStretch(1)
        maintenance.addWidget(self.clean_button)
        maintenance.addWidget(self.undo_button)
        layout.addLayout(maintenance)
        self._update_selection()

    def refresh(self) -> None:
        if self._scanning:
            return
        self._scanning = True
        self.summary.setText("Đang đọc kho… Bạn có thể tiếp tục dùng ứng dụng.")
        for button in (self.refresh_button, self.clean_button, self.undo_button, self.export_button):
            button.setEnabled(False)
        def run():
            try:
                entries, error = library.scan(self.project_root, self.workspace), ""
            except Exception as exc:
                entries, error = [], str(exc)
            try:
                self.scan_finished.emit(entries, error)
            except RuntimeError:
                pass  # Window was closed while the read-only scan finished.
        threading.Thread(target=run, daemon=True).start()

    def ensure_loaded(self) -> None:
        if not self._loaded:
            self.refresh()

    def _scan_complete(self, entries, error: str) -> None:
        self._scanning = False
        self.refresh_button.setEnabled(True)
        if error:
            self.summary.setText("Không đọc được kho: " + error)
            return
        self._loaded = True
        self._entries = entries
        self._fill()

    def _status(self, entry: library.Entry) -> str:
        if entry.is_latest:
            return "Mới nhất"
        return "Bản cũ" if entry.verdict == "archive" else "Giữ"

    def _fill(self) -> None:
        selected = self._selected_path()
        needle = self.filter.text().casefold().strip()
        scope = self.scope.currentData()
        rows = [e for e in sorted(self._entries, key=lambda e: (e.group or "~", -e.mtime))
                if (not needle or needle in e.name.casefold() or needle in (e.group or "").casefold())
                and (scope == "all" or scope == e.kind or (scope == "videos" and e.videos)
                     or (scope == "archive" and e.verdict == "archive"))]
        self.table.blockSignals(True)
        self.table.clearSelection()
        self.table.setCurrentCell(-1, -1)
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
                item.setToolTip(str(entry.path) if column == 3 else text)
                self.table.setItem(row, column, item)
            if entry.path == selected:
                self.table.selectRow(row)
        self.table.blockSignals(False)
        self._update_selection()
        self.empty_label.setVisible(not rows)
        moves = library.plan_cleanup(self._entries)
        total = sum(e.size for e in self._entries)
        self.summary.setText(
            f"Đang hiện {len(rows)}/{len(self._entries)} mục · {library.human_size(total)} · "
            f"{len(moves)} bản cũ/trùng có thể dọn ({library.human_size(sum(m.size for m in moves))})")
        self.export_button.setEnabled(not self._scanning and any(e.videos and e.verdict == "keep" for e in self._entries))
        self.clean_button.setEnabled(bool(moves) and not self._scanning)
        self.undo_button.setEnabled(not self._scanning and self._latest_batch() is not None)

    def _update_selection(self) -> None:
        path = self._selected_path()
        entry = next((e for e in self._entries if e.path == path), None)
        self.folder_button.setEnabled(path is not None)
        self.open_job_button.setEnabled(bool(path and path.is_dir() and (path / "package-manifest.json").is_file()))
        self.selection_label.setText(f"{entry.name} · {self._status(entry)}" if entry else "Chọn một mục để xem đường dẫn và thao tác.")
        self.selection_path.setText(str(path) if path else "")

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
