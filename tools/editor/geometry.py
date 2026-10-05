#!/usr/bin/env python3
"""Display scaling for the 1080x1920 production canvas."""

from __future__ import annotations

CANVAS_WIDTH = 1080
CANVAS_HEIGHT = 1920


class CanvasTransform:
    """Map production coordinates onto a fitted 9:16 display canvas."""

    def __init__(
        self,
        width: int = CANVAS_WIDTH,
        height: int = CANVAS_HEIGHT,
        view_width: int | None = None,
        view_height: int | None = None,
    ) -> None:
        self.width = float(width)
        self.height = float(height)
        self.view_width = float(view_width or self.width)
        self.view_height = float(view_height or self.height)

    def fit(self, view_width: int, view_height: int) -> "CanvasTransform":
        return CanvasTransform(self.width, self.height, view_width, view_height)

    def _scale(self) -> float:
        return min(self.view_width / self.width, self.view_height / self.height)

    @property
    def scale(self) -> float:
        """One uniform factor, so the canvas can never distort the contract."""
        return self._scale()

    @property
    def display_width(self) -> float:
        return self.width * self.scale

    @property
    def display_height(self) -> float:
        return self.height * self.scale

    def to_display(self, x: float, y: float) -> tuple[float, float]:
        return float(x) * self.scale, float(y) * self.scale

    def from_display(self, x: float, y: float) -> tuple[float, float]:
        return float(x) / self.scale, float(y) / self.scale

    def to_production_length(self, display_length: float) -> float:
        return float(display_length) / self.scale

    def to_display_rect(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
    ) -> tuple[float, float, float, float]:
        left, top = self.to_display(x, y)
        return left, top, float(width) * self.scale, float(height) * self.scale

    def offset_display_rect(
        self,
        rect: tuple[float, float, float, float],
        dx: float,
        dy: float,
    ) -> tuple[float, float, float, float]:
        left, top, width, height = rect
        return left + dx, top + dy, width, height

    def resize_display_rect(
        self,
        rect: tuple[float, float, float, float],
        dx: float,
        dy: float,
    ) -> tuple[float, float, float, float]:
        """Grow a display rect, keeping the production aspect ratio."""
        left, top, width, height = rect
        ratio = height / width if width else 1.0
        new_width = max(width + dx, 1.0)
        new_height = new_width * ratio
        return left + (width - new_width), top + (height - new_height), new_width, new_height