"""Generation probe: for every scene of a project, ask the agent for the scene's setting (a scene accent declaration)
with and without the skill, and print the answers to read. Scores only what a machine can see: use vs omit, and abstract wording.

    python -m tools.studio_project.skill_accent_probe --projects-root <dir> --project <id> --runs 2 [--skill-dir <dir>]
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from . import authoring_menus
from .authoring_spike import wait
from .service import StudioProjectService
from .skill_quiz import read_skill

FOREGROUND = re.compile(r"(điện thoại|phone|tin nhắn|message|chat|màn hình|screen|thư mục|folder)", re.I)
ABSTRACT = re.compile(r"\b(mood|icon|badge|symbol|battery|meter|emotion|feeling|concept|metaphor|vibe|idea|theme)\b", re.I)


def schema(scene_ids: list[str], anchors: dict[str, list[str]]) -> dict:
    row = lambda sid: {"type": "object", "additionalProperties": False, "required": ["use", "setting", "visible_detail", "anchor_id", "reason"],
                       "properties": {"use": {"type": "string", "enum": ["use", "omit"]}, "setting": {"type": "string", "maxLength": 80},
                                      "visible_detail": {"type": "string", "maxLength": 140}, "anchor_id": {"type": "string", "enum": anchors[sid] or ["none"]},
                                      "reason": {"type": "string", "maxLength": 140}}}
    return {"type": "object", "additionalProperties": False, "required": scene_ids, "properties": {s: row(s) for s in scene_ids}}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects-root", type=Path, required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--runs", type=int, default=2)
    parser.add_argument("--skill-dir", type=Path)
    args = parser.parse_args()
    service = StudioProjectService(args.projects_root)
    ws = service.visual._handle(args.project).workspace
    intent = json.loads((ws / ".authoring/visual-intent.json").read_text("utf8"))
    narration = (ws / "narration.txt").read_bytes().decode("utf8")
    rows = [{"id": s["id"], "narration_range": s["narration_range"],
             "text": narration.encode()[s["narration_range"][0]:s["narration_range"][1]].decode("utf8", "ignore")} for s in intent["scenes"]]
    capsule = {"scene_ranges": rows}
    anchors = {r["id"]: [a["id"] for a in authoring_menus.scene_menus(capsule, intent, r["id"], [])["anchors"]] for r in rows}
    texts = {r["id"]: r["text"] for r in rows}
    context = read_skill(args.skill_dir) if args.skill_dir else None
    for run in range(args.runs):
        data = {"task": "For each scene, decide its setting cue (the visible place behind the actors) for a Zodiac Phase 2 episode: use or omit, the setting, the visible detail drawn, and the exact anchor_id it is bound to.",
                "scenes": [{"id": r["id"], "text": r["text"], "anchors": [{"id": a["id"], "text": a["text"]} for a in authoring_menus.scene_menus(capsule, intent, r["id"], [])["anchors"]]} for r in rows]}
        if context:
            data["skill"] = context
        task = wait(service, service.agent.start_choice(args.project, schema(list(texts), anchors), data)["task_id"], 400)
        if task["status"] != "COMPLETED":
            print(f"run {run + 1}: {task['status']} {task.get('error')}")
            continue
        got = json.loads(task["suggestion"])
        used = sum(v["use"] == "use" for v in got.values())
        abstract = [s for s, v in got.items() if ABSTRACT.search(v["setting"] + " " + v["visible_detail"])]
        foreground = [s for s, v in got.items() if v["use"] == "use" and FOREGROUND.search(v["visible_detail"])]
        print(f"run {run + 1}: use {used}/{len(got)}, abstract wording in {abstract or 'none'}, story content passed off as setting in {foreground or 'none'}")
        for sid, v in got.items():
            print(f"  {sid} [{v['use']}] {v['setting']} | {v['visible_detail']} | {v['reason']}")


if __name__ == "__main__":
    main()
