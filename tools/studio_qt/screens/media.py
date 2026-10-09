from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QDir, QModelIndex, QSortFilterProxyModel, Qt, QUrl, Signal
from PySide6.QtGui import QPixmap, QStandardItem
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtMultimediaWidgets import QVideoWidget
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QFileSystemModel,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPlainTextEdit,
    QPushButton,
    QSlider,
    QSizePolicy,
    QSplitter,
    QStackedWidget,
    QTreeView,
    QVBoxLayout,
    QWidget,
)

from tools.zodiac_local import SUPPORTED_MUSIC_EXTENSIONS
from tools.studio_qt.publish_copy import publish_text_for_job

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".svg"}
TEXT_EXTENSIONS = {".txt", ".log", ".json", ".md", ".srt", ".vtt", ".ass", ".csv", ".yaml", ".yml", ".xml", ".html"}
TEXT_PREVIEW_LIMIT_BYTES = 2 * 1024 * 1024


def media_kind(path: Path) -> str | None:
    suffix = path.suffix.lower()
    if suffix in VIDEO_EXTENSIONS:
        return "video"
    if suffix in SUPPORTED_MUSIC_EXTENSIONS:
        return "audio"
    if suffix in IMAGE_EXTENSIONS:
        return "image"
    return None


class MediaFilterProxy(QSortFilterProxyModel):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.query = ""
        self.publish_root: Path | None = None

    def filterAcceptsRow(self, row: int, parent: QModelIndex) -> bool:
        model = self.sourceModel()
        index = model.index(row, 0, parent)
        if model.isDir(index):
            return True
        path = Path(model.filePath(index))
        if (self.publish_root is not None and path.parent == self.publish_root
                and path.name.casefold() in {"publish.json", "publish-copy.txt"}):
            return False
        return self.query in path.name.casefold()

    def data(self, index: QModelIndex, role=Qt.ItemDataRole.DisplayRole):
        if index.isValid() and role == Qt.ItemDataRole.DisplayRole and index.column() == 2:
            source = self.mapToSource(index.sibling(index.row(), 0))
            model = self.sourceModel()
            if source.isValid() and not model.isDir(source):
                path = Path(model.filePath(source))
                kind = media_kind(path)
                label = {"video": "Video", "audio": "Âm thanh", "image": "Hình ảnh"}.get(kind)
                return label or path.suffix.lstrip(".").upper() or "Tệp"
        return super().data(index, role)


