"""Owner cards: questions the authoring chain could not settle itself (missing art, a scene still weak after its re-choices).

A card has a default that keeps the scene as it is, so it never blocks the episode. Answering records the owner's choice in
`.runtime/pipeline/cards.json`; it is not a gate approval and creates no receipt. What `restage` and `redo` then do is up to the
chain the next time it runs (Task 7).
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from ..authoring_chain import CARD_OPTIONS, Card
from ..models import StudioError

STORE = Path(".runtime/pipeline/cards.json")


def _read(workspace: Path) -> list[dict]:
    try:
        rows = json.loads((Path(workspace) / STORE).read_text("utf8"))["cards"]
        return [r for r in rows if isinstance(r, dict)]
    except (OSError, ValueError, KeyError, TypeError):
        return []


def _write(workspace: Path, rows: list[dict]) -> None:
    path = Path(workspace) / STORE
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"cards": rows}, ensure_ascii=False), "utf8")
    tmp.replace(path)


def save_cards(workspace: Path, cards: list[Card]) -> None:
    """The chain's latest open questions. A question already answered (same scene, same reason) stays answered."""
    answered = {(r["scene_id"], r["reason"]): r for r in _read(workspace) if r.get("resolution")}
    rows = [dict(answered[(c.scene_id, c.reason)]) if (c.scene_id, c.reason) in answered else
            {"scene_id": c.scene_id, "reason": c.reason, "options": list(c.options), "default": c.default, "resolution": None}
            for c in cards]
    _write(workspace, rows)


def list_cards(workspace: Path) -> list[Card]:
    """Open cards only (not yet answered)."""
    return [Card(r["scene_id"], r["reason"], tuple(r.get("options") or CARD_OPTIONS), r.get("default", "accept"))
            for r in _read(workspace) if not r.get("resolution")]


def resolution(workspace: Path, scene_id: str) -> str | None:
    return next((r["resolution"] for r in _read(workspace) if r.get("scene_id") == scene_id and r.get("resolution")), None)


def resolve(workspace: Path, scene_id: str, choice: str) -> None:
    rows = _read(workspace)
    row = next((r for r in rows if r.get("scene_id") == scene_id and not r.get("resolution")), None)
    if row is None:
        raise StudioError("PIPELINE_CARD_UNKNOWN", "Không có thẻ nào đang mở cho cảnh này", "pipeline")
    if choice not in (row.get("options") or CARD_OPTIONS):
        raise StudioError("PIPELINE_CARD_CHOICE_INVALID", "Lựa chọn không có trong thẻ", "pipeline")
    row.update(resolution=choice, resolved_at=int(time.time()))
    _write(workspace, rows)
