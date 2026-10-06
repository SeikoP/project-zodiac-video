#!/usr/bin/env python3
"""THIẾT LẬP: giọng đọc, nhạc nền, âm lượng, nút Nghe thử."""

from __future__ import annotations

import json
import os
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from tools.studio.messages_vi import (
    ALIGN_MODEL_CHOICES,
    ALIGN_MODEL_HINT,
    BTN_LISTEN,
    LABEL_ALIGN_MODEL,
    LABEL_MUSIC,
    LABEL_VOLUME,
    LABEL_VOICE,
    SECTION_SETUP,
)
from tools.studio.views.common import Button, entry, label, section
from tools.zodiac_local import DEFAULT_MUSIC_VOLUME, default_music_path
from tools.studio.messages_vi import ALIGN_MODEL_DEFAULT
from tools.studio.theme import COLORS

DEFAULT_PANEL_VOLUME = DEFAULT_MUSIC_VOLUME

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
        self.music = tk.StringVar(value=str(default_music_path() or ""))
        self.volume = tk.DoubleVar(value=DEFAULT_PANEL_VOLUME)
        self.align_model = tk.StringVar(value=ALIGN_MODEL_DEFAULT)

        card = section(self, SECTION_SETUP)
        card.pack(fill="both", expand=True)

        label(card, LABEL_VOICE).pack(anchor="w", pady=(0, 4))
        combo = ttk.Combobox(card, textvariable=self.voice, values=voices, state="normal", width=28)
        combo.pack(fill="x", pady=(0, 12), ipady=3)

        music_row = tk.Frame(card, bg=COLORS["panel"])
        music_row.pack(fill="x", pady=(0, 10))
        label(music_row, LABEL_MUSIC, width=10).pack(side="left")
        entry(music_row, self.music).pack(side="left", fill="x", expand=True, ipady=6, padx=(0, 8))
        Button(music_row, "Chọn…", self._pick_music).pack(side="left", padx=(0, 8))
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

        align_row = tk.Frame(card, bg=COLORS["panel"])
        align_row.pack(fill="x", pady=(0, 8))
        label(align_row, LABEL_ALIGN_MODEL, width=10).pack(side="left")
        ttk.Combobox(
            align_row,
            textvariable=self.align_model,
            values=list(ALIGN_MODEL_CHOICES),
            state="readonly",
            width=12,
        ).pack(side="left")
        label(align_row, ALIGN_MODEL_HINT, wraplength=140, justify="left").pack(side="left", padx=(10, 0))

        self.music_note = label(card, "")
        self.music_note.pack(anchor="w")

    def _pick_music(self) -> None:
        chosen = filedialog.askopenfilename(
            title="Chọn nhạc nền",
            filetypes=[
                ("Tệp âm thanh", "*.mp3 *.wav *.m4a *.aac *.flac *.ogg"),
                ("Tất cả tệp", "*.*"),
            ],
        )
        if chosen:
            self.music.set(chosen)
            self.refresh()

    def _listen(self) -> None:
        self.on_listen(self.volume.get())

    def values(self) -> dict:
        return {
            "voice": self.voice.get(),
            "music": self.music.get(),
            "volume": self.volume.get(),
            "align_model": self.align_model.get(),
        }

    def refresh(self) -> None:
        note = "Chưa chọn nhạc nền" if not self.music.get().strip() else Path(self.music.get()).name
        self.music_note.configure(text=note)