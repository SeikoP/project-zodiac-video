from __future__ import annotations

from pathlib import Path
import json
import tempfile

from PySide6.QtCore import QProcess, Qt, QTimer, QUrl
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
    def __init__(self, values: dict, parent=None, *, vieneu_url: str | None = None,
                 tts_root: Path | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Thiết lập job")
        self.setMinimumWidth(520)
        root = QVBoxLayout(self)
        form = QFormLayout()

        self.vieneu_url = vieneu_url
        self.tts_root = tts_root
        self._voice_temp = None
        self.voice = QComboBox()
        self.voice.setMinimumContentsLength(24)
        self.voice.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
        self._server_voice_ids = None
        selected_voice = str(values.get("voice") or preferred_voice())
        for voice in dict.fromkeys([*saved_voices(), selected_voice]):
            self.voice.addItem(voice, voice)
        self.voice.setCurrentIndex(self.voice.findData(selected_voice))
        self.voice.setAccessibleName("Giọng đọc VieNeu")
        voice_row = QHBoxLayout()
        voice_row.addWidget(self.voice, 1)
        self.voice_refresh = QPushButton("Làm mới")
        self.voice_refresh.clicked.connect(self._refresh_voices)
        voice_row.addWidget(self.voice_refresh)
        form.addRow("Giọng đọc", voice_row)
        self.voice_preview = QPushButton("Nghe thử giọng")
        self.voice_preview.clicked.connect(self._toggle_voice_preview)
        form.addRow("", self.voice_preview)
        self.voice_status = QLabel("Danh sách giọng đã lưu trên máy.", objectName="muted")
        self.voice_status.setWordWrap(True)
        form.addRow("", self.voice_status)
        self.voice_player = QMediaPlayer(self)
        self.voice_audio = QAudioOutput(self)
        self.voice_audio.setVolume(1.0)
        self.voice_player.setAudioOutput(self.voice_audio)
        self.voice_player.playbackStateChanged.connect(self._voice_playback_changed)
        self.voice_player.errorOccurred.connect(lambda _error, message: self.voice_status.setText("Không phát được giọng: " + message))
        self.voice_process = QProcess(self)
        self.voice_process.readyReadStandardOutput.connect(self._voice_output)
        self.voice_process.readyReadStandardError.connect(self._voice_error_output)
        self.voice_process.finished.connect(self._voice_finished)
        self.voice_process.errorOccurred.connect(self._voice_process_error)
        self.voice_timeout = QTimer(self)
        self.voice_timeout.setSingleShot(True)
        self.voice_timeout.timeout.connect(self._voice_timed_out)
        self._voice_operation = ""
        self._voice_buffer = b""
        self._voice_error = ""
        self._voice_result = None
        self.voice.currentIndexChanged.connect(self._voice_selection_changed)
        self._voice_busy(False)
        if vieneu_url and tts_root:
            QTimer.singleShot(0, self._refresh_voices)

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
            "voice": self.voice.currentData(),
            "music": self.music.text().strip(),
            "volume": self.volume.value() / 100,
            "align_model": self.align_model.currentText(),
        }

    def done(self, result: int) -> None:
        self._stop_audition()
        self.voice_timeout.stop()
        self.voice_player.stop()
        self.voice_player.setSource(QUrl())
        if self.voice_process.state() != QProcess.ProcessState.NotRunning:
            self.voice_process.kill()
            self.voice_process.waitForFinished(1000)
        if self._voice_temp is not None:
            self._voice_temp.cleanup()
        super().done(result)

    def _voice_busy(self, busy: bool) -> None:
        connected = bool(self.vieneu_url and self.tts_root)
        self.voice_refresh.setEnabled(connected and not busy)
        available = self._server_voice_ids is None or self.voice.currentData() in self._server_voice_ids
        self.voice_preview.setEnabled(connected and not busy and available)
        self.voice.setEnabled(not busy)

    def _voice_selection_changed(self, _index: int) -> None:
        self.voice_player.stop()
        self.voice.setToolTip(self.voice.currentText())
        self._voice_busy(self.voice_process.state() != QProcess.ProcessState.NotRunning)

    def _start_voice_operation(self, operation: str) -> None:
        if not self.vieneu_url or not self.tts_root or self.voice_process.state() != QProcess.ProcessState.NotRunning:
            return
        from tools.zodiac_local import _tts_python
        from tools.studio import vieneu_client
        try:
            python = _tts_python(self.tts_root, None)
        except Exception as exc:
            self.voice_status.setText(f"Không kết nối được VieNeu: {exc}")
            return
        self._voice_operation = operation
        self._voice_buffer, self._voice_error, self._voice_result = b"", "", None
        arguments = ["-X", "utf8", str(Path(vieneu_client.__file__)), operation, "--url", self.vieneu_url]
        if operation == "preview":
            self._stop_audition()
            self.voice_player.stop()
            self.voice_player.setSource(QUrl())
            if self._voice_temp is None:
                self._voice_temp = tempfile.TemporaryDirectory(prefix="zodiac-voice-preview-")
            arguments += ["--voice", self.values()["voice"], "--output", str(Path(self._voice_temp.name) / "preview.wav")]
        self._voice_busy(True)
        self.voice_status.setText("Đang lấy danh sách giọng từ VieNeu…" if operation == "voices" else "Đang tạo câu nghe thử bằng VieNeu…")
        self.voice_timeout.start(120_000)
        self.voice_process.start(str(python), arguments)

    def _refresh_voices(self) -> None:
        self._start_voice_operation("voices")

    def set_server_voices(self, update: dict) -> None:
        choices = update.get("choices", [])
        voices = []
        for choice in choices:
            if isinstance(choice, (list, tuple)) and len(choice) == 2:
                label, value = choice
            else:
                label = value = choice
            if isinstance(label, str) and isinstance(value, str) and value.strip():
                voices.append((label, value))
        if not voices:
            self.voice_status.setText("VieNeu chưa nạp model hoặc chưa có giọng; giữ danh sách đã lưu.")
            return
        selected = self.values()["voice"]
        self._server_voice_ids = {value for _label, value in voices}
        self.voice.clear()
        for label, value in voices:
            self.voice.addItem(label, value)
        index = self.voice.findData(selected)
        if index < 0:
            self.voice.addItem(selected + " (giọng đã lưu, chưa có trên server)", selected)
            index = self.voice.count() - 1
        self.voice.setCurrentIndex(index)
        self.voice_status.setText(f"Đã kết nối VieNeu · {len(voices)} giọng." if index < len(voices)
                                  else "Giọng đã lưu chưa có trên server; chọn lại giọng trước khi nghe thử.")

    def _toggle_voice_preview(self) -> None:
        if self.voice_player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.voice_player.stop()
            self.voice_status.setText("Đã dừng nghe thử giọng.")
        else:
            self._start_voice_operation("preview")

    def _voice_playback_changed(self, state) -> None:
        self.voice_preview.setText("Dừng nghe thử giọng" if state == QMediaPlayer.PlaybackState.PlayingState else "Nghe thử giọng")
        if (state == QMediaPlayer.PlaybackState.StoppedState and self._voice_operation == "preview"
                and self.voice_process.state() == QProcess.ProcessState.NotRunning
                and self.voice_player.error() == QMediaPlayer.Error.NoError):
            self.voice_status.setText("Đã kết thúc nghe thử giọng.")

    def _voice_output(self) -> None:
        self._voice_buffer += bytes(self.voice_process.readAllStandardOutput())
        while b"\n" in self._voice_buffer:
            raw, self._voice_buffer = self._voice_buffer.split(b"\n", 1)
            line = raw.decode("utf-8", errors="replace")
            try:
                if line.startswith("VIENEU_EVENT "):
                    self.voice_status.setText(str(json.loads(line[13:])["message"]))
                elif line.startswith("VIENEU_VOICES "):
                    self._voice_result = json.loads(line[14:])
                elif line.startswith("VIENEU_PREVIEW_READY "):
                    self._voice_result = json.loads(line[21:])
            except (ValueError, KeyError, TypeError):
                self._voice_error = "VieNeu trả dữ liệu không hợp lệ."

    def _voice_error_output(self) -> None:
        self._voice_error = (self._voice_error + bytes(self.voice_process.readAllStandardError()).decode("utf-8", errors="replace"))[-2000:]

    def _voice_finished(self, exit_code: int, _status) -> None:
        self._voice_output()
        self._voice_error_output()
        self.voice_timeout.stop()
        self._voice_busy(False)
        if exit_code or self._voice_result is None:
            detail = self._voice_error.strip().splitlines()
            self.voice_status.setText("Không thực hiện được yêu cầu VieNeu: " + (detail[-1] if detail else "không có kết quả"))
        elif self._voice_operation == "voices" and isinstance(self._voice_result, dict):
            self.set_server_voices(self._voice_result)
        elif self._voice_operation == "preview":
            path = Path(self._voice_temp.name) / "preview.wav"
            if self._voice_result != str(path) or not path.is_file():
                self.voice_status.setText("VieNeu chưa tạo được file nghe thử.")
                return
            self.voice_player.setSource(QUrl.fromLocalFile(str(path)))
            self.voice_player.play()
            self.voice_status.setText("Đang nghe câu mẫu bằng giọng đã chọn.")

    def _voice_process_error(self, error) -> None:
        if error == QProcess.ProcessError.FailedToStart:
            self.voice_timeout.stop()
            self._voice_busy(False)
            self.voice_status.setText("Không khởi chạy được kết nối VieNeu: " + self.voice_process.errorString())

    def _voice_timed_out(self) -> None:
        self._voice_error = "VieNeu không phản hồi trong 120 giây."
        self.voice_process.kill()

    def _browse_music(self) -> None:
        patterns = " ".join(f"*{ext}" for ext in sorted(SUPPORTED_MUSIC_EXTENSIONS))
        path, _ = QFileDialog.getOpenFileName(self, "Chọn nhạc nền", self.music.text(), f"Âm thanh ({patterns});;Tất cả tệp (*)")
        if path:
            self.music.setText(str(Path(path)))

    def _volume_changed(self, value: int) -> None:
        self.volume_label.setText(f"{value}%")
        self.audio_output.setVolume(value / 100)

    def _toggle_audition(self) -> None:
        self.voice_player.stop()
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
