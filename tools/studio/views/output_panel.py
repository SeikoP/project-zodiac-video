#!/usr/bin/env python3
"""KẾT QUẢ: video vừa render và nút mở nhanh."""

from __future__ import annotations

import tkinter as tk

from tools.studio.messages_vi import BTN_OPEN_FOLDER, BTN_OPEN_VIDEO, NO_VIDEO, SECTION_OUTPUT
from tools.studio.views.common import Button, label, section
from tools.studio.theme import COLORS


class OutputPanel(tk.Frame):
    def __init__(self, parent, controller, *, on_open=None, video_path=None, job_path=None) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.controller = controller
        self.on_open = on_open or (lambda path: None)
        self.video_path_provider = video_path or (lambda: controller.video_path)
        self.job_path_provider = job_path or (lambda: controller.job)

        card = section(self, SECTION_OUTPUT)
        card.pack(fill="x")

        row = tk.Frame(card, bg=COLORS["panel"])
        row.pack(fill="x")
        self.status = label(row, NO_VIDEO, muted=False)
        self.status.pack(side="left", fill="x", expand=True)
        self.folder_button = Button(row, BTN_OPEN_FOLDER, self._open_folder)
        self.folder_button.pack(side="right", padx=(8, 0))
        self.video_button = Button(row, BTN_OPEN_VIDEO, self._open_video)
        self.video_button.pack(side="right")

    def _open_video(self) -> None:
        video = self.video_path_provider()
        if video:
            self.on_open(video)

    def _open_folder(self) -> None:
        video = self.video_path_provider()
        if video is not None:
            self.on_open(video.parent)

    def refresh(self) -> None:
        video = self.video_path_provider()
        if video is not None and video.is_file():
            self.status.configure(
                text=f"{video.name}  ·  {video.stat().st_size / 1024 / 1024:.1f} MB"
            )
        else:
            self.status.configure(text=NO_VIDEO)
        self.video_button.configure(
            state="normal" if video is not None and video.is_file() else "disabled"
        )
        job = self.job_path_provider()
        ready = job is not None and job.exists()
        self.folder_button.configure(state="normal" if ready else "disabled")
