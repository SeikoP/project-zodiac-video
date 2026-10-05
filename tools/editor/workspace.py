#!/usr/bin/env python3
"""Zodiac Editor Workspace shell: scenes, 9:16 canvas, inspector, safe save."""

from __future__ import annotations

import tkinter as tk
from tkinter import messagebox

from tools.editor.canvas import CanvasView
from tools.editor.commands import History, StateCommand
from tools.editor.document import EditorDocument, EditorError
from tools.editor.inspector import EventInspector, Inspector
from tools.editor.runtime import invalidate_runtime_for
from tools.editor.scene_list import SceneList
from tools.editor.timeline import TimelineView, selection_for_event
from tools.studio.theme import COLORS


class EditorWorkspace(tk.Toplevel):
    """One editor window over one v2 package."""

    def __init__(self, parent, package_root, *, on_close=None) -> None:
        super().__init__(parent)
        self.package_root = package_root
        self.history = History()
        self.document = EditorDocument(package_root)
        self.on_close = on_close or (lambda: None)

        self.title("Zodiac Editor")
        self.geometry("1360x900")
        self.minsize(1100, 760)
        self.configure(bg=COLORS["bg"])
        self.protocol("WM_DELETE_WINDOW", self.request_close)

        self.status = tk.StringVar(value="Ready")
        self.scene_id: str | None = None
        self.selected_event: str | None = None
        self._pending_edit = "transform"

        self._build()

        self.bind("<Control-z>", lambda _event: self.undo())
        self.bind("<Control-Z>", lambda _event: self.redo())
        self.bind("<Control-y>", lambda _event: self.redo())
        self.bind("<Control-s>", lambda _event: self.save())
        self._update_title()

    def _button(self, parent, text: str, command, *, primary: bool = False) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg=COLORS["accent"] if primary else COLORS["field"],
            fg=COLORS["bg"] if primary else COLORS["fg"],
            activebackground="#F2A092" if primary else COLORS["line"],
            activeforeground=COLORS["fg"],
            relief="flat",
            bd=0,
            padx=12,
            pady=7,
            font=("Segoe UI", 10, "bold" if primary else "normal"),
            cursor="hand2",
            highlightthickness=1,
            highlightbackground=COLORS["line"],
        )

    def _build(self) -> None:
        bar = tk.Frame(self, bg=COLORS["bg"], padx=14, pady=10)
        bar.pack(fill="x")
        tk.Label(bar, text="ZODIAC EDITOR", bg=COLORS["bg"], fg=COLORS["fg"],
                 font=("Segoe UI", 14, "bold")).pack(side="left")
        self._button(bar, "Save", self.save, primary=True).pack(side="left", padx=(16, 0))
        self._button(bar, "Revert", self.revert).pack(side="left", padx=(8, 0))
        self._button(bar, "Validate", self.validate).pack(side="left", padx=(8, 0))
        self.safe_zone = tk.BooleanVar(value=True)
        tk.Checkbutton(
            bar,
            text="Show Safe Zone",
            variable=self.safe_zone,
            command=self._toggle_safe_zone,
            bg=COLORS["bg"],
            fg=COLORS["fg"],
            selectcolor=COLORS["field"],
            activebackground=COLORS["bg"],
            activeforeground=COLORS["fg"],
            font=("Segoe UI", 9),
        ).pack(side="left", padx=(16, 0))

        body = tk.Frame(self, bg=COLORS["bg"], padx=14, pady=10)
        body.pack(fill="both", expand=True)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(0, weight=1)

        self.canvas = CanvasView(
            body,
            self.document,
            on_select=self._on_select,
            on_status=self._set_status,
            on_commit=self._commit,
        )
        self.canvas.grid(row=0, column=1, sticky="nsew")

        self.timeline = TimelineView(
            body,
            self.document,
            on_select_event=self.select_event,
            on_status=self._set_status,
        )
        self.timeline.grid(row=1, column=1, sticky="nsew", pady=(10, 0))

        self.inspector = Inspector(
            body,
            self.document,
            on_commit=self._commit,
            on_status=self._set_status,
            on_select_entity=self._select_entity,
        )
        self.inspector.configure(width=240)
        self.inspector.grid(row=0, column=2, sticky="nsew", padx=(10, 0))

        self.events = EventInspector(
            body,
            self.document,
            on_select_event=self.select_event,
            on_commit=self._commit_anchor,
            on_status=self._set_status,
        )
        self.events.configure(width=240)
        self.events.grid(row=1, column=2, sticky="nsew", padx=(10, 0), pady=(10, 0))

        self.scenes = SceneList(body, self.document, on_select=self.show_scene)
        self.scenes.grid(row=0, column=0, rowspan=2, sticky="nsew", padx=(0, 10))

        footer = tk.Frame(self, bg=COLORS["panel"])
        footer.pack(fill="x", side="bottom")
        tk.Label(footer, textvariable=self.status, bg=COLORS["panel"], fg=COLORS["muted"],
                 font=("Segoe UI", 9), anchor="w").pack(fill="x", padx=14, pady=6)
        tk.Label(footer, text=str(self.package_root), bg=COLORS["panel"], fg=COLORS["line"],
                 font=("Consolas", 8), anchor="w").pack(fill="x", padx=14, pady=(0, 6))

    # ---- wiring -------------------------------------------------------
    def show_scene(self, scene_id: str) -> None:
        self.scene_id = scene_id
        self.selected_event = None
        self.canvas.show_scene(scene_id)
        self.inspector.load_entities(self.document.placements(scene_id))
        self.events.load_events(scene_id)
        self.timeline.set_scene(scene_id)
        self._set_status(f"Scene {scene_id}")
        self._update_title()

    def select_event(self, event_id: str) -> None:
        """Select an event: marker, Event Inspector and target entity, no mutation."""
        event, entity_id = selection_for_event(self.document, event_id)
        self.selected_event = event_id if event else None
        self.timeline.select(self.selected_event)
        self.events.select(event_id)
        if entity_id:
            self._select_entity(entity_id)
        if event is not None:
            self._set_status(f"Event {event_id} ({event.get('trigger', {}).get('source')})")

    def _commit_anchor(self, event_id: str, before: dict, after: dict) -> None:
        self._pending_edit = "anchor"
        try:
            self.document.set_anchor(
                self.scene_id,
                event_id,
                text=after.get("text"),
                occurrence=after.get("occurrence"),
                drop_occurrence=after.get("occurrence") is None,
            )
        except EditorError as exc:
            self._set_status(str(exc))
            return
        self.events.select(event_id)
        self.timeline.refresh()
        self._set_status(f"Đã đổi anchor {event_id}: “{after.get('text')}”")
        self._update_title()

    def _select_entity(self, entity_id: str) -> None:
        """Select from the entity list; the only way to reach a hidden entity."""
        if not self.scene_id:
            return
        self.canvas.select(entity_id)
        self.inspector.show(self.canvas.selected.placement if self.canvas.selected else None)

    def _on_select(self, placement) -> None:
        self.inspector.show(placement)

    def _set_status(self, message: str) -> None:
        self.status.set(message)

    def _toggle_safe_zone(self) -> None:
        self.canvas.show_safe_zone = bool(self.safe_zone.get())
        self.canvas.refresh()

    def _commit(self, label: str, scene_id: str, entity_id: str, before: dict, after: dict) -> None:
        self._pending_edit = "transform"
        self.history.push(
            StateCommand(self.document, scene_id, entity_id, label).begin(after, before)
        )
        self.canvas.refresh()
        self.inspector.load_entities(self.document.placements(scene_id))
        self.inspector.sync()
        self._update_title()

    def _update_title(self) -> None:
        scene = self.scene_id or "—"
        mark = " *" if self.document.is_dirty else ""
        self.title(f"Zodiac Editor — {scene}{mark}")

    # ---- commands -----------------------------------------------------
    def undo(self) -> str:
        label = self.history.undo()
        self._after_history(label, "Undo" if label else "Nothing to undo")
        return label or ""

    def redo(self) -> str:
        label = self.history.redo()
        self._after_history(label, "Redo" if label else "Nothing to redo")
        return label or ""

    def _after_history(self, label: str | None, message: str) -> None:
        entity_id = None
        if self.history.can_undo or self.history.can_redo:
            entity_id = self._last_entity_id()
        if self.canvas.scene_id:
            self.canvas.refresh()
            if entity_id:
                self.canvas.select(entity_id)
        self.inspector.sync()
        self._set_status(f"{message}: {label}" if label else message)
        self._update_title()

    def _last_entity_id(self) -> str | None:
        return self.inspector.placement.entity_id if self.inspector.placement else None

    def validate(self) -> bool:
        try:
            self.document.validate()
        except EditorError as exc:
            messagebox.showerror("Validation failed", str(exc), parent=self)
            self._set_status("Validation failed")
            return False
        self._set_status("Contract valid")
        return True

    def save(self) -> bool:
        try:
            self.document.save()
        except EditorError as exc:
            if "changed on disk" in str(exc):
                return self._resolve_external_change()
            messagebox.showerror("Save blocked", str(exc), parent=self)
            self._set_status("Save blocked")
            return False
        self._announce_runtime()
        self._set_status("Saved production.json")
        self._update_title()
        return True

    def _resolve_external_change(self) -> bool:
        choice = self._ask_external_change()
        if choice == "reload":
            self._reload()
            return True
        if choice == "overwrite":
            self.document.acknowledge_disk_change()
            return self.save()
        self._set_status("Save cancelled")
        return False

    def _ask_external_change(self) -> str:
        dialog = tk.Toplevel(self)
        dialog.title("production.json changed outside Editor")
        dialog.configure(bg=COLORS["panel"])
        dialog.transient(self)
        dialog.resizable(False, False)
        result = {"choice": "cancel"}

        tk.Label(
            dialog,
            text="production.json changed on disk.\nSave would overwrite those changes.",
            bg=COLORS["panel"],
            fg=COLORS["fg"],
            font=("Segoe UI", 10),
            justify="left",
            padx=20,
            pady=16,
        ).pack(anchor="w")

        row = tk.Frame(dialog, bg=COLORS["panel"], padx=20, pady=(0, 16))
        row.pack(fill="x")

        def choose(choice: str) -> None:
            result["choice"] = choice
            dialog.destroy()

        self._button(row, "Reload", lambda: choose("reload")).pack(side="left")
        self._button(row, "Overwrite", lambda: choose("overwrite")).pack(side="left", padx=(8, 0))
        self._button(row, "Cancel", lambda: choose("cancel"), primary=True).pack(side="right")

        def on_close() -> None:
            result["choice"] = "cancel"
            dialog.destroy()

        dialog.protocol("WM_DELETE_WINDOW", on_close)
        dialog.bind("<Escape>", lambda _event: on_close())
        dialog.update_idletasks()
        parent_x = self.winfo_rootx() + (self.winfo_width() - dialog.winfo_reqwidth()) // 2
        parent_y = self.winfo_rooty() + (self.winfo_height() - dialog.winfo_reqheight()) // 2
        dialog.geometry(f"+{max(parent_x, 0)}+{max(parent_y, 0)}")
        self.wait_window(dialog)
        return result["choice"]

    def _reload(self) -> None:
        self.document.load()
        self.history.clear()
        scene_id = self.scene_id if self.scene_id in self.document.scene_ids else (
            self.document.scene_ids[0] if self.document.scene_ids else None
        )
        self.inspector.show(None)
        self.scenes.reload()
        if scene_id:
            self.show_scene(scene_id)
        self._set_status("Reloaded production.json from disk")
        self._update_title()

    def revert(self) -> None:
        if self.document.is_dirty and not messagebox.askyesno(
            "Revert", "Bỏ toàn bộ thay đổi chưa lưu?", parent=self
        ):
            return
        self._reload()

    def _announce_runtime(self) -> None:
        removed = invalidate_runtime_for(self.package_root, self._pending_edit)
        for path in removed:
            self._set_status(f"Saved production.json · invalidated {path.name}")

    def request_close(self) -> bool:
        if self.document.is_dirty:
            answer = messagebox.askyesnocancel(
                "Bạn có thay đổi chưa lưu",
                "Bạn có thay đổi chưa lưu.\n\nSave = lưu, Discard = bỏ, Cancel = ở lại.",
                parent=self,
            )
            if answer is None:
                return False
            if answer and not self.save():
                return False
            if not answer:
                self.document.revert()
        self.on_close()
        self.destroy()
        return True


def open_editor(parent, package_root) -> EditorWorkspace:
    """Entry point used by the launcher GUI."""
    try:
        return EditorWorkspace(parent, package_root)
    except EditorError as exc:
        messagebox.showerror("Không mở được Editor", str(exc), parent=parent)
        return None