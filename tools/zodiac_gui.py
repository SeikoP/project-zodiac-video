#!/usr/bin/env python3
"""Bootstrap for Zodiac Studio. The GUI itself lives in tools/studio/."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main(argv: list[str] | None = None) -> int:
    from tools.studio.app import main as studio_main

    return studio_main(argv)


if __name__ == "__main__":
    raise SystemExit(main())