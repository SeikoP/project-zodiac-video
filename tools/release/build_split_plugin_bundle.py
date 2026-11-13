#!/usr/bin/env python3
"""Build deterministic Web/Local Zodiac plugin distributions from one canonical source."""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.build_source_bundle import select_phase_files

PLUGIN = Path("plugins/zodiac-video-pipeline")
ROOT_FILES = {"package.json", "package-lock.json"}
CANONICAL_ROOTS = {"bootstrap","core","features","phases","orchestration","references","art-direction","compat","contracts"}
EXCLUDED = {"tests","__pycache__",".cache",".pytest_cache","node_modules",".runtime",".codegraph",".authoring","retired-source","generated-previews"}
STATIC_TIME=(1980,1,1,0,0,0)

WEB_CREATIVE_FILES={
    "skills/zodiac-video-pipeline/contracts/phase1-handoff.mjs",
    "skills/zodiac-video-pipeline/orchestration/phases/01-content.json",
    "skills/zodiac-video-pipeline/orchestration/phases/01-content.md",
    "skills/zodiac-video-pipeline/references/phase01-briefing.md",
    "skills/zodiac-video-pipeline/references/zodiac-identity-first.md",
    "skills/zodiac-video-pipeline/references/research-and-viral-tools.md",
    "skills/zodiac-video-pipeline/references/episode-formats.md",
    "skills/zodiac-video-pipeline/references/voice-profile.md",
    "skills/zodiac-video-pipeline/references/voice-benchmark.md",
    "skills/zodiac-video-pipeline/references/narrator-performance.md",
    "skills/zodiac-video-pipeline/references/content-craft.md",
    "skills/zodiac-video-pipeline/references/content-quality-engine.md",
    "skills/zodiac-video-pipeline/references/narrative-modes.md",
    "skills/zodiac-video-pipeline/references/engagement-engine.md",
    "skills/zodiac-video-pipeline/references/narrative-visual-direction.md",
    "skills/zodiac-video-pipeline/references/narration-rhythm.md",
    "skills/zodiac-video-pipeline/references/performance-surfaces.md",
}

def _canonical_eligible(rel: Path) -> bool:
    parts=rel.parts
    if any(p in EXCLUDED for p in parts) or rel.name.endswith(".test.mjs") or rel.suffix in {".pyc",".log"}:
        return False
    if rel.as_posix() in ROOT_FILES:
        return True
    return len(parts)>=3 and parts[0]=="skills" and parts[1]=="zodiac-video-pipeline" and parts[2] in CANONICAL_ROOTS

def _manifest(canonical: dict, config: dict) -> tuple[dict,dict]:
    interface=dict(config["interface"])
    if config.get("display_version"):
        prefix=f"v{canonical['version']} | "
        short=str(interface.get("shortDescription", "")).strip()
        if not short.startswith(prefix): interface["shortDescription"]=prefix+short
    plugin={
        "$schema":canonical.get("$schema"),
        "author":canonical.get("author",{"name":"Personal"}),
        "description":config["description"],
        "extensions":{"com.openai":{"interface":interface}},
        "name":config["name"],
        "version":canonical["version"],
    }
    codex={
        "interface":interface,"name":config["name"],"version":canonical["version"],
        "description":config["description"],"author":canonical.get("author",{"name":"Personal"}),
        "keywords":[],"skills":"./skills",
    }
    return plugin,codex

