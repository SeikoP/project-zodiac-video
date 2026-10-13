#!/usr/bin/env python3
"""Build a reproducible, execution-only candidate plugin ZIP (never auto-release)."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

PLUGIN = Path("plugins/zodiac-video-pipeline")
INCLUDED_ROOTS = {"bootstrap", "core", "features", "phases", "orchestration",
                  "references", "art-direction", "compat", "contracts"}
EXCLUDED_SEGMENTS = {"tests", "__pycache__", ".cache", ".pytest_cache",
                     ".authoring", "retired-source", "generated-previews"}
REQUIRED = {"plugin.json", ".codex-plugin/plugin.json", "skills/zodiac-video-pipeline/SKILL.md"}
STATIC_TIME = (1980, 1, 1, 0, 0, 0)


def eligible(rel: Path) -> bool:
    parts = rel.parts
    if any(part in EXCLUDED_SEGMENTS for part in parts):
        return False
    if rel.suffix in {".pyc", ".log"} or rel.name.endswith(".test.mjs"):
        return False
    if rel.as_posix() in REQUIRED:
        return True
    return len(parts) >= 3 and parts[0] == "skills" and parts[1] == "zodiac-video-pipeline" and parts[2] in INCLUDED_ROOTS


def build(root: Path, destination: Path) -> dict:
    src = root / PLUGIN
    for rel in REQUIRED:
        if not (src / rel).is_file():
            raise ValueError(f"PLUGIN_REQUIRED_FILE_MISSING {rel}")
    files = sorted((p for p in src.rglob("*") if p.is_file() and eligible(p.relative_to(src))),
                   key=lambda x: x.relative_to(src).as_posix())
    # Security: no symlinks or path traversal entries, even when source is polluted.
    for file in files:
        if file.is_symlink() or file.resolve().parent != file.parent.resolve():
            raise ValueError(f"PLUGIN_SOURCE_UNSAFE {file}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for file in files:
            rel = file.relative_to(src).as_posix()
            info = ZipInfo(rel, STATIC_TIME)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError("PLUGIN_ZIP_CRC_FAILURE")
        names = set(archive.namelist())
        if not REQUIRED.issubset(names):
            raise ValueError("PLUGIN_ARCHIVE_INCOMPLETE")
        if any(not eligible(Path(name)) for name in names):
            raise ValueError("PLUGIN_ARCHIVE_CONTAINS_RETIRED_SOURCE")
    all_files = [p for p in src.rglob("*") if p.is_file()]
    report = {
        "format": "zodiac-candidate-plugin-package@1",
        "release_approved": False,
        "archive_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "archive_bytes": destination.stat().st_size,
        "archive_file_count": len(files),
        "source_file_count": len(all_files),
        "source_bytes": sum(p.stat().st_size for p in all_files),
        "excluded_file_count": len(all_files) - len(files),
    }
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = build(args.repo_root.resolve(), args.output.resolve())
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
