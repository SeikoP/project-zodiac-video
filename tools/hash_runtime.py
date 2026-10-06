#!/usr/bin/env python3
from pathlib import Path
import sys
from tools.zodiac_local import _renderer_tree_sha256

root = Path(sys.argv[1] if len(sys.argv) > 1 else "runtime/zodiac-remotion/1.15.0/renderer")
print(_renderer_tree_sha256(root))
