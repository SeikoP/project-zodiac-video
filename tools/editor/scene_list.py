#!/usr/bin/env python3
"""Scene navigator: scene IDs with a short voice preview."""

from __future__ import annotations

import tkinter as tk

from tools.studio.theme import COLORS

PREVIEW_WORDS = 7


class SceneList(tk.Frame):
    def __init__(self, parent, document, *, on_select=None) -> None:
        super().__init__(parent, bg=COLORS["panel"])
        self.document = document
        self.on_select = on_select or (lambda scene_id: None)

        tk.Label(self, text="SCENES", bg=COLORS["panel"], fg=COLORS["fg"],
                 font=("Segoe UI", 11, "bold")).pack(anchor="w", pady=(0, 8))

        self.listbox = tk.Listbox(self, bg=COLORS["field"], fg=COLORS["fg"], relief="flat", bd=0,
                                 highlightthickness=1, highlightbackground=COLORS["line"],
                                 selectbackground=COLORS["accent"], selectforeground=COLORS["bg"],
                                 activestyle="none", font=("Segoe UI", 9), exportselection=False,
                                 width=31)
        self.listbox.pack(fill="both", expand=True)
        self.listbox.bind("<<ListboxSelect>>", self._on_pick)
        self.reload()

    def reload(self) -> None:
        self.listbox.delete(0, "end")
        for scene_id in self.document.scene_ids:
            self.listbox.insert("end", f"{scene_id}\n{self._preview(scene_id)}")
        if self.document.scene_ids:
            self.listbox.selection_set(0)
            self.on_select(self.document.scene_ids[0])

    def _preview(self, scene_id: str) -> str:
        voice = self.document.scene(scene_id).get("voice") or ""
        words = str(voice).split()
        preview = " ".join(words[:PREVIEW_WORDS])
        return f'"{preview}…"' if len(words) > PREVIEW_WORDS else f'"{preview}"'

    def _on_pick(self, _event) -> None:
        selection = self.listbox.curselection()
        scene_ids = self.document.scene_ids
        if selection and selection[0] < len(scene_ids):
            self.on_select(scene_ids[selection[0]])