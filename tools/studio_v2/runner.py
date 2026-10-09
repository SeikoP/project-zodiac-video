from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Callable, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
import threading

_COMMAND_OBSERVER: ContextVar[Callable[[str, str], None] | None] = ContextVar(
    "zodiac_studio_structured_command_observer", default=None
)


@contextmanager
def observe_structured_command_output(observer: Callable[[str, str], None]):
    """Connect native renderer stdout/stderr to the GUI without discarding output."""
    token = _COMMAND_OBSERVER.set(observer)
    try:
        yield
    finally:
        _COMMAND_OBSERVER.reset(token)

from tools.control_plane.errors import ControlPlaneError


def run_structured_command(
    command: Sequence[str],
    *,
    cwd: Path | None = None,
    stage: str,
    fallback_code: str,
) -> subprocess.CompletedProcess[str]:
    try:
        observer = _COMMAND_OBSERVER.get()
        if observer is None:
            result = subprocess.run(
                list(command),
                cwd=str(cwd) if cwd is not None else None,
                capture_output=True,
                text=True,
                check=False,
            )
        else:
            process = subprocess.Popen(
                list(command),
                cwd=str(cwd) if cwd is not None else None,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            chunks: dict[str, list[str]] = {"stdout": [], "stderr": []}

            def forward(stream, channel: str) -> None:
                if stream is None:
                    return
                try:
                    for line in stream:
                        chunks[channel].append(line)
                        observer(line.rstrip("\r\n"), channel)
                finally:
                    stream.close()

            workers = [
                threading.Thread(target=forward, args=(process.stdout, "stdout"), daemon=True),
                threading.Thread(target=forward, args=(process.stderr, "stderr"), daemon=True),
            ]
            for worker in workers:
                worker.start()
            process.wait()
            for worker in workers:
                worker.join()
            result = subprocess.CompletedProcess(
                list(command), process.returncode,
                "".join(chunks["stdout"]), "".join(chunks["stderr"])
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
