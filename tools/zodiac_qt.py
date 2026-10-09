"""Launcher for the PySide6 Zodiac Studio frontend."""

from __future__ import annotations

import sys


def main() -> int:
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
