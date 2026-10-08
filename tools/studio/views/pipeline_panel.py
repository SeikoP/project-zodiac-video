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
        self.v2_rows: dict[str, dict] = {}
        self.selected: str | None = None
        self.mode = "legacy"
        self.busy = False

        card = section(self, SECTION_PIPELINE)
        card.pack(fill="both", expand=True)
        self.card = card
        for step in STEP_NAMES_VI:
            self.rows[step] = self._row(card, step)

        self.footer = tk.Frame(card, bg=COLORS["panel"])
        self.footer.pack(fill="x", pady=(10, 0))
        self.rerun_button = Button(self.footer, BTN_RERUN, self._rerun)
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
        self.rerun_button.configure(state="normal" if not self.busy and step != "PACKAGE" else "disabled")

    def _rerun(self) -> None:
        if self.selected:
            self.on_rerun(self.selected)

    def refresh(self) -> None:
        self.show_legacy()
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

    def show_legacy(self) -> None:
        if self.mode == "legacy":
            return
        for row in self.v2_rows.values():
            row["frame"].pack_forget()
        for row in self.rows.values():
            row["frame"].pack(fill="x", pady=1, before=self.footer)
        self.selected = None
        self.rerun_button.configure(text=BTN_RERUN, state="disabled")
        self.mode = "legacy"

    def show_v2(self, rows: list[dict]) -> None:
        if self.mode != "v2":
            for row in self.rows.values():
                row["frame"].pack_forget()
            self.mode = "v2"
            self.selected = None
        labels = {
            "PACKAGE": "Gói video",
            "VOICE": "Giọng đọc",
            "TIMING": "Căn thời gian",
            "PLAN": "Kế hoạch render",
            "RENDER": "Kết xuất video",
            "AUDIO": "Âm thanh",
            "OUTPUT": "Hoàn tất",
        }
        for row in rows:
            step = row["step"]
            widgets = self.v2_rows.get(step)
            if widgets is None:
                frame = tk.Frame(self.card, bg=COLORS["panel"], cursor="hand2")
                marker = label(frame, "○", width=2, muted=False)
                marker.pack(side="left")
                name = label(frame, labels.get(step, step), muted=False)
                name.pack(side="left", fill="x", expand=True)
                detail = label(frame, "", width=26)
                detail.pack(side="right")
                widgets = self.v2_rows[step] = {
                    "frame": frame, "marker": marker, "name": name, "detail": detail,
                }
                for widget in (frame, marker, name, detail):
                    widget.bind("<Button-1>", lambda _event, s=step: self._select(s))
            if not widgets["frame"].winfo_manager():
                widgets["frame"].pack(fill="x", pady=1, before=self.footer)
            status = row.get("status", PENDING)
            color = STATUS_COLOR.get(status, COLORS["line"])
            widgets["marker"].configure(text=MARKERS.get(status, "○"), fg=color)
            widgets["name"].configure(fg=COLORS["fg"] if status != PENDING else COLORS["muted"])
            detail = row.get("detail") or STATUS_LABEL.get(status, "")
            detail = {
                "REUSED_GLOBAL": "Dùng lại dữ liệu đã có",
                "REBUILT": "Đã cập nhật",
                "SEGMENTS": "Các phân đoạn đã render",
            }.get(detail, detail)
            if status == RUNNING:
                detail = f"{max(0, min(100, int(row.get('progress', 0) * 100)))}% · {detail}".strip(" ·")
            widgets["detail"].configure(
                text=detail,
                fg=color if status in (FAILED, CANCELLED) else COLORS["muted"],
            )
            widgets["frame"].configure(bg=COLORS["field"] if status == FAILED else COLORS["panel"])
        self.rerun_button.configure(
            text="Chạy lại từ bước", state="normal" if self.selected in self.v2_rows
            and self.selected != "PACKAGE" and not self.busy else "disabled",
        )
