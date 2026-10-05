#!/usr/bin/env python3
"""QUY TRÌNH: theo dõi từng bước, bước lỗi nổi bật, chạy lại từng bước."""

from __future__ import annotations

import tkinter as tk

from tools.studio.messages_vi import BTN_RERUN, SECTION_PIPELINE, STEP_NAMES_VI
from tools.studio.pipeline import CANCELLED, DONE, FAILED, PENDING, RUNNING, SKIPPED
from tools.studio.views.common import Button, label, section
from tools.studio.theme import COLORS

MARKERS = {DONE: "✓", FAILED: "✕", RUNNING: "▸", CANCELLED: "‖", SKIPPED: "–", PENDING: "○"}
STATUS_COLOR = {
    DONE: COLORS["sage"],
    FAILED: COLORS["danger"],
    RUNNING: COLORS["accent"],
    CANCELLED: COLORS["muted"],
    SKIPPED: COLORS["line"],
    PENDING: COLORS["line"],
}
STATUS_LABEL = {
    DONE: "xong",
    FAILED: "lỗi",
    RUNNING: "đang chạy",
    CANCELLED: "đã dừng",
    SKIPPED: "bỏ qua",
    PENDING: "chờ",
}


class PipelinePanel(tk.Frame):
    def __init__(self, parent, controller, *, on_rerun=None) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.controller = controller
        self.on_rerun = on_rerun or (lambda step: None)
        self.rows: dict[str, dict] = {}
        self.selected: str | None = None

        card = section(self, SECTION_PIPELINE)
        card.pack(fill="both", expand=True)
        for step in STEP_NAMES_VI:
            self.rows[step] = self._row(card, step)

        footer = tk.Frame(card, bg=COLORS["panel"])
        footer.pack(fill="x", pady=(10, 0))
        self.rerun_button = Button(footer, BTN_RERUN, self._rerun)
        self.rerun_button.pack(side="left")
        self.rerun_button.configure(state="disabled")

    def _row(self, parent, step: str) -> dict:
        frame = tk.Frame(parent, bg=COLORS["panel"], cursor="hand2")
        frame.pack(fill="x", pady=1)
        marker = label(frame, MARKERS[PENDING], width=2, muted=False)
        marker.pack(side="left")
        name = label(frame, STEP_NAMES_VI[step], muted=False)
        name.pack(side="left", fill="x", expand=True)
        detail = label(frame, "", width=26)
        detail.pack(side="right")
        for widget in (frame, marker, name, detail):
            widget.bind("<Button-1>", lambda _event, s=step: self._select(s))
        return {"frame": frame, "marker": marker, "name": name, "detail": detail}

    def _select(self, step: str) -> None:
        self.selected = step
        self.rerun_button.configure(state="normal")

    def _rerun(self) -> None:
        if self.selected:
            self.on_rerun(self.selected)

    def refresh(self) -> None:
        for row in self.controller.pipeline_rows():
            widgets = self.rows[row["step"]]
            status = row["status"]
            color = STATUS_COLOR.get(status, COLORS["line"])
            widgets["marker"].configure(text=MARKERS.get(status, "○"), fg=color)
            widgets["name"].configure(
                fg=COLORS["fg"] if status != PENDING else COLORS["muted"],
            )
            detail = row["message"] or STATUS_LABEL.get(status, "")
            if row["step"] == "VOICE_SCENES" and row["scenes"]:
                done = sum(1 for entry in row["scenes"].values() if entry.get("status") == DONE)
                detail = f"{done}/{len(row['scenes'])} scene xong"
            widgets["detail"].configure(text=detail, fg=color if status in (FAILED, CANCELLED) else COLORS["muted"])
            widgets["frame"].configure(
                bg=COLORS["field"] if status == FAILED else COLORS["panel"]
            )