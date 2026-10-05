#!/usr/bin/env python3
"""Desktop controller for the local Zodiac + VieNeu + Remotion workflow."""

from __future__ import annotations

import json
import os
import queue
import re
import shutil
import signal
import subprocess
import sys
import threading
import tkinter as tk
import urllib.error
import urllib.request
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

ROOT = Path(__file__).resolve().parents[1]
TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")
TTS_URL = "http://127.0.0.1:7860"
DEFAULT_ARCHIVE = ROOT / "ready" / "zodiac-sun-gemini-render-ready.zip"
DEFAULT_MUSIC = Path(r"C:\Users\bungm\Downloads\audio [music].mp3")
WORKSPACE = ROOT / ".zodiac-work"
COLORS = {
    "bg": "#171522", "panel": "#211E2B", "field": "#2A2635",
    "fg": "#F5F0E8", "muted": "#B8B0C4", "line": "#40394B",
    "accent": "#E88D7D", "sage": "#91B49A", "danger": "#F08C86",
}


def saved_voices() -> list[str]:
    home = Path(os.environ.get("VIENEU_HOME") or (Path.home() / ".vieneu"))
    try:
        voices = json.loads((home / "user_voices_v3_turbo.json").read_text(encoding="utf-8")).get("presets", {})
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        voices = {}
    return list(voices) or ["Hải Đăng"]


