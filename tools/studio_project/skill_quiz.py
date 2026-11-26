"""Measure whether an agent holding a skill digest answers Phase 2 concept questions the way the plugin's contracts require.

    python -m tools.studio_project.skill_quiz --projects-root <dir> --project <id> --runs 3 [--skill-dir <dir>]

Options are shuffled per run (the key is always B in the file) so a letter bias cannot score. One luna call per run.
Without --skill-dir the agent sees only the questions (baseline); with it, the skill digest is added as `context`.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from .authoring_spike import wait
from .service import StudioProjectService

QUIZ = Path(__file__).resolve().parents[2] / "plugins/zodiac-video-pipeline/skills/zodiac-studio-visual-production/tests/quiz.json"


def shuffled(questions: list[dict], seed: int) -> tuple[list[dict], dict[str, str]]:
    rng, rows, key = random.Random(seed), [], {}
    for q in questions:
        letters = sorted(q["options"])
        texts = [q["options"][k] for k in letters]
        order = list(range(len(texts)))
        rng.shuffle(order)
        rows.append({"id": q["id"], "q": q["q"], "options": {letters[i]: texts[order[i]] for i in range(len(letters))}})
        key[q["id"]] = letters[order.index(letters.index(q["answer"]))]
    return rows, key


def schema(questions: list[dict]) -> dict:
    return {"type": "object", "additionalProperties": False, "required": [q["id"] for q in questions],
            "properties": {q["id"]: {"type": "string", "enum": sorted(q["options"])} for q in questions}}


def read_skill(folder: Path) -> str:
    parts = [(folder / "SKILL.md").read_text("utf8")]
    parts += [p.read_text("utf8") for p in sorted((folder / "references").glob("*.md"))] if (folder / "references").is_dir() else []
    return "\n\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects-root", type=Path, required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--skill-dir", type=Path)
    args = parser.parse_args()
    questions = json.loads(QUIZ.read_text("utf8"))["questions"]
    context = read_skill(args.skill_dir) if args.skill_dir else None
    service = StudioProjectService(args.projects_root)
    total, misses = 0, {}
    for run in range(args.runs):
        rows, key = shuffled(questions, run)
        data = {"task": "Answer each question with the single option letter the Zodiac Phase 2 contracts require.", "questions": rows}
        if context:
            data["skill"] = context
        task = wait(service, service.agent.start_choice(args.project, schema(rows), data)["task_id"], 400)
        if task["status"] != "COMPLETED":
            print(f"run {run + 1}: {task['status']} {task.get('error')}")
            continue
        given = json.loads(task["suggestion"])
        score = sum(given[q] == key[q] for q in key)
        total += score
        for q in key:
            if given[q] != key[q]:
                misses[q] = misses.get(q, 0) + 1
        print(f"run {run + 1}: {score}/{len(key)}", flush=True)
    print(f"mean {total / args.runs:.1f}/{len(questions)}; missed: {json.dumps(misses)}")


if __name__ == "__main__":
    main()
