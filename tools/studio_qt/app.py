from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path

from PySide6.QtCore import Qt, QTimer, Slot
from PySide6.QtGui import QAction, QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QApplication,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QStackedWidget,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from tools.studio.controller import StudioController
from tools.studio.job_state import JobStateStore
from tools.studio.pipeline import DONE, FAILED, PENDING, RUNNING, SKIPPED, CANCELLED
from tools.studio.preflight import Job5PreflightChecker, PreflightChecker
from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.studio_v2.executor import ExecutorConfig
from tools.studio_v2.session import StudioV2Session, detect_job5_manifest
from tools.studio.messages_vi import ALIGN_MODEL_DEFAULT
from tools.studio_qt.events import WorkerEventBridge
from tools.studio_qt.screens.home import HomeScreen
from tools.studio_qt.screens.media import MediaWorkspace
from tools.studio_qt.screens.workbench import STAGE_TITLES, WorkbenchScreen
from tools.studio_qt.theme import stylesheet
from tools.zodiac_local import (
    DEFAULT_MUSIC_VOLUME,
    default_music_path,
)

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / ".zodiac-work"
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
MUSIC_DIRECTORIES = (ROOT / "asset" / "music", ROOT / "assets" / "music")
LEGACY_STAGES = {
    "PACKAGE": ("IMPORT_PACKAGE",),
    "VOICE": ("VOICE_SCENES", "CONCAT_VOICE"),
    "TIMING": ("ALIGN_TIMING", "VALIDATE_RUNTIME"),
    "PLAN": ("PREPARE_RENDERER",),
    "RENDER": ("RENDER_VIDEO",),
    "AUDIO": ("MIX_MUSIC",),
    "OUTPUT": ("MIX_MUSIC",),
}
LEGACY_RERUN = {
    "PACKAGE": "IMPORT_PACKAGE",
    "VOICE": "VOICE_SCENES",
    "TIMING": "ALIGN_TIMING",
    "PLAN": "PREPARE_RENDERER",
    "RENDER": "RENDER_VIDEO",
    "AUDIO": "MIX_MUSIC",
}


