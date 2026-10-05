#!/usr/bin/env python3
"""9:16 canvas: layer-ordered items, hit testing, drag and resize."""

from __future__ import annotations

import re
import tkinter as tk
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from tools.editor.geometry import CanvasTransform
from tools.studio.theme import COLORS

HANDLE = 8
MIN_SIZE = 1.0
DRAWABLE_TAGS = {"rect", "circle", "ellipse", "text", "path", "line", "polyline", "polygon"}
_NUMBER = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")


@dataclass(frozen=True)
class CanvasItem:
    placement: object
    layer: float
    display_rect: tuple[float, float, float, float]
    detail: str
    missing: bool = False

    @property
    def entity_id(self) -> str:
        return self.placement.entity_id


def build_items(document, scene_id: str, view: CanvasTransform, *, include_hidden: bool = False) -> list[CanvasItem]:
    """Visible placements of one scene, back layer first, in display pixels."""
    items = []
    for placement in document.placements(scene_id):
        if not placement.visible and not include_hidden:
            continue
        detail, missing = describe_source(document, placement)
        items.append(
            CanvasItem(
                placement=placement,
                layer=placement.layer,
                display_rect=view.to_display_rect(
                    placement.x,
                    placement.y,
                    placement.width,
                    placement.height,
                ),
                detail=detail,
                missing=missing,
            )
        )
    return items


def describe_source(document, placement) -> tuple[str, bool]:
    """Return a short label plus whether the referenced artwork is missing."""
    if placement.asset:
        entry = (document.working.get("assets") or {}).get(placement.asset)
        if not isinstance(entry, dict):
            return "MISSING ASSET", True
        relative = str(entry.get("path") or placement.asset)
        return relative, not (document.root / relative).is_file()

    entry = (document.working.get("primitives") or {}).get(placement.primitive)
    if not isinstance(entry, dict):
        return "MISSING PRIMITIVE", True
    return f"primitive:{placement.primitive}", False


def hit_test(items: list[CanvasItem], x: float, y: float) -> CanvasItem | None:
    """Topmost item containing the point; items are already layer ordered."""
    for item in reversed(items):
        left, top, width, height = item.display_rect
        if left <= x <= left + width and top <= y <= top + height:
            return item
    return None


def in_handle(rect: tuple[float, float, float, float], x: float, y: float) -> bool:
    left, top, width, height = rect
    return (
        left + width - HANDLE <= x <= left + width + HANDLE
        and top + height - HANDLE <= y <= top + height + HANDLE
    )


class AssetCache:
    """Cache parsed SVG/primitive artwork; never reread it while dragging."""

    def __init__(self, limit: int = 128) -> None:
        self._limit = limit
        self._cache: dict[tuple[str, str], dict] = {}

    def get(self, root: Path, document, placement) -> dict:
        key = (placement.scene_id, placement.source_id)
        if key not in self._cache:
            if len(self._cache) >= self._limit:
                self._cache.clear()
            self._cache[key] = self._load(root, document, placement)
        return self._cache[key]

    def _load(self, root: Path, document, placement) -> dict:
        if placement.asset:
            return _load_svg(root, document, placement)
        entry = (document.working.get("primitives") or {}).get(placement.primitive)
        if not isinstance(entry, dict):
            return {"view_box": None, "elements": (), "source": "MISSING PRIMITIVE", "missing": True}
        return {
            "view_box": entry.get("viewBox"),
            "elements": entry.get("elements") or (),
            "source": f"primitive:{placement.primitive}",
            "missing": False,
        }


def _local(tag: str) -> str:
    return tag.split("}")[-1].lower()


