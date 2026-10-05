#!/usr/bin/env python3
"""Runtime invalidation boundary between editor edits and generated files."""

from __future__ import annotations

from pathlib import Path

SAFE_EDITS = frozenset({"transform", "layer", "visible"})

# ponytail: only visual derived props are dropped; voice.wav and
# .runtime/timing.json survive every SAFE edit by construction. Add entries here
# when a later phase introduces state/asset/caption edits.


class RuntimeInvalidationError(Exception):
    """An edit type without a defined runtime-invalidation boundary."""


def invalidate_runtime_for(package_root: Path, edit_type: str) -> list[Path]:
    """Delete only the derived files that a given edit invalidates."""
    if edit_type not in SAFE_EDITS:
        raise RuntimeInvalidationError(f"no runtime invalidation defined for {edit_type!r}")

    root = Path(package_root)
    removed = []
    for relative in (".runtime/render-props.json",):
        path = root / relative
        if path.exists():
            path.unlink()
            removed.append(path)
    return removed