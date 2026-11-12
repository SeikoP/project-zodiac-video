"""Own only the VieNeu process launched by this GUI; reuse external servers."""
from __future__ import annotations
import json
from pathlib import Path
from urllib.parse import urlsplit
from PySide6.QtCore import QProcess, QProcessEnvironment, QTimer, QUrl, Signal
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkRequest
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QWidget


class VieNeuControl(QWidget):
    log_received = Signal(str, str)

    def __init__(self, root: Path, url: str, log_path: Path, parent=None):
        super().__init__(parent)
        self.root, self.url, self.log_path = Path(root), url.rstrip("/"), Path(log_path)
        parsed = urlsplit(url)
        self.local = parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost", "::1")
        self.host, self.port = parsed.hostname, parsed.port or 7860
        self.ready, self.in_use, self.checking = False, False, False
        self.process = QProcess(self)
        self.process.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        self.process.readyReadStandardOutput.connect(self._read_output)
        self.process.errorOccurred.connect(self._process_error)
        self.process.finished.connect(self._finished)
        self.network = QNetworkAccessManager(self)
        row = QHBoxLayout(self)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(6)
        self.status = QLabel("VieNeu · kiểm tra…", objectName="muted")
        self.status.setMaximumWidth(155)
        self.start_button = QPushButton("Bật VieNeu")
        self.stop_button = QPushButton("Tắt")
        self.start_button.clicked.connect(self.start)
        self.stop_button.clicked.connect(self.stop)
        row.addWidget(self.status);row.addWidget(self.start_button);row.addWidget(self.stop_button)
        self.timer = QTimer(self)
        self.timer.setInterval(5000)
        self.timer.timeout.connect(self.probe)
        self.timer.start()
        QTimer.singleShot(0, self.probe)
        self._buttons()

    @property
    def owned(self):
        return self.process.state() != QProcess.ProcessState.NotRunning

    def _buttons(self):
        self.start_button.setEnabled(self.local and not self.owned and not self.ready and not self.in_use)
        self.stop_button.setEnabled(self.owned and not self.in_use)
        self.stop_button.setToolTip("Đợi tạo giọng xong trước khi tắt." if self.in_use else "Tắt VieNeu do GUI này bật; không tắt server bên ngoài.")

    def set_in_use(self, active: bool):
        if active != self.in_use:
            self.in_use = active
            self._buttons()

    def probe(self):
        if self.checking:
            return
        self.checking = True
        request = QNetworkRequest(QUrl(self.url + "/config"))
        request.setTransferTimeout(1500)
        reply = self.network.get(request)
        reply.finished.connect(lambda: self._probed(reply))

    def _probed(self, reply):
        self.checking = False
        try:
            data = json.loads(bytes(reply.readAll()).decode("utf-8"))
            self.ready = reply.attribute(QNetworkRequest.Attribute.HttpStatusCodeAttribute) == 200 and isinstance(data, dict) and isinstance(data.get("components"), list)
        except (ValueError, UnicodeError):
            self.ready = False
        reply.deleteLater()
        self.status.setText("VieNeu · sẵn sàng" if self.ready else "VieNeu · đang bật…" if self.owned else "VieNeu · chưa chạy")
        self.status.setToolTip(self.url + (" · GUI quản lý" if self.owned else " · server bên ngoài" if self.ready else ""))
        self._buttons()

    def start(self):
        if not self.local or self.owned or self.ready or self.in_use:
            return
        python = self.root / ".venv" / "Scripts" / "python.exe"
        if not python.is_file():
            python = self.root / ".venv" / "bin" / "python"
        if not python.is_file() or not (self.root / "apps" / "gradio_main.py").is_file():
            self.status.setText("VieNeu · thiếu cài đặt")
            self.status.setToolTip(f"Cần môi trường .venv và apps/gradio_main.py tại {self.root}")
            return
        env = QProcessEnvironment.systemEnvironment()
        for key, value in {"GRADIO_SERVER_NAME": self.host, "GRADIO_SERVER_PORT": str(self.port), "GRADIO_SHARE": "false", "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"}.items():
            env.insert(key, value)
        self.process.setProcessEnvironment(env)
        self.process.setWorkingDirectory(str(self.root))
        self.process.setProgram(str(python))
        self.process.setArguments(["-u", "-m", "apps.gradio_main"])
        self.process.start()
        self.status.setText("VieNeu · đang bật…")
        self._buttons()

    def _read_output(self):
        text = bytes(self.process.readAllStandardOutput()).decode("utf-8", errors="replace")
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with self.log_path.open("a", encoding="utf-8") as stream:
                stream.write(text)
        except OSError as exc:
            self.status.setToolTip(f"Không ghi được log VieNeu: {exc}")
        for line in text.splitlines():
            if line.strip():
                self.log_received.emit(line, "vieneu")

    def _process_error(self, _error):
        self.status.setText("VieNeu · lỗi khởi động")
        self.status.setToolTip(self.process.errorString() + f" · Log: {self.log_path}")
        self._buttons()

    def _finished(self, code, _status):
        self.ready = False
        self.status.setText("VieNeu · đã tắt" if code == 0 else "VieNeu · đã dừng")
        self.status.setToolTip(f"Exit {code} · Log: {self.log_path}")
        self._buttons()

    def stop(self):
        if self.owned and not self.in_use:
            self.process.terminate()
            pid = self.process.processId()
            QTimer.singleShot(3000, lambda: self._kill_owned(pid))
            self.status.setText("VieNeu · đang tắt…")

    def _kill_owned(self, expected_pid):
        if self.owned and not self.in_use and self.process.processId() == expected_pid:
            self.process.kill()

    def shutdown(self):
        self.timer.stop()
        if self.owned:
            self.process.kill()
            self.process.waitForFinished(1500)
