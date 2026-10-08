from __future__ import annotations

import json
from pathlib import Path, PurePosixPath
from typing import Any

from .authoring import load_authoring_ir
from .contracts import canonical_contract_hash, validate_contract_shape
from .errors import ControlPlaneError


_REQUIRED_ROOT_FILES = {
    "package-manifest.json",
    "production.ir.json",
    "design-token.json",
    "narration.txt",
}
_ALLOWED_ROOT_FILES = _REQUIRED_ROOT_FILES
_ALLOWED_ROOT_DIRECTORIES = {"assets", "publish"}
_REQUIRED_ROOT_DIRECTORIES = {"publish"}
_REQUIRED_PUBLISH_FILES = {"publish.json", "publish-copy.txt"}


def _fail(code: str, message: str, *, detail: dict[str, Any] | None = None) -> None:
    raise ControlPlaneError(
        code=code,
        stage="PACKAGE",
        message=message,
        detail=detail or {},
    )


def _read_object(path: Path, *, code: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        _fail(code, f"cannot read {path.name}: {exc}", detail={"path": str(path)})
    if not isinstance(value, dict):
        _fail(code, f"{path.name} root must be an object", detail={"path": str(path)})
    return value


def _validate_schema(name: str, value: dict[str, Any], *, code: str) -> None:
    issues = validate_contract_shape(name, value)
    if issues:
        first = issues[0]
        _fail(
            code,
            f"{name} does not match its canonical contract",
            detail={"path": first.path, "issue": first.message},
        )


def _walk_asset_files(asset_root: Path) -> set[str]:
    files: set[str] = set()
    folded: set[str] = set()
    for path in asset_root.rglob("*"):
        relative = path.relative_to(asset_root).as_posix()
        if path.is_symlink():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "package assets must not contain symbolic links",
                detail={"path": f"assets/{relative}"},
            )
        if path.is_dir():
            continue
        if not path.is_file():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "package assets may contain regular files only",
                detail={"path": f"assets/{relative}"},
            )
        key = relative.casefold()
        if key in folded:
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "package assets contain duplicate case-insensitive paths",
                detail={"path": f"assets/{relative}"},
            )
        folded.add(key)
        files.add(f"assets/{relative}")
    return files


def _validate_asset_files(root: Path, ir: dict[str, Any]) -> None:
    asset_root = root / "assets"
    if asset_root.is_symlink() or (asset_root.exists() and not asset_root.is_dir()):
        _fail("PACKAGE_CONTENT_INVALID", "Job@5 assets path must be a regular directory")
    if not asset_root.exists():
        if ir["assets"]:
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "Job@5 package is missing assets/ referenced by the Authoring IR",
            )
        return

    resolved_asset_root = asset_root.resolve()
    referenced: set[str] = set()
    for asset_id, asset in ir["assets"].items():
        raw_path = asset.get("path") if isinstance(asset, dict) else None
        if (
            not isinstance(raw_path, str)
            or not raw_path.startswith("assets/")
            or "\\" in raw_path
            or raw_path.startswith("/")
        ):
            _fail(
                "PACKAGE_CONTENT_INVALID",
                f"asset {asset_id!r} must reference a safe assets/ path",
                detail={"asset_id": asset_id, "path": raw_path},
            )
        parts = raw_path.split("/")
        if any(part in ("", ".", "..") for part in parts):
            _fail(
                "PACKAGE_CONTENT_INVALID",
                f"asset {asset_id!r} has an unsafe path",
                detail={"asset_id": asset_id, "path": raw_path},
            )
        candidate = root.joinpath(*PurePosixPath(raw_path).parts)
        if candidate.is_symlink() or not candidate.is_file():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                f"asset {asset_id!r} is missing or is not a regular file",
                detail={"asset_id": asset_id, "path": raw_path},
            )
        resolved = candidate.resolve()
        if not resolved.is_relative_to(resolved_asset_root):
            _fail(
                "PACKAGE_CONTENT_INVALID",
                f"asset {asset_id!r} escapes the assets/ directory",
                detail={"asset_id": asset_id, "path": raw_path},
            )
        referenced.add(PurePosixPath(raw_path).as_posix())

    actual = _walk_asset_files(asset_root)
    missing = sorted(referenced - actual)
    unreferenced = sorted(actual - referenced)
    if missing or unreferenced:
        _fail(
            "PACKAGE_CONTENT_INVALID",
            "packaged assets must exactly match the Authoring IR references",
            detail={"missing": missing, "unreferenced": unreferenced},
        )


