"""Source-bound Stage/Verify/Publish importer for an approved Phase 1 v2 capsule.

The existing Node importer alone validates Web handoff meaning. This module is a
filesystem/metadata transaction boundary and never creates creative approval.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path

from .models import ProjectHandle, StudioError
from .registry import EpisodeRegistry

BRIDGE = Path(__file__).with_name("handoff_bridge.mjs")
RECEIPT = "studio-import-receipt.json"
_TRUSTED_SOURCE_PATHS = (
    "narration.txt", ".authoring", ".authoring/narrative-plan.json",
    ".authoring/episode-scope.json", ".authoring/phase3-writer-brief.json",
    ".authoring/voice-profile.json", ".authoring/content-review-receipt.json",
    ".authoring/pipeline-state.json", RECEIPT,
)


def _trusted_dir(root: Path, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    if directory.is_symlink() or not directory.resolve().is_relative_to(root.resolve()):
        raise StudioError("STUDIO_DIRECTORY_ESCAPE", str(directory), "import")
    return directory


def _trusted_workspace_sources(workspace: Path) -> None:
    base = workspace.resolve()
    for rel in _TRUSTED_SOURCE_PATHS:
        entry = workspace / rel
        if entry.is_symlink() or not entry.resolve().is_relative_to(base):
            raise StudioError("STUDIO_MATERIALIZED_SYMLINK_ESCAPE", rel, "import")


def _bridge(command: str, archive: Path, workspace: Path | None = None,
            *, node_executable: str = "node") -> dict:
    cmd = [node_executable, str(BRIDGE), command, str(archive)]
    if workspace is not None:
        cmd.append(str(workspace))
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, encoding="utf-8", errors="replace",
                                check=False, timeout=120)
    except FileNotFoundError as exc:
        raise StudioError("NODE_RUNTIME_MISSING", str(exc), "import") from exc
    except subprocess.TimeoutExpired as exc:
        raise StudioError("HANDOFF_BRIDGE_TIMEOUT", command, "import") from exc
    if result.returncode:
        raise StudioError("HANDOFF_SOURCE_INVALID",
                          (result.stderr or result.stdout).strip()[:1500], "import")
    try:
        output = json.loads(result.stdout)
        if not isinstance(output, dict) or output.get("ok") is not True:
            raise ValueError("Missing success envelope")
        return output
    except (json.JSONDecodeError, ValueError) as exc:
        raise StudioError("HANDOFF_BRIDGE_PROTOCOL_INVALID", str(exc), "import") from exc


@contextmanager
def _exclusive_source_lock(root: Path, source_sha: str):
    # OS-managed lock avoids permanent stale .lock directories after a process crash.
    folder = _trusted_dir(root, root / ".locks")
    lock_path = folder / (source_sha + ".lock")
    with open(lock_path, "a+b") as handle:
        handle.seek(0)
        if handle.seek(0, os.SEEK_END) == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _assert_receipt(workspace: Path, inspected: dict) -> None:
    try:
        receipt = json.loads((workspace / RECEIPT).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise StudioError("STUDIO_IMPORT_RECEIPT_MISSING", str(exc), "import") from exc
    for key in ("source_sha256", "manifest_sha256"):
        if receipt.get(key) != inspected[key]:
            raise StudioError("STUDIO_IMPORT_RECEIPT_DRIFT", key, "import")
    if receipt.get("format") != "zodiac-studio-import@1":
        raise StudioError("STUDIO_IMPORT_RECEIPT_INVALID", "Unknown import receipt format", "import")


def _import_verified_snapshot(projects_root: Path, capsule_path: Path, registry: EpisodeRegistry,
                              *, node_executable: str = "node",
                   fault_after_publish: bool = False) -> ProjectHandle:
    """Import one approved v2 capsule with atomic publish and idempotent reopen.

    fault_after_publish is an explicit injection point for isolated crash tests;
    no human approval is inferred from a returned ProjectHandle.
    """
    root = Path(projects_root).resolve()
    if registry.root != root:
        raise StudioError("REGISTRY_ROOT_MISMATCH", "Registry must belong to projects root", "import")
    try:
        archive = Path(capsule_path).resolve(strict=True)
    except OSError as exc:
        raise StudioError("HANDOFF_SOURCE_INVALID", str(exc), "import") from exc
    if not archive.is_file():
        raise StudioError("HANDOFF_SOURCE_INVALID", "Not a capsule file", "import")
    inspected = _bridge("inspect", archive, node_executable=node_executable)
    source_sha = inspected["source_sha256"]
    project_id = "studio-" + source_sha[:24]
    episode_id = "ep-" + source_sha[:24]
    episodes = _trusted_dir(root, root / "episodes")
    final = episodes / project_id
    handle = ProjectHandle(project_id, final, source_sha, episode_id)
    # Validate upstream before any project-visible index/file mutation.
    with _exclusive_source_lock(root, source_sha):
        existing = registry.find_by_source(source_sha)
        if existing is not None and existing != handle:
            raise StudioError("STUDIO_PROJECT_IDENTITY_CONFLICT", source_sha, "import")
        if final.is_symlink():
            raise StudioError("STUDIO_PROJECT_SYMLINK_FORBIDDEN", str(final), "import")
        if final.exists():
            if not final.is_dir():
                raise StudioError("STUDIO_PROJECT_COLLISION", str(final), "import")
            _trusted_workspace_sources(final)
            _assert_receipt(final, inspected)
            _bridge("verify", archive, final, node_executable=node_executable)
            return registry.register(handle, inspected["manifest_sha256"])
        if existing is not None:
            raise StudioError("STUDIO_PROJECT_MISSING", "Index points to absent source", "import")
        stage_dir = _trusted_dir(root, root / ".staging")
        stage = Path(tempfile.mkdtemp(prefix=project_id + "-", dir=stage_dir))
        published = False
        try:
            _bridge("materialize", archive, stage, node_executable=node_executable)
            (stage / RECEIPT).write_text(
                json.dumps({
                    "format": "zodiac-studio-import@1",
                    "source_sha256": source_sha,
                    "manifest_sha256": inspected["manifest_sha256"],
                    "capsule_sha256": inspected["capsule_sha256"],
                    "run_id": inspected["manifest"]["run_id"],
                    "not_an_approval": True,
                }, sort_keys=True, indent=2) + "\n", encoding="utf-8"
            )
            # Final verify avoids accepting incomplete/corrupted staging output.
            _trusted_workspace_sources(stage)
            _assert_receipt(stage, inspected)
            _bridge("verify", archive, stage, node_executable=node_executable)
            stage.rename(final)  # same volume, atomic directory publish
            published = True
            if fault_after_publish:
                raise RuntimeError("SYNTHETIC_TEST_CRASH_AFTER_PUBLISH")
            return registry.register(handle, inspected["manifest_sha256"])
        finally:
            # Never delete a published source; orphan adoption uses exact hashes.
            if not published and stage.exists():
                shutil.rmtree(stage)


def import_handoff(projects_root: Path, capsule_path: Path, registry: EpisodeRegistry,
                   *, node_executable: str = "node",
                   fault_after_publish: bool = False) -> ProjectHandle:
    """Import from a private immutable snapshot, not a mutable caller-owned ZIP.

    The original caller path may be swapped between inspect and materialize.
    Keeping all bridge operations on one process-owned snapshot prevents that
    TOCTOU race without mutating or consuming the supplied capsule.
    """
    root = Path(projects_root).resolve()
    if registry.root != root:
        raise StudioError("REGISTRY_ROOT_MISMATCH", "Registry must belong to projects root", "import")
    try:
        archive = Path(capsule_path).resolve(strict=True)
    except OSError as exc:
        raise StudioError("HANDOFF_SOURCE_INVALID", str(exc), "import") from exc
    if not archive.is_file():
        raise StudioError("HANDOFF_SOURCE_INVALID", "Not a capsule file", "import")
    stage_dir = _trusted_dir(root, root / ".staging")
    with tempfile.TemporaryDirectory(prefix="source-capsule-", dir=stage_dir) as temp:
        snapshot = Path(temp) / "source.zip"
        try:
            shutil.copyfile(archive, snapshot)
        except OSError as exc:
            raise StudioError("HANDOFF_SOURCE_INVALID", str(exc), "import") from exc
        return _import_verified_snapshot(
            root, snapshot, registry,
            node_executable=node_executable, fault_after_publish=fault_after_publish,
        )
