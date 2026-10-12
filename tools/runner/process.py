"""Managed subprocess ownership for Zodiac local execution."""

from __future__ import annotations

import contextlib
import contextvars
import os
from pathlib import Path
import subprocess

from tools.runner.errors import PipelineError

_PROCESS_OBSERVER = contextvars.ContextVar("zodiac_process_observer", default=None)
_PROCESS_LOG_OBSERVER = contextvars.ContextVar("zodiac_process_log_observer", default=None)


@contextlib.contextmanager
def observe_subprocesses(observer):
    """Expose the currently running child process to the Studio worker."""
    token = _PROCESS_OBSERVER.set(observer)
    try:
        yield
    finally:
        _PROCESS_OBSERVER.reset(token)


@contextlib.contextmanager
def observe_subprocess_output(observer):
    """Route managed child output into a caller-owned log sink."""
    token = _PROCESS_LOG_OBSERVER.set(observer)
    try:
        yield
    finally:
        _PROCESS_LOG_OBSERVER.reset(token)


def emit_process_log(text: str, *, channel: str = "stdout") -> bool:
    observer = _PROCESS_LOG_OBSERVER.get()
    if observer is None:
        return False
    observer(str(text), channel=channel)
    return True


def _process_group_kwargs() -> dict:
    if os.name == "nt":
        flag = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        return {"creationflags": flag} if flag else {}
    return {"start_new_session": True}


def run_managed_subprocess(
    arguments: list[str],
    *,
    cwd: Path | str | None = None,
    check: bool = False,
    capture_output: bool = False,
    text: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    """Run one cancellable child in its own process group."""
    if any(not isinstance(arg, str) or "\x00" in arg for arg in arguments):
        raise PipelineError("subprocess arguments must be NUL-free strings.")

    popen_kwargs = _process_group_kwargs()
    process_observer = _PROCESS_OBSERVER.get()
    log_observer = _PROCESS_LOG_OBSERVER.get()
    should_capture = capture_output or log_observer is not None
    if should_capture:
        popen_kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    process = subprocess.Popen(
        arguments,
        cwd=cwd,
        shell=False,
        text=text,
        env=env,
        **popen_kwargs,
    )
    if process_observer is not None:
        process_observer(process)
    try:
        if log_observer is None:
            stdout, stderr = process.communicate()
        else:
            import threading

            stdout_chunks = []
            stderr_chunks = []
            sentinel = "" if text else b""

            def pump(stream, chunks, channel: str) -> None:
                if stream is None:
                    return
                try:
                    for raw in iter(stream.readline, sentinel):
                        chunks.append(raw)
                        rendered = raw if isinstance(raw, str) else raw.decode("utf-8", errors="replace")
                        line = rendered.rstrip("\r\n")
                        if line:
                            log_observer(line, channel=channel)
                finally:
                    stream.close()

            threads = [
                threading.Thread(target=pump, args=(process.stdout, stdout_chunks, "stdout"), daemon=True),
                threading.Thread(target=pump, args=(process.stderr, stderr_chunks, "stderr"), daemon=True),
            ]
            for thread in threads:
                thread.start()
            process.wait()
            for thread in threads:
                thread.join()
            stdout = "".join(stdout_chunks) if text else b"".join(stdout_chunks)
            stderr = "".join(stderr_chunks) if text else b"".join(stderr_chunks)
    finally:
        if process_observer is not None:
            process_observer(None)

    result = subprocess.CompletedProcess(arguments, process.returncode, stdout, stderr)
    if check and process.returncode:
        raise subprocess.CalledProcessError(process.returncode, arguments, output=stdout, stderr=stderr)
    return result
