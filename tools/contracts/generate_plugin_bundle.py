#!/usr/bin/env python3
"""Generate plugin-visible public contract copies from canonical root schemas."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "contracts" / "manifest.json"
OUTPUT = ROOT / "plugins" / "zodiac-video-pipeline" / "skills" / "zodiac-video-pipeline" / "references" / "contracts"


def canonical_hash(value: dict) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def generate() -> dict:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    rows = {}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, spec in registry["contracts"].items():
        if not spec.get("plugin_bundle"):
            continue
        source = ROOT / spec["canonical_path"]
        value = json.loads(source.read_text(encoding="utf-8"))
        target = OUTPUT / f"{name}.schema.json"
        target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        rows[name] = {
            "canonical_path": spec["canonical_path"],
            "canonical_sha256": canonical_hash(value),
        }
    result = {"format": "zodiac-generated-contract-bundle@1", "contracts": rows}
    (OUTPUT / "generated-manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    generate()