class ZodiacQtApp(QMainWindow):
    def __init__(self, workspace: Path | None = None, parent=None) -> None:
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose, True)
        self.workspace = Path(workspace or WORKSPACE).resolve()
        self.controller = StudioController(self.workspace, tts_root=TTS_ROOT, vieneu_url=TTS_URL)
        self.v2_session = StudioV2Session(self.workspace)
        self.bridge = WorkerEventBridge(self)
        self.bridge.event_received.connect(self._on_legacy_event)
        self.bridge.log_received.connect(self._on_log)
        self.bridge.operation_finished.connect(self._on_operation_finished)
        self.mode = "legacy"
        self.busy = False
        self.pipeline_running = False
        self.selected_stage: str | None = None
        self.close_when_stopped = False
        self.settings = {"voice": preferred_voice(saved_voices()), "music": str(default_music_path() or ""), "volume": DEFAULT_MUSIC_VOLUME, "align_model": ALIGN_MODEL_DEFAULT}
        self.setWindowTitle("Zodiac Studio · Task Workbench")
        self.resize(1260, 860)
        self.setMinimumSize(1024, 680)
        self.setStyleSheet(stylesheet())

        self.stack = QStackedWidget()
        self.home = HomeScreen(self._recent_jobs())
        self.home.import_requested.connect(self._choose_archive)
        self.home.ready_import_requested.connect(self._import_ready_archive)
        self.home.ready_refresh_requested.connect(self._refresh_ready_archives)
        self.home.job_requested.connect(self._open_recent)
        self._refresh_ready_archives()
        self.stack.addWidget(self.home)
        self.media = MediaWorkspace()
        self.media.set_jobs(self._media_jobs())
        self.media.refresh_jobs_requested.connect(self._refresh_media_jobs)
        self._media_output: tuple[str | None, str | None] | None = None
        self.main_tabs = QTabWidget()
        self.main_tabs.setDocumentMode(True)
        self.main_tabs.setMovable(False)
        self.main_tabs.addTab(self.stack, "Công việc / Workspace")
        self.main_tabs.addTab(self.media, "Media")
        self.main_tabs.currentChanged.connect(self._main_tab_changed)

        shell = QWidget()
        shell_layout = QVBoxLayout(shell)
        shell_layout.setContentsMargins(0, 0, 0, 0)
        shell_layout.setSpacing(0)
        topbar = QWidget(objectName="appTopbar")
        topbar_layout = QHBoxLayout(topbar)
        topbar_layout.setContentsMargins(22, 8, 22, 8)
        topbar_layout.setSpacing(14)
        topbar_layout.addWidget(QLabel("ZODIAC STUDIO", objectName="brand"))
        self.header_job = QLabel("Chưa mở công việc", objectName="muted")
        self.header_job.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.header_job.setMinimumWidth(180)
        topbar_layout.addWidget(self.header_job, 1)
        self.header_settings_button = QPushButton("Thiết lập")
        self.header_settings_button.setEnabled(False)
        self.header_settings_button.clicked.connect(self._open_settings)
        topbar_layout.addWidget(self.header_settings_button)
        shell_layout.addWidget(topbar)
        shell_layout.addWidget(self.main_tabs, 1)
        self.setCentralWidget(shell)
        self.workbench: WorkbenchScreen | None = None
        self._shortcuts = []
        for sequence, callback in (
            ("Ctrl+O", self._choose_archive),
            ("Ctrl+R", lambda: self._start(resume=True)),
            ("Ctrl+Shift+R", lambda: self._start(resume=False)),
            ("Ctrl+L", self._toggle_logs),
            ("Escape", self._show_home),
        ):
            shortcut = QShortcut(QKeySequence(sequence), self)
            shortcut.setContext(Qt.ShortcutContext.WindowShortcut)
            shortcut.activated.connect(callback)
            self._shortcuts.append(shortcut)
        self._refresh_timer = QTimer(self)
        self._refresh_timer.setInterval(250)
        self._refresh_timer.timeout.connect(self._refresh_workbench)
        QTimer.singleShot(0, self._restore_session)

    def _recent_jobs(self) -> list[dict]:
        jobs = []
        for path in sorted(self.workspace.joinpath("v2", "jobs").glob("*"), key=lambda item: item.stat().st_mtime, reverse=True):
            if path.is_dir() and (path / "package-manifest.json").is_file():
                jobs.append({"name": path.name, "state": self._job5_recent_state(path), "path": str(path)})
        for path in sorted(self.workspace.joinpath("jobs").glob("*"), key=lambda item: item.stat().st_mtime, reverse=True):
            if not path.is_dir():
                continue
            state = JobStateStore(path).load()
            steps = list((state or {}).get("steps", {}).values())
            statuses = [str(item.get("status", "")) for item in steps]
            status = "Cần xử lý" if FAILED in statuses else "Đang chạy" if RUNNING in statuses else "Cần tiếp tục" if any(value in (PENDING, CANCELLED) for value in statuses) else "Hoàn tất" if statuses and all(value == DONE for value in statuses) else "Job local"
            jobs.append({"name": path.name, "state": status, "path": str(path)})
        return jobs[:12]

    def _media_jobs(self) -> list[dict]:
        jobs = []
        for group, directory, job5 in (
            ("Job@5", self.workspace / "v2" / "jobs", True),
            ("Job local", self.workspace / "jobs", False),
        ):
            try:
                paths = sorted(directory.iterdir(), key=lambda item: item.name.casefold())
            except OSError:
                continue
            for path in paths:
                if not path.is_dir() or path.name.startswith("."):
                    continue
                output = path / "out"
                if not output.is_dir() or (job5 and not (path / "package-manifest.json").is_file()):
                    continue
                jobs.append({
                    "group": group,
                    "name": path.name,
                    "path": str(path.resolve()),
                    "out_path": str(output.resolve()),
                })
        return jobs

    def _refresh_media_jobs(self) -> None:
        self.media.set_jobs(self._media_jobs())

    @staticmethod
    def _job5_recent_state(path: Path) -> str:
        try:
            state = json.loads((path / ".runtime" / "studio-v2-state.json").read_text(encoding="utf-8"))
            steps = state.get("steps", {})
            statuses = {name: str(row.get("status", "")) for name, row in steps.items()}
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            return "Job@5"
        names = {"PACKAGE": "Gói", "VOICE": "Giọng", "TIMING": "Timing", "PLAN": "Kế hoạch", "RENDER": "Render", "AUDIO": "Âm thanh", "OUTPUT": "Đầu ra"}
        for wanted, label in ((FAILED, "Cần xử lý"), (RUNNING, "Đang chạy"), (CANCELLED, "Đã dừng"), (PENDING, "Cần tiếp tục")):
            step = next((key for key in names if statuses.get(key) == wanted), None)
            if step:
                return f"{label} · {names[step]}"
        if statuses and all(value == DONE for value in statuses.values()):
            return "Hoàn tất · 7/7 bước" if len(statuses) == 7 else f"Hoàn tất · {len(statuses)}/7 bước"
        return "Job@5"

    def _restore_session(self) -> None:
        try:
            payload = json.loads((self.workspace / "gui-session.json").read_text(encoding="utf-8"))
            rel = payload.get("job") if isinstance(payload, dict) else None
            if isinstance(rel, str):
                path = (self.workspace / rel).resolve()
                if path.exists() and path.is_relative_to(self.workspace):
                    self._open_recent(str(path))
        except (OSError, ValueError, TypeError):
            pass

    def _ready_archives(self) -> list[str]:
        """Only regular ZIP files directly under this workspace's ready/ folder."""
        ready = self.workspace / "ready"
        try:
            paths = (p for p in ready.iterdir() if p.is_file() and not p.is_symlink() and p.suffix.casefold() == ".zip")
            return [str(p.resolve()) for p in sorted(paths, key=lambda p: (-p.stat().st_mtime, p.name.casefold()))]
        except OSError:
            return []

    def _refresh_ready_archives(self) -> None:
        self.home.set_ready_packages(self._ready_archives())

    def _import_ready_archive(self, raw_path: str) -> None:
        path = Path(raw_path).resolve()
        ready = (self.workspace / "ready").resolve()
        if not path.is_file() or path.parent != ready or path.suffix.casefold() != ".zip":
            QMessageBox.warning(self, "Gói không hợp lệ", "Chỉ chọn ZIP hiện có trong thư mục ready/ của workspace.")
            self._refresh_ready_archives()
            return
        self._run_operation("import", path)

    def _choose_archive(self) -> None:
        ready = self.workspace / "ready"
        filename, _ = QFileDialog.getOpenFileName(self, "Nhập gói video", str(ready if ready.is_dir() else self.workspace), "Gói video (*.zip);;Tất cả tệp (*)")
        if not filename:
            return
        self._run_operation("import", Path(filename))

    def _open_recent(self, raw_path: str) -> None:
        path = Path(raw_path).resolve()
        if not path.exists() or not path.is_relative_to(self.workspace):
            QMessageBox.warning(self, "Không mở được job", "Job nằm ngoài workspace hoặc không còn tồn tại.")
            return
        self._run_operation("open", path)

    def _run_operation(self, name: str, value: Path) -> None:
        if self.busy or self.pipeline_running:
            return
        self.busy = True
        self.home.import_button.setEnabled(False)
        self.home.ready_import_button.setEnabled(False)

        def run() -> None:
            try:
                if name == "import" and detect_job5_manifest(value) is not None:
                    path = self.v2_session.import_archive(value)
                    mode = "job5"
                elif name == "open" and value.parent == self.workspace / "v2" / "jobs":
                    path = self.v2_session.open_workspace(value)
                    mode = "job5"
                else:
                    if name == "import":
                        self.controller.select_archive(value)
                        if self.controller.package_changed:
                            self.bridge.operation_finished.emit("package_conflict", (None, value, None))
                            return
                        self.controller.sync_package()
                    else:
                        self.controller.use_job(value)
                    path = self.controller.job
                    mode = "legacy"
                self.bridge.operation_finished.emit(name, (mode, path, None))
            except Exception as exc:
                self.bridge.operation_finished.emit(name, (None, None, exc))

        threading.Thread(target=run, daemon=True).start()

    def _active_job(self) -> Path | None:
        return self.v2_session.job if self.mode == "job5" else self.controller.job

    def _active_video(self) -> Path | None:
        return self.v2_session.video_path if self.mode == "job5" else self.controller.video_path

    def _load_settings(self, job: Path) -> None:
        path = job / ".runtime" / "gui-settings.json"
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(value, dict):
                self.settings.update({key: value[key] for key in self.settings.keys() & value.keys()})
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            pass

    def _save_session(self, job: Path) -> None:
        try:
            self.workspace.mkdir(parents=True, exist_ok=True)
            path = self.workspace / "gui-session.json"
            temp = path.with_suffix(".json.tmp")
            temp.write_text(json.dumps({"mode": "v2" if self.mode == "job5" else "legacy", "job": job.resolve().relative_to(self.workspace).as_posix()}), encoding="utf-8")
            os.replace(temp, path)
            settings_path = job / ".runtime" / "gui-settings.json"
            settings_path.parent.mkdir(parents=True, exist_ok=True)
            temp = settings_path.with_suffix(".json.tmp")
            temp.write_text(json.dumps(self.settings, ensure_ascii=False) + "\n", encoding="utf-8")
            os.replace(temp, settings_path)
        except (OSError, ValueError):
            pass

    def _v2_rows(self) -> list[dict]:
        return self.v2_session.pipeline_rows()

    def _legacy_rows(self) -> list[dict]:
        source = {row["step"]: row for row in self.controller.pipeline_rows()}
        rows = []
        rank = {FAILED: 5, RUNNING: 4, PENDING: 3, CANCELLED: 2, SKIPPED: 1, DONE: 0}
        for stage, steps in LEGACY_STAGES.items():
            candidates = [source[step] for step in steps if step in source]
            active = max(candidates, key=lambda row: rank.get(row["status"], 0), default={})
            states = [row["status"] for row in candidates]
            if states and all(state in (DONE, SKIPPED) for state in states):
                status = DONE
            else:
                status = active.get("status", PENDING)
            rows.append({"step": stage, "status": status, "detail": active.get("message", ""), "progress": active.get("progress", 0.0)})
        return rows

    def _refresh_workbench(self) -> None:
        if self.workbench is None or self._active_job() is None:
            return
        rows = self._v2_rows() if self.mode == "job5" else self._legacy_rows()
        self.workbench.set_rows(rows)
        active = next((row for row in rows if row.get("status") in (RUNNING, FAILED, PENDING)), rows[-1])
        if not self.pipeline_running and self.selected_stage:
            active = next((row for row in rows if row.get("step") == self.selected_stage), active)
        percent = None
        if self.mode == "legacy" and active.get("status") == RUNNING and float(active.get("progress", 0.0)) > 0:
            percent = float(active["progress"])
        self.workbench.set_active_stage(active["step"], active, percent=percent)
        pipeline_active = self.pipeline_running or bool(self.v2_session.running) or bool(self.controller.worker and self.controller.worker.is_alive())
        self.workbench.set_running(pipeline_active, busy=self.busy and not pipeline_active)
        self.header_settings_button.setEnabled(not pipeline_active and not self.busy)
        video = self._active_video()
        video = video if video and video.is_file() else None
        job = self._active_job()
        output_dir = job / "out"
        if not output_dir.is_dir():
            output_dir = None
        if video and output_dir:
            try:
                if not video.resolve().is_relative_to(output_dir.resolve()):
                    video = None
            except (OSError, ValueError):
                video = None
        else:
            video = None
        output = (str(video.resolve()) if video else None, str(output_dir.resolve()) if output_dir else None)
        self.workbench.set_output(*output)
        if output != self._media_output:
            self.media.set_jobs(self._media_jobs())
            self.media.set_output(*output, job_path=job)
            self._media_output = output
        if self.pipeline_running and self.mode == "legacy" and not (self.controller.worker and self.controller.worker.is_alive()):
            self.pipeline_running = False
            self._refresh_timer.stop()
            if self.close_when_stopped:
                self.close()

    def _main_tab_changed(self, index: int) -> None:
        if self.main_tabs.widget(index) is self.media:
            self._refresh_media_jobs()
        else:
            self.media.player.pause()

    @Slot(str, dict)
    def _on_legacy_event(self, kind: str, payload: dict) -> None:
        if self.workbench:
            self.workbench.append_activity(payload.get("text") or payload.get("message") or kind)
        self._refresh_workbench()

    @Slot(str, str)
    def _on_log(self, line: str, channel: str) -> None:
        if self.workbench:
            self.workbench.append_activity(f"[{channel}] {line}")
        self._refresh_workbench()

    def _start(self, *, resume: bool, rerun: str | None = None) -> None:
        job = self._active_job()
        if job is None or self.busy or self.pipeline_running:
            return
        music_raw = str(self.settings.get("music", "")).strip()
        music = Path(music_raw).expanduser() if music_raw else None
        if music and not music.is_file():
            QMessageBox.warning(self, "Không tìm thấy nhạc", "Chọn lại file nhạc nền trong Thiết lập.")
            return
        if self.mode == "legacy":
            rerun_step = LEGACY_RERUN.get(rerun) if rerun else None
            started = self.controller.start_pipeline(
                resume=resume, rerun=rerun_step, voice=self.settings["voice"], music=music,
                volume=float(self.settings["volume"]), align_model=self.settings["align_model"],
                on_event=lambda kind, payload: self.bridge.event_received.emit(kind, payload),
            )
            if not started:
                self.workbench.append_activity(self.controller.status_text)
                return
            self.pipeline_running = True
        else:
            self.v2_session.cancel_event.clear()
            config = ExecutorConfig(
                voice_profile=self.settings["voice"],
                tts_settings={"mode": "v3turbo", "vieneu_url": TTS_URL, "tts_root": TTS_ROOT, "scene_gap_ms": 0.0},
                tts_engine_version="vieneu-v3turbo@local-v1",
                aligner_settings={"model": self.settings["align_model"], "device": "cpu", "compute_type": "int8", "scene_gap_ms": 0.0, "sentence_pause_ms": 0.0},
                aligner_version="faster-whisper@local-v1",
                renderer_version="2.0.0", renderer_hash="zodiac-renderer@2.0.0",
                music_path=music, mix_settings={"volume": float(self.settings["volume"])},
            )
            rerun_from = rerun if rerun else (None if resume else "VOICE")

            def run_v2() -> None:
                try:
                    from tools.zodiac_local import observe_subprocess_output
                    with observe_subprocess_output(lambda line, channel="stdout": self.bridge.log_received.emit(line, channel)):
                        self.v2_session.run(config, rerun_from=rerun_from)
                    self.bridge.operation_finished.emit("run_done", (None, None, None))
                except Exception as exc:
                    self.bridge.operation_finished.emit("run_error", (None, None, exc))

            self.busy = True
            self.pipeline_running = True
            threading.Thread(target=run_v2, daemon=True).start()
        self._save_session(job)
        self._refresh_timer.start()
        self._refresh_workbench()

    def _select_stage(self, stage: str) -> None:
        self.selected_stage = stage
        rows = self._v2_rows() if self.mode == "job5" else self._legacy_rows()
        row = next((row for row in rows if row["step"] == stage), {"status": PENDING})
        percent = float(row.get("progress", 0.0)) if self.mode == "legacy" and row.get("status") == RUNNING and float(row.get("progress", 0)) > 0 else None
        self.workbench.set_active_stage(stage, row, percent=percent)

    def _rerun(self, stage: str) -> None:
        self._start(resume=True, rerun=stage)

    def _cancel(self) -> None:
        if self.mode == "job5":
            self.v2_session.cancel()
        else:
            self.controller.cancel()
        self.workbench.append_activity("Đang chờ bước hiện tại dừng an toàn…")

    def _on_operation_finished(self, name: str, result: object) -> None:
        if name == "package_conflict":
            self.busy = False
            self.home.import_button.setEnabled(True)
            answer = QMessageBox.question(
                self,
                "Gói video đã thay đổi",
                "ZIP được chọn có nội dung khác job hiện tại.\n\n"
                "Nhập bản mới sẽ cập nhật nội dung gói và giữ lại cache local có thể dùng lại.\n"
                "Bạn muốn nhập bản mới? Chọn No để tiếp tục giữ job hiện tại.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No | QMessageBox.StandardButton.Cancel,
                QMessageBox.StandardButton.Cancel,
            )
            if answer == QMessageBox.StandardButton.Yes:
                self.busy = True
                self.home.import_button.setEnabled(False)

                def resolve() -> None:
                    try:
                        self.controller.accept_package_conflict("import")
                        self.bridge.operation_finished.emit("import", ("legacy", self.controller.job, None))
                    except Exception as exc:
                        self.bridge.operation_finished.emit("import", (None, None, exc))

                threading.Thread(target=resolve, daemon=True).start()
            else:
                self.controller.accept_package_conflict("keep")
                if self.close_when_stopped:
                    self.close()
            return
        if name == "install_plan":
            self.busy = False
            commands, missing, error = result
            if error:
                QMessageBox.critical(self, "Không chuẩn bị được cài đặt", error)
                return
            if not missing:
                QMessageBox.information(self, "Dependency đã sẵn sàng", "Không có dependency cài thêm.")
                self._refresh_workbench()
                return
            if not commands:
                QMessageBox.warning(
                    self,
                    "Cần cài thủ công",
                    "Các mục còn thiếu không có lệnh cài tự động an toàn:\n\n" + "\n".join(missing),
                )
                self.workbench.append_activity("Cần xử lý dependency thủ công; xem kết quả kiểm tra môi trường.")
                return
            command_text = "\n".join(" ".join(f'"{part}"' if " " in part else part for part in command) for command in commands)
            answer = QMessageBox.question(
                self,
                "Xác nhận cài dependency",
                "Thiếu:\n" + "\n".join(missing) + "\n\nSẽ chạy:\n" + command_text + "\n\nTiếp tục?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            if answer == QMessageBox.StandardButton.Yes:
                self.busy = True
                self._refresh_workbench()
                threading.Thread(target=self._execute_install, args=(commands,), daemon=True).start()
            elif self.close_when_stopped:
                self.close()
            return
        if name == "install_done":
            self.busy = False
            code, error = result
            self.workbench.append_activity("Cài dependency hoàn tất." if not error and code == 0 else "Cài dependency thất bại; xem nhật ký.")
            if error or code:
                QMessageBox.critical(self, "Cài dependency thất bại", error or f"Lệnh trả về mã {code}.")
                self._refresh_workbench()
            else:
                self._check_environment()
            if self.close_when_stopped and not self.busy:
                self.close()
            return
        if name in ("import", "open"):
            self.busy = False
            self.home.import_button.setEnabled(True)
            self._refresh_ready_archives()
            mode, path, error = result
            if error is not None:
                QMessageBox.critical(self, "Không mở được gói video", str(error))
                if self.close_when_stopped:
                    self.close()
                return
            self.mode = mode
            self.selected_stage = None
            self.home.set_recent_jobs(self._recent_jobs())
            self._refresh_ready_archives()
            self._load_settings(path)
            self._save_session(path)
            self.header_job.setText(f"{Path(path).name}  ·  {'Job@5' if mode == 'job5' else 'Job local'}")
            self.header_job.setToolTip(str(path))
            self.header_settings_button.setEnabled(True)
            self._media_output = None
            self.media.set_jobs(self._media_jobs(), selected_path=path)
            self.main_tabs.setCurrentWidget(self.stack)
            if self.workbench:
                self.stack.removeWidget(self.workbench)
                self.workbench.deleteLater()
            self.workbench = WorkbenchScreen()
            self.workbench.home_requested.connect(self._show_home)
            self.workbench.set_job(
                Path(path).name,
                revision=self.v2_session.package_revision if mode == "job5" else None,
                mode="job5" if mode == "job5" else "Job local",
                rows=self._v2_rows() if mode == "job5" else self._legacy_rows(),
            )
            self.workbench.set_log_file(Path(path) / ".runtime" / "studio-gui.log")
            self.workbench.continue_requested.connect(lambda: self._start(resume=True))
            self.workbench.run_all_requested.connect(lambda: self._start(resume=False))
            self.workbench.cancel_requested.connect(self._cancel)
            self.workbench.rerun_requested.connect(self._rerun)
            self.workbench.stage_selected.connect(self._select_stage)
            self.workbench.output_requested.connect(self._open_output)
            self.workbench.more_button.clicked.connect(self._show_actions_menu)
            self.stack.addWidget(self.workbench)
            self.stack.setCurrentWidget(self.workbench)
            self._refresh_workbench()
            if self.close_when_stopped:
                self.close()
            elif not error:
                self._check_environment(show_result=False)
            return
        if name == "preflight":
            self.busy = False
            ready, failure, show_result = result
            self.workbench.set_environment_state(ready, failure or "")
            if show_result:
                if failure:
                    QMessageBox.warning(self, "Môi trường chưa sẵn sàng", failure)
                else:
                    QMessageBox.information(self, "Môi trường sẵn sàng", "Các thành phần cần thiết đã sẵn sàng.")
            self._refresh_workbench()
            if self.close_when_stopped:
                self.close()
            return
        if name in ("run_done", "run_error"):
            self.busy = False
            self.pipeline_running = False
            self._refresh_timer.stop()
            if name == "run_error" and result[2] is not None:
                self.workbench.append_activity(str(result[2]))
                QMessageBox.critical(self, "Quy trình chưa hoàn tất", str(result[2]))
            self._refresh_workbench()
            if self.close_when_stopped:
                self.close()
            return
    def _open_output(self, kind: str) -> None:
        raw_path = self.workbench.output_path(kind) if self.workbench else None
        if not raw_path:
            return
        self._refresh_media_jobs()
        path = Path(raw_path)
        if kind == "video":
            if not path.is_file():
                QMessageBox.warning(self, "Không tìm thấy video", "Tệp đầu ra đã bị di chuyển hoặc xóa.")
                return
            self.media.open_media(path)
        else:
            if not path.is_dir():
                QMessageBox.warning(self, "Không tìm thấy thư mục", "Thư mục đầu ra đã bị di chuyển hoặc xóa.")
                return
            self.media.open_folder(path)
        self.main_tabs.setCurrentWidget(self.media)

    def _show_actions_menu(self) -> None:
        menu = self.workbench.more_button.menu()
        if menu is None:
            from PySide6.QtWidgets import QMenu
            menu = QMenu(self.workbench.more_button)
            check = QAction("Kiểm tra môi trường", menu)
            check.triggered.connect(self._check_environment)
            menu.addAction(check)
            install = QAction("Cài dependency còn thiếu…", menu)
            install.triggered.connect(self._install_dependencies)
            menu.addAction(install)
            studio = QAction("Mở Remotion Studio", menu)
            studio.triggered.connect(self._open_remotion)
            menu.addAction(studio)
            menu.addSeparator()
            switch = QAction("Về danh sách job", menu)
            switch.triggered.connect(self._show_home)
            menu.addAction(switch)
            self.workbench.more_button.setMenu(menu)
        menu.exec(self.workbench.more_button.mapToGlobal(self.workbench.more_button.rect().bottomLeft()))

    def _show_home(self) -> None:
        self.home.set_recent_jobs(self._recent_jobs())
        self._refresh_ready_archives()
        self.main_tabs.setCurrentWidget(self.stack)
        self.stack.setCurrentWidget(self.home)

    def _toggle_logs(self) -> None:
        if self.workbench and self.main_tabs.currentWidget() is self.stack and self.stack.currentWidget() is self.workbench:
            self.workbench.log_toggle.toggle()

    def _check_environment(self, _checked: bool = False, *, show_result: bool = True) -> None:
        job = self._active_job()
        if not job:
            return
        if self.busy or self.pipeline_running:
            return
        def check() -> None:
            try:
                checker = Job5PreflightChecker(job, tts_root=TTS_ROOT, vieneu_url=TTS_URL) if self.mode == "job5" else self.controller.preflight()
                music_raw = str(self.settings.get("music", "")).strip()
                checker.require_music = bool(music_raw)
                checker.music_path = Path(music_raw).expanduser() if music_raw else None
                checks = checker.run()
                failures = [f"{item.label}: {item.message}" for item in checks if not item.ok]
                detail = "\n".join(f"{item.label}: {item.message}\n{item.details}" for item in checks if not item.ok)
                self.bridge.operation_finished.emit("preflight", (not failures, detail, show_result))
            except Exception as exc:
                self.bridge.operation_finished.emit("preflight", (False, str(exc), show_result))
        self.busy = True
        self.workbench.append_activity("Đang kiểm tra môi trường…")
        self._refresh_workbench()
        threading.Thread(target=check, daemon=True).start()

    def _install_dependencies(self) -> None:
        if self.busy or self.pipeline_running or not self._active_job():
            return

        def inspect() -> None:
            try:
                checker = Job5PreflightChecker(self._active_job(), tts_root=TTS_ROOT, vieneu_url=TTS_URL) if self.mode == "job5" else PreflightChecker(self._active_job(), tts_root=TTS_ROOT, vieneu_url=TTS_URL)
                checks = checker.run()
                missing = [f"{check.label}: {check.message}" for check in checks if check.error_code == "DEPENDENCY_MISSING"]
                commands = checker.install_commands([check for check in checks if check.error_code == "DEPENDENCY_MISSING"]) if isinstance(checker, Job5PreflightChecker) else ([checker.install_command()] if missing else [])
                self.bridge.operation_finished.emit("install_plan", (commands, missing, None))
            except Exception as exc:
                self.bridge.operation_finished.emit("install_plan", ([], [], str(exc)))

        self.busy = True
        self.workbench.append_activity("Đang kiểm tra dependency có thể cài…")
        self._refresh_workbench()
        threading.Thread(target=inspect, daemon=True).start()

    def _execute_install(self, commands: list[list[str]]) -> None:
        if self.mode == "legacy":
            try:
                self.controller.install_dependencies(
                    log_callback=lambda line: self.bridge.log_received.emit(line, "install")
                )
                status = self.controller.status_text
                code = 0 if status.startswith("Đã cài") else 1
                self.bridge.operation_finished.emit("install_done", (code, None if code == 0 else status))
            except Exception as exc:
                self.bridge.operation_finished.emit("install_done", (1, str(exc)))
            return
        try:
            code = 0
            for command in commands:
                self.bridge.log_received.emit("$ " + " ".join(command), "install")
                process = subprocess.Popen(
                    command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace", shell=False,
                )
                if process.stdout is not None:
                    for line in process.stdout:
                        self.bridge.log_received.emit(line.rstrip(), "install")
                code = process.wait()
                if code:
                    break
            self.bridge.operation_finished.emit("install_done", (code, None))
        except Exception as exc:
            self.bridge.operation_finished.emit("install_done", (1, str(exc)))

    def _open_remotion(self) -> None:
        if self.mode == "job5":
            self.workbench.append_activity("Remotion Studio riêng hiện chưa hỗ trợ Job@5.")
            return
        job = self.controller.job
        if job:
            subprocess.Popen([sys.executable, "tools/zodiac_local.py", "preview", job.name, "--workspace", str(self.workspace)], cwd=ROOT, shell=False)

    def _open_settings(self) -> None:
        if self.busy or self.pipeline_running:
            return
        from tools.studio_qt.dialogs.settings import SettingsDialog
        dialog = SettingsDialog(self.settings, self)
        saved = dialog.exec()
        values = dialog.values() if saved else None
        dialog.deleteLater()
        if saved:
            self.settings = values
            job = self._active_job()
            if job:
                self._save_session(job)

    def closeEvent(self, event) -> None:
        if self.pipeline_running or (self.controller.worker and self.controller.worker.is_alive()):
            self.close_when_stopped = True
            self._cancel()
            event.ignore()
            return
        if self.busy:
            self.close_when_stopped = True
            event.ignore()
            return
        event.accept()


def main() -> int:
    app = QApplication.instance() or QApplication(sys.argv)
    window = ZodiacQtApp()
    window.show()
    return app.exec()
