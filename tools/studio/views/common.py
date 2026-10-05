#!/usr/bin/env python3
"""Shared Tk building blocks so the sections stay small and consistent."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from tools.studio.theme import COLORS

FONT = ("Segoe UI", 10)
FONT_SMALL = ("Segoe UI", 9)
FONT_BOLD = ("Segoe UI", 10, "bold")
FONT_TITLE = ("Segoe UI", 15, "bold")


def section(parent, title: str) -> tk.Frame:
    frame = tk.Frame(parent, bg=COLORS["panel"], highlightthickness=1, highlightbackground=COLORS["line"], padx=14, pady=12)
    tk.Label(frame, text=title, bg=COLORS["panel"], fg=COLORS["fg"], font=FONT_BOLD).pack(anchor="w", pady=(0, 10))
    return frame


def label(parent, text: str, *, small: bool = False, muted: bool = True, **kwargs) -> tk.Label:
    return tk.Label(
        parent,
        text=text,
        bg=kwargs.pop("bg", COLORS["panel"]),
        fg=COLORS["muted"] if muted else COLORS["fg"],
        font=FONT_SMALL if small else FONT,
        anchor="w",
        **kwargs,
    )


def entry(parent, variable) -> tk.Entry:
    return tk.Entry(
        parent,
        textvariable=variable,
        bg=COLORS["field"],
        fg=COLORS["fg"],
        insertbackground=COLORS["fg"],
        relief="flat",
        bd=0,
        font=FONT_SMALL,
        highlightthickness=1,
        highlightbackground=COLORS["line"],
        highlightcolor=COLORS["accent"],
        justify="left",
    )


class Button(tk.Button):
    def __init__(self, parent, text: str, command, *, primary: bool = False, **kwargs):
        super().__init__(
            parent,
            text=text,
            command=command,
            bg=COLORS["accent"] if primary else COLORS["field"],
            fg=COLORS["bg"] if primary else COLORS["fg"],
            activebackground="#F2A092" if primary else COLORS["line"],
            activeforeground=COLORS["fg"],
            disabledforeground="#7C7489",
            relief="flat",
            bd=0,
            padx=14,
            pady=8,
            font=FONT_BOLD if primary else FONT,
            cursor="hand2",
            highlightthickness=1,
            highlightbackground=COLORS["line"],
            highlightcolor=COLORS["accent"],
            **kwargs,
        )


def use_theme(root) -> None:
    """Dark ttk widgets so combobox and slider match the panel colours."""
    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure(
        "TCombobox",
        fieldbackground=COLORS["field"],
        background=COLORS["field"],
        foreground=COLORS["fg"],
        arrowcolor=COLORS["fg"],
        bordercolor=COLORS["line"],
        lightcolor=COLORS["field"],
        darkcolor=COLORS["field"],
    )
    style.map(
        "TCombobox",
        fieldbackground=[("readonly", COLORS["field"])],
        foreground=[("readonly", COLORS["fg"])],
        selectbackground=[("readonly", COLORS["field"])],
    )
    style.configure(
        "Horizontal.TScale",
        background=COLORS["panel"],
        troughcolor=COLORS["field"],
    )
    root.option_add("*TCombobox*Listbox.background", COLORS["field"])
    root.option_add("*TCombobox*Listbox.foreground", COLORS["fg"])
    root.option_add("*TCombobox*Listbox.selectBackground", COLORS["accent"])
    root.option_add("*TCombobox*Listbox.selectForeground", COLORS["bg"])