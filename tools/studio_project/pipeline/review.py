"""User-only Visual Review receipt. Agents, autopilot and pipeline.run can never create it."""
from __future__ import annotations

import json
import os
import re
import secrets
import tempfile
import time
from pathlib import Path

from ..models import StudioError
from ..status import _hash, _json

FORMAT = "zodiac-visual-review@1"
RUNTIME = Path(".runtime/visual-workspace")
PLAYBACKS = Path(".runtime/pipeline/playbacks.json")
PLAYBACK_TTL_SECONDS = 6 * 3600
# A review needs real viewing time: confirming sooner than this after the preview opened is refused.
# Tests (and only tests) may set ZODIAC_REVIEW_MIN_SECONDS to a smaller value.
MIN_REVIEW_SECONDS = 10.0


def _min_review_seconds() -> float:
    try:
        return max(0.0, float(os.environ.get("ZODIAC_REVIEW_MIN_SECONDS", MIN_REVIEW_SECONDS)))
    except ValueError:
        return MIN_REVIEW_SECONDS
_BUILD_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _error(code: str, message: str) -> StudioError:
    return StudioError(code, message, "pipeline")


def _manifest_hash(root: Path, build_id: object) -> str | None:
    if not isinstance(build_id, str) or not _BUILD_ID.fullmatch(build_id):
        return None
    return _hash(root / RUNTIME / "builds" / build_id / "manifest.json", root)


def review_receipt_valid(root: Path, state: dict) -> bool:
    """The receipt is valid only for the exact build manifest and source it was confirmed against."""
    receipt = _json(Path(root) / RUNTIME / "review.json")
    if not receipt or receipt.get("format") != FORMAT:
        return False
    proof = receipt.get("proof") or {}
    if proof.get("kind") != "user_gui" or not isinstance(proof.get("playback_id"), str):
        return False
    build = state.get("build") if isinstance(state.get("build"), dict) else {}
    manifest = _manifest_hash(Path(root), build.get("id"))
    return bool(manifest and receipt.get("build_id") == build.get("id") and receipt.get("build_manifest_sha256") == manifest
                and receipt.get("source_hash") == state.get("source_hash"))


def visual_review_status(root: Path) -> str:
    """APPROVED only for a valid receipt; STALE when one exists but no longer matches; else UNKNOWN."""
    root = Path(root)
    if not (root / RUNTIME / "review.json").exists():
        return "UNKNOWN"
    state = _json(root / RUNTIME / "state.json") or {}
    return "APPROVED" if review_receipt_valid(root, state) else "STALE"


def _atomic(path: Path, body: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.stem}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as writer:
            json.dump(body, writer, ensure_ascii=False, sort_keys=True)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _playbacks(root: Path) -> dict:
    data = _json(root / PLAYBACKS) or {}
    now = time.time()
    return {k: v for k, v in data.items() if isinstance(v, dict) and now - v.get("issued_at", 0) < PLAYBACK_TTL_SECONDS}


def _require_ready(service, project_id: str) -> None:
    from .api import pipeline_get  # lazy: api -> evidence -> review would otherwise be a cycle
    nodes = {n["id"]: n["status"] for n in pipeline_get(service, project_id)["nodes"]}
    if nodes.get("visual_review") != "AWAITING_USER":
        raise _error("PIPELINE_GATE_NOT_READY", "Agent đang hoàn thiện; chưa thể duyệt hình ảnh")


def issue_playback(service, project_id: str, build_id: str) -> dict:
    """Backend-issued proof that the GUI opened this exact build for review (single use)."""
    root = Path(service.registry.get(project_id).workspace)
    _require_ready(service, project_id)
    snapshot = service.visual.snapshot(project_id)
    if (snapshot.get("build") or {}).get("id") != build_id:
        raise _error("PIPELINE_BUILD_MISMATCH", "Bản dựng đã thay đổi; mở lại bản xem trước")
    token = secrets.token_hex(16)
    book = dict(list(_playbacks(root).items())[-19:])
    book[token] = {"build_id": build_id, "source_hash": snapshot["source_hash"], "issued_at": time.time()}
    _atomic(root / PLAYBACKS, book)
    return {"playback_id": token}


def confirm_visual_review(service, project_id: str, base_revision: int, build_id: str, playback_id: str, *,
                          caller: str = "gui") -> dict:
    if caller != "gui":
        raise StudioError("COMMAND_SCOPE_FORBIDDEN", "Chỉ người dùng được duyệt hình ảnh", "command")
    root = Path(service.registry.get(project_id).workspace)
    snapshot = service.visual.snapshot(project_id)
    if base_revision != snapshot["revision"]:
        raise StudioError("REVISION_CONFLICT", "Dự án đã thay đổi; xem lại bản dựng mới", "pipeline")
    if (snapshot.get("build") or {}).get("id") != build_id:
        raise _error("PIPELINE_BUILD_MISMATCH", "Bản dựng đã thay đổi; mở lại bản xem trước")
    book = _playbacks(root)
    proof = book.get(playback_id) if isinstance(playback_id, str) else None
    if not proof or proof["build_id"] != build_id or proof["source_hash"] != snapshot["source_hash"]:
        raise _error("PIPELINE_PLAYBACK_REQUIRED", "Hãy xem bản dựng trước khi duyệt")
    _require_ready(service, project_id)
    if time.time() - proof.get("issued_at", 0) < _min_review_seconds():
        raise _error("PIPELINE_PLAYBACK_TOO_SHORT", "Hãy xem bản dựng thêm một chút trước khi duyệt")
    manifest = _manifest_hash(root, build_id)
    if manifest is None:
        raise _error("PIPELINE_BUILD_MISMATCH", "Không đọc được manifest của bản dựng")
    _atomic(root / RUNTIME / "review.json", {
        "format": FORMAT, "build_id": build_id, "build_manifest_sha256": manifest, "source_hash": snapshot["source_hash"],
        "revision": snapshot["revision"], "confirmed_at": time.time(), "proof": {"kind": "user_gui", "playback_id": playback_id}})
    book.pop(playback_id, None)
    _atomic(root / PLAYBACKS, book)
    return {"status": visual_review_status(root), "build_id": build_id, "source_hash": snapshot["source_hash"]}
