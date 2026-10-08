from __future__ import annotations

import os
import re
import shutil
import stat
import tempfile
from pathlib import Path, PurePosixPath
import zipfile
import zlib

from .errors import ControlPlaneError


MAX_ARCHIVE_ENTRIES = 5000
MAX_ARCHIVE_FILE_BYTES = 128 * 1024 * 1024
MAX_ARCHIVE_TOTAL_BYTES = 512 * 1024 * 1024
MAX_ARCHIVE_RATIO_CHECK_BYTES = 1_000_000
MAX_ARCHIVE_COMPRESSION_RATIO = 250
_ARCHIVE_COPY_CHUNK_BYTES = 1024 * 1024
_DRIVE_PATH = re.compile(r"^[A-Za-z]:")


def _unsafe(message: str, *, detail: dict | None = None) -> ControlPlaneError:
    return ControlPlaneError(
        code="PACKAGE_ARCHIVE_UNSAFE",
        stage="PACKAGE",
        message=message,
        detail=detail or {},
    )


def _normalized_name(raw: str) -> str:
    name = raw.replace("\\", "/")
    if (
        not name
        or "\x00" in name
        or name.startswith("/")
        or _DRIVE_PATH.match(name)
        or any(part in ("", ".", "..") for part in name.split("/"))
    ):
        raise _unsafe("archive contains an unsafe relative path", detail={"path": raw})
    return PurePosixPath(name).as_posix()


def _unix_kind(info: zipfile.ZipInfo) -> int:
    if info.create_system != 3:
        return 0
    return stat.S_IFMT((info.external_attr >> 16) & 0xFFFF)


