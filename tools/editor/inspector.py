#!/usr/bin/env python3
"""Inspector panel: read-only identity, editable transform/layer/visible."""

from __future__ import annotations

import tkinter as tk

from tools.studio.theme import COLORS

FIELD_FONT = ("Segoe UI", 9)


class Inspector(tk.Frame):
    """Entity list plus two-way sync between the canvas and the contract values."""

    def __init__(self, parent, document, *, on_commit=None, on_status=None, on_select_entity=None) -> None:
        super().__init__(parent, bg=COLORS["panel"])
        self.document = document
        self.on_commit = on_commit or (lambda label, scene_id, entity_id, before, after: None)
        self.on_status = on_status or (lambda message: None)
        self.on_select_entity = on_select_entity or (lambda entity_id: None)
        self.placement = None
        self._loading = False
        self._entity_ids: list[str] = []
        self._vars: dict[str, tk.Variable] = {
            key: tk.StringVar() for key in ("x", "y", "width", "height", "layer")
        }
        self.visible = tk.BooleanVar(value=True)

        tk.Label(self, text="INSPECTOR", bg=COLORS["panel"], fg=COLORS["fg"],
                 font=("Segoe UI", 11, "bold")).pack(anchor="w", pady=(0, 8))

        tk.Label(self, text="ENTITIES", bg=COLORS["panel"], fg=COLORS["muted"],
                 font=("Segoe UI", 9, "bold")).pack(anchor="w")
        self.entity_list = tk.Listbox(
            self,
            bg=COLORS["field"],
            fg=COLORS["fg"],
            relief="flat",
            bd=0,
            highlightthickness=1,
            highlightbackground=COLORS["line"],
            selectbackground=COLORS["accent"],
            selectforeground=COLORS["bg"],
            activestyle="none",
            font=("Segoe UI", 9),
            exportselection=False,
            height=4,
        )
        self.entity_list.pack(fill="x", pady=(2, 10))
        self.entity_list.bind("<<ListboxSelect>>", self._on_entity_pick)

        self.readonly: dict[str, tk.Label] = {}
        for key, caption in (
            ("entity_id", "Entity ID"),
            ("kind", "Kind"),
            ("state_id", "State"),
            ("source", "Asset / Primitive"),
        ):
            self.readonly[key] = self._readonly_row(caption)

        for key, caption in (("x", "X"), ("y", "Y"), ("width", "Width"), ("height", "Height"), ("layer", "Layer")):
            self._number_row(caption, key)

        visible_row = tk.Frame(self, bg=COLORS["panel"])
        visible_row.pack(fill="x", pady=4)
        tk.Label(visible_row, text="Visible", bg=COLORS["panel"], fg=COLORS["muted"],
                 font=FIELD_FONT, width=10, anchor="w").pack(side="left")
        tk.Checkbutton(visible_row, text="show", variable=self.visible, command=self._apply_visible,
                       bg=COLORS["panel"], fg=COLORS["fg"], selectcolor=COLORS["field"],
                       activebackground=COLORS["panel"], activeforeground=COLORS["fg"],
                       font=FIELD_FONT).pack(side="left")

        self._loading = False
        self.show(None)

    def _readonly_row(self, caption: str) -> tk.Label:
        row = tk.Frame(self, bg=COLORS["panel"])
        row.pack(fill="x", pady=2)
        tk.Label(row, text=caption, bg=COLORS["panel"], fg=COLORS["muted"], font=FIELD_FONT,
                 width=10, anchor="w").pack(side="left")
        value = tk.Label(row, text="—", bg=COLORS["panel"], fg=COLORS["fg"], font=FIELD_FONT,
                         anchor="w", wraplength=150, justify="left")
        value.pack(side="left", fill="x", expand=True)
        return value

    def _number_row(self, caption: str, key: str) -> None:
        row = tk.Frame(self, bg=COLORS["panel"])
        row.pack(fill="x", pady=2)
        tk.Label(row, text=caption, bg=COLORS["panel"], fg=COLORS["muted"], font=FIELD_FONT,
                 width=10, anchor="w").pack(side="left")
        entry = tk.Entry(row, textvariable=self._vars[key], bg=COLORS["field"], fg=COLORS["fg"],
                         insertbackground=COLORS["fg"], relief="flat", bd=0, font=FIELD_FONT,
                         highlightthickness=1, highlightbackground=COLORS["line"],
                         highlightcolor=COLORS["accent"], justify="right")
        entry.pack(side="left", fill="x", expand=True, ipady=6)
        entry.bind("<Return>", lambda _event, k=key: self._apply_fields({k: self._vars[k].get()}))
        entry.bind("<FocusOut>", lambda _event, k=key: self._apply_fields({k: self._vars[k].get()}))

    # ---- public ------------------------------------------------------
    def load_entities(self, placements) -> None:
        """List every entity of the scene, hidden ones included."""
        self._loading = True
        self.entity_list.delete(0, "end")
        self._entity_ids = []
        for placement in placements:
            self._entity_ids.append(placement.entity_id)
            label = placement.entity_id if placement.visible else f"{placement.entity_id}  (hidden)"
            self.entity_list.insert("end", label)
        self._loading = False
        if self.placement is not None:
            self._highlight(self.placement.entity_id)

    def _highlight(self, entity_id: str | None) -> None:
        if entity_id in self._entity_ids:
            self.entity_list.selection_clear(0, "end")
            self.entity_list.selection_set(self._entity_ids.index(entity_id))
            self.entity_list.see(self._entity_ids.index(entity_id))

    def _on_entity_pick(self, _event) -> None:
        if self._loading:
            return
        selection = self.entity_list.curselection()
        if selection and selection[0] < len(self._entity_ids):
            self.on_select_entity(self._entity_ids[selection[0]])

    def show(self, placement) -> None:
        self._loading = True
        self.placement = placement
        if placement is None:
            for label in self.readonly.values():
                label.configure(text="—")
            for variable in self._vars.values():
                variable.set("")
            self.visible.set(False)
            self.entity_list.selection_clear(0, "end")
            self._loading = False
            return

        self.readonly["entity_id"].configure(text=placement.entity_id)
        self.readonly["kind"].configure(text=placement.kind or "—")
        self.readonly["state_id"].configure(text=placement.state_id)
        self.readonly["source"].configure(text=placement.source_id)
        self._highlight(placement.entity_id)
        state = self.document.state(placement.scene_id, placement.entity_id, placement.state_id)
        transform = state.get("transform") or {}
        for key in ("x", "y", "width", "height"):
            self._vars[key].set(str(transform.get(key, "")))
        self._vars["layer"].set(str(state.get("layer", "")))
        self.visible.set(bool(state.get("visible", True)))
        self._loading = False

    def sync(self) -> None:
        """Refresh the fields after a canvas drag."""
        self.show(self.placement)

    # ---- edits -------------------------------------------------------
    def _parse(self, raw: str):
        try:
            return float(str(raw).strip())
        except (TypeError, ValueError):
            return None

    def _apply_fields(self, changes: dict[str, str]) -> None:
        if self._loading or self.placement is None:
            return
        placement = self.placement
        state = self.document.state(placement.scene_id, placement.entity_id, placement.state_id)
        transform = state.get("transform") or {}
        before = {
            "x": transform.get("x"),
            "y": transform.get("y"),
            "width": transform.get("width"),
            "height": transform.get("height"),
            "layer": state.get("layer"),
            "visible": state.get("visible"),
        }
        after = dict(before)
        for key, raw in changes.items():
            value = self._parse(raw)
            if value is None:
                self.on_status(f"{key}: không phải số, giữ nguyên giá trị cũ.")
                self._loading = True
                self._vars[key].set(str(before[key]))
                self._loading = False
                return
            after[key] = int(value) if float(value).is_integer() else value
        if after == before:
            return
        self._loading = True
        self.document.set_transform(
            placement.scene_id,
            placement.entity_id,
            placement.state_id,
            **{key: after[key] for key in ("x", "y", "width", "height")},
        )
        if after["layer"] != before["layer"]:
            self.document.set_layer(placement.scene_id, placement.entity_id, after["layer"], placement.state_id)
        self._loading = False
        self.on_commit("Inspector", placement.scene_id, placement.entity_id, before, after)

    def _apply_visible(self) -> None:
        if self._loading or self.placement is None:
            return
        placement = self.placement
        state = self.document.state(placement.scene_id, placement.entity_id, placement.state_id)
        before = {"visible": state.get("visible")}
        after = {"visible": bool(self.visible.get())}
        if after == before:
            return
        self.document.set_visible(placement.scene_id, placement.entity_id, after["visible"], placement.state_id)
        self.on_commit("Visible", placement.scene_id, placement.entity_id, before, after)