def _load_svg(root: Path, document, placement) -> dict:
    entry = (document.working.get("assets") or {}).get(placement.asset) or {}
    relative = str(entry.get("path") or "")
    path = root / relative
    if not relative or not path.is_file():
        return {"view_box": None, "elements": (), "source": relative or "MISSING ASSET", "missing": True}
    try:
        tree = ET.fromstring(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ET.ParseError):
        return {"view_box": None, "elements": (), "source": relative, "missing": True}

    elements = []
    for element in tree.iter():
        tag = _local(element.tag)
        if tag not in DRAWABLE_TAGS:
            continue
        attributes = {key.split("}")[-1]: value for key, value in element.attrib.items()}
        if tag == "text":
            attributes.setdefault("text", (element.text or "").strip())
        elements.append({"tag": tag, "attributes": attributes})
    return {"view_box": tree.get("viewBox"), "elements": elements, "source": relative, "missing": False}


def _number(value, fallback=0.0) -> float:
    match = _NUMBER.search(str(value))
    return float(match.group()) if match else fallback


def draw_artwork(
    widget: tk.Canvas,
    item: CanvasItem,
    artwork: dict,
    outline: str,
    *,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
) -> None:
    """Best-effort vector preview; geometry follows the contract, not the beauty."""
    left, top, width, height = item.display_rect
    left, top = left + offset_x, top + offset_y
    if item.missing:
        widget.create_rectangle(left, top, left + width, top + height, outline=outline, dash=(4, 3))
        widget.create_text(
            left + width / 2,
            top + height / 2,
            text="MISSING ASSET",
            fill=COLORS["danger"],
            font=("Segoe UI", 9, "bold"),
        )
        return

    numbers = _NUMBER.findall(str(artwork.get("view_box") or ""))
    box_width = float(numbers[2]) if len(numbers) == 4 else width
    box_height = float(numbers[3]) if len(numbers) == 4 else height
    scale = min(width / box_width, height / box_height) if box_width and box_height else 1.0
    offset_x = left + (width - box_width * scale) / 2
    offset_y = top + (height - box_height * scale) / 2

    for element in artwork.get("elements") or ():
        _draw_element(widget, str(element.get("tag")), element.get("attributes") or {}, offset_x, offset_y, scale, outline)


def _draw_element(widget, tag, attributes, offset_x, offset_y, scale, outline) -> None:
    fill = attributes.get("fill") if attributes.get("fill") not in (None, "none") else ""
    stroke = attributes.get("stroke") if attributes.get("stroke") not in (None, "none") else None
    if tag == "rect":
        x = offset_x + _number(attributes.get("x")) * scale
        y = offset_y + _number(attributes.get("y")) * scale
        widget.create_rectangle(
            x,
            y,
            x + _number(attributes.get("width")) * scale,
            y + _number(attributes.get("height")) * scale,
            fill=fill,
            outline=stroke or outline,
            width=max(1, int(_number(attributes.get("stroke-width"), 1) * scale)),
        )
    elif tag in {"circle", "ellipse"}:
        cx = offset_x + _number(attributes.get("cx")) * scale
        cy = offset_y + _number(attributes.get("cy")) * scale
        rx = _number(attributes.get("rx") or attributes.get("r"), 10) * scale
        ry = _number(attributes.get("ry") or attributes.get("r"), 10) * scale
        widget.create_oval(cx - rx, cy - ry, cx + rx, cy + ry, fill=fill, outline=stroke or outline)
    elif tag == "line":
        widget.create_line(
            offset_x + _number(attributes.get("x1")) * scale,
            offset_y + _number(attributes.get("y1")) * scale,
            offset_x + _number(attributes.get("x2")) * scale,
            offset_y + _number(attributes.get("y2")) * scale,
            fill=stroke or outline,
        )
    elif tag in {"path", "polyline", "polygon"}:
        points = _flatten(attributes, offset_x, offset_y, scale)
        if len(points) >= 4:
            widget.create_line(*points, fill=stroke or outline)
    elif tag == "text":
        widget.create_text(
            offset_x + _number(attributes.get("x")) * scale,
            offset_y + _number(attributes.get("y")) * scale,
            text=str(attributes.get("text", "")),
            fill=fill or outline,
            font=("Segoe UI", max(6, int(_number(attributes.get("font-size"), 12) * scale))),
        )


