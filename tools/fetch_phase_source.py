"""Fetch a pinned *phase* source artifact; never clone/download the monorepo.

Requires a GitHub token with Actions artifact read permission. Does not trigger
Actions, publish plugins or bypass native pipeline gates.
"""
import argparse
import io
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import zipfile

from stage_source_bundle import stage

API = "https://api.github.com"
REPOSITORY = "SeikoP/project-zodiac-video"


def request(url, token, accept="application/vnd.github+json"):
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "zodiac-phase-source-transport",
    })
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def fetch(phase, version, release_id, commit, target, token, archive_path=None):
    if not token:
        raise RuntimeError("SOURCE_TRANSPORT_UNAVAILABLE: GH_TOKEN is required")
    if phase not in ("01-content", "02-visual-production", "03-handoff"):
        raise ValueError("invalid phase")
    if len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit.lower()):
        raise ValueError("source commit must be an exact SHA-1")
    artifact_name = "zodiac-execution-source-" + phase + "-" + commit
    url = API + "/repos/" + REPOSITORY + "/actions/artifacts?per_page=100&name=" + artifact_name
    result = json.loads(request(url, token))
    matching = [a for a in result.get("artifacts", [])
                if a.get("name") == artifact_name and not a.get("expired")
                and a.get("workflow_run", {}).get("head_sha") == commit]
    if not matching:
        raise RuntimeError("SOURCE_TRANSPORT_UNAVAILABLE: no matching artifact " + artifact_name)
    matching.sort(key=lambda a: a["id"], reverse=True)
    downloaded = request(matching[0]["archive_download_url"], token, "application/octet-stream")
    # GitHub Actions artifact downloads are a ZIP wrapper around the payload ZIP.
    with zipfile.ZipFile(io.BytesIO(downloaded)) as wrapper:
        files = [n for n in wrapper.namelist() if n.endswith(".zip") and "/" not in n]
        if len(files) != 1:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: artifact must contain one root ZIP")
        payload = wrapper.read(files[0])
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        meta = json.loads(z.read("SOURCE-PROVENANCE.json"))
        if meta.get("commit") != commit:
            raise ValueError("SOURCE_INTEGRITY_MISMATCH: source commit differs")
    archive = Path(archive_path) if archive_path else Path(target).parent / (artifact_name + ".zip")
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.write_bytes(payload)
    return stage(archive, target, phase, version, release_id)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--phase", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--release-id", required=True)
    p.add_argument("--commit", required=True)
    p.add_argument("--target", required=True)
    p.add_argument("--archive")
    args = p.parse_args()
    print(json.dumps(fetch(args.phase, args.version, args.release_id,
                           args.commit, args.target, os.environ.get("GH_TOKEN"), args.archive)))
