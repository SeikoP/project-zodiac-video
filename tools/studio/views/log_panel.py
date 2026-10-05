#!/usr/bin/env python3
"""NHẬT KÝ: log có thể thu gọn, không chiếm chỗ khi không cần."""

from __future__ import annotations

import tkinter as tk

from tools.studio.messages_vi import BTN_HIDE_LOGS, BTN_SHOW_LOGS, SECTION_LOG
from tools.studio.views.common import Button, label, section
from tools.studio.theme import COLORS


class LogPanel(tk.Frame):
    def __init__(self, parent) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.expanded = False

        self.card = section(self, SECTION_LOG)
        self.card.pack(fill="both", expand=True)

        head = tk.Frame(self.card, bg=COLORS["panel"])
        head.pack(fill="x", pady=(0, 8))
        self.toggle = Button(head, BTN_SHOW_LOGS, self.toggle_panel)
        self.toggle.pack(side="right")

        self.text = tk.Text(
            self.card,
            height=6,
            wrap="word",
            state="disabled",
            bg="#15131E",
            fg=COLORS["fg"],
            insertbackground=COLORS["fg"],
            selectbackground="#564556",
            relief="flat",
            bd=0,
            padx=10,
            pady=8,
            font=("Consolas", 9),
            highlightthickness=1,
            highlightbackground=COLORS["line"],
        )
        self.text.pack(fill="both", expand=True)

    def toggle_panel(self) -> None:
        self.expanded = not self.expanded
        if self.expanded:
            self.text.pack(fill="both", expand=True)
            self.toggle.configure(text=BTN_HIDE_LOGS)
        else:
            self.text.pack_forget()
            self.toggle.configure(text=BTN_SHOW_LOGS)

    def append(self, message: str) -> None:
        self.text.configure(state="normal")
        self.text.insert("end", message.rstrip() + "\n")
        self.text.see("end")
        self.text.configure(state="disabled")