class EventInspector(tk.Frame):
    """Read-only event fields; only the semantic voice anchor is editable."""

    def __init__(self, parent, document, *, on_select_event=None, on_commit=None, on_status=None) -> None:
        super().__init__(parent, bg=COLORS["panel"])
        self.document = document
        self.on_select_event = on_select_event or (lambda event_id: None)
        self.on_commit = on_commit or (lambda event_id, before, after: None)
        self.on_status = on_status or (lambda message: None)
        self.scene_id: str | None = None
        self.event: dict | None = None
        self._loading = False
        self._event_ids: list[str] = []
        self.anchor_text = tk.StringVar()
        self.anchor_occurrence = tk.StringVar()

        tk.Label(self, text="EVENT INSPECTOR", bg=COLORS["panel"], fg=COLORS["fg"],
                 font=("Segoe UI", 11, "bold")).pack(anchor="w", pady=(0, 8))

        self.event_list = tk.Listbox(
            self, bg=COLORS["field"], fg=COLORS["fg"], relief="flat", bd=0, highlightthickness=1,
            highlightbackground=COLORS["line"], selectbackground=COLORS["accent"],
            selectforeground=COLORS["bg"], activestyle="none", font=("Segoe UI", 9),
            exportselection=False, height=4,
        )
        self.event_list.pack(fill="x", pady=(0, 8))
        self.event_list.bind("<<ListboxSelect>>", self._on_pick)

        self.readonly: dict[str, tk.Label] = {}
        for key, caption in (
            ("event_id", "event.id"),
            ("target", "target"),
            ("action", "action"),
            ("state_before", "state_before"),
            ("state_after", "state_after"),
            ("trigger_source", "trigger.source"),
            ("motion", "motion"),
            ("sfx", "sfx"),
        ):
            self.readonly[key] = self._readonly_row(caption)

        anchor_frame = tk.Frame(self, bg=COLORS["panel"])
        anchor_frame.pack(fill="x", pady=(8, 0))
        tk.Label(anchor_frame, text="voice_anchor", bg=COLORS["panel"], fg=COLORS["muted"],
                 font=("Segoe UI", 9, "bold")).pack(anchor="w")
        self.anchor_text_entry = self._entry(anchor_frame, self.anchor_text)
        self.anchor_occurrence_entry = self._entry(anchor_frame, self.anchor_occurrence)
        apply_row = tk.Frame(self, bg=COLORS["panel"])
        apply_row.pack(fill="x", pady=(6, 0))
        self.apply_button = tk.Button(
            apply_row, text="Áp dụng anchor", command=self._apply, bg=COLORS["field"], fg=COLORS["fg"],
            relief="flat", bd=0, padx=10, pady=5, font=("Segoe UI", 9), cursor="hand2",
            highlightthickness=1, highlightbackground=COLORS["line"],
        )
        self.apply_button.pack(side="left")
        self._set_anchor_editable(False)

    def _readonly_row(self, caption: str) -> tk.Label:
        row = tk.Frame(self, bg=COLORS["panel"])
        row.pack(fill="x", pady=1)
        tk.Label(row, text=caption, bg=COLORS["panel"], fg=COLORS["muted"], font=FIELD_FONT,
                 width=15, anchor="w").pack(side="left")
        value = tk.Label(row, text="—", bg=COLORS["panel"], fg=COLORS["fg"], font=FIELD_FONT,
                         anchor="w", wraplength=120, justify="left")
        value.pack(side="left", fill="x", expand=True)
        return value

    def _entry(self, parent, variable) -> tk.Entry:
        row = tk.Frame(parent, bg=COLORS["panel"])
        row.pack(fill="x", pady=2)
        tk.Label(row, text="text" if variable is self.anchor_text else "occurrence", bg=COLORS["panel"],
                 fg=COLORS["muted"], font=FIELD_FONT, width=10, anchor="w").pack(side="left")
        entry = tk.Entry(row, textvariable=variable, bg=COLORS["field"], fg=COLORS["fg"],
                         insertbackground=COLORS["fg"], relief="flat", bd=0, font=FIELD_FONT,
                         highlightthickness=1, highlightbackground=COLORS["line"],
                         highlightcolor=COLORS["accent"])
        entry.pack(side="left", fill="x", expand=True, ipady=5)
        return entry

    def _set_anchor_editable(self, enabled: bool) -> None:
        state = "normal" if enabled else "disabled"
        self.anchor_text_entry.configure(state=state)
        self.anchor_occurrence_entry.configure(state=state)
        self.apply_button.configure(state=state)

    # ---- public ------------------------------------------------------
    def load_events(self, scene_id: str | None, events=None) -> None:
        self.scene_id = scene_id
        events = list(events if events is not None else (self.document.events(scene_id) if scene_id else []))
        self._loading = True
        self.event_list.delete(0, "end")
        self._event_ids = []
        for event in events:
            event_id = str(event.get("id"))
            self._event_ids.append(event_id)
            trigger = event.get("trigger") or {}
            tag = "scene_start" if trigger.get("source") == "scene_start" else "voice_anchor"
            self.event_list.insert("end", f"{event_id}  ({tag})")
        self._loading = False
        self.show(None)

    def select(self, event_id: str | None) -> None:
        self._loading = True
        self.event_list.selection_clear(0, "end")
        if event_id in self._event_ids:
            self.event_list.selection_set(self._event_ids.index(event_id))
        self._loading = False
        event = self._event(event_id)
        self.show(event)

    def show(self, event: dict | None) -> None:
        self._loading = True
        self.event = event
        if event is None:
            for label in self.readonly.values():
                label.configure(text="—")
            self.anchor_text.set("")
            self.anchor_occurrence.set("")
            self._set_anchor_editable(False)
            self._loading = False
            return

        trigger = event.get("trigger") or {}
        motion = event.get("motion") or {}
        self.readonly["event_id"].configure(text=str(event.get("id")))
        self.readonly["target"].configure(text=str(event.get("target", "—")))
        self.readonly["action"].configure(text=str(event.get("action", "—")))
        self.readonly["state_before"].configure(text=str(event.get("state_before", "—")))
        self.readonly["state_after"].configure(text=str(event.get("state_after", "—")))
        self.readonly["trigger_source"].configure(text=str(trigger.get("source", "—")))
        self.readonly["motion"].configure(
            text=f"{motion.get('preset', '—')} · {motion.get('duration_frames', '—')}f"
        )
        self.readonly["sfx"].configure(text=str(event.get("sfx") or "—"))
        editable = trigger.get("source") == "voice_anchor"
        self._set_anchor_editable(editable)
        if editable:
            self.anchor_text.set(str(trigger.get("text", "")))
            self.anchor_occurrence.set("" if trigger.get("occurrence") is None else str(trigger["occurrence"]))
        self._loading = False

    def _event(self, event_id: str | None) -> dict | None:
        if not event_id or not self.scene_id:
            return None
        for event in self.document.events(self.scene_id):
            if event.get("id") == event_id:
                return event
        return None

    def _on_pick(self, _event) -> None:
        if self._loading:
            return
        selection = self.event_list.curselection()
        if selection and selection[0] < len(self._event_ids):
            self.on_select_event(self._event_ids[selection[0]])

    def _apply(self) -> None:
        if self._loading or self.event is None:
            return
        before = dict(self.event.get("trigger") or {})
        text = self.anchor_text.get().strip()
        raw_occurrence = self.anchor_occurrence.get().strip()
        try:
            occurrence = int(raw_occurrence) if raw_occurrence else None
        except ValueError:
            self.on_status("occurrence phải là số nguyên 1-based.")
            return
        after = {"source": "voice_anchor", "text": text}
        if occurrence is not None:
            after["occurrence"] = occurrence
        if after == before:
            self.on_status("Anchor không đổi.")
            return
        self.on_commit(str(self.event.get("id")), before, after)