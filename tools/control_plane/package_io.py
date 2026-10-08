from __future__ import annotations

import re
import shutil
import stat
from pathlib import Path, PurePosixPath
import zipfile

from .errors import ControlPlaneError


_DRIVE_PATH = re.compile(r"^[A-Za-z]:/")


def _unsafe(message: str, *, detail: dict | None = None) -> ControlPlaneError:
    return ControlPlaneError(
        code="PACKAGE_ARCHIVE_UNSAFE",
        stage="PACKAGE",
        message=message,
        detail=detail or {},
    )


def _normalized_name(raw: str) -> str:
    name = raw.replace("\\", "/")
    if not name or name.startswith("/") or _DRIVE_PATH.match(name):
        raise _unsafe("archive contains an absolute or drive-qualified path", detail={"path": raw})
    path = PurePosixPath(name)
    parts = path.parts
    if any(part in ("", ".", "..") for part in parts):
        raise _unsafe("archive contains an unsafe relative path", detail={"path": raw})
    return "/".join(parts)


def _is_symlink(info: zipfile.ZipInfo) -> bool:
    if info.create_system != 3:
        return False
    mode = (info.external_attr >> 16) & 0xFFFF
    return stat.S_IFMT(mode) == stat.S_IFLNK


def extract_package_archive(archive: Path, destination: Path) -> Path:
    archive = Path(archive).resolve()
    destination = Path(destination).resolve()
    if not archive.is_file():
        raise _unsafe("package archive does not exist", detail={"path": str(archive)})

    try:
        handle = zipfile.ZipFile(archive)
    except (OSError, zipfile.BadZipFile) as exc:
        raise _unsafe("package archive is not a readable ZIP", detail={"path": str(archive)}) from exc

    with handle:
        files: list[tuple[zipfile.ZipInfo, str]] = []
        raw_seen: set[str] = set()
        for info in handle.infolist():
            if info.is_dir():
                continue
            if _is_symlink(info):
                raise _unsafe("package archive contains a symlink", detail={"path": info.filename})
            normalized = _normalized_name(info.filename)
            key = normalized.casefold()
            if key in raw_seen:
                raise _unsafe("package archive contains duplicate normalized paths", detail={"path": normalized})
            raw_seen.add(key)
            files.append((info, normalized))

        if not files:
            raise _unsafe("package archive contains no files")

        names = [name for _info, name in files]
        if "package-manifest.json" in names:
            prefix = ""
        else:
            manifests = [name for name in names if name.endswith("/package-manifest.json")]
            if len(manifests) != 1:
                raise _unsafe("package archive must contain one package-manifest.json at root or one wrapper directory")
            parts = PurePosixPath(manifests[0]).parts
            if len(parts) != 2:
                raise _unsafe("package archive wrapper must be exactly one directory deep", detail={"path": manifests[0]})
            prefix = parts[0] + "/"
            if any(not name.startswith(prefix) for name in names):
                raise _unsafe("package archive wrapper is ambiguous")

        normalized_entries: list[tuple[zipfile.ZipInfo, str]] = []
        seen: set[str] = set()
        for info, name in files:
            relative = name[len(prefix):] if prefix else name
            if not relative:
                continue
            key = relative.casefold()
            if key in seen:
                raise _unsafe("package archive contains duplicate normalized package paths", detail={"path": relative})
            seen.add(key)
            normalized_entries.append((info, relative))

        if destination.exists():
            shutil.rmtree(destination)
        destination.mkdir(parents=True, exist_ok=True)

        for info, relative in normalized_entries:
            target = destination.joinpath(*PurePosixPath(relative).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with handle.open(info, "r") as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)

    return destination
