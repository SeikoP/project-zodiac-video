"""Read-only source-bound EpisodeStatus: never approve voice/visual/video from file existence."""
from __future__ import annotations

import hashlib
import json
import wave
from pathlib import Path

from .models import EpisodeStatus, ProjectHandle

# Mirror canonical Node approvalPaths resolution order exactly.
_SOURCE = {
    "narration": (".authoring/narration.txt", "narration.txt"),
    "plan": (".authoring/narrative-plan.json", "narrative-plan.json"),
    "scope": (".authoring/episode-scope.json",),
    "brief": (".authoring/phase3-writer-brief.json", ".authoring/writer-brief.json",
              ".authoring/narration-writer-brief.json"),
    "voice": (".authoring/voice-profile.json", "voice-profile.json"),
}


def _json(path: Path) -> dict | None:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else None
    except (OSError, ValueError, UnicodeError):
        return None


def _hash(path: Path, root: Path) -> str | None:
    try:
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            return None
        digest = hashlib.sha256()
        with path.open("rb") as reader:
            for chunk in iter(lambda: reader.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        return None


def _canonical_source_hash(root: Path, choices: tuple[str, ...]) -> str | None:
    # Node checks the first existing candidate, not a fixed path. A broken,
    # unreadable or unsafe higher-priority source must block, not fall through.
    for rel in choices:
        candidate = root / rel
        if candidate.is_symlink() or candidate.exists():
            return _hash(candidate, root)
    return None


def _source_status(handle: ProjectHandle) -> str:
    root = handle.workspace.resolve()
    marker = _json(root / "studio-import-receipt.json")
    if marker is None:
        return "UNKNOWN"
    if marker.get("format") != "zodiac-studio-import@1" or \
            marker.get("source_sha256") != handle.imported_source_sha256:
        return "BLOCKED"
    receipt = _json(root / ".authoring/content-review-receipt.json")
    state = _json(root / ".authoring/pipeline-state.json")
    if receipt is None or state is None:
        return "BLOCKED"
    run_id = receipt.get("run_id")
    if (not isinstance(run_id, str) or not run_id.strip() or
            state.get("run_id") != run_id or marker.get("run_id") != run_id):
        return "BLOCKED"
    proof = receipt.get("proof") or {}
    if not isinstance(proof, dict) or not isinstance(state.get("review_receipts"), list):
        return "BLOCKED"
    if not isinstance(receipt.get("source_hashes"), dict):
        return "BLOCKED"
    if receipt.get("phase_id") != "01-content" or receipt.get("status") != "APPROVED" or \
            proof.get("kind") != "user_message" or not str(proof.get("ref") or "").strip():
        return "BLOCKED"
    approvals = [
        r for r in state.get("review_receipts", [])
        if isinstance(r, dict) and r.get("phase_id") == "01-content"
        and r.get("status") == "APPROVED"
    ]
    if (len(approvals) != 1 or approvals[0].get("proof") != proof or
            not isinstance(approvals[0].get("source_hashes"), dict)):
        return "BLOCKED"
    hashes = {k: _canonical_source_hash(root, choices)
              for k, choices in _SOURCE.items()}
    if any(value is None for value in hashes.values()) or \
            any(receipt.get("source_hashes", {}).get(k) != v or
                approvals[0].get("source_hashes", {}).get(k) != v
                for k, v in hashes.items()):
        return "BLOCKED"
    # Same deterministic source identity as the canonical Node P0 import bridge.
    source_identity = hashlib.sha256(json.dumps({
        "run_id": receipt.get("run_id"),
        "source_hashes": hashes, "proof_ref": proof["ref"],
    }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
    return "APPROVED" if source_identity == handle.imported_source_sha256 else "BLOCKED"


def _voice_status(workspace: Path) -> str:
    base = workspace / ".runtime/artifacts/voice"
    if not base.is_dir():
        return "UNKNOWN"
    active = []
    for index in sorted(base.glob("*/index.json")):
        if index.is_symlink() or not index.resolve().is_relative_to(workspace.resolve()):
            return "BLOCKED"
        record = _json(index)
        if not record or record.get("version") != 1 or not record.get("active_take"):
            return "BLOCKED"
        takes = record.get("takes", [])
        if not isinstance(takes, list):
            return "BLOCKED"
        take = next((x for x in takes if isinstance(x, dict) and
                     x.get("take_id") == record["active_take"]), None)
        if not take:
            return "BLOCKED"
        relative = take.get("path")
        if not isinstance(relative, str) or Path(relative).is_absolute() or ".." in Path(relative).parts:
            return "BLOCKED"
        wav = workspace / relative
        if _hash(wav, workspace) != take.get("wav_sha256"):
            return "BLOCKED"
        try:
            with wave.open(str(wav), "rb") as reader:
                if reader.getnframes() < 1 or reader.getframerate() < 1000:
                    return "BLOCKED"
        except (OSError, EOFError, wave.Error):
            return "BLOCKED"
        active.append(take)
    if not active:
        return "UNKNOWN"
    if any(x.get("migrated_from_checkpoint") or
           x.get("approval_source") == "studio-v2-compatibility" for x in active):
        return "COMPAT_MIGRATED"
    # A take's legacy APPROVED flag never establishes that a human listened.
    return "TECHNICAL_VALID"


def resolve_episode_status(handle: ProjectHandle) -> EpisodeStatus:
    root = handle.workspace.resolve()
    return EpisodeStatus(
        project_id=handle.project_id,
        content=_source_status(handle),
        voice=_voice_status(root),
        # Until later phases introduce verified human visual, actual exported
        # media and publication receipts, these remain evidence-absent UNKNOWN.
        visual="UNKNOWN",
        video="UNKNOWN",
        published="UNKNOWN",
    )
