#!/usr/bin/env python3
"""THIẾT LẬP: giọng đọc, nhạc nền, âm lượng, nút Nghe thử."""

from __future__ import annotations

import json
import os
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from tools.studio.messages_vi import (
    BTN_LISTEN,
    LABEL_MUSIC,
    LABEL_VOLUME,
    LABEL_VOICE,
    SECTION_SETUP,
)
from tools.studio.views.common import Button, entry, label, section
from tools.studio.theme import COLORS


def saved_voices() -> list[str]:
    home = Path(os.environ.get("VIENEU_HOME") or (Path.home() / ".vieneu"))
    try:
        voices = json.loads((home / "user_voices_v3_turbo.json").read_text(encoding="utf-8")).get("presets", {})
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        voices = {}
    return list(voices) or ["Hải Đăng"]


class AudioPanel(tk.Frame):
    def __init__(self, parent, controller, *, on_listen=None) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.controller = controller
        self.on_listen = on_listen or (lambda volume: None)
        voices = saved_voices()
        self.voice = tk.StringVar(value="cuongdepzai" if "cuongdepzai" in voices else voices[0])
        self.music = tk.StringVar(value="")
        self.volume = tk.DoubleVar(value=1.0)

        card = section(self, SECTION_SETUP)
        card.pack(fill="both", expand=True)

        label(card, LABEL_VOICE).pack(anchor="w", pady=(0, 4))
        combo = ttk.Combobox(card, textvariable=self.voice, values=voices, state="normal", width=28)
        combo.pack(fill="x", pady=(0, 12), ipady=3)

        music_row = tk.Frame(card, bg=COLORS["panel"])
        music_row.pack(fill="x", pady=(0, 10))
        label(music_row, LABEL_MUSIC, width=10).pack(side="left")
        entry(music_row, self.music).pack(side="left", fill="x", expand=True, ipady=6, padx=(0, 8))
        Button(music_row, BTN_LISTEN, self._listen).pack(side="left")

        volume_row = tk.Frame(card, bg=COLORS["panel"])
        volume_row.pack(fill="x", pady=(0, 12))
        label(volume_row, LABEL_VOLUME, width=10).pack(side="left")
        self.volume_label = label(volume_row, "100%", width=5)
        self.volume_label.pack(side="right")
        ttk.Scale(
            volume_row,
            from_=0,
            to=1.0,
            variable=self.volume,
            command=lambda _value: self.volume_label.configure(text=f"{self.volume.get():.0%}"),
        ).pack(side="left", fill="x", expand=True, padx=(0, 9))

        self.music_note = label(card, "")
        self.music_note.pack(anchor="w")

    def _listen(self) -> None:
        self.on_listen(self.volume.get())

    def values(self) -> dict:
        return {"voice": self.voice.get(), "music": self.music.get(), "volume": self.volume.get()}

    def refresh(self) -> None:
        note = "Chưa chọn nhạc nền" if not self.music.get().strip() else Path(self.music.get()).name
        self.music_note.configure(text=note)