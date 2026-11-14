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
    "health", "projects.list", "projects.open", "projects.import",
    "projects.command", "events.list", "events.recent", "assets.list",
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
    if method == "health":
        _exact(p)
        return {"status": "READY", "protocol": "zodiac-studio-rpc@1", "authority": "P0 Project Core",
                "scope": ["read", "metadata-write"], "approvals": "NOT_GRANTED"}
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
        if len(raw) > _MAX_REQUEST_BYTES:
            raise StudioError("RPC_REQUEST_TOO_LARGE", "Maximum request size 64 KiB", "transport")
        req = json.loads(raw.decode("utf-8"))
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
    while line := input_pipe.readline():
        # Every inbound line gets exactly one reply, including errors.
        response = handle_line(service, line.rstrip(b"\r\n"))
        output_pipe.write((json.dumps(response, ensure_ascii=False, allow_nan=False,
                                      separators=(",", ":")) + "\n").encode("utf-8"))
        output_pipe.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
