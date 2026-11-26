"""Launcher for Zodiac Studio V5, the Tauri desktop app (the only GUI)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    """Start the locally built Studio V5 executable against this source tree (Python core, plugin, asset library)."""
    exe_var = os.environ.get("ZODIAC_STUDIO_V5_EXE", "")
    exe = Path(exe_var).expanduser() if exe_var else None
    if not exe or not exe.is_file() or exe.suffix.lower() != ".exe":
        print("ZODIAC_STUDIO_V5_EXE must point to a locally built Windows Studio V5 executable "
              "(build: see apps/zodiac-studio/README.md; development: `pnpm desktop:dev`).", file=sys.stderr)
        return 2
    repo = Path(__file__).resolve().parents[1]
    if not (repo / "tools/studio_project/rpc_stdio.py").is_file():
        print("Verified Studio Project Core source tree is unavailable.", file=sys.stderr)
        return 2
    environment = os.environ.copy()
    environment["ZODIAC_STUDIO_SOURCE_ROOT"] = str(repo)
    environment["ZODIAC_STUDIO_PYTHON"] = sys.executable
    return subprocess.run([str(exe)], cwd=str(repo), env=environment, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
