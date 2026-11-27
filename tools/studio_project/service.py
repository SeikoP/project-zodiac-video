"""P1 Zodiac Studio project/application boundary.

Human/agent transports must use this API, not write imported authoring files.
Only safe metadata notes/tags are permitted in this phase.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import re
import threading
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .importer import import_handoff
from .models import ProjectHandle, StudioError
from .registry import EpisodeRegistry
from .ideas import IdeasBoard
from .status import resolve_episode_status
from .settings import StudioSettings

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4"
PROJECT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$")
COMMAND_FIELDS = frozenset({"project_id", "command_id", "base_revision", "kind", "payload"})



def _concept_ids() -> set[str]:
    from .ideas import load_catalog
    try:
        return {c["id"] for g in load_catalog()["groups"] for c in g["concepts"]}
    except Exception:
        return set()



def scope_identity(scope: dict) -> tuple[str | None, str | None]:
    """Sign and concept of an episode scope; the Ideas board matches episodes on this pair."""
    from .agent_authoring import MEMBER_IDS, scope_sign
    sign = scope_sign(scope)
    concept = scope.get("concept_code")
    if isinstance(concept, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", concept.strip()):
        return (sign[:64] if sign else None), concept.strip()
    # zodiac-episode-scope@1 has no concept_code: Web names the episode "<concept>-<member>".
    episode, members = scope.get("episode_id"), scope.get("member_ids")
    if isinstance(episode, str) and isinstance(members, list) and len(members) == 1 and members[0] in MEMBER_IDS:
        head = episode[: -len(members[0]) - 1] if episode.endswith("-" + members[0]) else None
        if head and head in _concept_ids():
            return (sign[:64] if sign else None), head
    return (sign[:64] if sign else None), None


class StudioProjectService:
    """Single P0 owner for project reads and safely bounded metadata writes."""

    def __init__(self, projects_root: Path):
        self.registry = EpisodeRegistry(Path(projects_root))
        self.ideas = IdeasBoard(self.registry)
        self.settings = StudioSettings(self.registry.root)
        self._agent = None
        self._voice = None
        self._visual = None
        self._scope = threading.local()

    @contextlib.contextmanager
    def read_scope(self):
        """Within this block (this thread only) each project/visual/voice snapshot is computed once and reused.
        One pipeline read used to rebuild the same snapshot six times (each one hashes project files): seconds per poll.
        Never wrap code that writes and then reads again."""
        if getattr(self._scope, 'cache', None) is not None:
            yield
            return
        self._scope.cache = {}
        try:
            yield
        finally:
            self._scope.cache = None

    def scoped(self, key, compute):
        cache = getattr(self._scope, 'cache', None)
        if cache is None:
            return compute()
        if key not in cache:
            cache[key] = compute()
        value = cache[key]
        return dict(value) if isinstance(value, dict) else value  # a read scope: callers read, they do not edit nested data

    @property
    def visual(self):
        if self._visual is None:
            from .visual_workspace import VisualWorkspace
            self._visual = VisualWorkspace(self)
        return self._visual

    @property
    def voice(self):
        if self._voice is None:
            from .voice_lab import VoiceLab
            self._voice = VoiceLab(self)
        return self._voice

    @property
    def agent(self):
        if self._agent is None:
            from .agent_bridge import AgentManager
            self._agent = AgentManager(self)
        return self._agent

    def close(self) -> None:
        self.settings.close()
        try:
            try:
                if self._visual is not None:
                    self._visual.close()
            finally:
                if self._voice is not None:
                    self._voice.close()
        finally:
            if self._agent is not None:
                self._agent.close()

    @staticmethod
    def _id(value: object) -> str:
        if not isinstance(value, str) or PROJECT_ID.fullmatch(value) is None:
            raise StudioError("PROJECT_ID_INVALID", "Invalid project ID", "project")
        return value

    def _snapshot(self, handle: ProjectHandle) -> dict[str, Any]:
        status = asdict(resolve_episode_status(handle))
        if status['video'] == 'EXPORTED':
            from .audio_mix import export_audio_current
            from .status import _json
            receipt = (_json(handle.workspace/'.runtime/visual-workspace/state.json') or {}).get('export') or {}
            if not export_audio_current(self.settings, handle.workspace, receipt): status['video'] = 'STALE'
        label = handle.episode_id
        sign = None
        concept_code = None
        # Human-readable working title comes only from the hash-verified source.
        # It is never promoted to a final publish title or creative approval.
        if status["content"] == "APPROVED":
            scope_path = handle.workspace / ".authoring/episode-scope.json"
            if scope_path.is_file() and not scope_path.is_symlink():
                try:
                    scope = json.loads(scope_path.read_text(encoding="utf-8"))
                    working = scope.get("title_working")
                    if isinstance(working, str) and working.strip():
                        label = " ".join(working.split())[:120]
                    sign, concept_code = scope_identity(scope)
                except (OSError, ValueError, TypeError):
                    pass
        return {
            "project_id": handle.project_id,
            "episode_id": handle.episode_id,
            "display_title": label,
            "sign": sign,
            "concept_code": concept_code,
            "source_sha256": handle.imported_source_sha256,
            "revision": self.registry.current_revision(handle.project_id),
            "status": status,
        }

    def import_capsule(self, archive: Path) -> dict:
        # Actual existing P0 importer validates source, receipt, hashes and paths.
        handle = import_handoff(self.registry.root, Path(archive), self.registry)
        return self._snapshot(handle)

    def list_projects(self, *, limit: int = 100,
                      after_project_id: str | None = None) -> list[dict]:
        return [self._snapshot(handle) for handle in self.registry.list_projects(
            limit=limit, after_project_id=after_project_id,
        )]

    def project(self, project_id: str) -> dict:
        handle = self.registry.get(self._id(project_id))
        if handle is None:
            raise StudioError("PROJECT_NOT_FOUND", project_id, "project")
        return self.scoped(('project', handle.project_id), lambda: self._snapshot(handle))

    def events(self, project_id: str, *, after_seq: int = 0) -> list[dict]:
        self.project(project_id)
        if type(after_seq) is not int or after_seq < 0:
            raise StudioError("EVENT_CURSOR_INVALID", "Cursor must be a nonnegative integer", "events")
        # P1 bounded SQL query, cursor = last event_seq; do not load entire table.
        return self.registry.events_page(project_id, after_seq, limit=100)

    def recent_events(self, project_id: str) -> list[dict]:
        self.project(project_id)
        return self.registry.events_recent(project_id, limit=100)

    def command(self, request: dict) -> dict:
        if not isinstance(request, dict) or request.keys() != COMMAND_FIELDS:
            raise StudioError("COMMAND_CONTRACT_INVALID", "Expected versioned metadata command fields", "command")
        project_id = self._id(request["project_id"])
        self.project(project_id)  # fail before any new registry event
        kind = request["kind"]
        payload = request["payload"]
        if kind == "project.note":
            field = "text"
            max_chars = 2000
        elif kind == "project.tag":
            field = "tag"
            max_chars = 64
        else:
            raise StudioError("COMMAND_SCOPE_FORBIDDEN", str(kind), "command")
        if not isinstance(payload, dict) or set(payload) != {field}:
            raise StudioError("COMMAND_PAYLOAD_INVALID", "Exactly one metadata field required", "command")
        value = payload[field]
        if (not isinstance(value, str) or not value.strip() or len(value) > max_chars or
                any(ord(ch) < 32 and ch not in "\n\t" for ch in value)):
            raise StudioError("COMMAND_PAYLOAD_INVALID", "Invalid metadata value", "command")
        # SQL layer owns idempotence + optimistic revision + ordering.
        return self.registry.record_command(
            project_id, request["command_id"], request["base_revision"], kind, payload
        )

    @staticmethod
    def assets(*, query: str = "", limit: int = 100) -> dict:
        if not isinstance(query, str) or len(query) > 120:
            raise StudioError("ASSET_QUERY_INVALID", "Query max length 120", "assets")
        if type(limit) is not int or not 1 <= limit <= 500:
            raise StudioError("ASSET_QUERY_INVALID", "Limit must be 1..500", "assets")
        catalog_path = ASSETS / "props/index.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        if catalog.get("format") != "zodiac-v4-prop-catalog@1":
            raise StudioError("ASSET_CATALOG_INVALID", "Unexpected V4 prop catalog format", "assets")
        rows = []
        for row in catalog["assets"]:
            rel = row.get("path")
            if not isinstance(rel, str):
                continue
            file = ASSETS / rel
            if file.is_symlink() or not file.resolve().is_relative_to(ASSETS.resolve()) or not file.is_file():
                continue  # no stale/missing assets or unsafe reference passed to the agent
            try:
                content = file.read_bytes()
            except OSError:
                continue
            rows.append({
                "id": row["id"], "role": row.get("role", "unknown"),
                "contexts": row.get("contexts", []), "source": "asset-library-v4",
                "source_revision": str(catalog.get("version", "")),
                "sha256": hashlib.sha256(content).hexdigest(), "available": True,
            })
        needle = query.casefold().strip()
        matched = [row for row in rows if not needle or needle in row["id"].casefold()]
        return {
            "format": "zodiac-studio-asset-index@1",
            "source_catalog_sha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
            "ranked": False, "selection": "id_filter_only", "total": len(matched),
            "items": matched[:limit],
        }
