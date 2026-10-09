"""Measured unit telemetry for Studio, backed by tqdm.

No percentage is emitted before a unit has actually completed.
The Qt frontend consumes callbacks; terminal users see tqdm when attached to
an interactive TTY. A fallback full render does not inherit segment progress.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
import sys
from typing import Callable, Iterator, Sequence, TypeVar

from tqdm.auto import tqdm

T = TypeVar("T")
Observer = Callable[[str, int, int, str, str], None]
_OBSERVER: ContextVar[Observer | None] = ContextVar("studio_unit_progress", default=None)


@contextmanager
def observe_unit_progress(callback: Observer) -> Iterator[None]:
    token = _OBSERVER.set(callback)
    try:
        yield
    finally:
        _OBSERVER.reset(token)


def reset_unit_progress(stage: str, *, unit: str, label: str) -> None:
    observer = _OBSERVER.get()
    if observer is not None:
        observer(stage, 0, 0, unit, label)


def tracked_units(items: Sequence[T], *, stage: str, label: str, unit: str) -> Iterator[T]:
    """Update only after the work performed for each yielded unit succeeds.

    tqdm provides terminal display; the callback provides structured measured
    counts without exposing CR-based terminal bars to the Qt activity log.
    """
    total = len(items)
    if total <= 0:
        return
    interactive = bool(getattr(sys.stderr, "isatty", lambda: False)())
    observer = _OBSERVER.get()
    with tqdm(items, total=total, desc=label, unit=unit,
              disable=not interactive, leave=False) as progress:
        for completed, item in enumerate(progress, 1):
            yield item
            if observer is not None:
                observer(stage, completed, total, unit, label)

# The pinned Remotion CLI 4.0.530 prints actual "Rendering frames"
# and "Encoding video" x/y counters; it rewrites terminal lines using ANSI.
from dataclasses import dataclass
import re

_ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
_RENDER_COUNTER = re.compile(
    r"\b(Rendering|Rendered)\s+frames?\b[^\r\n]{0,180}?\b(\d{1,8})/(\d{1,8})\b", re.I,
)
_ENCODE_COUNTER = re.compile(
    r"\b(Encoding|Encoded|Muxing|Muxed)\s+(?:video|audio)\b[^\r\n]{0,180}?\b(\d{1,8})/(\d{1,8})\b", re.I,
)

FrameObserver = Callable[[str, int, int, str], None]


@dataclass(frozen=True)
class FrameScope:
    segment_id: str
    expected_frames: int
    observer: FrameObserver | None


_FRAME_OBSERVER: ContextVar[FrameObserver | None] = ContextVar("studio_frame_observer", default=None)
_FRAME_SCOPE: ContextVar[FrameScope | None] = ContextVar("studio_frame_scope", default=None)


@contextmanager
def observe_frame_progress(callback: FrameObserver) -> Iterator[None]:
    token = _FRAME_OBSERVER.set(callback)
    try:
        yield
    finally:
        _FRAME_OBSERVER.reset(token)


@contextmanager
def track_render_segment_frames(segment_id: str, expected_frames: int) -> Iterator[None]:
    observer = _FRAME_OBSERVER.get()
    scope = FrameScope(segment_id, expected_frames, observer)
    token = _FRAME_SCOPE.set(scope)
    try:
        if observer is not None and expected_frames > 0:
            observer(segment_id, 0, expected_frames, "rendering")
        yield
    finally:
        _FRAME_SCOPE.reset(token)


class RemotionFrameParser:
    """Parse only actual counters from the pinned CLI, not inferred progress.

    The stream may contain ANSI screen rewrites, CR updates and split packets.
    Reject totals inconsistent with the current segment's actual frame plan.
    """
    def __init__(self, scope: FrameScope):
        self.scope = scope
        self.tail = ""
        self.last: dict[str, int] = {}

    def feed(self, chunk: str) -> None:
        if self.scope.observer is None or self.scope.expected_frames <= 0:
            return
        normalized = _ANSI_RE.sub("", chunk)
        self.tail = (self.tail + normalized)[-1024:]
        for pattern, phase in ((_RENDER_COUNTER, "rendering"), (_ENCODE_COUNTER, "encoding")):
            for match in pattern.finditer(self.tail):
                done, total = int(match.group(2)), int(match.group(3))
                if total != self.scope.expected_frames or not (0 <= done <= total):
                    continue
                previous = self.last.get(phase, -1)
                if done <= previous:
                    continue
                self.last[phase] = done
                self.scope.observer(self.scope.segment_id, done, total, phase)

    @staticmethod
    def is_terminal_progress_line(line: str) -> bool:
        text = _ANSI_RE.sub("", line).strip()
        return bool(_RENDER_COUNTER.search(text) or _ENCODE_COUNTER.search(text))


def current_frame_scope() -> FrameScope | None:
    return _FRAME_SCOPE.get()
