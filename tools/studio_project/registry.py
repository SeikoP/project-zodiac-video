"""Crash-safe Studio *metadata* index; not a visual or approval source of truth."""
from __future__ import annotations

import json
import re
import sqlite3
from contextlib import closing
from pathlib import Path

from .models import ProjectHandle, StudioError

_HASH = re.compile(r"^[a-fA-F0-9]{64}$")
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$")
_ALLOWED_COMMANDS = frozenset({"project.note", "project.tag"})


def _require_hash(value: str) -> str:
    if not isinstance(value, str) or not _HASH.fullmatch(value):
        raise StudioError("REGISTRY_INVALID", "Expected 64-character SHA-256")
    return value.lower()


def _require_id(value: str, field: str) -> str:
    if not isinstance(value, str) or not _ID.fullmatch(value):
        raise StudioError("REGISTRY_INVALID", "Unsafe " + field)
    return value


class EpisodeRegistry:
    """Durable indexes/events. No creative files are written here."""

    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.db_path = self.root / "studio-index.sqlite3"
        with closing(self._connect()) as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS projects (
                    project_id TEXT PRIMARY KEY,
                    workspace TEXT NOT NULL,
                    imported_source_sha256 TEXT NOT NULL UNIQUE,
                    source_manifest_hash TEXT NOT NULL,
                    episode_id TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
                );
                CREATE TABLE IF NOT EXISTS events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL REFERENCES projects(project_id),
                    command_id TEXT NOT NULL,
                    base_revision INTEGER NOT NULL,
                    revision INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    UNIQUE(project_id, command_id)
                );
                CREATE INDEX IF NOT EXISTS idx_events_project_seq
                ON events(project_id, seq);
            """)

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(str(self.db_path), timeout=5, isolation_level=None)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=5000")
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=FULL")
        return db

    def _workspace(self, path: Path) -> str:
        resolved = Path(path).resolve(strict=False)
        if not resolved.is_relative_to(self.root) or resolved == self.root:
            raise StudioError("WORKSPACE_OUTSIDE_ROOT", str(path))
        return str(resolved)

    @staticmethod
    def _handle(row: sqlite3.Row) -> ProjectHandle:
        return ProjectHandle(
            project_id=row["project_id"],
            workspace=Path(row["workspace"]),
            imported_source_sha256=row["imported_source_sha256"],
            episode_id=row["episode_id"],
        )

    def register(self, project: ProjectHandle, source_manifest_hash: str) -> ProjectHandle:
        _require_id(project.project_id, "project_id")
        _require_id(project.episode_id, "episode_id")
        source_sha = _require_hash(project.imported_source_sha256)
        manifest_sha = _require_hash(source_manifest_hash)
        workspace = self._workspace(project.workspace)
        db = self._connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            same_id = db.execute("SELECT * FROM projects WHERE project_id=?", (project.project_id,)).fetchone()
            if same_id and same_id["imported_source_sha256"] != source_sha:
                raise StudioError("PROJECT_IDENTITY_CONFLICT", project.project_id)
            same_source = db.execute(
                "SELECT * FROM projects WHERE imported_source_sha256=?", (source_sha,)
            ).fetchone()
            if same_source:
                if same_source["source_manifest_hash"] != manifest_sha:
                    raise StudioError("SOURCE_MANIFEST_DRIFT", source_sha)
                if same_source["project_id"] == project.project_id and (
                    same_source["workspace"] != workspace or same_source["episode_id"] != project.episode_id
                ):
                    raise StudioError("PROJECT_IDENTITY_CONFLICT", project.project_id)
                answer = self._handle(same_source)
            else:
                db.execute(
                    "INSERT INTO projects(project_id,workspace,imported_source_sha256,source_manifest_hash,episode_id)"
                    " VALUES(?,?,?,?,?)",
                    (project.project_id, workspace, source_sha, manifest_sha, project.episode_id),
                )
                answer = ProjectHandle(project.project_id, Path(workspace), source_sha, project.episode_id)
            db.execute("COMMIT")
            return answer
        except Exception:
            db.execute("ROLLBACK")
            raise
        finally:
            db.close()

    def get(self, project_id: str) -> ProjectHandle | None:
        with closing(self._connect()) as db:
            row = db.execute("SELECT * FROM projects WHERE project_id=?", (project_id,)).fetchone()
        return self._handle(row) if row else None

    def find_by_source(self, source_sha256: str) -> ProjectHandle | None:
        source_sha = _require_hash(source_sha256)
        with closing(self._connect()) as db:
            row = db.execute(
                "SELECT * FROM projects WHERE imported_source_sha256=?", (source_sha,)
            ).fetchone()
        return self._handle(row) if row else None

    def project_count(self) -> int:
        with closing(self._connect()) as db:
            return int(db.execute("SELECT COUNT(*) FROM projects").fetchone()[0])

    def current_revision(self, project_id: str) -> int:
        with closing(self._connect()) as db:
            row = db.execute("SELECT revision FROM projects WHERE project_id=?", (project_id,)).fetchone()
        if not row:
            raise StudioError("PROJECT_NOT_FOUND", project_id)
        return int(row["revision"])

    def record_command(
        self, project_id: str, command_id: str, base_revision: int, kind: str, payload: dict
    ) -> dict:
        _require_id(project_id, "project_id")
        _require_id(command_id, "command_id")
        if kind not in _ALLOWED_COMMANDS:
            raise StudioError("COMMAND_SCOPE_FORBIDDEN", str(kind))
        if not isinstance(base_revision, int) or isinstance(base_revision, bool) or base_revision < 0:
            raise StudioError("REGISTRY_INVALID", "Negative or nonnumeric base_revision")
        if not isinstance(payload, dict):
            raise StudioError("COMMAND_PAYLOAD_INVALID", "A JSON object is required")
        try:
            encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        except (TypeError, ValueError) as error:
            raise StudioError("COMMAND_PAYLOAD_INVALID", str(error)) from error
        if len(encoded.encode("utf-8")) > 16384:
            raise StudioError("COMMAND_PAYLOAD_INVALID", "Metadata command exceeds 16 KiB")
        db = self._connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            existing = db.execute(
                "SELECT * FROM events WHERE project_id=? AND command_id=?", (project_id, command_id)
            ).fetchone()
            if existing:
                if (existing["kind"], existing["payload_json"], existing["base_revision"]) != (
                    kind, encoded, base_revision
                ):
                    raise StudioError("COMMAND_IDEMPOTENCY_CONFLICT", command_id)
                result = self._event(existing)
            else:
                row = db.execute("SELECT revision FROM projects WHERE project_id=?", (project_id,)).fetchone()
                if row is None:
                    raise StudioError("PROJECT_NOT_FOUND", project_id)
                if row["revision"] != base_revision:
                    raise StudioError("REVISION_CONFLICT", str(row["revision"]))
                revision = base_revision + 1
                cursor = db.execute(
                    "INSERT INTO events(project_id,command_id,base_revision,revision,kind,payload_json)"
                    " VALUES(?,?,?,?,?,?)",
                    (project_id, command_id, base_revision, revision, kind, encoded),
                )
                db.execute("UPDATE projects SET revision=? WHERE project_id=?", (revision, project_id))
                result = {
                    "project_id": project_id, "command_id": command_id,
                    "event_seq": cursor.lastrowid, "revision": revision,
                    "kind": kind, "payload": json.loads(encoded)
                }
            db.execute("COMMIT")
            return result
        except Exception:
            db.execute("ROLLBACK")
            raise
        finally:
            db.close()

    @staticmethod
    def _event(row: sqlite3.Row) -> dict:
        return {
            "project_id": row["project_id"], "command_id": row["command_id"],
            "event_seq": row["seq"], "revision": row["revision"],
            "kind": row["kind"], "payload": json.loads(row["payload_json"])
        }

    def events_since(self, project_id: str, after_seq: int) -> list[dict]:
        with closing(self._connect()) as db:
            rows = db.execute(
                "SELECT * FROM events WHERE project_id=? AND seq>? ORDER BY seq ASC",
                (project_id, after_seq),
            ).fetchall()
        return [self._event(row) for row in rows]
