#!/usr/bin/env python3
"""DỰ ÁN: chọn gói ZIP và xem job đang dùng."""

from __future__ import annotations

import tkinter as tk
from tkinter import filedialog, ttk

from tools.studio.messages_vi import BTN_BROWSE, LABEL_ARCHIVE, LABEL_JOB, SECTION_PROJECT
from tools.studio.views.common import Button, entry, label, section
from tools.studio.theme import COLORS


class ProjectPanel(tk.Frame):
    def __init__(self, parent, controller, *, on_changed=None, extra_jobs=None, on_select=None) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.controller = controller
        self.on_changed = on_changed or (lambda: None)
        self.extra_jobs = extra_jobs or (lambda: [])
        self.on_select = on_select
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
        self.job_picker = ttk.Combobox(job_row, state="readonly", width=28)
        self.job_picker.pack(side="left")
        self.job_picker.bind("<<ComboboxSelected>>", self._pick_job)
        label(job_row, "", textvariable=self.job_name, muted=False).pack(side="left", padx=(10, 0))
        self.external_job = False

    def job_choices(self) -> list[str]:
        jobs = self.controller.available_jobs() + self.extra_jobs()
        self.job_picker.configure(values=jobs)
        return jobs

    def choose_job(self, name: str) -> None:
        """Switch the active job; used by the picker and after an import."""
        if self.on_select is not None:
            self.on_select(name)
            return
        if not name or name not in self.controller.available_jobs():
            return
        self.controller.use_job(self.controller.job_path(name))
        self.archive.set("")
        self.controller.select_archive(None)
        self.external_job = False
        self.job_picker.set(name)
        self.refresh()
        self.on_changed()

    def _pick_job(self, _event=None) -> None:
        self.choose_job(self.job_picker.get())

    def _browse(self) -> None:
        path = filedialog.askopenfilename(
            title="Chọn gói video",
            filetypes=[("Gói video", "*.zip"), ("Tất cả tệp", "*.*")],
        )
        if not path:
            return
        self.archive.set(path)
        self.on_changed()

    def refresh(self) -> None:
        if self.external_job:
            self.job_choices()
            self.job_picker.set(f"Job@5 · {self.job_name.get()}")
            return
        current = self.controller.job.name if self.controller.job else ""
        self.job_name.set(current or "—")
        self.job_choices()
        if current:
            self.job_picker.set(current)
        else:
            self.job_picker.set("")

    def set_external_job(self, name: str | None) -> None:
        """Show a job owned by another backend without changing the legacy controller."""
        self.external_job = name is not None
        if name is None:
            self.refresh()
            return
        self.job_choices()
        self.job_picker.set(f"Job@5 · {name}")
        self.job_name.set(name)
