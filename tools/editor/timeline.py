#!/usr/bin/env python3
"""Timeline panel for the active scene: measured words plus semantic event markers."""

from __future__ import annotations

import tkinter as tk

from tools.editor.timing import (
    NO_TIMING,
    TIMING_STALE_OR_INVALID,
    AnchorProblem,
    ms_to_frame,
    resolve_event,
    scene_frame_to_x,
)
from tools.studio.theme import COLORS

LANE_HEIGHT = 96
MARKER_RADIUS = 7


def selection_for_event(document, event_id: str):
    """Pure event -> (event, target entity id) mapping used by the UI and tests."""
    for scene_id in document.scene_ids:
        for event in document.events(scene_id):
            if event.get("id") != event_id:
                continue
            target = event.get("target")
            return event, None if target in (None, "camera") else target
    return None, None


class TimelineView(tk.Frame):
    """Word tokens and event markers of one scene. Never writes timing."""

    def __init__(
        self,
        parent,
        document,
        *,
        on_select_event=None,
        on_status=None,
    ) -> None:
        super().__init__(parent, bg=COLORS["panel"])
        self.document = document
        self.on_select_event = on_select_event or (lambda event_id: None)
        self.on_status = on_status or (lambda message: None)
        self.scene_id: str | None = None
        self.timing = document.timing
        self.selected_event: str | None = None
        self._markers: list[tuple[str, float, str]] = []

        self.widget = tk.Canvas(self, height=LANE_HEIGHT, bg=COLORS["panel"], highlightthickness=1,
                                highlightbackground=COLORS["line"])
        self.widget.pack(fill="both", expand=True, padx=10, pady=(0, 8))
        self.widget.bind("<Configure>", lambda _event: self.refresh())
        self.widget.bind("<Button-1>", self._on_click)

    # ---- public ------------------------------------------------------
    def set_scene(self, scene_id: str | None) -> None:
        self.scene_id = scene_id
        self.selected_event = None
        self.refresh()

    def select(self, event_id: str | None) -> None:
        self.selected_event = event_id
        self.refresh()

    def refresh(self) -> None:
        widget = self.widget
        widget.delete("all")
        if self.scene_id is None:
            widget.create_text(
                10, LANE_HEIGHT / 2, text="Timeline: chọn một scene", anchor="w",
                fill=COLORS["muted"], font=("Segoe UI", 9),
            )
            return

        self.timing = self.document.timing
        width = max(widget.winfo_width(), 100)
        scene = self.timing.scene(self.scene_id) if self.timing.state not in {NO_TIMING, TIMING_STALE_OR_INVALID} else None
        header = f"{self.scene_id}"
        if scene is not None:
            header += f"   0:00 {'─' * 8} {scene.duration_frames / self.timing_fps():.2f}s"
        widget.create_text(6, 10, text=header, anchor="nw", fill=COLORS["fg"], font=("Segoe UI", 9, "bold"))

        if self.timing.state == NO_TIMING:
            badge = "Timing chưa có"
            widget.create_text(width - 8, 10, text=badge, anchor="ne", fill=COLORS["accent"],
                               font=("Segoe UI", 9, "bold"))
            widget.create_text(6, 30, text=self._semantic_summary(), anchor="nw", fill=COLORS["muted"],
                               font=("Segoe UI", 8))
            return

        if self.timing.state == TIMING_STALE_OR_INVALID:
            widget.create_text(width - 8, 10, text="Timing không hợp lệ", anchor="ne", fill=COLORS["danger"],
                               font=("Segoe UI", 9, "bold"))
            widget.create_text(6, 30, text=(self.timing.error or "")[:160], anchor="nw", fill=COLORS["danger"],
                               font=("Segoe UI", 8))
            return

        self._draw_words(scene, width)
        self._draw_events(scene, width)

    # ---- drawing -----------------------------------------------------
    def _draw_words(self, scene, width: float) -> None:
        widget = self.widget
        for word in scene.words:
            left = scene_frame_to_x(
                ms_to_frame(word.start_ms, scene.fps) - scene.start_frame,
                scene.duration_frames,
                width,
            )
            right = scene_frame_to_x(
                ms_to_frame(word.end_ms, scene.fps) - scene.start_frame,
                scene.duration_frames,
                width,
            )
            widget.create_rectangle(
                left + 1, 26, max(right - 1, left + 2), 46,
                fill=COLORS["field"], outline=COLORS["line"],
            )
            widget.create_text(
                (left + right) / 2, 36, text=word.text.strip(".,!?")[:8],
                fill=COLORS["muted"], font=("Segoe UI", 7),
            )

    def _draw_events(self, scene, width: float) -> None:
        widget = self.widget
        self._markers = []
        for event in self.document.events(self.scene_id):
            event_id = str(event.get("id"))
            state, frame, label = "ok", None, event_id
            try:
                frame = resolve_event(scene, event).local_frame
            except AnchorProblem as problem:
                state = problem.code
                label = f"{event_id} ?"
            x = scene_frame_to_x(frame, scene.duration_frames, width) if frame is not None else 8.0
            color = {
                "ok": COLORS["accent"],
                "ANCHOR_NOT_FOUND": COLORS["danger"],
                "ANCHOR_AMBIGUOUS": COLORS["accent"],
                "ANCHOR_OCCURRENCE_INVALID": COLORS["danger"],
            }.get(state, COLORS["danger"])
            if event_id == self.selected_event:
                widget.create_text(x, 58, text="▼", fill=COLORS["fg"], font=("Segoe UI", 8))
            widget.create_polygon(
                x, 66,
                x - MARKER_RADIUS, 66 + MARKER_RADIUS * 1.6,
                x + MARKER_RADIUS, 66 + MARKER_RADIUS * 1.6,
                fill=color, outline=COLORS["bg"] if state == "ok" else color,
            )
            widget.create_text(x, 88, text=label, fill=color, font=("Segoe UI", 7))
            self._markers.append((event_id, x, state))

    def _on_click(self, event) -> None:
        width = max(self.widget.winfo_width(), 100)
        for event_id, x, state in self._markers:
            if abs(event.x - x) <= MARKER_RADIUS + 4:
                self.on_select_event(event_id)
                return
        self.on_status(f"Timeline width {width:.0f}px")

    # ---- helpers -----------------------------------------------------
    def timing_fps(self) -> int:
        return int(self.document.video.get("fps") or 30)

    def _semantic_summary(self) -> str:
        parts = []
        for event in self.document.events(self.scene_id):
            trigger = event.get("trigger") or {}
            if trigger.get("source") == "scene_start":
                parts.append(f"{event.get('id')} scene_start")
            else:
                occurrence = trigger.get("occurrence")
                suffix = f" #{occurrence}" if occurrence else ""
                parts.append(f"{event.get('id')} “{trigger.get('text', '')}”{suffix}")
        return "  ·  ".join(parts)