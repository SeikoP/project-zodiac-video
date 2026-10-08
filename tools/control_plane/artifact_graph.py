from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from typing import Any


def _sha256(path: Path) -> str | None:
    try:
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        return None


@dataclass(frozen=True)
class ArtifactDecision:
    reusable: bool
    reason: str
    content_hash: str | None = None


class ArtifactGraph:
    """Job-local index of validated artifacts and their explicit dependencies."""

    def __init__(self, workspace: Path) -> None:
        self.workspace = Path(workspace).resolve()
        self.path = self.workspace / ".runtime" / "artifacts" / "manifest.json"
        self.records: dict[str, dict[str, Any]] = {}
        self.refresh()

    def refresh(self) -> None:
        self.records = {}
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            payload = {}
        if isinstance(payload, dict) and payload.get("version") == 1:
            records = payload.get("artifacts")
            if isinstance(records, dict):
                self.records = {
                    str(key): value
                    for key, value in records.items()
                    if isinstance(value, dict)
                }

    def decide(self, artifact_id: str, fingerprint: str) -> ArtifactDecision:
        record = self.records.get(artifact_id)
        if record is None:
            return ArtifactDecision(False, "NO_ARTIFACT")
        if record.get("input_fingerprint") != fingerprint:
            return ArtifactDecision(False, "DIRTY_INPUT")
        if record.get("validation_status") != "VALID":
            return ArtifactDecision(False, "ARTIFACT_INVALID")
        relative = record.get("path")
        if not isinstance(relative, str):
            return ArtifactDecision(False, "ARTIFACT_INVALID")
        path = (self.workspace / relative).resolve()
        if self.workspace not in path.parents and path != self.workspace:
            return ArtifactDecision(False, "ARTIFACT_INVALID")
        actual = _sha256(path)
        if actual is None or actual != record.get("content_hash"):
            return ArtifactDecision(False, "ARTIFACT_INVALID")
        return ArtifactDecision(True, "REUSED_VALIDATED", actual)

    def record(
        self,
        artifact_id: str,
        artifact_type: str,
        fingerprint: str,
        path: Path,
        *,
        producer: str,
        producer_version: str,
        approval_status: str = "NOT_APPLICABLE",
        provenance: dict[str, Any] | None = None,
        dependencies: dict[str, str] | None = None,
    ) -> str:
        self.refresh()
        path = Path(path).resolve()
        try:
            relative = path.relative_to(self.workspace).as_posix()
        except ValueError as exc:
            raise ValueError("job artifacts must remain inside the workspace") from exc
        content_hash = _sha256(path)
        if content_hash is None:
            raise FileNotFoundError(path)
        self.records[artifact_id] = {
            "artifact_id": artifact_id,
            "artifact_type": artifact_type,
            "content_hash": content_hash,
            "input_fingerprint": fingerprint,
            "producer": producer,
            "producer_version": producer_version,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "validation_status": "VALID",
            "approval_status": approval_status,
            "provenance": provenance or {},
            "dependencies": dependencies or {},
            "path": relative,
        }
        self._save()
        return content_hash

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(self.path.suffix + f".{os.getpid()}.tmp")
        try:
            temp.write_text(
                json.dumps(
                    {"version": 1, "artifacts": self.records},
                    ensure_ascii=False,
                    sort_keys=True,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
                newline="\n",
            )
            os.replace(temp, self.path)
        finally:
            temp.unlink(missing_ok=True)
