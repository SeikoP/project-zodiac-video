"""Reset one Job@5 workspace and re-import its source ZIP.

Usage:
    uv run python -m tools.control_plane.reset_job path/to/job.zip --yes

Only the job workspace selected by the validated ZIP identity is removed.
The archive, other jobs, and shared renderer/dependency caches remain intact.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import tempfile

from tools.control_plane.package_io import extract_package_archive
from tools.control_plane.package_validation import validate_job5_package_root
from tools.studio_v2.controller import StudioV2Controller
from tools.tui.v2_adapter import job5_workspace_path


ROOT = Path(__file__).resolve().parents[2]
JOBS = ROOT / ".zodiac-work" / "v2" / "jobs"


def reset_job(archive: Path, *, yes: bool = False) -> Path:
    archive = archive.expanduser().resolve(strict=True)
    if archive.suffix.lower() != ".zip":
        raise ValueError("Expected a Job@5 ZIP archive.")
    with tempfile.TemporaryDirectory(prefix="zodiac-reset-check-") as tmp:
        staged = extract_package_archive(archive, Path(tmp) / "package")
        package = validate_job5_package_root(staged)
        target = job5_workspace_path(ROOT / ".zodiac-work", package["manifest"]).resolve()
        jobs_root = JOBS.resolve()
        if target.parent != jobs_root or target == jobs_root or target.is_symlink():
            raise ValueError("Unsafe job destination; reset refused.")
        print(f"Job: {package['manifest']['job']['id']}")
        print(f"Workspace to reset: {target}")
        print(f"Source ZIP (preserved): {archive}")
        if not yes:
            raise ValueError("No files removed. Re-run with --yes to confirm a full reset.")
        if target.exists():
            if not target.is_dir():
                raise ValueError("Job workspace is not a directory; reset refused.")
            shutil.rmtree(target)
        controller = StudioV2Controller(target)
        controller.import_package(staged)
        print("RESET_OK: package re-imported; voice, timing, render and output start fresh.")
        return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset and re-import one Zodiac Job@5 from its source ZIP.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--yes", action="store_true", help="Confirm deletion of this job's workspace/cache/output")
    args = parser.parse_args()
    try:
        reset_job(args.archive, yes=args.yes)
    except Exception as exc:
        print(f"RESET_FAILED: {exc}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
