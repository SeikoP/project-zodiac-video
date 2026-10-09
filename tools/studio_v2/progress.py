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
