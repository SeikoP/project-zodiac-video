"""Verify and safely stage a phase-scoped Zodiac source artifact; no network or approvals."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import zipfile


def stage(archive_path, target, phase, version, release_id, commit=None):
    target = Path(target).resolve()
    if target.exists() and any(target.iterdir()):
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: target not empty")
    with zipfile.ZipFile(archive_path) as source:
        names = source.namelist()
        if len(names) != len(set(names)) or "SOURCE-PROVENANCE.json" not in names:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: invalid index")
        provenance = json.loads(source.read("SOURCE-PROVENANCE.json"))
        if (provenance.get("format") != "zodiac-execution-source@2"
            or provenance.get("scope") != phase
            or provenance.get("plugin_version") != version
            or provenance.get("plugin_release_id") != release_id):
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: release/scope mismatch")
        if commit is not None and provenance.get("commit") != commit:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: commit mismatch")
        entries = provenance.get("files", [])
        if len(entries) != len({entry["path"] for entry in entries}):
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: duplicate inventory")
        if set(names) != {entry["path"] for entry in entries} | {"SOURCE-PROVENANCE.json"}:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: file inventory mismatch")
        for entry in entries:
            name = entry["path"]
            path = PurePosixPath(name)
            if (path.is_absolute() or ".." in path.parts or not name.startswith("plugins/zodiac-video-pipeline/")
                or "\\" in name):
                raise ValueError("SOURCE_INTEGRITY_MISMATCH: unsafe path")
            info = source.getinfo(name)
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise ValueError("SOURCE_INTEGRITY_MISMATCH: symlink")
            data = source.read(name)
            if len(data) != entry["size"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
                raise ValueError("SOURCE_INTEGRITY_MISMATCH: payload checksum")
        # No writes until the complete archive has been validated.
        target.mkdir(parents=True, exist_ok=True)
        for entry in entries:
            dest = target.joinpath(*PurePosixPath(entry["path"]).parts)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(source.read(entry["path"]))
        (target / "SOURCE-PROVENANCE.json").write_bytes(source.read("SOURCE-PROVENANCE.json"))
        return {"status": "SOURCE_STAGED", "files": len(entries), "scope": phase,
                "source_root": str(target / "plugins/zodiac-video-pipeline")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive")
    parser.add_argument("target")
    parser.add_argument("--phase", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    print(json.dumps(stage(args.archive, args.target, args.phase, args.version, args.release_id, args.commit)))