def extract_package_archive(archive: Path, destination: Path) -> Path:
    """Safely extract one Job@5 package archive within fixed resource bounds."""
    archive = Path(archive).expanduser().resolve()
    destination = Path(destination).expanduser()
    if not destination.is_absolute():
        destination = Path.cwd() / destination
    destination = destination.parent.resolve() / destination.name
    if not archive.is_file():
        raise _unsafe("package archive does not exist", detail={"path": str(archive)})
    if destination.is_symlink():
        raise _unsafe("extraction destination must not be a symlink", detail={"path": str(destination)})

    try:
        handle = zipfile.ZipFile(archive)
    except (OSError, zipfile.BadZipFile) as exc:
        raise _unsafe("package archive is not a readable ZIP", detail={"path": str(archive)}) from exc

    staging: Path | None = None
    try:
        with handle:
            infos = handle.infolist()
            if len(infos) > MAX_ARCHIVE_ENTRIES:
                raise _unsafe(
                    f"package archive has more than {MAX_ARCHIVE_ENTRIES} entries",
                    detail={"entries": len(infos)},
                )

            files: list[tuple[zipfile.ZipInfo, str]] = []
            seen: dict[str, bool] = {}
            declared_total = 0
            for info in infos:
                kind = _unix_kind(info)
                if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                    raise _unsafe("package archive contains a special file", detail={"path": info.filename})
                is_dir = info.is_dir() or kind == stat.S_IFDIR
                if info.is_dir() and kind == stat.S_IFREG:
                    raise _unsafe("package archive has a directory/file type mismatch", detail={"path": info.filename})
                raw_name = info.filename[:-1] if info.is_dir() and info.filename.endswith("/") else info.filename
                normalized = _normalized_name(raw_name)
                key = normalized.casefold()
                if key in seen:
                    raise _unsafe("package archive contains duplicate normalized paths", detail={"path": normalized})
                seen[key] = is_dir

                if info.flag_bits & 0x1:
                    raise _unsafe("encrypted ZIP members are not supported", detail={"path": normalized})
                if is_dir:
                    if info.file_size != 0:
                        raise _unsafe("package archive directory entries must be empty", detail={"path": normalized})
                    continue

                if info.file_size < 0 or info.compress_size < 0:
                    raise _unsafe("package archive has invalid member sizes", detail={"path": normalized})
                if info.file_size > MAX_ARCHIVE_FILE_BYTES:
                    raise _unsafe(
                        f"package archive member exceeds {MAX_ARCHIVE_FILE_BYTES} bytes",
                        detail={"path": normalized, "bytes": info.file_size},
                    )
                declared_total += info.file_size
                if declared_total > MAX_ARCHIVE_TOTAL_BYTES:
                    raise _unsafe(
                        f"package archive expands beyond {MAX_ARCHIVE_TOTAL_BYTES} bytes",
                        detail={"bytes": declared_total},
                    )
                if info.file_size > MAX_ARCHIVE_RATIO_CHECK_BYTES:
                    ratio = (
                        float("inf")
                        if info.compress_size == 0
                        else info.file_size / info.compress_size
                    )
                    if ratio > MAX_ARCHIVE_COMPRESSION_RATIO:
                        raise _unsafe(
                            "package archive member has a suspicious compression ratio",
                            detail={"path": normalized, "ratio": ratio},
                        )
                files.append((info, normalized))

            if not files:
                raise _unsafe("package archive contains no files")

            file_keys = {name.casefold() for _info, name in files}
            for _info, name in files:
                parts = PurePosixPath(name).parts
                for index in range(1, len(parts)):
                    parent = "/".join(parts[:index]).casefold()
                    if parent in file_keys:
                        raise _unsafe(
                            "package archive file conflicts with a parent directory",
                            detail={"path": name},
                        )

            names = [name for _info, name in files]
            if "package-manifest.json" in names:
                prefix = ""
            else:
                manifests = [name for name in names if name.endswith("/package-manifest.json")]
                if len(manifests) != 1:
                    raise _unsafe(
                        "package archive must contain one package-manifest.json at root or one wrapper directory"
                    )
                parts = PurePosixPath(manifests[0]).parts
                if len(parts) != 2:
                    raise _unsafe(
                        "package archive wrapper must be exactly one directory deep",
                        detail={"path": manifests[0]},
                    )
                prefix = parts[0] + "/"
                if any(not name.startswith(prefix) for name in names):
                    raise _unsafe("package archive wrapper is ambiguous")

            normalized_entries: list[tuple[zipfile.ZipInfo, str]] = []
            normalized_seen: set[str] = set()
            for info, name in files:
                relative = name[len(prefix):] if prefix else name
                if not relative:
                    raise _unsafe("package archive contains an empty package path")
                key = relative.casefold()
                if key in normalized_seen:
                    raise _unsafe(
                        "package archive contains duplicate normalized package paths",
                        detail={"path": relative},
                    )
                normalized_seen.add(key)
                normalized_entries.append((info, relative))

            destination.parent.mkdir(parents=True, exist_ok=True)
            staging = Path(
                tempfile.mkdtemp(
                    prefix=f".{destination.name}.extract-",
                    dir=destination.parent,
                )
            )
            copied_total = 0
            for info, relative in normalized_entries:
                target = staging.joinpath(*PurePosixPath(relative).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                copied = 0
                with handle.open(info, "r") as source, target.open("xb") as output:
                    while chunk := source.read(_ARCHIVE_COPY_CHUNK_BYTES):
                        copied += len(chunk)
                        copied_total += len(chunk)
                        if copied > info.file_size or copied > MAX_ARCHIVE_FILE_BYTES:
                            raise _unsafe(
                                "package archive member exceeded its declared or allowed size",
                                detail={"path": relative},
                            )
                        if copied_total > MAX_ARCHIVE_TOTAL_BYTES:
                            raise _unsafe(
                                f"package archive expands beyond {MAX_ARCHIVE_TOTAL_BYTES} bytes",
                                detail={"bytes": copied_total},
                            )
                        output.write(chunk)
                if copied != info.file_size:
                    raise _unsafe(
                        "package archive member size does not match its declaration",
                        detail={"path": relative, "declared": info.file_size, "actual": copied},
                    )

        if destination.exists():
            if destination.is_dir():
                shutil.rmtree(destination)
            else:
                destination.unlink()
        os.replace(staging, destination)
        staging = None
        return destination
    except ControlPlaneError:
        raise
    except (
        OSError,
        RuntimeError,
        zipfile.BadZipFile,
        EOFError,
        NotImplementedError,
        ValueError,
        zlib.error,
    ) as exc:
        raise _unsafe("cannot safely extract package archive", detail={"error": str(exc)}) from exc
    finally:
        if staging is not None:
            shutil.rmtree(staging, ignore_errors=True)
