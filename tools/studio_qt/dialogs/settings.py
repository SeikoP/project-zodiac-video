from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt, QTimer, QUrl
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QSlider,
    QVBoxLayout,
    QDialogButtonBox,
)

from tools.studio.messages_vi import ALIGN_MODEL_CHOICES, ALIGN_MODEL_DEFAULT
from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.zodiac_local import SUPPORTED_MUSIC_EXTENSIONS


class SettingsDialog(QDialog):
    def __init__(self, values: dict, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Thiết lập job")
        self.setMinimumWidth(520)
        root = QVBoxLayout(self)
        form = QFormLayout()

        self.voice = QComboBox()
        self.voice.setEditable(True)
        self.voice.addItems(saved_voices())
        self.voice.setCurrentText(str(values.get("voice") or preferred_voice()))
        form.addRow("Giọng đọc", self.voice)

        self.align_model = QComboBox()
        self.align_model.addItems(ALIGN_MODEL_CHOICES)
        self.align_model.setCurrentText(str(values.get("align_model") or ALIGN_MODEL_DEFAULT))
        form.addRow("Model căn từ", self.align_model)

        music_row = QHBoxLayout()
        self.music = QLineEdit(str(values.get("music", "")))
        self.music.setPlaceholderText("Không dùng nhạc nền")
        self.music.setToolTip(self.music.text())
        self.music.textChanged.connect(self.music.setToolTip)
        browse = QPushButton("Chọn file…")
        browse.clicked.connect(self._browse_music)
        music_row.addWidget(self.music, 1)
        music_row.addWidget(browse)
        form.addRow("Nhạc nền", music_row)

        volume_row = QHBoxLayout()
        self.volume = QSlider()
        self.volume.setOrientation(Qt.Orientation.Horizontal)
        self.volume.setRange(0, 100)
        self.volume.setValue(round(float(values.get("volume", 1.0)) * 100))
        self.volume.setAccessibleName("Âm lượng nhạc nền")
        self.volume_label = QLabel(f"{self.volume.value()}%")
        volume_row.addWidget(self.volume, 1)
        volume_row.addWidget(self.volume_label)
        form.addRow("Âm lượng", volume_row)

        self.audition_button = QPushButton("Nghe thử 10 giây")
        self.player = QMediaPlayer(self)
        self.audio_output = QAudioOutput(self)
        self.player.setAudioOutput(self.audio_output)
        self.volume.valueChanged.connect(self._volume_changed)
        self.audio_output.setVolume(self.volume.value() / 100)
        self.audition_timer = QTimer(self)
        self.audition_timer.setSingleShot(True)
        self.audition_timer.timeout.connect(self._stop_audition)
        self.player.playbackStateChanged.connect(self._audition_state_changed)
        self.player.errorOccurred.connect(self._audition_error)
        self.audition_button.clicked.connect(self._toggle_audition)
        form.addRow("", self.audition_button)
        self.audition_status = QLabel("Nghe thử phát trực tiếp trong ứng dụng.", objectName="muted")
        form.addRow("", self.audition_status)
        root.addLayout(form)
        root.addWidget(QLabel("Thiết lập được lưu theo job hiện tại."))
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Cancel | QDialogButtonBox.StandardButton.Save)
        buttons.button(QDialogButtonBox.StandardButton.Save).setText("Lưu")
        buttons.button(QDialogButtonBox.StandardButton.Cancel).setText("Hủy")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        root.addWidget(buttons)

    def values(self) -> dict:
        return {
            "voice": self.voice.currentText().strip(),
            "music": self.music.text().strip(),
            "volume": self.volume.value() / 100,
            "align_model": self.align_model.currentText(),
        }

    def done(self, result: int) -> None:
        self._stop_audition()
        super().done(result)

    def _browse_music(self) -> None:
        patterns = " ".join(f"*{ext}" for ext in sorted(SUPPORTED_MUSIC_EXTENSIONS))
        path, _ = QFileDialog.getOpenFileName(self, "Chọn nhạc nền", self.music.text(), f"Âm thanh ({patterns});;Tất cả tệp (*)")
        if path:
            self.music.setText(str(Path(path)))

    def _volume_changed(self, value: int) -> None:
        self.volume_label.setText(f"{value}%")
        self.audio_output.setVolume(value / 100)

    def _toggle_audition(self) -> None:
        if self.audition_timer.isActive():
            self._stop_audition()
            return
        path = Path(self.music.text().strip()).expanduser()
        if not path.is_file():
            self.audition_status.setText("Chọn tệp âm thanh tồn tại để nghe thử.")
            return
        self.audio_output.setVolume(self.volume.value() / 100)
        self.player.setSource(QUrl.fromLocalFile(str(path.resolve())))
        self.audition_timer.start(10_000)
        self.player.play()
        self.audition_button.setText("Dừng nghe thử")
        self.audition_status.setText("Đang phát trong ứng dụng · tự dừng sau 10 giây")

    def _stop_audition(self) -> None:
        self.audition_timer.stop()
        self.player.stop()
        self.audition_button.setText("Nghe thử 10 giây")
        self.audition_status.setText("Đã dừng nghe thử.")

    def _audition_state_changed(self, state: QMediaPlayer.PlaybackState) -> None:
        if state == QMediaPlayer.PlaybackState.StoppedState and self.audition_timer.isActive():
            self.audition_timer.stop()
            self.audition_button.setText("Nghe thử 10 giây")

    def _audition_error(self, _error, message: str) -> None:
        self.audition_timer.stop()
        self.audition_button.setText("Nghe thử 10 giây")
        self.audition_status.setText(f"Không phát được nhạc: {message}")
