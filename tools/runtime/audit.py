"""Reverse-dependency audit for versioned runtime source trees."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_SCAN_ROOTS = (".github", "tools", "tests", "plugins")
_TEXT_SUFFIXES = {".py", ".json", ".md", ".mjs", ".js", ".ts", ".tsx", ".yml", ".yaml"}


@dataclass(frozen=True)
class RuntimeReferenceAudit:
    runtime_id: str
    version: str
    references: tuple[str, ...]

    @property
    def safe_to_archive(self) -> bool:
        return not self.references


def _registry_rows() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for path in sorted((_ROOT / "runtime" / "releases").glob("*.json")):
        value = json.loads(path.read_text(encoding="utf-8"))
        runtime_id = value.get("id")
        supported = value.get("supported", {})
        if isinstance(runtime_id, str) and isinstance(supported, dict):
            rows.extend((runtime_id, version) for version in supported if isinstance(version, str))
    return rows


def audit_runtime_references() -> list[RuntimeReferenceAudit]:
    files: list[Path] = []
    for root_name in _SCAN_ROOTS:
        root = _ROOT / root_name
        if not root.exists():
            continue
        files.extend(path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in _TEXT_SUFFIXES)

    results: list[RuntimeReferenceAudit] = []
    for runtime_id, version in _registry_rows():
        refs: list[str] = []
        for path in files:
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError):
                continue
            if version in text and (runtime_id in text or f"/{version}" in text or f'"{version}"' in text):
                refs.append(path.relative_to(_ROOT).as_posix())
        results.append(RuntimeReferenceAudit(runtime_id, version, tuple(sorted(set(refs)))))
    return results
