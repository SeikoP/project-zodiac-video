"""Transactional repair for Renderer 2.0.1's damaged npm dependency tree.

Invoked only from the user's approved "Cài dependency" Studio action.
Never touches .zodiac-work, Job@5, voice, timing, props, or output video.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from tools.studio.preflight import ROOT


def repair_renderer_201(
    renderer: Path,
    *,
    run=subprocess.run,
    which=shutil.which,
) -> str:
    renderer = Path(renderer).resolve()
    package = renderer / "package.json"
    launcher = renderer / "scripts" / "local-remotion-cli.mjs"
    if not package.is_file() or not launcher.is_file():
        raise RuntimeError("RENDERER_SOURCE_MISSING: Update GitHub before installing dependencies.")
    meta = json.loads(package.read_text(encoding="utf-8"))
    if not meta.get("dependencies", {}).get("@remotion/cli"):
        raise RuntimeError("RENDERER_PIN_MISSING: package.json is missing @remotion/cli.")
    node = which("node")
    npm = which("npm.cmd") or which("npm")
    if not node or not npm:
        raise RuntimeError("RENDERER_INSTALL_TOOLS_MISSING: Node.js + npm must be installed.")

    existing = renderer / "node_modules"
    if existing.is_symlink():
        raise RuntimeError("RENDERER_DEPENDENCY_SYMLINK_UNSUPPORTED: Refusing to modify node_modules symlink.")
    backup = renderer / (".zodiac-node_modules-backup-" + uuid.uuid4().hex)
    renamed = False
    if existing.exists():
        existing.rename(backup)  # atomic on same filesystem, no destructive delete
        renamed = True

    def invoke(command: list[str]) -> subprocess.CompletedProcess:
        return run(command,cwd=str(renderer),capture_output=True,text=True,
                   encoding="utf-8",errors="replace",check=False,timeout=900)

    try:
        installed = invoke([npm,"install","--prefix",str(renderer),"--no-audit","--no-fund"])
        if installed.returncode:
            raise RuntimeError("npm install failed: " + (installed.stderr or installed.stdout)[-2000:])
        # The CLI must load all transitive require() dependencies, not merely
        # have @remotion/cli/package.json present.
        verified = invoke([node,str(launcher),"--check"])
        if verified.returncode or "RENDERER_CLI_READY" not in verified.stdout:
            raise RuntimeError("RENDERER_DEPENDENCY_STILL_BROKEN: "+
                               (verified.stderr or verified.stdout)[-2000:])
    except (Exception, KeyboardInterrupt):
        if existing.exists():
            shutil.rmtree(existing)
        if renamed:
            backup.rename(existing)
        raise

    if renamed:
        try:
            shutil.rmtree(backup)
        except OSError:
            # Successful installation remains valid; inform user of backup.
            return "RENDERER_DEPENDENCY_REPAIRED (old backup retained: " + str(backup) + ")"
    return "RENDERER_DEPENDENCY_REPAIRED "+str(renderer)


def main() -> int:
    parser=argparse.ArgumentParser(description="Repair local Renderer 2.0.1 node_modules")
    parser.add_argument("--version",choices=["2.0.1"],required=True)
    args=parser.parse_args()
    path=ROOT/"runtime"/"zodiac-renderer"/args.version/"renderer"
    try:
        print(repair_renderer_201(path),flush=True)
        return 0
    except Exception as exc:
        print("RENDERER_DEPENDENCY_REPAIR_FAILED: "+str(exc),file=sys.stderr,flush=True)
        return 2


if __name__=="__main__":
    raise SystemExit(main())
