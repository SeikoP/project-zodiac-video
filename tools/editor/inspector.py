#!/usr/bin/env python3
"""Inspector panel: read-only identity, editable transform/layer/visible."""

from __future__ import annotations

import tkinter as tk

from tools.zodiac_gui import COLORS

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
            height=6,
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