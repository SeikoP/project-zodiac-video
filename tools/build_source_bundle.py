"""Package tracked executable source with pinned provenance; no episode approval."""
import argparse, hashlib, json, subprocess, zipfile
from pathlib import Path

def build(root, output, commit, release_id, release_record=None):
    root = Path(root).resolve()
    commit = subprocess.check_output(["git", "rev-parse", commit], cwd=root, text=True).strip()
    if commit != subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip():
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: commit is not checked out")
    plugin = root / "plugins/zodiac-video-pipeline"
    manifests = [json.loads((plugin / p).read_text()) for p in ["plugin.json", ".codex-plugin/plugin.json", "skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json"]]
    version = manifests[0]["version"]
    if manifests[1]["version"] != version or manifests[2]["plugin_version"] != version:
        raise ValueError("SOURCE_INTEGRITY_MISMATCH: versions disagree")
    record = None
    if release_record:
        record = json.loads((root / release_record).read_text())
        if record["plugin_version"] != version or not record.get("plugin_release_id") or not record.get("source_commit"):
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: release record incomplete or wrong version")
        if release_id and release_id != record["plugin_release_id"]:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: release ID disagrees with record")
        release_id = record["plugin_release_id"]
    subprocess.check_call(["git", "diff", "--quiet", "HEAD", "--"], cwd=root)
    paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
    entries = []
    output = Path(output); output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(filter(None, paths)):
            file = root / name
            if file.is_symlink() or not file.is_file():
                raise ValueError("SOURCE_INTEGRITY_MISMATCH: missing/symlink " + name)
            data = file.read_bytes()
            archive.writestr(name, data)
            entries.append({"path": name, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)})
        archive.writestr("SOURCE-PROVENANCE.json", json.dumps({"format": "zodiac-execution-source@1", "plugin_version": version, "plugin_release_id": release_id, "plugin_source_commit": record["source_commit"] if record else None, "repository": "SeikoP/project-zodiac-video", "commit": commit, "source_root": "plugins/zodiac-video-pipeline", "guidance_role": "development mirror; active installed plugin and user govern workflow/episode", "not_an_approval": True, "files": entries}, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None: raise ValueError("SOURCE_INTEGRITY_MISMATCH: ZIP CRC")
    return {"version": version, "commit": commit, "files": len(entries), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="."); parser.add_argument("--output", required=True)
    parser.add_argument("--commit", required=True); parser.add_argument("--release-id", default="")
    parser.add_argument("--release-record")
    args = parser.parse_args()
    print(json.dumps(build(args.root, args.output, args.commit, args.release_id, args.release_record)))
