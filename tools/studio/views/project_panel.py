#!/usr/bin/env python3
"""DỰ ÁN: chọn gói ZIP và xem job đang dùng."""

from __future__ import annotations

import tkinter as tk
from tkinter import filedialog

from tools.studio.messages_vi import BTN_BROWSE, LABEL_ARCHIVE, LABEL_JOB, SECTION_PROJECT
from tools.studio.views.common import Button, entry, label, section
from tools.studio.theme import COLORS


class ProjectPanel(tk.Frame):
    def __init__(self, parent, controller, *, on_changed=None) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.controller = controller
        self.on_changed = on_changed or (lambda: None)
        self.archive = tk.StringVar(value="")
        self.job_name = tk.StringVar(value="")

        card = section(self, SECTION_PROJECT)
        card.pack(fill="x")

        row = tk.Frame(card, bg=COLORS["panel"])
        row.pack(fill="x", pady=(0, 8))
        label(row, LABEL_ARCHIVE, width=12).pack(side="left")
        entry(row, self.archive).pack(side="left", fill="x", expand=True, ipady=7, padx=(0, 8))
        Button(row, BTN_BROWSE, self._browse).pack(side="left")

        job_row = tk.Frame(card, bg=COLORS["panel"])
        job_row.pack(fill="x")
        label(job_row, LABEL_JOB, width=12).pack(side="left")
        label(job_row, "", textvariable=self.job_name, muted=False).pack(side="left")

    def _browse(self) -> None:
        path = filedialog.askopenfilename(
            title="Chọn gói video",
            filetypes=[("Gói video", "*.zip"), ("Tất cả tệp", "*.*")],
        )
        if not path:
            return
        self.archive.set(path)
        self.controller.select_archive(path)
        self.on_changed()

    def refresh(self) -> None:
        self.job_name.set(self.controller.job.name if self.controller.job else "—")