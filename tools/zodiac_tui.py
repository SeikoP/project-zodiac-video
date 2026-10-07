#!/usr/bin/env python3
"""Bootstrap for the Zodiac Textual control plane."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    try:
        from tools.tui.app import main as tui_main
    except ModuleNotFoundError as exc:
        if exc.name == "textual" or (exc.name or "").startswith("textual."):
            print(
                "Thiếu Textual. Cài dependency bằng:\n"
                f'  "{sys.executable}" -m pip install -r "{ROOT / "requirements-local.txt"}"',
                file=sys.stderr,
            )
            return 2
        raise
    return tui_main()


if __name__ == "__main__":
    raise SystemExit(main())
