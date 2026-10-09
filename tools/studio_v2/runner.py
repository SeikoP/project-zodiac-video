from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Sequence

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