def _flatten(attributes, offset_x, offset_y, scale) -> list[float]:
    raw = attributes.get("points") if attributes.get("points") else attributes.get("d")
    numbers = [float(value) for value in _NUMBER.findall(str(raw or ""))]
    points: list[float] = []
    for index in range(0, len(numbers) - 1, 2):
        points.append(offset_x + numbers[index] * scale)
        points.append(offset_y + numbers[index + 1] * scale)
    return points


class CanvasView(tk.Frame):
    """Interactive 9:16 canvas: select, drag to move, corner handle to resize."""

    def __init__(
        self,
        parent,
        document,
        *,
        on_select=None,
        on_status=None,
        on_commit=None,
    ) -> None:
        super().__init__(parent, bg=COLORS["bg"])
        self.document = document
        self.on_select = on_select or (lambda placement: None)
        self.on_status = on_status or (lambda message: None)
        self.on_commit = on_commit or (lambda label, scene_id, entity_id, before, after: None)

        self.scene_id: str | None = None
        self.items: list[CanvasItem] = []
        self.selected: CanvasItem | None = None
        self.show_safe_zone = True
        self.cache = AssetCache()
        self._view = CanvasTransform(document.video.get("width", 1080), document.video.get("height", 1920))
        self._offset = (0.0, 0.0)
        self._drag: dict | None = None

        self.widget = tk.Canvas(self, bg="#0F0D16", highlightthickness=1, highlightbackground=COLORS["line"])
        self.widget.pack(fill="both", expand=True, padx=10, pady=10)
        self.widget.bind("<Configure>", lambda _event: self.refresh())
        self.widget.bind("<Button-1>", self._on_press)
        self.widget.bind("<B1-Motion>", self._on_drag)
        self.widget.bind("<ButtonRelease-1>", self._on_release)

    # ---- public ------------------------------------------------------
    def show_scene(self, scene_id: str) -> None:
        self.scene_id = scene_id
        self.selected = None
        self.refresh()
        self.on_select(None)

    def select(self, entity_id: str | None) -> None:
        """Select by id, including hidden entities chosen from the inspector list."""
        self.selected = next(
            (
                item
                for item in build_items(
                    self.document, self.scene_id, self._view, include_hidden=True
                )
                if item.entity_id == entity_id
            ),
            None,
        )
        self.refresh()

    def safe_area(self) -> dict | None:
        return self.document.safe_area

    def refresh(self) -> None:
        widget = self.widget
        widget.delete("all")
        if not self.scene_id:
            return
        width = max(widget.winfo_width(), 200)
        height = max(widget.winfo_height(), 200)
        self._view = self._view.fit(width - 20, height - 20)
        # ponytail: single uniform scale + centering; no pan/zoom until needed.
        self._offset = (
            (width - self._view.display_width) / 2,
            (height - self._view.display_height) / 2,
        )
        offset_x, offset_y = self._offset

        left, top = self._view.to_display(0, 0)
        right = left + self._view.display_width
        bottom = top + self._view.display_height
        widget.create_rectangle(
            left + offset_x,
            top + offset_y,
            right + offset_x,
            bottom + offset_y,
            fill="#1B1826",
            outline=COLORS["line"],
        )

        self.items = build_items(self.document, self.scene_id, self._view)
        for item in self.items:
            draw_artwork(
                widget,
                item,
                self.cache.get(self.document.root, self.document, item.placement),
                COLORS["line"] if item.placement.visible else COLORS["muted"],
                offset_x=offset_x,
                offset_y=offset_y,
            )
            x, y, _width, _height = item.display_rect
            widget.create_text(
                x + offset_x + 4,
                y + offset_y + 4,
                text=f"{item.placement.entity_id} · L{item.placement.layer:g}"
                + ("" if item.placement.visible else " · hidden"),
                fill=COLORS["muted"],
                anchor="nw",
                font=("Segoe UI", 8),
            )

        if self.show_safe_zone:
            area = self.safe_area()
            if area:
                x, y, area_width, area_height = self._view.to_display_rect(
                    area["x"], area["y"], area["width"], area["height"]
                )
                widget.create_rectangle(
                    x + offset_x,
                    y + offset_y,
                    x + offset_x + area_width,
                    y + offset_y + area_height,
                    outline=COLORS["sage"],
                    dash=(6, 4),
                )
                widget.create_text(x + offset_x + 6, y + offset_y + 6, text="SAFE ZONE", fill=COLORS["sage"], anchor="nw", font=("Segoe UI", 8, "bold"))

        if self.selected is not None:
            self._draw_selection()

    # ---- interaction -------------------------------------------------
    def _draw_selection(self) -> None:
        widget = self.widget
        offset_x, offset_y = self._offset
        left, top, width, height = self.selected.display_rect
        widget.create_rectangle(
            left + offset_x,
            top + offset_y,
            left + offset_x + width,
            top + offset_y + height,
            outline=COLORS["accent"],
            width=2,
        )
        widget.create_rectangle(
            left + offset_x + width - HANDLE,
            top + offset_y + height - HANDLE,
            left + offset_x + width + HANDLE,
            top + offset_y + height + HANDLE,
            fill=COLORS["accent"],
            outline=COLORS["bg"],
        )

    def _on_press(self, event) -> None:
            if self.scene_id is None:
                return
            offset_x, offset_y = self._offset
            # hidden entities are never clickable; the inspector entity list selects them
            items = build_items(self.document, self.scene_id, self._view)
            x, y = event.x - offset_x, event.y - offset_y
            if self.selected is not None and in_handle(self.selected.display_rect, x, y):
                self._drag = {
                    "mode": "resize",
                    "before": self._snapshot(self.selected.placement),
                    "rect": self.selected.display_rect,
                    "origin": (event.x, event.y),
                }
                return
            item = hit_test(items, x, y)
            self.selected = item
            self.refresh()
            if item is None:
                self.on_select(None)
                return
            self.on_select(item.placement)
            self._drag = {
                "mode": "move",
                "before": self._snapshot(item.placement),
                "rect": item.display_rect,
                "origin": (event.x, event.y),
            }

    def _on_drag(self, event) -> None:
        if not self._drag or self.selected is None:
            return
        view = self._view
        origin_x, origin_y = self._drag["origin"]
        if self._drag["mode"] == "move":
            new_rect = view.offset_display_rect(
                self._drag["rect"], event.x - origin_x, event.y - origin_y
            )
        else:
            new_rect = view.resize_display_rect(
                self._drag["rect"], event.x - origin_x, event.y - origin_y
            )

        placement = self.selected.placement
        left, top, width, height = new_rect
        x, y = view.from_display(left, top)
        new_width = max(MIN_SIZE, round(view.to_production_length(width)))
        new_height = max(MIN_SIZE, round(view.to_production_length(height)))
        self.document.set_transform(
            placement.scene_id,
            placement.entity_id,
            placement.state_id,
            x=round(x),
            y=round(y),
            width=new_width,
            height=new_height,
        )
        self.refresh()
        self.on_status(
            f"{placement.entity_id}: x={round(x)} y={round(y)} w={new_width} h={new_height}"
        )

    def _on_release(self, _event) -> None:
        if not self._drag or self.selected is None:
            self._drag = None
            return
        placement = self.selected.placement
        after = self._snapshot(placement)
        before = self._drag["before"]
        mode = self._drag["mode"]
        self._drag = None
        if after != before:
            self.on_commit(
                "Move" if mode == "move" else "Resize",
                placement.scene_id,
                placement.entity_id,
                before,
                after,
            )

    def _snapshot(self, placement) -> dict:
        state = self.document.state(placement.scene_id, placement.entity_id, placement.state_id)
        transform = state.get("transform") or {}
        return {
            "x": transform.get("x"),
            "y": transform.get("y"),
            "width": transform.get("width"),
            "height": transform.get("height"),
            "layer": state.get("layer"),
            "visible": state.get("visible"),
        }
