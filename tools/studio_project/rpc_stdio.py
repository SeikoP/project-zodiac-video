"""Private stdio-only P1 transport for the Zodiac Studio desktop host.

One newline-delimited request in, one JSON response out. No HTTP listener,
arbitrary Python evaluation, raw filesystem mutation or shell execution.
The host controls the project root and owns this process lifetime.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .models import StudioError
from .service import StudioProjectService

_MAX_REQUEST_BYTES = 65536
_ALLOWED = frozenset({
    "ideas.list", "ideas.update",
    "health", "projects.list", "projects.open", "projects.import",
    "projects.command", "events.list", "events.recent", "assets.list",
    "agent.health", "agent.start", "agent.task", "agent.tasks",
    "agent.cancel", "agent.apply", "agent.visual.start", "agent.author.start",
    "voice.open", "voice.start", "voice.cancel", "voice.select", "voice.assemble",
    "voice.audio", "voice.playback", "voice.confirm",
    "visual.open", "visual.command", "visual.cancel", "visual.preview",
    "episode.build", "scene.compile", "video.export", "video.get", "assets.describe", "assets.gallery", "assets.find_candidates", "validation.get",
})


def _object(value: object) -> dict:
    if not isinstance(value, dict):
        raise StudioError("RPC_PARAMS_INVALID", "An object is required", "transport")
    return value


def _exact(params: dict, *keys: str) -> None:
    if set(params) != set(keys):
        raise StudioError("RPC_PARAMS_INVALID", "Unexpected/missing parameter", "transport")


def dispatch(service: StudioProjectService, method: str, params: object) -> Any:
    if method not in _ALLOWED:
        raise StudioError("RPC_METHOD_FORBIDDEN", "Operation is not permitted", "transport")
    p = _object(params)
    if method == 'video.export':
        _exact(p, 'project_id', 'base_revision')
        return service.visual.export(**p)
    if method == 'video.get':
        _exact(p, 'project_id')
        return service.visual.video(p['project_id'])
    if method == "ideas.list":
        _exact(p)
        return service.ideas.snapshot()
    if method == "ideas.update":
        _exact(p, "concept_id", "sign", "status")
        return service.ideas.update(**p)
    if method == "health":
        _exact(p)
        return {"status": "READY", "protocol": "zodiac-studio-rpc@1", "authority": "P0 Project Core",
                "scope": ["read", "metadata-write"], "approvals": "NOT_GRANTED"}
    if method == "assets.gallery":
        _exact(p, "project_id")
        return service.visual.gallery(p["project_id"])
    if method in ("visual.open", "visual.cancel", "assets.describe", "validation.get"):
        _exact(p, "project_id")
        operation = {"visual.open": service.visual.snapshot, "visual.cancel": service.visual.cancel,
                     "assets.describe": service.visual.describe, "validation.get": service.visual.validation}[method]
        return operation(p["project_id"])
    if method == "visual.command":
        _exact(p, "project_id", "command_id", "base_revision", "kind", "payload")
        return service.visual.command(**p)
    if method == "episode.build":
        _exact(p, "project_id", "base_revision")
        return service.visual.start(**p)
    if method == "scene.compile":
        _exact(p, "project_id", "base_revision", "scene_id")
        return service.visual.start(**p)
    if method == "visual.preview":
        _exact(p, "project_id", "scene_id", "build_id")
        return service.visual.preview(**p)
    if method == "assets.find_candidates":
        _exact(p, "project_id", "scene_id", "requirement")
        return service.visual.candidates(**p)
    if method == "voice.open":
        _exact(p, "project_id")
        return service.voice.snapshot(p["project_id"])
    if method == "voice.start":
        _exact(p, "project_id", "action", "unit_ids", "voice", "intent", "pronunciation", "base_revision")
        return service.voice.start(**p)
    if method == "voice.cancel":
        _exact(p, "project_id")
        return service.voice.cancel(p["project_id"])
    if method == "voice.select":
        _exact(p, "project_id", "unit_id", "take_id", "base_revision", "gap_after_ms")
        return service.voice.select(**p)
    if method == "voice.assemble":
        _exact(p, "project_id", "base_revision")
        return service.voice.assemble(**p)
    if method == "voice.audio":
        _exact(p, "project_id", "unit_id", "take_id", "offset")
        return service.voice.audio(**p)
    if method == "voice.playback":
        _exact(p, "project_id", "unit_id", "take_id")
        return service.voice.playback(**p)
    if method == "voice.confirm":
        _exact(p, "project_id", "unit_id", "take_id", "playback_id", "confirm", "base_revision")
        return service.voice.confirm(**p)
    if method == "agent.health":
        _exact(p)
        return service.agent.health()
    if method == "agent.start":
        _exact(p, "project_id")
        return service.agent.start(p["project_id"])
    if method == "agent.visual.start":
        _exact(p, "project_id", "scene_id", "instruction")
        return service.agent.start_visual(**p)
    if method == "agent.author.start":
        _exact(p, "project_id", "instruction")
        return service.agent.start_authoring(**p)
    if method == "agent.task":
        _exact(p, "task_id")
        return service.agent.task(p["task_id"])
    if method == "agent.tasks":
        _exact(p, "project_id")
        return service.agent.tasks(p["project_id"])
    if method == "agent.cancel":
        _exact(p, "task_id")
        return service.agent.cancel(p["task_id"])
    if method == "agent.apply":
        _exact(p, "task_id", "confirm", "base_revision", "command_id")
        return service.agent.apply_suggestion(
            p["task_id"], confirm=p["confirm"], base_revision=p["base_revision"],
            command_id=p["command_id"],
        )
    if method == "projects.list":
        if p:
            _exact(p, "limit", "after_project_id")
            return service.list_projects(limit=p["limit"], after_project_id=p["after_project_id"])
        return service.list_projects()
    if method == "projects.open":
        _exact(p, "project_id")
        return service.project(p["project_id"])
    if method == "projects.import":
        _exact(p, "path")
        if not isinstance(p["path"], str) or not p["path"].lower().endswith(".zip"):
            raise StudioError("HANDOFF_SOURCE_INVALID", "Only a Phase 1 v2 ZIP can be imported", "transport")
        return service.import_capsule(Path(p["path"]))
    if method == "projects.command":
        _exact(p, "request")
        return service.command(p["request"])
    if method == "events.list":
        _exact(p, "project_id", "after_seq")
        return service.events(p["project_id"], after_seq=p["after_seq"])
    if method == "events.recent":
        _exact(p, "project_id")
        return service.recent_events(p["project_id"])
    if method == "assets.list":
        _exact(p, "query", "limit")
        return service.assets(query=p["query"], limit=p["limit"])
    raise AssertionError("Exhaustive method dispatch")


def handle_line(service: StudioProjectService, raw: bytes) -> dict:
    message_id = None
    try:
        if len(raw) > 2*1024*1024:
            raise StudioError("RPC_REQUEST_TOO_LARGE", "Maximum request size 64 KiB", "transport")
        req = json.loads(raw.decode("utf-8"))
        if len(raw) > _MAX_REQUEST_BYTES and (not isinstance(req, dict) or req.get("method") != "visual.command"):
            raise StudioError("RPC_REQUEST_TOO_LARGE", "Maximum request size 64 KiB", "transport")
        if not isinstance(req, dict) or set(req) != {"id", "method", "params"}:
            raise StudioError("RPC_REQUEST_INVALID", "Expected id, method, params", "transport")
        message_id = req["id"]
        if not isinstance(message_id, str) or not (1 <= len(message_id) <= 96):
            raise StudioError("RPC_REQUEST_INVALID", "Invalid correlation id", "transport")
        result = dispatch(service, req["method"], req["params"])
        return {"id": message_id, "ok": True, "result": result}
    except StudioError as exc:
        return {"id": message_id, "ok": False,
                "error": {"code": exc.code, "stage": exc.stage, "message": exc.message}}
    except (ValueError, UnicodeError, TypeError, KeyError) as exc:
        return {"id": message_id, "ok": False,
                "error": {"code": "RPC_REQUEST_INVALID", "stage": "transport",
                          "message": str(exc)[:240]}}
    except OSError as exc:
        return {"id": message_id, "ok": False,
                "error": {"code": "BACKEND_IO_ERROR", "stage": "backend",
                          "message": str(exc)[:240]}}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Zodiac Studio restricted stdio host")
    parser.add_argument("--projects-root", type=Path, required=True)
    args = parser.parse_args(argv)
    service = StudioProjectService(args.projects_root)
    input_pipe = sys.stdin.buffer
    output_pipe = sys.stdout.buffer
    try:
        while line := input_pipe.readline():
            # Every inbound line gets exactly one reply, including errors.
            response = handle_line(service, line.rstrip(b"\r\n"))
            output_pipe.write((json.dumps(response, ensure_ascii=False, allow_nan=False,
                                          separators=(",", ":")) + "\n").encode("utf-8"))
            output_pipe.flush()
    finally:
        service.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
