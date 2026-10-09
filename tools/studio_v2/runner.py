from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Callable, Sequence

from tools.control_plane.errors import ControlPlaneError


def run_structured_command(
    command: Sequence[str],
    *,
    cwd: Path | None = None,
    stage: str,
    fallback_code: str,
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            list(command),
            cwd=str(cwd) if cwd is not None else None,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ControlPlaneError(
            code="RENDERER_EXECUTABLE_MISSING",
            stage=stage,
            message=f"required executable is missing: {command[0]}",
            detail={"command": list(command)},
        ) from exc

    if result.returncode == 0:
        return result

    payload = None
    # Structured tools may write diagnostics to stderr or stdout. Never lose
    # JSON details when subprocess returns a non-zero status.
    for line in reversed((result.stderr + "\n" + result.stdout).splitlines()):
        try:
            candidate = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(candidate, dict) and candidate.get("ok") is False and candidate.get("code"):
            payload = candidate
            break

    if payload is not None:
        raise ControlPlaneError(
            code=str(payload["code"]),
            stage=str(payload.get("stage") or stage),
            message=str(payload.get("message") or "command failed"),
            scene_id=payload.get("scene_id"),
            event_id=payload.get("event_id"),
            target=payload.get("target"),
            detail=dict(payload.get("detail") or {}),
        )

    raise ControlPlaneError(
        code=fallback_code,
        stage=stage,
        message=f"command failed with exit code {result.returncode}",
        detail={
            "command": list(command),
            "returncode": result.returncode,
            "stderr": result.stderr[-4000:],
            "stdout": result.stdout[-4000:],
        },
    )


def run_payload_audit_with_cache_recovery(
    command: Sequence[str], *, cached_plan: bool,
    rebuild_plan: Callable[[], object],
) -> bool:
    """Audit once; rebuild only a mismatched *cached* plan, then audit once more.

    Returns whether a cache repair was performed. Does not mutate Job@5 or
    rerun voice/timing; a freshly compiled plan must pass without intervention.
    """
    def verify() -> None:
        run_structured_command(command,stage="PLAN",fallback_code="RENDER_PLAN_PAYLOAD_MISMATCH")

    try:
        verify()
    except ControlPlaneError as exc:
        if not cached_plan or exc.code != "RENDER_PLAN_PAYLOAD_MISMATCH":
            raise
        rebuild_plan()
        verify()  # fail closed; never auto-approve a second mismatch
        return True
    return False
