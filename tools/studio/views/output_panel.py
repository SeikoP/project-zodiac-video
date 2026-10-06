#!/usr/bin/env python3
"""KẾT QUẢ: video vừa render và nút mở nhanh."""

from __future__ import annotations

import tkinter as tk

from tools.studio.messages_vi import BTN_OPEN_FOLDER, BTN_OPEN_VIDEO, NO_VIDEO, SECTION_OUTPUT
from tools.studio.views.common import Button, label, section
from tools.studio.theme import COLORS


class OutputPanel(tk.Frame):
    def __init__(self, parent, controller, *, on_open=None) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.controller = controller
        self.on_open = on_open or (lambda path: None)

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
        if self.controller.video_path:
            self.on_open(self.controller.video_path)

    def _open_folder(self) -> None:
        if self.controller.video_path is not None:
            self.on_open(self.controller.video_path.parent)

    def refresh(self) -> None:
        video = self.controller.video_path
        bundle = self.controller.publish_bundle_path
        if bundle is not None and bundle.is_file():
            self.status.configure(
                text=f"Gói xuất bản sẵn sàng · {bundle.name} · {bundle.stat().st_size / 1024 / 1024:.1f} MB"
            )
        elif video is not None and video.is_file():
            self.status.configure(
                text=f"{video.name}  ·  {video.stat().st_size / 1024 / 1024:.1f} MB"
            )
        else:
            self.status.configure(text=NO_VIDEO)
        self.video_button.configure(
            state="normal" if video is not None and video.is_file() else "disabled"
        )
        ready = self.controller.job is not None and self.controller.job.exists()
        self.folder_button.configure(state="normal" if ready else "disabled")
