"""Fail-closed runtime release registry."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
_RELEASES = _ROOT / "runtime" / "releases"


class RuntimeRegistryError(RuntimeError):
    pass


@dataclass(frozen=True)
class RuntimeSpec:
    runtime_id: str
    version: str
    path: Path
    status: str


def _registry_path(runtime_id: str) -> Path:
    if not runtime_id or "/" in runtime_id or "\\" in runtime_id:
        raise RuntimeRegistryError(f"RUNTIME_ID_UNKNOWN {runtime_id}")
    path = _RELEASES / f"{runtime_id}.json"
    if not path.is_file():
        raise RuntimeRegistryError(f"RUNTIME_ID_UNKNOWN {runtime_id}")
    return path


def _load(runtime_id: str) -> dict[str, Any]:
    try:
        value = json.loads(_registry_path(runtime_id).read_text(encoding="utf-8"))
    except RuntimeRegistryError:
        raise
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeRegistryError(f"RUNTIME_REGISTRY_INVALID {runtime_id}: {exc}") from exc
    if value.get("format") != "zodiac-runtime-release-registry@1" or value.get("id") != runtime_id:
        raise RuntimeRegistryError(f"RUNTIME_REGISTRY_INVALID {runtime_id}")
    if not isinstance(value.get("supported"), dict):
        raise RuntimeRegistryError(f"RUNTIME_REGISTRY_INVALID {runtime_id}")
    return value


def resolve_runtime(runtime_id: str, version: str) -> RuntimeSpec:
    registry = _load(runtime_id)
    row = registry["supported"].get(version)
    if not isinstance(row, dict):
        raise RuntimeRegistryError(f"RUNTIME_VERSION_UNSUPPORTED {runtime_id}@{version}")
    raw_path = row.get("path")
    if not isinstance(raw_path, str) or not raw_path:
        raise RuntimeRegistryError(f"RUNTIME_REGISTRY_INVALID {runtime_id}@{version}")
    path = (_ROOT / raw_path).resolve()
    try:
        path.relative_to(_ROOT)
    except ValueError as exc:
        raise RuntimeRegistryError(f"RUNTIME_PATH_UNSAFE {runtime_id}@{version}") from exc
    manifest_path = path / "runtime-manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeRegistryError(f"RUNTIME_MANIFEST_INVALID {runtime_id}@{version}: {exc}") from exc
    if manifest.get("id") != runtime_id or manifest.get("version") != version:
        raise RuntimeRegistryError(f"RUNTIME_MANIFEST_MISMATCH {runtime_id}@{version}")
    return RuntimeSpec(runtime_id=runtime_id, version=version, path=Path(raw_path), status=str(row.get("status", "supported")))


def current_runtime(runtime_id: str) -> RuntimeSpec:
    registry = _load(runtime_id)
    version = registry.get("current")
    if not isinstance(version, str):
        raise RuntimeRegistryError(f"RUNTIME_CURRENT_INVALID {runtime_id}")
    return resolve_runtime(runtime_id, version)


def default_runtime(runtime_id: str, *, profile: str) -> RuntimeSpec:
    registry = _load(runtime_id)
    defaults = registry.get("defaults", {})
    version = defaults.get(profile) if isinstance(defaults, dict) else None
    if not isinstance(version, str):
        raise RuntimeRegistryError(f"RUNTIME_DEFAULT_UNKNOWN {runtime_id}:{profile}")
    return resolve_runtime(runtime_id, version)