def build_profile(root: Path, profile: str, destination: Path) -> dict:
    root=Path(root).resolve();src=root/PLUGIN
    if profile not in {"web","local"}: raise ValueError("SPLIT_PROFILE_INVALID")
    canonical=json.loads((src/"plugin.json").read_text(encoding="utf-8"))
    config=json.loads((src/f"distributions/{profile}.plugin.json").read_text(encoding="utf-8"))
    if config.get("profile")!=profile: raise ValueError("SPLIT_PROFILE_CONFIG_INVALID")
    entry=Path(config["entry_skill"])
    required=[entry]
    if config.get("include_humanizer"):
        required += [Path("skills/humanizer/SKILL.md"),Path("skills/humanizer/LICENSE")]
    files=sorted((p for p in src.rglob("*") if p.is_file() and _canonical_eligible(p.relative_to(src))),key=lambda p:p.relative_to(src).as_posix())
    source_count = len(files)
    if profile == "web":
        # Web Phase 1 is guidance-only creative authoring. Do not package the
        # native producer runtime, npm manifests, validators, caches or source
        # transport machinery. Local owns native execution.
        selected = {str(PLUGIN / rel) for rel in WEB_CREATIVE_FILES}
        files = [p for p in files if p.relative_to(root).as_posix() in selected]
        missing_web = [rel for rel in sorted(WEB_CREATIVE_FILES) if not (src / rel).is_file()]
        if missing_web:
            raise ValueError("SPLIT_WEB_CREATIVE_FILE_MISSING " + repr(missing_web))
    for rel in required:
        p=src/rel
        if not p.is_file(): raise ValueError(f"SPLIT_REQUIRED_FILE_MISSING {rel.as_posix()}")
        files.append(p)
    # Stable de-duplication.
    unique={p.relative_to(src).as_posix():p for p in files}
    files=[unique[k] for k in sorted(unique)]
    packaged=set(unique)
    # Validate literal local ESM imports against canonical packaged bytes.
    for file in files:
        if file.suffix not in {".mjs",".js"}: continue
        raw=file.read_text(encoding="utf-8")
        for spec in re.findall(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+)['"]""",raw):
            target=(file.parent/spec).resolve()
            try: rel=target.relative_to(src.resolve()).as_posix()
            except ValueError as exc: raise ValueError(f"SPLIT_IMPORT_OUTSIDE_ARCHIVE {file}: {spec}") from exc
            if rel not in packaged: raise ValueError(f"SPLIT_STATIC_IMPORT_MISSING {file}: {spec}")
    plugin,codex=_manifest(canonical,config)
    generated={
        "plugin.json":(json.dumps(plugin,ensure_ascii=False,indent=2)+"\n").encode(),
        ".codex-plugin/plugin.json":(json.dumps(codex,ensure_ascii=False,indent=2)+"\n").encode(),
    }
    destination=Path(destination);destination.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(destination,"w",compression=ZIP_DEFLATED,compresslevel=9) as out:
        for name,data in sorted(generated.items()):
            info=ZipInfo(name,STATIC_TIME);info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16
            out.writestr(info,data,compress_type=ZIP_DEFLATED,compresslevel=9)
        for file in files:
            rel=file.relative_to(src).as_posix()
            info=ZipInfo(rel,STATIC_TIME);info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16
            out.writestr(info,file.read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=9)
    with ZipFile(destination) as z:
        if z.testzip() is not None: raise ValueError("SPLIT_ZIP_CRC_FAILURE")
        names=set(z.namelist())
        if config["entry_skill"] not in names: raise ValueError("SPLIT_ENTRY_SKILL_MISSING")
        other="skills/zodiac-video-local/SKILL.md" if profile=="web" else "skills/zodiac-video-web/SKILL.md"
        if other in names: raise ValueError("SPLIT_OPPOSITE_ENTRY_SKILL_PRESENT")
        if "skills/zodiac-video-pipeline/SKILL.md" in names: raise ValueError("SPLIT_MONOLITHIC_ENTRY_PRESENT")
    return {
        "format":"zodiac-split-plugin-package@1","profile":profile,"plugin_name":config["name"],
        "version":canonical["version"],"archive_sha256":hashlib.sha256(destination.read_bytes()).hexdigest(),
        "archive_bytes":destination.stat().st_size,"archive_file_count":len(files)+2,
        "deferred_file_count": source_count - len(files) + len(required),"release_approved":False,
    }

def main():
    p=argparse.ArgumentParser();p.add_argument("--repo-root",type=Path,default=Path.cwd());p.add_argument("--profile",choices=["web","local"],required=True);p.add_argument("--output",type=Path,required=True);p.add_argument("--report",type=Path)
    a=p.parse_args();result=build_profile(a.repo_root,a.profile,a.output)
    if a.report:
        a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result))

if __name__=="__main__": main()