def _validate_narration(root: Path, ir: dict[str, Any]) -> None:
    try:
        narration = (root / "narration.txt").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        _fail(
            "PACKAGE_CONTENT_INVALID",
            f"cannot read narration.txt: {exc}",
            detail={"path": str(root / "narration.txt")},
        )
    narration = narration.replace("\r\n", "\n")
    if narration.endswith("\n"):
        narration = narration[:-1]
    expected = "\n".join(scene["voice"] for scene in ir["scenes"])
    if narration != expected:
        _fail(
            "PACKAGE_CONTENT_INVALID",
            "narration.txt must exactly match ordered IR scene voice",
        )


def validate_job5_package_root(root: Path) -> dict[str, Any]:
    """Validate the exact Job@5 package boundary before importing it into a workspace."""
    source = Path(root).expanduser()
    if source.is_symlink():
        _fail("PACKAGE_CONTENT_INVALID", "Job@5 package root must not be a symbolic link")
    root = source.resolve()
    if not root.is_dir():
        _fail("PACKAGE_CONTENT_INVALID", "Job@5 package root must be a regular directory")

    for name in _REQUIRED_ROOT_FILES:
        path = root / name
        if not path.is_file() or path.is_symlink():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                f"Job@5 package is missing required file {name}",
                detail={"path": name},
            )
    for name in _REQUIRED_ROOT_DIRECTORIES:
        path = root / name
        if not path.is_dir() or path.is_symlink():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                f"Job@5 package is missing required directory {name}/",
                detail={"path": name},
            )

    for entry in root.iterdir():
        if entry.is_symlink():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "Job@5 package must not contain symbolic links",
                detail={"path": entry.name},
            )
        if entry.name in _ALLOWED_ROOT_FILES:
            if not entry.is_file():
                _fail(
                    "PACKAGE_CONTENT_INVALID",
                    "Job@5 root file has an unexpected type",
                    detail={"path": entry.name},
                )
        elif entry.name in _ALLOWED_ROOT_DIRECTORIES:
            if not entry.is_dir():
                _fail(
                    "PACKAGE_CONTENT_INVALID",
                    "Job@5 root directory has an unexpected type",
                    detail={"path": entry.name},
                )
        else:
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "Job@5 package contains an unexpected root entry",
                detail={"path": entry.name},
            )

    publish_root = root / "publish"
    publish_entries = list(publish_root.iterdir())
    actual_publish = {entry.name for entry in publish_entries}
    if actual_publish != _REQUIRED_PUBLISH_FILES:
        _fail(
            "PACKAGE_CONTENT_INVALID",
            "publish/ must contain exactly publish.json and publish-copy.txt",
            detail={
                "missing": sorted(_REQUIRED_PUBLISH_FILES - actual_publish),
                "unexpected": sorted(actual_publish - _REQUIRED_PUBLISH_FILES),
            },
        )
    for entry in publish_entries:
        if entry.is_symlink() or not entry.is_file():
            _fail(
                "PACKAGE_CONTENT_INVALID",
                "publish/ may contain regular files only",
                detail={"path": f"publish/{entry.name}"},
            )
    try:
        (publish_root / "publish-copy.txt").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        _fail(
            "PACKAGE_CONTENT_INVALID",
            f"cannot read publish-copy.txt: {exc}",
            detail={"path": "publish/publish-copy.txt"},
        )

    manifest = _read_object(root / "package-manifest.json", code="PACKAGE_INVALID")
    _validate_schema("zodiac-job-v5", manifest, code="PACKAGE_INVALID")
    expected_hash = canonical_contract_hash("authoring-ir-v1")
    contract = manifest["contract"]
    if contract["sha256"] != expected_hash:
        _fail(
            "PACKAGE_CONTRACT_MISMATCH",
            "package authoring contract hash does not match canonical local contract",
            detail={"expected": expected_hash, "actual": contract["sha256"]},
        )
    renderer = manifest["renderer"]
    if renderer != {"id": "zodiac-renderer", "version": "2.0.0"}:
        _fail(
            "PACKAGE_RENDERER_MISMATCH",
            "package requires an unsupported renderer",
            detail={"renderer": renderer},
        )

    ir = load_authoring_ir(root / "production.ir.json")
    design = _read_object(root / "design-token.json", code="DESIGN_TOKEN_INVALID")
    _validate_schema("design-token-v4", design, code="DESIGN_TOKEN_INVALID")
    publish = _read_object(publish_root / "publish.json", code="PACKAGE_CONTENT_INVALID")
    _validate_schema("publish-v1", publish, code="PACKAGE_CONTENT_INVALID")
    source = publish.get("source", {})
    if (
        source.get("narration") != "narration.txt"
        or source.get("production") != "production.ir.json"
    ):
        _fail(
            "PACKAGE_CONTENT_INVALID",
            "publish metadata must point to narration.txt and production.ir.json",
            detail={"source": source},
        )

    _validate_narration(root, ir)
    _validate_asset_files(root, ir)
    return {
        "manifest": manifest,
        "ir": ir,
        "design": design,
        "publish": publish,
    }