def open_path(path: Path) -> None:
    """Open a file/folder using the native launcher without a shell."""
    path = Path(path).resolve()
    if sys.platform == "win32":
        os.startfile(str(path))
        return

    launcher_name = "open" if sys.platform == "darwin" else "xdg-open"
    launcher = shutil.which(launcher_name)
    if not launcher:
        raise OSError(
            f"Không tìm thấy trình mở mặc định {launcher_name!r}."
        )
    subprocess.Popen(
        [str(Path(launcher).resolve()), str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        shell=False,
    )


def terminate_process_tree(process: subprocess.Popen) -> None:
    """Terminate a detached preview process and its child tree."""
    if process.poll() is not None:
        return

    if os.name == "nt":
        subprocess.run(
            [
                "taskkill",
                "/T",
                "/F",
                "/PID",
                str(process.pid),
            ],
            capture_output=True,
            check=False,
            shell=False,
        )
        return

    try:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        return



class ZodiacGui(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Zodiac Studio · Local")
        self.geometry("800x700")
        self.minsize(700, 620)
        self.configure(bg=COLORS["bg"])
        self.messages: queue.Queue[tuple[str, str]] = queue.Queue()
        initial_archive = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_ARCHIVE
        self.archive = tk.StringVar(value=str(initial_archive if initial_archive.is_file() else DEFAULT_ARCHIVE))
        voices = saved_voices()
        self.voice = tk.StringVar(value="cuongdepzai" if "cuongdepzai" in voices else voices[0])
        self.music = tk.StringVar(value=str(DEFAULT_MUSIC) if DEFAULT_MUSIC.is_file() else "")
        self.volume = tk.DoubleVar(value=0.12)
        self.service_status = tk.StringVar(value="Đang kiểm tra VieNeu…")
        self.video_status = tk.StringVar(value="Chưa có video render")
        self.buttons: list[tk.Button] = []
        self.service_process: subprocess.Popen | None = None
        self.preview_process: subprocess.Popen | None = None
        self.preview_stop_requested = False
        self._style()
        self._build()
        self.after(100, self._drain_messages)
        self.after(1500, self._poll_service)
        self._ensure_service()

    def _style(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Zodiac.Horizontal.TProgressbar", background=COLORS["accent"], troughcolor=COLORS["field"], bordercolor=COLORS["field"], lightcolor=COLORS["accent"], darkcolor=COLORS["accent"])

    def _label(self, parent, text: str, *, size: int = 10, color: str | None = None, bold: bool = False, **kwargs) -> tk.Label:
        return tk.Label(parent, text=text, bg=kwargs.pop("bg", COLORS["panel"]), fg=color or COLORS["fg"],
                        font=("Segoe UI", size, "bold" if bold else "normal"), **kwargs)

    def _button(self, parent, text: str, command, *, primary: bool = False, **kwargs) -> tk.Button:
        button = tk.Button(parent, text=text, command=command, bg=COLORS["accent"] if primary else COLORS["field"],
                           fg=COLORS["bg"] if primary else COLORS["fg"], activebackground="#F2A092" if primary else COLORS["line"],
                           activeforeground=COLORS["fg"], disabledforeground="#81798C", relief="flat", bd=0,
                           padx=14, pady=9, font=("Segoe UI", 10, "bold" if primary else "normal"),
                           cursor="hand2", highlightthickness=1, highlightbackground=COLORS["line"],
                           highlightcolor=COLORS["accent"], **kwargs)
        self.buttons.append(button)
        return button

    def _card(self, parent, title: str, hint: str | None = None) -> tk.Frame:
        card = tk.Frame(parent, bg=COLORS["panel"], highlightthickness=1, highlightbackground=COLORS["line"], padx=16, pady=13)
        self._label(card, title, size=11, bold=True).pack(anchor="w")
        if hint:
            self._label(card, hint, size=9, color=COLORS["muted"]).pack(anchor="w", pady=(2, 10))
        return card

    def _build(self) -> None:
        body = tk.Frame(self, bg=COLORS["bg"], padx=20, pady=16)
        body.pack(fill="both", expand=True)

        head = tk.Frame(body, bg=COLORS["bg"])
        head.pack(fill="x", pady=(0, 14))
        self._label(head, "ZODIAC  /  VIDEO STUDIO", size=17, bold=True, bg=COLORS["bg"]).pack(anchor="w")
        self._label(head, "Local voice, preview & render", size=10, color=COLORS["muted"], bg=COLORS["bg"]).pack(anchor="w", pady=(2, 8))
        service = tk.Frame(head, bg=COLORS["bg"])
        service.pack(anchor="w")
        self.service_dot = self._label(service, "●", size=10, color=COLORS["accent"], bg=COLORS["bg"])
        self.service_dot.pack(side="left", padx=(0, 6))
        self._label(service, "VieNeu", size=9, bold=True, bg=COLORS["bg"]).pack(side="left")
        self._label(service, "  ·  ", size=9, color=COLORS["muted"], bg=COLORS["bg"]).pack(side="left")
        self.service_label = tk.Label(service, textvariable=self.service_status, bg=COLORS["bg"], fg=COLORS["muted"], font=("Segoe UI", 9))
        self.service_label.pack(side="left")
        self.service_button = self._button(service, "Khởi động", self._ensure_service)
        self.service_button.pack(side="left", padx=(10, 0))
        self.stop_service_button = self._button(service, "Dừng server", self._stop_service)
        self.stop_service_button.pack(side="left", padx=(6, 0))

        setup = self._card(body, "01  ·  Nguồn & âm thanh", "Chọn gói video, voice đã lưu và nhạc nền tùy chọn.")
        setup.pack(fill="x", pady=(0, 10))
        self._path_row(setup, "Gói video", self.archive, self._browse_archive, "ZIP")
        voice_row = tk.Frame(setup, bg=COLORS["panel"])
        voice_row.pack(fill="x", pady=(9, 0))
        self._label(voice_row, "Giọng VieNeu", size=9, color=COLORS["muted"], width=12, anchor="w").pack(side="left")
        voice_box = ttk.Combobox(voice_row, textvariable=self.voice, values=saved_voices(), state="normal", width=25)
        voice_box.pack(side="left", ipady=4)
        self._path_row(setup, "Nhạc nền", self.music, self._browse_music, "Audio", pady=(9, 0))
        volume_row = tk.Frame(setup, bg=COLORS["panel"])
        volume_row.pack(fill="x", pady=(7, 0))
        self._label(volume_row, "Âm lượng nhạc", size=9, color=COLORS["muted"], width=12, anchor="w").pack(side="left")
        ttk.Scale(volume_row, variable=self.volume, from_=0, to=1.0, command=self._show_volume).pack(side="left", fill="x", expand=True, padx=(0, 9))
        self.volume_label = self._label(volume_row, "12%", size=9, color=COLORS["muted"], width=5, anchor="e")
        self.volume_label.pack(side="right")
        self.listen_button = self._button(volume_row, "Nghe thử", self._listen_music)
        self.listen_button.pack(side="right", padx=(0, 8))

        actions = self._card(body, "02  ·  Tạo video", "Render tạo MP4; Remotion Studio là preview tương tác và chạy cho tới khi bạn đóng nó.")
        actions.pack(fill="x", pady=(0, 10))
        action_row = tk.Frame(actions, bg=COLORS["panel"])
        action_row.pack(fill="x", pady=(2, 0))
        self.primary_button = self._button(action_row, "Tạo voice + render", self._voice_render, primary=True)
        self.primary_button.pack(side="left")
        self._button(action_row, "Render lại", self._render).pack(side="left", padx=(8, 0))
        self.preview_button = self._button(action_row, "Mở Remotion Studio", self._preview)
        self.preview_button.pack(side="left", padx=(8, 0))
        self._button(action_row, "Kiểm tra", self._check).pack(side="right")
        self.progress = ttk.Progressbar(actions, mode="indeterminate", style="Zodiac.Horizontal.TProgressbar")
        self.progress.pack(fill="x", pady=(12, 0))

        output = self._card(body, "03  ·  Video gần nhất")
        output.pack(fill="x", pady=(0, 10))
        output_row = tk.Frame(output, bg=COLORS["panel"])
        output_row.pack(fill="x", pady=(8, 0))
        self._label(output_row, "", size=9, color=COLORS["muted"]).pack(side="left")
        self.video_label = tk.Label(output_row, textvariable=self.video_status, bg=COLORS["panel"], fg=COLORS["muted"], font=("Segoe UI", 9), anchor="w")
        self.video_label.pack(side="left", fill="x", expand=True)
        self.open_video_button = self._button(output_row, "Mở video", self._open_video)
        self.open_video_button.pack(side="right", padx=(6, 0))
        self.open_folder_button = self._button(output_row, "Mở thư mục", self._open_folder)
        self.open_folder_button.pack(side="right")

        log_card = self._card(body, "Nhật ký", "Tiến độ render và lỗi sẽ hiện ở đây.")
        log_card.pack(fill="both", expand=True)
        self.log = tk.Text(log_card, height=8, wrap="word", state="disabled", bg="#15131E", fg=COLORS["fg"],
                           insertbackground=COLORS["fg"], selectbackground="#564556", relief="flat", bd=0,
                           padx=10, pady=8, font=("Consolas", 9), highlightthickness=1, highlightbackground=COLORS["line"])
        self.log.pack(fill="both", expand=True, pady=(10, 0))
        self.open_video_button.configure(state="disabled")
        self.open_folder_button.configure(state="disabled")
        self._refresh_output()

    def _path_row(self, parent, label: str, value: tk.StringVar, browse, button_text: str, *, pady=(0, 0)) -> None:
        row = tk.Frame(parent, bg=COLORS["panel"])
        row.pack(fill="x", pady=pady)
        self._label(row, label, size=9, color=COLORS["muted"], width=12, anchor="w").pack(side="left")
        entry = tk.Entry(row, textvariable=value, bg=COLORS["field"], fg=COLORS["fg"], insertbackground=COLORS["fg"],
                         relief="flat", bd=0, font=("Segoe UI", 9), highlightthickness=1,
                         highlightbackground=COLORS["line"], highlightcolor=COLORS["accent"])
        entry.pack(side="left", fill="x", expand=True, ipady=7, padx=(0, 7))
        self._button(row, "Chọn…", browse).pack(side="right")

    def _log(self, message: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", message + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _job_name(self) -> str:
        return re.sub(r"[^a-zA-Z0-9._-]+", "-", Path(self.archive.get()).stem.replace("-render-ready", "")).strip("-.").lower()

    def _job_path(self) -> Path:
        return WORKSPACE / "jobs" / self._job_name()

    def _video_path(self) -> Path:
        return self._job_path() / "out" / "zodiac-story.mp4"

    def _refresh_output(self) -> None:
        video = self._video_path()
        if video.is_file():
            self.video_status.set(f"{video.name}  ·  {video.stat().st_size / 1024 / 1024:.1f} MB")
            self.open_video_button.configure(state="normal")
            self.open_folder_button.configure(state="normal")
        else:
            self.video_status.set("Chưa có video render")
            self.open_video_button.configure(state="disabled")
            self.open_folder_button.configure(state="normal" if self._job_path().exists() else "disabled")

    def _base_commands(self) -> list[list[str]]:
        archive = Path(self.archive.get()).expanduser()
        if not archive.is_file():
            raise ValueError(f"Không tìm thấy ZIP: {archive}")
        commands = []
        if not (self._job_path() / "production.json").is_file():
            commands.append([sys.executable, "tools/zodiac_local.py", "import", str(archive), "--name", self._job_name()])
        return commands

    def _render_command(self, action: str) -> list[str]:
        command = [sys.executable, "tools/zodiac_local.py", action, self._job_name()]
        music = self.music.get().strip()
        if music:
            if not Path(music).expanduser().is_file():
                raise ValueError(f"Không tìm thấy file nhạc: {music}")
            command.extend(["--music", music, "--music-volume", f"{self.volume.get():.3f}"])
        else:
            command.append("--no-music")
        return command

    def _start(
        self,
        commands: list[list[str]],
        *,
        detach_last: bool = False,
        done_kind: str = "done",
        done_message: str = "Hoàn tất.",
    ) -> None:
        if not commands:
            self._log("Không có bước nào cần chạy.")
            return
        for button in self.buttons:
            button.configure(state="disabled")
        self.progress.start(12)

        def spawn(
            command: list[str],
            *,
            detached: bool = False,
        ) -> subprocess.Popen:
            self.messages.put(
                ("log", "> " + subprocess.list2cmdline(command))
            )
            kwargs = {}
            if detached and os.name != "nt":
                kwargs["start_new_session"] = True
            elif detached and os.name == "nt":
                kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
            return subprocess.Popen(
                command,
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                shell=False,
                **kwargs,
            )

        def consume(process: subprocess.Popen) -> tuple[int, list[str]]:
            assert process.stdout is not None
            tail: list[str] = []
            for line in process.stdout:
                line = line.rstrip()
                self.messages.put(("log", line))
                if line:
                    tail.append(line)
                    del tail[:-10]
            return process.wait(), tail

        def worker() -> None:
            try:
                for index, command in enumerate(commands):
                    detached = detach_last and index == len(commands) - 1
                    process = spawn(command, detached=detached)
                    if detached:
                        self.preview_process = process
                        self.preview_stop_requested = False
                        self.messages.put((
                            "studio_started",
                            "Remotion Studio đang chạy ở process riêng. Nút này sẽ đổi thành Dừng Studio.",
                        ))

                        def watch_studio() -> None:
                            code, tail = consume(process)
                            stopped = self.preview_stop_requested
                            self.preview_process = None
                            if code and not stopped:
                                details = "\n".join(tail)
                                message = f"Remotion Studio dừng với mã {code}."
                                if details:
                                    message += f"\n\n{details}"
                                self.messages.put(("studio_error", message))
                            else:
                                self.messages.put(("studio_stopped", "Remotion Studio đã đóng."))

                        threading.Thread(target=watch_studio, daemon=True).start()
                        return

                    code, tail = consume(process)
                    if code:
                        details = "\n".join(tail)
                        raise RuntimeError(f"Lệnh dừng với mã {code}." + (f"\n\n{details}" if details else ""))
                self.messages.put((done_kind, done_message))
            except Exception as exc:
                self.messages.put(("error", str(exc)))

        threading.Thread(target=worker, daemon=True).start()

    def _run_action(self, action: str, *, voice: bool = False, detach_last: bool = False) -> None:
        if voice and not self._service_online():
            raise ValueError("VieNeu chưa sẵn sàng. Chờ trạng thái kết nối rồi thử lại.")
        commands = self._base_commands()
        if voice:
            commands.append([sys.executable, "tools/zodiac_local.py", "voice", self._job_name(), "--voice", self.voice.get().strip(), "--vieneu-url", TTS_URL])
        commands.append(self._render_command(action))
        self._start(commands, detach_last=detach_last)

    def _guarded(self, action) -> None:
        try:
            action()
        except (OSError, ValueError) as exc:
            messagebox.showerror("Không thể chạy", str(exc))

    def _voice_render(self) -> None:
        self._guarded(lambda: self._run_action("render", voice=True))

    def _render(self) -> None:
        self._guarded(lambda: self._run_action("render"))

    def _preview(self) -> None:
        if self.preview_process and self.preview_process.poll() is None:
            self._stop_preview()
            return
        self._guarded(lambda: self._run_action("preview", detach_last=True))

    def _stop_preview(self) -> None:
        process = self.preview_process
        if not process or process.poll() is not None:
            return
        self.preview_stop_requested = True
        terminate_process_tree(process)
        self._log("Đang dừng Remotion Studio và toàn bộ process con…")

    def _listen_music(self) -> None:
        def start_preview() -> None:
            music = Path(self.music.get().strip()).expanduser()
            if not music.is_file():
                raise ValueError("Chọn một file nhạc nền hợp lệ trước khi nghe thử.")
            voice = self._job_path() / "voice.wav"
            if not voice.is_file():
                raise ValueError("Chưa có voice.wav. Hãy chạy Tạo voice + render ít nhất một lần trước khi nghe thử mix.")
            output = self._job_path() / ".runtime" / "audio-preview.wav"
            command = [
                sys.executable,
                "tools/zodiac_local.py",
                "audio-preview",
                self._job_name(),
                "--music",
                str(music),
                "--music-volume",
                f"{self.volume.get():.3f}",
            ]
            self._start(
                [command],
                done_kind="audio_preview",
                done_message=str(output),
            )

        self._guarded(start_preview)

    def _check(self) -> None:
        self._guarded(lambda: self._start([*self._base_commands(), [sys.executable, "tools/zodiac_local.py", "check", self._job_name()]]))

    def _browse_archive(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("Video package", "*.zip"), ("All files", "*.*")])
        if path:
            self.archive.set(path)
            self._refresh_output()

    def _browse_music(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("Audio", "*.mp3 *.wav *.m4a *.aac *.ogg"), ("All files", "*.*")])
        if path:
            self.music.set(path)

    def _show_volume(self, _value: str) -> None:
        self.volume_label.configure(text=f"{self.volume.get():.0%}")

    def _service_online(self) -> bool:
        try:
            request = urllib.request.Request(TTS_URL + "/config", headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=1.5) as response:
                return response.status == 200
        except (OSError, urllib.error.URLError):
            return False

    def _ensure_service(self) -> None:
        if self._service_online() or (self.service_process and self.service_process.poll() is None):
            return
        if not (TTS_ROOT / "pyproject.toml").is_file():
            self.service_status.set(f"Không tìm thấy VieNeu tại {TTS_ROOT}")
            return
        self.service_status.set("Đang chạy uv run vieneu-web… lần đầu có thể tải model")

        def start() -> None:
            try:
                flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                process = subprocess.Popen(["uv", "run", "vieneu-web"], cwd=TTS_ROOT, stdout=subprocess.PIPE,
                                           stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                           bufsize=1, creationflags=flags)
                self.service_process = process
                assert process.stdout is not None
                for line in process.stdout:
                    self.messages.put(("service_log", line.rstrip()))
                if process.poll() not in (None, 0):
                    self.messages.put(("service_error", f"VieNeu dừng với mã {process.returncode}. Kiểm tra nhật ký."))
            except Exception as exc:
                self.messages.put(("service_error", f"Không khởi động được VieNeu: {exc}"))

        threading.Thread(target=start, daemon=True).start()

    def _stop_service(self) -> None:
        if self.service_process and self.service_process.poll() is None:
            if os.name == "nt":
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.service_process.pid)], capture_output=True, check=False)
            else:
                self.service_process.terminate()
            self.service_status.set("Đang dừng VieNeu…")
        else:
            self.service_status.set("Server không do GUI khởi chạy; hãy dừng trong cửa sổ VieNeu.")

    def _poll_service(self) -> None:
        self._refresh_output()
        online = self._service_online()
        if online:
            self.service_status.set("API đã kết nối · dùng lại model của VieNeu")
            self.service_dot.configure(fg=COLORS["sage"])
            self.service_button.configure(state="disabled")
            self.stop_service_button.configure(state="normal" if self.service_process and self.service_process.poll() is None else "disabled")
        else:
            running = bool(self.service_process and self.service_process.poll() is None)
            self.service_status.set("Đang khởi động / nạp model…" if running else "Chưa kết nối · tự khởi động khi mở GUI")
            self.service_dot.configure(fg=COLORS["accent"])
            self.service_button.configure(state="normal")
            self.stop_service_button.configure(state="normal" if running else "disabled")
        self.after(2500, self._poll_service)

    def _open_video(self) -> None:
        video = self._video_path()
        if video.is_file():
            open_path(video)

    def _open_folder(self) -> None:
        folder = self._video_path().parent
        if folder.exists():
            open_path(folder)

    def _drain_messages(self) -> None:
        try:
            while True:
                kind, message = self.messages.get_nowait()
                if kind in {"log", "service_log"}:
                    self._log(message)
                elif kind in {"done", "audio_preview"}:
                    self.progress.stop()
                    for button in self.buttons:
                        button.configure(state="normal")
                    self._refresh_output()
                    if kind == "audio_preview":
                        path = Path(message)
                        if path.is_file():
                            self._log(
                                f"Nghe thử mix ở mức {self.volume.get():.0%}: {path.name}"
                            )
                            try:
                                open_path(path)
                            except OSError as exc:
                                self._log(f"Không tự mở được preview: {exc}")
                                messagebox.showwarning(
                                    "Preview đã tạo",
                                    f"File đã tạo tại:\n{path}\n\nKhông tự mở được: {exc}",
                                )
                        else:
                            messagebox.showerror("Không thể nghe thử", f"Không tìm thấy file preview: {path}")
                    else:
                        self._log(message)
                elif kind == "studio_started":
                    self.progress.stop()
                    for button in self.buttons:
                        button.configure(state="normal")
                    self.preview_button.configure(text="Dừng Studio", state="normal")
                    self._log(message)
                elif kind == "studio_stopped":
                    self.preview_button.configure(text="Mở Remotion Studio", state="normal")
                    self._log(message)
                elif kind == "studio_error":
                    self.progress.stop()
                    self.preview_button.configure(text="Mở Remotion Studio", state="normal")
                    for button in self.buttons:
                        button.configure(state="normal")
                    self._log(message)
                    messagebox.showerror("Remotion Studio dừng", message)
                elif kind in {"error", "service_error"}:
                    if kind == "error":
                        self.progress.stop()
                        for button in self.buttons:
                            button.configure(state="normal")
                    self._log(message)
                    if kind == "error":
                        messagebox.showerror("Pipeline dừng", message)
                    else:
                        self.service_status.set(message)
        except queue.Empty:
            pass
        self.after(100, self._drain_messages)


if __name__ == "__main__":
    ZodiacGui().mainloop()