class MediaWorkspace(QWidget):
    refresh_jobs_requested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        root = QVBoxLayout(self)
        root.setContentsMargins(16, 12, 16, 12)
        root.setSpacing(8)

        header = QHBoxLayout()
        title = QLabel("Thư viện media", objectName="pageTitle")
        header.addWidget(title)
        self.root_label = QLabel("Chọn job để duyệt thư mục out/", objectName="muted")
        self.root_label.setMinimumWidth(0)
        self.root_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.root_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.root_label.setToolTip("Media chỉ duyệt thư mục out/ của các job")
        header.addWidget(self.root_label, 1)
        self.refresh_button = QPushButton("Làm mới")
        self.refresh_button.clicked.connect(self.refresh_jobs_requested)
        header.addWidget(self.refresh_button)
        root.addLayout(header)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setChildrenCollapsible(False)
        files_panel = QWidget(objectName="workspaceMain")
        files_layout = QVBoxLayout(files_panel)
        files_layout.setContentsMargins(20, 10, 12, 8)
        files_layout.setSpacing(8)
        files_layout.addWidget(QLabel("ĐẦU RA THEO CÔNG VIỆC", objectName="eyebrow"))
        self.job_picker = QComboBox()
        self.job_picker.setAccessibleName("Chọn nhóm và công việc Media")
        self.job_picker.setMaxVisibleItems(16)
        self.job_picker.currentIndexChanged.connect(self._job_changed)
        files_layout.addWidget(self.job_picker)
        self.search = QLineEdit()
        self.search.setPlaceholderText("Lọc tên tệp đầu ra…")
        self.search.setClearButtonEnabled(True)
        self.search.setAccessibleName("Lọc tệp đầu ra")
        self.search.textChanged.connect(self._filter_files)
        files_layout.addWidget(self.search)

        self.file_model = QFileSystemModel(self)
        self.file_model.setReadOnly(True)
        self.file_model.setFilter(QDir.Filter.AllEntries | QDir.Filter.NoDotAndDotDot | QDir.Filter.Hidden)
        self.file_model.setHeaderData(0, Qt.Orientation.Horizontal, "Tệp")
        self.file_model.setHeaderData(1, Qt.Orientation.Horizontal, "Dung lượng")
        self.file_model.setHeaderData(2, Qt.Orientation.Horizontal, "Loại")
        self.proxy = MediaFilterProxy(self)
        self.proxy.setSourceModel(self.file_model)
        self.proxy.setDynamicSortFilter(True)
        self.proxy.setRecursiveFilteringEnabled(True)
        self.files = QTreeView()
        self.files.setModel(self.proxy)
        self.files.setRootIsDecorated(False)
        self.files.setItemsExpandable(True)
        self.files.setSelectionBehavior(QTreeView.SelectionBehavior.SelectRows)
        self.files.setSelectionMode(QTreeView.SelectionMode.SingleSelection)
        self.files.setUniformRowHeights(True)
        self.files.setAccessibleName("Tệp trong thư mục out của job")
        self.files.hideColumn(3)
        self.files.hideColumn(4)
        tree_header = self.files.header()
        tree_header.setStretchLastSection(False)
        tree_header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        tree_header.setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        tree_header.setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.files.setColumnWidth(1, 86)
        self.files.setColumnWidth(2, 88)
        self.files.activated.connect(self._activate_file)
        self.files.clicked.connect(self._select_file)
        files_layout.addWidget(self.files, 1)
        splitter.addWidget(files_panel)

        preview_panel = QWidget(objectName="workspaceMain")
        preview_layout = QVBoxLayout(preview_panel)
        preview_layout.setContentsMargins(20, 10, 12, 8)
        preview_layout.setSpacing(8)
        self.preview_stack = QStackedWidget()
        self.video_widget = QVideoWidget()
        self.video_widget.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.player = QMediaPlayer(self)
        self.audio_output = QAudioOutput(self)
        self.audio_output.setVolume(0.8)
        self.player.setAudioOutput(self.audio_output)
        self.player.setVideoOutput(self.video_widget)
        self.preview_stack.addWidget(self.video_widget)
        self.preview_label = QLabel("Chọn video, âm thanh hoặc hình ảnh để xem trong ứng dụng.")
        self.preview_label.setObjectName("mediaPreview")
        self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_label.setWordWrap(True)
        self.preview_label.setMinimumHeight(180)
        self.preview_label.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.preview_stack.setMinimumHeight(180)
        self.preview_stack.addWidget(self.preview_label)
        self.text_preview = QPlainTextEdit(objectName="mediaTextPreview")
        self.text_preview.setReadOnly(True)
        self.text_preview.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)
        self.text_preview.setAccessibleName("Nội dung tệp văn bản đầu ra")
        self.preview_stack.addWidget(self.text_preview)
        preview_layout.addWidget(self.preview_stack, 1)

        self.selected_label = QLabel("Chưa chọn tệp", objectName="sectionTitle")
        self.selected_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        preview_layout.addWidget(self.selected_label)
        self.path_label = QLabel("", objectName="muted")
        self.path_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.path_label.setWordWrap(True)
        self.path_label.setToolTip("Đường dẫn đầy đủ của tệp media")
        preview_layout.addWidget(self.path_label)
        publish_header = QHBoxLayout()
        publish_header.addWidget(QLabel("NỘI DUNG ĐĂNG · SẴN SÀNG COPY", objectName="eyebrow"))
        publish_header.addStretch(1)
        self.copy_publish_button = QPushButton("Copy caption + hashtags")
        self.copy_publish_button.setObjectName("copyPublish")
        self.copy_publish_button.setEnabled(False)
        self.copy_publish_button.setToolTip("Copy caption và hashtags vào clipboard, không cần mở ZIP publish")
        self.copy_publish_button.clicked.connect(self._copy_publish)
        publish_header.addWidget(self.copy_publish_button)
        preview_layout.addLayout(publish_header)
        self.publish_preview = QPlainTextEdit(objectName="publishValuePreview")
        self.publish_preview.setReadOnly(True)
        self.publish_preview.setMaximumHeight(116)
        self.publish_preview.setMinimumHeight(74)
        self.publish_preview.setPlaceholderText("Nội dung đăng sẽ xuất hiện khi chọn job có Publish.")
        self.publish_preview.setAccessibleName("Caption và hashtags không có nhãn kỹ thuật")
        preview_layout.addWidget(self.publish_preview)

        controls = QHBoxLayout()
        self.play_button = QPushButton("Phát")
        self.play_button.setAccessibleName("Phát hoặc tạm dừng media")
        self.play_button.setEnabled(False)
        self.play_button.clicked.connect(self._toggle_playback)
        controls.addWidget(self.play_button)
        self.position_slider = QSlider(Qt.Orientation.Horizontal)
        self.position_slider.setRange(0, 0)
        self.position_slider.setAccessibleName("Vị trí phát media")
        self.position_slider.sliderMoved.connect(self.player.setPosition)
        self.position_label = QLabel("00:00 / 00:00", objectName="muted")
        self.position_label.setMinimumWidth(82)
        controls.addWidget(self.position_slider, 1)
        controls.addWidget(self.position_label)
        controls.addWidget(QLabel("Âm lượng"))
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(80)
        self.volume_slider.setAccessibleName("Âm lượng phát media")
        self.volume_slider.setFixedWidth(90)
        self.volume_slider.valueChanged.connect(self._volume_changed)
        controls.addWidget(self.volume_slider)
        preview_layout.addLayout(controls)
        self.status_label = QLabel("Sẵn sàng", objectName="muted")
        preview_layout.addWidget(self.status_label)
        splitter.addWidget(preview_panel)
        splitter.setSizes([360, 760])
        root.addWidget(splitter, 1)

        self.file_model.directoryLoaded.connect(self._select_pending_file)
        self.player.positionChanged.connect(self._position_changed)
        self.player.durationChanged.connect(self._duration_changed)
        self.player.playbackStateChanged.connect(self._playback_state_changed)
        self.player.errorOccurred.connect(self._player_error)
        self._root_path: Path | None = None
        self._selected_path: Path | None = None
        self._pending_selection: Path | None = None
        self._jobs: dict[str, dict] = {}
        self._current_job_path: Path | None = None
        self._duration = 0
        self._image_path: Path | None = None

    def set_jobs(self, jobs: list[dict], selected_path: str | Path | None = None) -> None:
        previous = str(self._current_job_path) if self._current_job_path else None
        normalized: dict[str, dict] = {}
        for job in jobs:
            job_path = Path(job["path"]).resolve()
            out_path = Path(job["out_path"]).resolve()
            if out_path != (job_path / "out").resolve() or not out_path.is_dir():
                continue
            normalized[str(job_path)] = {**job, "path": str(job_path), "out_path": str(out_path)}
        self._jobs = normalized

        self.job_picker.blockSignals(True)
        model = self.job_picker.model()
        model.clear()
        last_group = None
        for key, job in normalized.items():
            if job["group"] != last_group:
                group_item = QStandardItem(job["group"])
                group_item.setFlags(Qt.ItemFlag.ItemIsEnabled)
                model.appendRow(group_item)
                last_group = job["group"]
            item = QStandardItem(job["name"])
            item.setData(key, Qt.ItemDataRole.UserRole)
            item.setToolTip(f"{job['group']} · {job['out_path']}")
            model.appendRow(item)

        preferred = Path(selected_path).resolve() if selected_path else Path(previous).resolve() if previous else None
        selected_index = -1
        fallback_index = -1
        for row in range(model.rowCount()):
            key = model.item(row).data(Qt.ItemDataRole.UserRole)
            if key is None:
                continue
            fallback_index = row if fallback_index < 0 else fallback_index
            job = normalized[key]
            if preferred and (key == str(preferred) or job["out_path"] == str(preferred)):
                selected_index = row
                break
        if selected_index < 0:
            selected_index = fallback_index

        self.job_picker.setEnabled(bool(normalized))
        self.job_picker.setCurrentIndex(selected_index)
        self.job_picker.blockSignals(False)
        self.files.setVisible(bool(normalized))
        self.files.setEnabled(bool(normalized))
        self.search.setEnabled(bool(normalized))
        if selected_index >= 0:
            self._job_changed(selected_index)
        else:
            self.copy_publish_button.setEnabled(False)
            self.publish_preview.clear()
            self._current_job_path = None
            self.root_label.setText("Chưa có job nào có thư mục out/")
            self.root_label.setToolTip("Media chỉ hiển thị các job có thư mục out/")
            self._clear_selection()
            self._root_path = None
            self.files.setRootIndex(QModelIndex())

    def set_output(
        self,
        video_path: str | None,
        folder_path: str | None,
        job_path: str | Path | None = None,
    ) -> None:
        if not self._current_job_path:
            return
        key = str(Path(job_path).resolve()) if job_path else None
        job = self._jobs.get(key or "")
        if (
            job is None
            or self._current_job_path != Path(job["path"])
            or not folder_path
            or Path(folder_path).resolve() != Path(job["out_path"])
        ):
            return
        video = Path(video_path) if video_path else None
        if video and video.is_file() and video.resolve().is_relative_to(Path(job["out_path"])):
            self.open_media(video)

    def open_folder(self, path: str | Path) -> None:
        job = self._job_for_output_path(Path(path))
        if job is None:
            self.status_label.setText("Media chỉ duyệt thư mục out/ của job.")
            return
        self._select_job(job["path"])

    def open_media(self, path: str | Path) -> None:
        file_path = Path(path)
        kind = media_kind(file_path)
        if not file_path.is_file():
            self.status_label.setText("Không tìm thấy tệp đầu ra.")
            return
        file_path = file_path.resolve()
        job = self._job_for_output_path(file_path)
        if job is None:
            self.status_label.setText("Media chỉ mở tệp thuộc thư mục out/ của job.")
            return
        self._select_job(job["path"])
        if kind is None:
            self._show_output_details(file_path)
            return
        self.set_root_path(Path(job["out_path"]))
        self._selected_path = file_path
        self._image_path = file_path if kind == "image" else None
        self.player.stop()
        self._duration = 0
        self.position_slider.setRange(0, 0)
        self.position_label.setText("00:00 / 00:00")
        self.selected_label.setText(f"{file_path.name}  ·  {self._format_size(file_path)}")
        self.selected_label.setToolTip(file_path.name)
        self.path_label.setText(str(file_path))
        self.play_button.setEnabled(kind in ("video", "audio"))
        self.play_button.setText("Phát")
        if kind == "video":
            self.preview_stack.setCurrentWidget(self.video_widget)
            self.status_label.setText("Video sẵn sàng phát")
            self.player.setSource(QUrl.fromLocalFile(str(file_path)))
        elif kind == "audio":
            self.preview_label.setPixmap(QPixmap())
            self.preview_label.setText("Tệp âm thanh · nhấn Phát để nghe trong ứng dụng")
            self.preview_stack.setCurrentWidget(self.preview_label)
            self.status_label.setText("Âm thanh sẵn sàng phát")
            self.player.setSource(QUrl.fromLocalFile(str(file_path)))
        else:
            self.player.setSource(QUrl())
            self.preview_stack.setCurrentWidget(self.preview_label)
            pixmap = QPixmap(str(file_path))
            self.preview_label.setPixmap(pixmap.scaled(self.preview_label.size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
            self.preview_label.setText("" if not pixmap.isNull() else "Không xem được định dạng ảnh này.")
            self.status_label.setText("Ảnh đã mở trong workspace")
        self._pending_selection = file_path
        self._select_pending_file()

    def set_root_path(self, path: str | Path) -> None:
        root = Path(path).resolve()
        if not any(root == Path(job["out_path"]) for job in self._jobs.values()):
            return
        if root == self._root_path:
            return
        self._root_path = root
        self.proxy.publish_root = root
        self.proxy.invalidateFilter()
        source_index = self.file_model.setRootPath(str(root))
        self.files.setRootIndex(self.proxy.mapFromSource(source_index))
        if self._selected_path is not None and not self._selected_path.is_relative_to(root):
            self._selected_path = None

    def _job_for_output_path(self, path: Path) -> dict | None:
        target = path.resolve()
        for job in self._jobs.values():
            output = Path(job["out_path"])
            if target == output or target.is_relative_to(output):
                return job
        return None

    def _select_job(self, job_path: str | Path) -> None:
        index = self.job_picker.findData(str(Path(job_path).resolve()), Qt.ItemDataRole.UserRole)
        if index >= 0:
            self.job_picker.setCurrentIndex(index)

    def _job_changed(self, index: int) -> None:
        job_path = self.job_picker.itemData(index, Qt.ItemDataRole.UserRole)
        job = self._jobs.get(job_path or "")
        if job is None:
            return
        new_path = Path(job["path"])
        if new_path != self._current_job_path:
            self._clear_selection()
        self._current_job_path = new_path
        self.root_label.setText(f"{job['name']} · out/")
        self.root_label.setToolTip(job["out_path"])
        self.set_root_path(job["out_path"])
        publish_text = publish_text_for_job(Path(job["path"]))
        self.publish_preview.setPlainText(publish_text)
        self.copy_publish_button.setEnabled(bool(publish_text))

    def _copy_publish(self) -> None:
        """Copy a single publishing payload, without bundling duplicate files."""
        job = self._jobs.get(str(self._current_job_path)) if self._current_job_path else None
        content = publish_text_for_job(Path(job["path"])) if job else ""
        if not content:
            self.status_label.setText("Job chưa có caption/hashtag để sao chép.")
            self.copy_publish_button.setEnabled(False)
            return
        QApplication.clipboard().setText(content)
        self.status_label.setText("Đã sao chép nội dung đăng — chỉ có caption và hashtags, không kèm nhãn.")

    def _filter_files(self, text: str) -> None:
        self.proxy.query = text.strip().casefold()
        self.proxy.invalidateFilter()

    def _activate_file(self, index: QModelIndex) -> None:
        source = self.proxy.mapToSource(index)
        if not self.file_model.isDir(source):
            self.open_media(self.file_model.filePath(source))

    def _select_file(self, index: QModelIndex) -> None:
        source = self.proxy.mapToSource(index)
        if not self.file_model.isDir(source):
            path = Path(self.file_model.filePath(source))
            self.open_media(path)

    def _show_output_details(self, path: Path) -> None:
        extension = path.suffix.lstrip(".").upper() or "TỆP"
        self.player.stop()
        self.player.setSource(QUrl())
        self._selected_path = path
        self._pending_selection = None
        self._image_path = None
        self._duration = 0
        self.position_slider.setRange(0, 0)
        self.position_label.setText("00:00 / 00:00")
        self.selected_label.setText(f"{path.name}  ·  {self._format_size(path)}")
        self.selected_label.setToolTip(path.name)
        self.path_label.setText(str(path))
        self.play_button.setEnabled(False)
        self.play_button.setText("Phát")
        self.preview_label.setPixmap(QPixmap())
        if path.suffix.casefold() in TEXT_EXTENSIONS:
            try:
                with path.open("rb") as stream:
                    data = stream.read(TEXT_PREVIEW_LIMIT_BYTES + 1)
                if b"\x00" in data:
                    raise ValueError("binary file")
                clipped = len(data) > TEXT_PREVIEW_LIMIT_BYTES
                content = data[:TEXT_PREVIEW_LIMIT_BYTES].decode("utf-8", errors="replace")
                if clipped:
                    content += "\n\n[Đã giới hạn xem trước ở 2 MiB; mở bằng trình soạn thảo để xem hết.]"
                self.text_preview.setPlainText(content)
                self.preview_stack.setCurrentWidget(self.text_preview)
                self.status_label.setText("Văn bản đã mở trong Media" + (" · bản xem trước" if clipped else ""))
            except (OSError, ValueError):
                self.preview_label.setText("Không đọc được tệp dưới dạng UTF-8.")
                self.preview_stack.setCurrentWidget(self.preview_label)
                self.status_label.setText("Không thể xem nội dung tệp này.")
        else:
            self.preview_label.setText(f"{extension}\nKhông hỗ trợ xem trước nội dung tệp này.")
            self.preview_stack.setCurrentWidget(self.preview_label)
            self.status_label.setText(f"Tệp đầu ra · {extension}")

    def _clear_selection(self) -> None:
        self.player.stop()
        self.player.setSource(QUrl())
        self._selected_path = None
        self._pending_selection = None
        self._image_path = None
        self._duration = 0
        self.position_slider.setRange(0, 0)
        self.position_label.setText("00:00 / 00:00")
        self.selected_label.setText("Chưa chọn tệp")
        self.selected_label.setToolTip("")
        self.path_label.clear()
        self.play_button.setEnabled(False)
        self.play_button.setText("Phát")
        self.preview_label.setPixmap(QPixmap())
        self.preview_label.setText("Chọn video, âm thanh, hình ảnh hoặc tệp đầu ra để xem trong ứng dụng.")
        self.text_preview.clear()
        self.preview_stack.setCurrentWidget(self.preview_label)
        self.status_label.setText("Sẵn sàng")

    def _select_pending_file(self, _path: str | None = None) -> None:
        if self._pending_selection is None:
            return
        source = self.file_model.index(str(self._pending_selection))
        if source.isValid():
            proxy = self.proxy.mapFromSource(source)
            if proxy.isValid():
                self.files.setCurrentIndex(proxy)
                self._pending_selection = None

    def _toggle_playback(self) -> None:
        if self.player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.player.pause()
        else:
            self.player.play()

    def _volume_changed(self, value: int) -> None:
        self.audio_output.setVolume(value / 100)

    def _playback_state_changed(self, state: QMediaPlayer.PlaybackState) -> None:
        playing = state == QMediaPlayer.PlaybackState.PlayingState
        self.play_button.setText("Tạm dừng" if playing else "Phát")

    def _position_changed(self, position: int) -> None:
        if not self.position_slider.isSliderDown():
            self.position_slider.setValue(position)
        self.position_label.setText(f"{self._format_time(position)} / {self._format_time(self._duration)}")

    def _duration_changed(self, duration: int) -> None:
        self._duration = duration
        self.position_slider.setRange(0, duration)
        self.position_label.setText(f"{self._format_time(self.player.position())} / {self._format_time(duration)}")

    def _player_error(self, _error, message: str) -> None:
        if message:
            self.status_label.setText(f"Không phát được media: {message}")

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        if self._image_path is not None:
            pixmap = QPixmap(str(self._image_path))
            if not pixmap.isNull():
                self.preview_label.setPixmap(pixmap.scaled(self.preview_label.size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))

    @staticmethod
    def _format_time(milliseconds: int) -> str:
        seconds = max(0, milliseconds // 1000)
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes:02d}:{seconds:02d}"

    @staticmethod
    def _format_size(path: Path) -> str:
        try:
            size = path.stat().st_size
        except OSError:
            return "Không rõ dung lượng"
        if size < 1024:
            return f"{size} B"
        if size < 1024**2:
            return f"{size / 1024:.1f} KiB"
        return f"{size / 1024**2:.1f} MiB"
