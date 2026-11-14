"""Reproducible isolated visual benchmark; never grants creative approval."""
from __future__ import annotations

import argparse
import copy
import json
import os
from pathlib import Path
import shutil
import time

from tools.studio.artifacts import file_sha256
from .service import StudioProjectService


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capsule",type=Path,required=True)
    parser.add_argument("--intent",type=Path,required=True)
    parser.add_argument("--voice-workspace",type=Path,required=True)
    parser.add_argument("--projects-root",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    source=args.voice_workspace.resolve()
    with_service=StudioProjectService(args.projects_root)
    try:
        service=with_service;project=service.import_capsule(args.capsule);pid=project["project_id"]
        handle=service.registry.get(pid)
        if handle.workspace.resolve()==source:
            raise ValueError("Benchmark must use an isolated projects root, not the source workspace")
        def narration(root):
            return next(root/p for p in (".authoring/narration.txt","narration.txt") if (root/p).is_file())
        if file_sha256(narration(source))!=file_sha256(narration(handle.workspace)):
            raise ValueError("Voice/source narration mismatch")
        for name in ("voice-lab","artifacts"):
            directory=source/".runtime"/name
            if directory.exists():
                if directory.is_symlink() or any(p.is_symlink() for p in directory.rglob("*")):
                    raise ValueError("Symlink in voice artifacts")
                target=handle.workspace/".runtime"/name
                source_path=Path("\\\\?\\"+str(directory)) if os.name=="nt" else directory
                target_path=Path("\\\\?\\"+str(target.resolve())) if os.name=="nt" else target
                shutil.copytree(source_path,target_path,dirs_exist_ok=True,
                                ignore=shutil.ignore_patterns("alignment","jobs") if name=="voice-lab" else None)
        lab=service.visual;intent=json.loads(args.intent.read_text(encoding="utf8"));runs=[]
        original_narration=file_sha256(narration(handle.workspace))
        original_audio={p.relative_to(handle.workspace).as_posix():file_sha256(p) for p in handle.workspace.rglob("*.wav")}
        def command(kind,payload):
            state=lab.snapshot(pid)
            return lab.command(pid,"benchmark-"+str(time.time_ns()),state["revision"],kind,payload)
        def build(label,scene_id=None):
            state=lab.snapshot(pid);start=time.perf_counter();lab.start(pid,state["revision"],scene_id)
            deadline=time.monotonic()+180
            while time.monotonic()<deadline:
                state=lab.snapshot(pid)
                if state["job"]["status"]!="RUNNING":break
                time.sleep(.05)
            if state["job"]["status"]!="COMPLETED":
                raise RuntimeError(json.dumps(state["job"]))
            manifest=state["build"]
            assert len(manifest["scenes"])==len(intent["scenes"])
            runs.append({"case":label,"observed_ms":round((time.perf_counter()-start)*1000),"build_id":manifest["id"],
                         "revision":state["revision"],"cache":manifest["cache"],"resources":manifest["resources"],
                         "asset_hashes":manifest["assets"],"scene_hashes":{s["id"]:s["preview_sha256"] for s in manifest["scenes"]}})
            return state
        command("source.replace",{"intent":intent})
        cold=build("cold");warm=build("warm")
        assert warm["build"]["cache"]["rebuilt"]==0
        target=intent["scenes"][min(2,len(intent["scenes"])-1)];actor=target["entities"][0];state_id=actor["initial_state"]
        command("scene.patch",{"scene_id":target["id"],"entity_id":actor["id"],"state_id":state_id,
                               "changes":{"x":actor["states"][state_id]["transform"]["x"]+20}})
        scoped=build("scene-edit",target["id"])
        assert all(e["node_id"] in ("scene:"+target["id"],"appearance:"+target["id"]) for e in scoped["build"]["cache"]["events"] if not e["hit"])
        command("theme.select",{"theme":"dark"});dark=build("theme-only")
        assert cold["build"]["assets"]==dark["build"]["assets"]
        assert all(e["hit"] for e in dark["build"]["cache"]["events"] if e["node_id"].startswith("geometry:"))
        shared=copy.deepcopy(lab.snapshot(pid)["intent"])
        if shared.get("cast"):
            catalog=ROOT/"plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/components/catalog.json"
            choices=[r["id"] for r in json.loads(catalog.read_text(encoding="utf8"))["expressions"]]
            spec=shared["cast"][0];spec_state=next(iter(spec["states"].values()));spec_state["expression_id"]=next(x for x in choices if x!=spec_state["expression_id"])
            command("source.replace",{"intent":shared});build("shared-character-edit")
        assert file_sha256(narration(handle.workspace))==original_narration
        assert all(file_sha256(handle.workspace/rel)==sha for rel,sha in original_audio.items())
        result={"format":"zodiac-studio-p34-benchmark@1","project_id":pid,"workspace":str(handle.workspace),
                "source_capsule_sha256":file_sha256(args.capsule),"source_intent_sha256":file_sha256(args.intent),
                "scene_count":len(intent["scenes"]),"narration_unchanged":True,"existing_audio_unchanged":True,
                "timing_provenance":"Reused selected source-bound Voice Lab ASR; no timing or voice regenerated",
                "source_approval":"Existing capsule receipt; synthetic receipts remain synthetic", "human_visual_review":"NOT_ASSERTED",
                "renderer_parity":"NOT_ASSERTED","runs":runs}
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
        print(json.dumps({"project_id":pid,"scenes":len(intent["scenes"]),"runs":[{"case":r["case"],"observed_ms":r["observed_ms"],"reused":r["cache"]["reused"],"rebuilt":r["cache"]["rebuilt"]} for r in runs]},ensure_ascii=True))
    finally:
        with_service.close()


ROOT=Path(__file__).resolve().parents[2]
if __name__=="__main__":main()
