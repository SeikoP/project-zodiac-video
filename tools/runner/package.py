"""Package extraction safety owned by the local runner."""

from __future__ import annotations

import re
import stat
import zipfile
from pathlib import Path, PurePosixPath

from tools.runner.errors import PipelineError

MAX_ZIP_ENTRIES = 5000
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_COMPRESSION_RATIO = 250


def _safe_relative_path(raw_name: str) -> PurePosixPath:
    normalized = raw_name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        "\x00" in normalized
        or path.is_absolute()
        or re.match(r"^[A-Za-z]:", normalized)
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise PipelineError(f"unsafe ZIP path: {raw_name!r}")
    return path


def safe_extract_zip(archive_path: Path, destination: Path) -> None:
    """Extract a ZIP after rejecting traversal, links, duplicates, and ZIP bombs."""
    archive_path = Path(archive_path)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    seen: set[str] = set()
    total_size = 0

    try:
        with zipfile.ZipFile(archive_path) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ZIP_ENTRIES:
                raise PipelineError(f"ZIP has more than {MAX_ZIP_ENTRIES} entries.")

            for info in entries:
                rel = _safe_relative_path(info.filename.rstrip("/"))
                key = rel.as_posix().casefold()
                if key in seen:
                    raise PipelineError(f"duplicate ZIP path: {info.filename!r}")
                seen.add(key)

                mode = info.external_attr >> 16
                kind = stat.S_IFMT(mode)
                if kind == stat.S_IFLNK:
                    raise PipelineError(f"ZIP symbolic links are not allowed: {info.filename!r}")
                if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                    raise PipelineError(f"ZIP special files are not allowed: {info.filename!r}")
                if info.flag_bits & 0x1:
                    raise PipelineError("encrypted ZIP members are not supported.")

                target = destination.joinpath(*rel.parts)
                resolved = target.resolve()
                if not resolved.is_relative_to(root):
                    raise PipelineError(f"unsafe ZIP path: {info.filename!r}")
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue

                if info.file_size > MAX_FILE_BYTES:
                    raise PipelineError(f"ZIP member is too large: {info.filename!r}")
                total_size += info.file_size
                if total_size > MAX_TOTAL_BYTES:
                    raise PipelineError("ZIP expands beyond the 512 MiB safety limit.")
                if info.file_size > 1_000_000 and (
                    info.compress_size == 0
                    or info.file_size / info.compress_size > MAX_COMPRESSION_RATIO
                ):
                    raise PipelineError(f"suspicious compression ratio: {info.filename!r}")

                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info, "r") as source, target.open("xb") as output:
                    copied = 0
                    while chunk := source.read(1024 * 1024):
                        copied += len(chunk)
                        if copied > info.file_size or copied > MAX_FILE_BYTES:
                            raise PipelineError(f"ZIP member exceeded declared size: {info.filename!r}")
                        output.write(chunk)
                    if copied != info.file_size:
                        raise PipelineError(f"ZIP member size mismatch: {info.filename!r}")
    except PipelineError:
        raise
    except (OSError, zipfile.BadZipFile, RuntimeError, EOFError, NotImplementedError) as exc:
        raise PipelineError(f"cannot safely read ZIP: {exc}") from exc
