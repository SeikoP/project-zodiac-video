"""Launcher for the PySide6 Zodiac Studio frontend."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _preview_main() -> int:
    """Opt-in one-window Tauri pilot. Default production Qt launcher is unchanged."""
    exe_var = os.environ.get("ZODIAC_STUDIO_V5_EXE", "")
    exe = Path(exe_var).expanduser() if exe_var else None
    if not exe or not exe.is_file() or exe.suffix.lower() != ".exe":
        print("ZODIAC_STUDIO_V5_EXE must point to a locally built Windows preview executable.", file=sys.stderr)
        return 2
    repo = Path(__file__).resolve().parents[1]
    if not (repo / "tools/studio_project/rpc_stdio.py").is_file():
        print("Verified Studio Project Core source tree is unavailable.", file=sys.stderr)
        return 2
    environment = os.environ.copy()
    environment["ZODIAC_STUDIO_SOURCE_ROOT"] = str(repo)
    environment["ZODIAC_STUDIO_PYTHON"] = sys.executable
    return subprocess.run([str(exe)], cwd=str(repo), env=environment, check=False).returncode


def main() -> int:
    if "--v5-preview" in sys.argv[1:]:
        return _preview_main()
    if sys.version_info < (3, 10):
        print("zodiac yêu cầu Python 3.10 trở lên.", file=sys.stderr)
        return 2
    try:
        import PySide6  # noqa: F401
    except ImportError:
        print("Thiếu PySide6. Cài dependencies của project bằng: uv sync", file=sys.stderr)
        return 2

    from tools.studio_qt.app import main as qt_main

    return qt_main()


if __name__ == "__main__":
    raise SystemExit(main())
