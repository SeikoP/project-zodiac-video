"""Resolve approved narration anchors consistently across Studio scene partitioning."""
from __future__ import annotations


def anchor_offset(text: str, beat: dict) -> int:
    """Match the non-overlapping occurrence semantics of the Phase 1 JS contract."""
    anchor = beat.get("voice_anchor")
    occurrence = beat.get("occurrence", 1)
    if not isinstance(anchor, str) or not anchor.strip() or type(occurrence) is not int or occurrence < 1:
        return -1
    start = 0
    for _ in range(occurrence):
        at = text.find(anchor, start)
        if at < 0:
            return -1
        start = at + len(anchor)
    return at


def scene_binding(rows: list[dict], beat: dict):
    """Find the scene and local character offset of the globally selected occurrence."""
    text = "".join(row["text"] for row in rows)
    at = anchor_offset(text, beat)
    if at < 0:
        return None
    start = 0
    for row in rows:
        stop = start + len(row["text"])
        if start <= at < stop and at + len(beat["voice_anchor"]) <= stop:
            return row["id"], at - start
        start = stop
    return None
