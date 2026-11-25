"""Spike (kept as the measuring tool): run Stage + Act for chosen scenes with outputSchema, assemble, validate, time it.

    python -m tools.studio_project.authoring_spike --projects-root <dir> --project <id> --scenes s01,s02 --runs 3

Spends luna calls (2 per scene per run). Writes a markdown table to stdout; nothing is applied to the project.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from . import agent_parts, authoring_menus, scene_assembler
from .service import StudioProjectService


def wait(service, task_id: str, limit: float = 300.0) -> dict:
    end = time.monotonic() + limit
    while time.monotonic() < end:
        task = service.agent.task(task_id)
        if task["status"] in ("COMPLETED", "FAILED", "CANCELLED"):
            return task
        time.sleep(0.5)
    raise TimeoutError(task_id)


def choose(service, project_id: str, schema: dict, data: dict) -> tuple[dict | None, str | None]:
    task = wait(service, service.agent.start_choice(project_id, schema, data)["task_id"])
    return (json.loads(task["suggestion"]), None) if task["status"] == "COMPLETED" else (None, task.get("error"))


def one_run(service, project_id: str, capsule: dict, intent: dict, scene_id: str, narration: str) -> dict:
    row = next(r for r in capsule["scene_ranges"] if r["id"] == scene_id)
    menus = authoring_menus.scene_menus(capsule, intent, scene_id, [])
    goal = next((s.get("semantic_goal") for s in intent.get("scenes", []) if s.get("id") == scene_id), row["text"][:80])
    began, result = time.monotonic(), {"scene": scene_id, "schema_valid": False, "accepted": False, "compiled": False, "seconds": 0.0, "error": None}
    stage, error = choose(service, project_id, authoring_menus.stage_schema(menus),
                          {"scene_id": scene_id, "scene_text": row["text"], "goal": goal, "menus": {k: menus[k] for k in ("frames", "mechanics", "cast", "props", "dressing")}})
    if stage:
        act, error = choose(service, project_id, authoring_menus.act_schema(menus, stage),
                            {"scene_id": scene_id, "scene_text": row["text"], "goal": goal, "stage": stage, "anchors": [{"id": a["id"], "text": a["text"]} for a in menus["anchors"]],
                             "targets": [p["prop_id"] for p in stage["props"]] + [p["entity_id"] for p in stage["present"]]})
        result["schema_valid"] = act is not None
        if act:
            try:
                part = scene_assembler.assemble_scene(menus, stage, act, scene_id, row["narration_range"], row["text"], goal)
                task = {"scene_id": scene_id, "scene_range": row["narration_range"], "scene_text": row["text"],
                        "cast": [{"entity_id": m["entity_id"], "states": sorted(m["states"])} for m in intent["cast"]], "story_visual_assets": {}}
                text = agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), task)
                result["accepted"] = True
                merged = json.loads(json.dumps(intent))
                merged["scenes"] = [json.loads(text)["payload"]["scene"] if sc["id"] == scene_id else sc for sc in intent["scenes"]]
                merged["assets"].update(json.loads(text)["payload"].get("assets") or {})
                handle = service.visual._handle(project_id)
                service.visual._node(handle, {"action": "validate_authoring", "intent": merged, "narration": narration})
                result["compiled"] = True
            except Exception as exc:  # measuring tool: record, never hide
                error = f"{type(exc).__name__}: {str(exc)[:160]}"
    result.update(seconds=round(time.monotonic() - began, 1), error=error)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects-root", type=Path, required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--scenes", required=True)
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    service = StudioProjectService(args.projects_root)
    workspace = service.visual._handle(args.project).workspace  # read the stored files directly: the snapshot refuses a drifted source
    intent = json.loads((workspace / ".authoring/visual-intent.json").read_text("utf8"))
    narration = (workspace / "narration.txt").read_bytes().decode("utf8")
    capsule = {"scene_ranges": [{"id": sc["id"], "narration_range": sc["narration_range"],
                                 "text": narration.encode()[sc["narration_range"][0]:sc["narration_range"][1]].decode("utf8", "ignore")}
                                for sc in intent["scenes"]]}
    print("| scene | run | schema-valid | accepted | compiled | seconds | error |\n|---|---|---|---|---|---|---|")
    for scene_id in args.scenes.split(","):
        for run in range(1, args.runs + 1):
            r = one_run(service, args.project, capsule, intent, scene_id, narration)
            print(f"| {scene_id} | {run} | {'Y' if r['schema_valid'] else 'N'} | {'Y' if r['accepted'] else 'N'} | {'Y' if r['compiled'] else 'N'} | {r['seconds']} | {r['error'] or ''} |", flush=True)


if __name__ == "__main__":
    main()
