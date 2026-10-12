"""Build phase-scoped, integrity-pinned Zodiac execution source (never an episode ZIP)."""
import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

PLUGIN = "plugins/zodiac-video-pipeline/"
PHASES = ("01-content", "02-visual-production", "03-handoff")
ROOT_REQUIRED = ("plugin.json", ".codex-plugin/plugin.json",
                 "skills/zodiac-video-pipeline/SKILL.md",
                 "skills/zodiac-video-pipeline/orchestration/router.md",
                 "skills/zodiac-video-pipeline/orchestration/execution-bootstrap.md",
                 "skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json")
PHASE_REQUIRED = {
    "01-content": ("skills/zodiac-video-pipeline/orchestration/execution-preflight.mjs",
                   "skills/zodiac-video-pipeline/orchestration/commit-phase01-step.mjs",
                   "skills/zodiac-video-pipeline/orchestration/run-validator-with-receipt.mjs"),
    "02-visual-production": ("skills/zodiac-video-pipeline/orchestration/phase02-execute.mjs",),
    "03-handoff": ("skills/zodiac-video-pipeline/orchestration/run-phase03-production.mjs",),
}


def include(path, phase):
    if not path.startswith(PLUGIN):
        return False
    rel = path[len(PLUGIN):]
    parts = PurePosixPath(rel).parts
    if not parts or "tests" in parts or rel.endswith(".test.mjs"):
        return False
    # Phase 01 uses shared orchestration and reference data but never the
    # large visual/asset source library; phase 02/03 need native contracts/assets.
    if phase == "01-content" and (
        rel.startswith("skills/zodiac-video-pipeline/references/asset-library-v4/")
        or rel.startswith("skills/zodiac-video-pipeline/asset-library/")
    ):
        return False
    return True


def build(root, output, commit, release_id, release_record=None, phase="01-content"):
    if phase not in PHASES:
        raise ValueError("Unknown phase")
    root = Path(root).resolve()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    commit = subprocess.check_output(["git", "rev-parse", commit], cwd=root, text=True).strip()
    if head != commit:
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: commit not checked out")
    if subprocess.run(["git", "diff", "--quiet", "HEAD", "--"], cwd=root).returncode:
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: dirty working tree")
    plugin = root / PLUGIN
    paths = ("plugin.json", ".codex-plugin/plugin.json",
             "skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json")
    manifests = [json.loads((plugin / path).read_text()) for path in paths]
    version = manifests[0]["version"]
    if manifests[1]["version"] != version or manifests[2]["plugin_version"] != version:
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: manifest version mismatch")
    record = None
    if release_record:
        record = json.loads((root / release_record).read_text())
        if record["plugin_version"] != version or not record.get("plugin_release_id") or not record.get("source_commit"):
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: release record incomplete")
        if release_id and release_id != record["plugin_release_id"]:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: release ID mismatch")
        release_id = record["plugin_release_id"]
    if not release_id:
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: missing release ID")
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
    selected = sorted(path for path in filter(None, tracked) if include(path, phase))
    missing = [PLUGIN + p for p in (*ROOT_REQUIRED, *PHASE_REQUIRED[phase])
               if PLUGIN + p not in selected]
    if missing:
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: missing execution inputs " + repr(missing))
    entries = []
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in selected:
            file = root / name
            if file.is_symlink() or not file.is_file():
                raise ValueError("SOURCE_INTEGRITY_MISMATCH: missing/symlink " + name)
            data = file.read_bytes()
            archive.writestr(name, data)
            entries.append({"path": name, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)})
        archive.writestr("SOURCE-PROVENANCE.json", json.dumps({
            "format": "zodiac-execution-source@2", "scope": phase,
            "plugin_version": version, "plugin_release_id": release_id,
            "plugin_source_commit": record["source_commit"] if record else None,
            "repository": "SeikoP/project-zodiac-video", "commit": commit,
            "source_root": PLUGIN.rstrip("/"),
            "guidance_role": "execution bytes only; installed plugin router and real user approvals govern",
            "not_an_approval": True, "files": entries
        }, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: ZIP CRC")
    return {"phase": phase, "version": version, "commit": commit, "files": len(entries),
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--output", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--release-id", default="")
    parser.add_argument("--release-record")
    parser.add_argument("--phase", choices=PHASES, default="01-content")
    args = parser.parse_args()
    print(json.dumps(build(args.root, args.output, args.commit, args.release_id, args.release_record, args.phase)))
