"""One library over every package, job and video on disk.

Packages (ready/*.zip), Job@5 workspaces (v2/jobs/*), legacy local jobs
(jobs/*) and rendered videos (out/*.mp4) are scanned into one list, grouped by
the job id found in their package-manifest.json.  Within a group the newest
entry is "latest"; everything else is superseded.

Cleanup never deletes.  It moves superseded entries into
``<workspace>/_archive/<timestamp>/`` and writes ``moved.json`` so ``restore``
can put them back.  Nothing here imports Qt.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

ARCHIVE_DIR = "_archive"
CACHE_DIRS = ("scratch", "source-bundles", "v1export")
CACHE_GLOBS = ("phase01-source-*",)
VIDEO_SUFFIXES = (".mp4", ".mov", ".webm")
_COPY_SUFFIX = re.compile(r"\s*\(\d+\)$")
_VERSION_SUFFIX = re.compile(r"[-_]v?\d+(\.\d+)+$")


@dataclass
class Entry:
    kind: str  # package | job | legacy_job | cache
    path: Path
    name: str
    group: str | None = None
    revision: str | None = None
    size: int = 0
    mtime: float = 0.0
    sha256: str | None = None
    renderer: str | None = None
    state: str = ""
    videos: list[Path] = field(default_factory=list)
    is_latest: bool = False
    verdict: str = "keep"  # keep | archive
    reason: str = ""

    def as_dict(self) -> dict:
        return {
            "kind": self.kind, "name": self.name, "path": str(self.path), "group": self.group,
            "revision": self.revision, "size": self.size, "mtime": self.mtime,
            "renderer": self.renderer, "state": self.state, "videos": [str(v) for v in self.videos],
            "is_latest": self.is_latest, "verdict": self.verdict, "reason": self.reason,
        }


def _tree_size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    total = 0
    for item in path.rglob("*"):
        try:
            if item.is_file() and not item.is_symlink():
                total += item.stat().st_size
        except OSError:
            continue
    return total


def _newest_mtime(path: Path) -> float:
    try:
        latest = path.stat().st_mtime
        if path.is_dir():
            for name in ("package-manifest.json", ".runtime/studio-v2-state.json"):
                candidate = path / name
                if candidate.is_file():
                    latest = max(latest, candidate.stat().st_mtime)
        return latest
    except OSError:
        return 0.0


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _manifest_from_zip(path: Path) -> dict | None:
    try:
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if name.rsplit("/", 1)[-1] == "package-manifest.json" and name.count("/") <= 1:
                    return json.loads(archive.read(name).decode("utf-8"))
    except (OSError, zipfile.BadZipFile, ValueError, KeyError):
        return None
    return None


def _manifest_from_dir(path: Path) -> dict | None:
    try:
        return json.loads((path / "package-manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _identity(manifest: dict | None) -> tuple[str | None, str | None, str | None]:
    if not isinstance(manifest, dict):
        return None, None, None
    job = manifest.get("job") if isinstance(manifest.get("job"), dict) else {}
    renderer = manifest.get("renderer") if isinstance(manifest.get("renderer"), dict) else {}
    return job.get("id") or None, job.get("revision") or None, renderer.get("version") or None


def _job_state(path: Path) -> str:
    try:
        steps = json.loads((path / ".runtime" / "studio-v2-state.json").read_text(encoding="utf-8")).get("steps", {})
    except (OSError, ValueError, AttributeError):
        return "chưa chạy"
    statuses = [str(row.get("status", "")) for row in steps.values() if isinstance(row, dict)]
    if not statuses:
        return "chưa chạy"
    if "FAILED" in statuses:
        return "lỗi"
    if "RUNNING" in statuses:
        return "đang chạy"
    if all(value == "DONE" for value in statuses):
        return "hoàn tất"
    return "dang dở"


def _videos(job: Path) -> list[Path]:
    out = job / "out"
    if not out.is_dir():
        return []
    return sorted((p for p in out.iterdir() if p.is_file() and p.suffix.casefold() in VIDEO_SUFFIXES),
                  key=lambda p: p.stat().st_mtime, reverse=True)


def _package_group(path: Path, manifest: dict | None) -> tuple[str | None, str | None, str | None]:
    group, revision, renderer = _identity(manifest)
    if group:
        return group, revision, renderer
    stem = _COPY_SUFFIX.sub("", path.stem)
    if _VERSION_SUFFIX.search(stem):
        return _VERSION_SUFFIX.sub("", stem), None, None
    if _COPY_SUFFIX.search(path.stem):
        return stem, None, None
    return None, None, None


def scan(project_root: Path, workspace: Path, *, with_hashes: bool = True, with_sizes: bool = True) -> list[Entry]:
    size_of = _tree_size if with_sizes else (lambda path: 0)
    entries: list[Entry] = []
    for ready in dict.fromkeys(p.resolve() for p in (project_root / "ready", workspace / "ready")):
        if not ready.is_dir():
            continue
        for path in sorted(ready.iterdir()):
            if not path.is_file() or path.is_symlink() or path.suffix.casefold() != ".zip":
                continue
            group, revision, renderer = _package_group(path, _manifest_from_zip(path))
            stat = path.stat()
            entries.append(Entry("package", path, path.name, group, revision, stat.st_size, stat.st_mtime,
                                 _sha256(path) if with_hashes else None, renderer))
    for sub, kind in (("v2/jobs", "job"), ("jobs", "legacy_job")):
        base = workspace / sub
        if not base.is_dir():
            continue
        for path in sorted(base.iterdir()):
            if not path.is_dir() or path.name.startswith("."):
                continue
            group, revision, renderer = _identity(_manifest_from_dir(path))
            entries.append(Entry(kind, path, path.name, group or path.name, revision, size_of(path),
                                 _newest_mtime(path), None, renderer, _job_state(path) if kind == "job" else "cũ",
                                 _videos(path)))
    for name in CACHE_DIRS:
        path = workspace / name
        if path.is_dir():
            entries.append(Entry("cache", path, name, None, None, size_of(path), _newest_mtime(path)))
    for pattern in CACHE_GLOBS:
        for path in sorted(workspace.glob(pattern)):
            if path.is_dir():
                entries.append(Entry("cache", path, path.name, None, None, size_of(path), _newest_mtime(path)))
    classify(entries)
    return entries


def classify(entries: list[Entry]) -> None:
    """Mark the latest of each group and decide keep/archive.  Pure over the entries."""
    for entry in entries:
        entry.is_latest, entry.verdict, entry.reason = False, "keep", ""

    # 1. Byte-identical packages: keep one (the newest), archive the rest.
    by_hash: dict[str, list[Entry]] = {}
    for entry in entries:
        if entry.kind == "package" and entry.sha256:
            by_hash.setdefault(entry.sha256, []).append(entry)
    for same in by_hash.values():
        if len(same) > 1:
            same.sort(key=lambda e: (e.mtime, e.name), reverse=True)
            for dup in same[1:]:
                dup.verdict, dup.reason = "archive", f"trùng nội dung với {same[0].name}"

    # 2. Within a (kind, group): newest is latest, older ones are superseded.
    groups: dict[tuple[str, str], list[Entry]] = {}
    for entry in entries:
        if entry.kind in {"package", "job"} and entry.group:
            groups.setdefault((entry.kind, entry.group), []).append(entry)
    for members in groups.values():
        live = [e for e in members if e.verdict == "keep"]
        live.sort(key=lambda e: (e.mtime, e.name), reverse=True)
        if live:
            live[0].is_latest = True
        keep_extra = None
        if live and members[0].kind == "job":
            # An older job that holds the only finished video is still worth keeping.
            with_video = [e for e in live if e.videos]
            if with_video and not live[0].videos:
                keep_extra = with_video[0]
        for old in live[1:]:
            if old is keep_extra:
                old.reason = "giữ vì là bản duy nhất đã có video"
                continue
            old.verdict, old.reason = "archive", f"bản cũ của {live[0].name}"

    # 3. Legacy jobs: superseded when a Job@5 workspace with the same id exists.
    current = {e.group for e in entries if e.kind == "job"}
    for entry in entries:
        if entry.kind == "legacy_job":
            if entry.group in current:
                entry.verdict, entry.reason = "archive", "đã có bản Job@5 cùng tên"
            elif not entry.videos:
                entry.verdict, entry.reason = "archive", "job cũ, chưa có video"
            else:
                entry.reason = "job cũ có video"

    # 4. Caches are always regenerable.
    for entry in entries:
        if entry.kind == "cache":
            entry.verdict, entry.reason = "archive", "bộ nhớ đệm, tạo lại được"


@dataclass
class Move:
    source: Path
    reason: str
    size: int


def plan_cleanup(entries: list[Entry], *, caches: bool = False) -> list[Move]:
    moves = []
    for entry in entries:
        if entry.verdict != "archive":
            continue
        if entry.kind == "cache" and not caches:
            continue
        moves.append(Move(entry.path, entry.reason, entry.size))
    return moves


def apply_cleanup(moves: list[Move], workspace: Path, *, now: datetime | None = None) -> Path | None:
    if not moves:
        return None
    stamp = (now or datetime.now()).strftime("%Y%m%d-%H%M%S")
    target = workspace / ARCHIVE_DIR / stamp
    target.mkdir(parents=True, exist_ok=False)
    record = []
    for index, move in enumerate(moves):
        if not move.source.exists():
            continue
        destination = target / f"{index:03d}-{move.source.name}"
        shutil.move(str(move.source), str(destination))
        record.append({"from": str(move.source), "to": destination.name, "reason": move.reason, "size": move.size})
    (target / "moved.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def restore(archive: Path) -> int:
    record = json.loads((archive / "moved.json").read_text(encoding="utf-8"))
    restored = 0
    for item in record:
        source, back = archive / item["to"], Path(item["from"])
        if source.exists() and not back.exists():
            back.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(back))
            restored += 1
    return restored


def purge_batch(batch: Path) -> None:
    shutil.rmtree(batch, ignore_errors=True)


def purge_archive(workspace: Path, *, keep_latest: int = 0) -> int:
    base = workspace / ARCHIVE_DIR
    if not base.is_dir():
        return 0
    batches = sorted((p for p in base.iterdir() if p.is_dir()), reverse=True)
    removed = 0
    for batch in batches[keep_latest:]:
        shutil.rmtree(batch)
        removed += 1
    return removed


def _slug(text: str) -> str:
    cleaned = re.sub(r"[^\w.-]+", "-", text.strip(), flags=re.UNICODE).strip("-_.")
    return cleaned or "job"


def video_name(entry: Entry, video: Path) -> str:
    """<job>__r<revision>__<render time><ext>, so every video says which job and render it is."""
    stamp = datetime.fromtimestamp(video.stat().st_mtime).strftime("%Y%m%d-%H%M")
    revision = _slug(entry.revision) if entry.revision else "x"
    return f"{_slug(entry.group or entry.name)}__r{revision}__{stamp}{video.suffix.casefold()}"


def export_videos(entries: list[Entry], destination: Path) -> list[tuple[Path, Path]]:
    """Copy each job's newest video into one folder under a descriptive name.

    Idempotent: a file already exported under the same name is left alone.
    Jobs already marked for archive are skipped so the folder only holds current work.
    """
    done: list[tuple[Path, Path]] = []
    for entry in entries:
        if entry.kind not in {"job", "legacy_job"} or not entry.videos or entry.verdict == "archive":
            continue
        source = entry.videos[0]
        target = destination / video_name(entry, source)
        if target.exists() and target.stat().st_size == source.stat().st_size:
            continue
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        done.append((source, target))
    return done


def human_size(value: int) -> str:
    size = float(value)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{value} B"
