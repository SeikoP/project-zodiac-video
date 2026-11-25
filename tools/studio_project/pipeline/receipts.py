"""Source-bound technical receipts for pipeline steps (never approvals)."""
from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

FORMAT = "zodiac-pipeline-receipt@1"
_NAME = re.compile(r"^[a-z][a-z0-9_]{0,40}$")


def _file(workspace: Path, name: str) -> Path:
    if not _NAME.fullmatch(name):
        raise ValueError("invalid receipt name")
    return Path(workspace) / ".runtime" / "pipeline" / "receipts" / f"{name}.json"


def write_receipt(workspace: Path, name: str, *, source_hash: str, build_id: str | None = None,
                  payload: dict | None = None) -> Path:
    path = _file(workspace, name)
    path.parent.mkdir(parents=True, exist_ok=True)
    body = {"format": FORMAT, "name": name, "source_hash": source_hash, "build_id": build_id, "payload": payload or {}}
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as writer:
            json.dump(body, writer, ensure_ascii=False, sort_keys=True)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return path


def read_receipt(workspace: Path, name: str) -> dict | None:
    path = _file(workspace, name)
    try:
        if path.is_symlink() or not path.is_file():
            return None
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return raw if isinstance(raw, dict) and raw.get("format") == FORMAT and raw.get("name") == name else None


def receipt_state(workspace: Path, name: str, source_hash: str | None, build_id: str | None = None) -> str:
    """NONE when absent, OK when bound to the current source (and build), else STALE."""
    receipt = read_receipt(workspace, name)
    if receipt is None:
        return "NONE"
    if source_hash is None or receipt.get("source_hash") != source_hash:
        return "STALE"
    if build_id is not None and receipt.get("build_id") != build_id:
        return "STALE"
    return "OK"
