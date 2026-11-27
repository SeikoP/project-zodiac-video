"""Frame review: a model LOOKS at rendered frames of each scene and judges them against what the scene is meant to say.

This is the one agent job that runs on the expensive `vision` role (see agent_bridge.ROLE_DEFAULTS). It never edits
anything: it returns findings, and the autopilot hands each failing scene to the cheaper repair role. A finding is
advisory evidence for the human Visual Review; nothing here approves anything.
"""
from __future__ import annotations

import json
import re

from .models import StudioError

CODES = frozenset({"FOCUS_UNCLEAR", "ACTOR_HIDDEN", "COMPOSITION_UNBALANCED", "STATIC_SCENE", "PROP_IRRELEVANT",
                   "TEXT_UNREADABLE", "STORY_MISMATCH", "OTHER"})
MAX_NOTE = 300
FRACTIONS = (0.4, 0.9)  # early enough to see the setup, late enough to see the beat land


def invalid(message: str) -> StudioError:
    return StudioError("AGENT_REVIEW_INVALID", message, "agent")


def plan_times(build: dict, fractions=FRACTIONS) -> dict[str, list[float]]:
    """Episode-timeline seconds to photograph for each built scene."""
    times: dict[str, list[float]] = {}
    for scene in build.get("scenes", []):
        start, end = scene["start_ms"] / 1000, scene["end_ms"] / 1000
        span = max(end - start, 0.1)
        times[scene["id"]] = sorted({round(start + span * f, 2) for f in fractions})
    return times


def frame_name(seconds: float) -> str:
    """HyperFrames names a kept still at-<seconds>s.png with no trailing zeros."""
    return "at-" + (f"{seconds:.6f}".rstrip("0").rstrip(".") or "0") + "s.png"


def build_task(intent: dict, frames: dict[str, list[str]]) -> dict:
    """The data the model sees: for each scene its goal, its spoken text and the photographed frames (in order)."""
    narration_ranges = {s["id"]: s.get("narration_range") for s in intent.get("scenes", [])}
    scenes = []
    for scene in intent.get("scenes", []):
        paths = frames.get(scene["id"])
        if paths:
            scenes.append({"scene_id": scene["id"], "goal": scene.get("semantic_goal", ""),
                           "narration_range": narration_ranges.get(scene["id"]), "frames": list(paths)})
    cast = [m.get("entity_id") for m in intent.get("cast", []) if isinstance(m, dict) and m.get("entity_id")]
    return {"scenes": scenes, "cast": cast}


def image_paths(task: dict) -> list[str]:
    return [path for scene in task["scenes"] for path in scene["frames"]]


def prompt(task: dict) -> str:
    listing = [{"scene_id": s["scene_id"], "goal": s["goal"], "frame_count": len(s["frames"])} for s in task["scenes"]]
    return (
        "You review rendered frames of a short vertical cartoon video, as a strict but fair art director. "
        "Frames are attached in this order: for each scene below its frame_count images, scenes in the listed order. "
        "Judge each scene ONLY on what you can see against its goal: is the point of the beat readable at a glance, is the "
        "acting character visible and not hidden, is the composition balanced (not crammed in a corner or leaving the story "
        "empty), is the scene alive rather than a static pose, is any prop clearly relevant, is every text readable and clear "
        "of the bottom caption lane. Do not judge the story itself, the voice, or taste. "
        "Return ONLY JSON {\"scenes\":[{\"scene_id\":string,\"verdict\":\"ok\"|\"fix\",\"issues\":[{\"code\":string,\"note\":string}],"
        "\"instruction\":string}]} with exactly one entry per listed scene. Allowed codes: " + ", ".join(sorted(CODES)) + ". "
        "verdict \"fix\" needs at least one issue and an `instruction`: one short Vietnamese sentence (max 250 characters) telling a "
        "scene editor what to change in this scene only (which entity, what, why). Use verdict \"ok\" with empty issues and "
        "empty instruction when the scene works; prefer \"ok\" over nitpicking. The episode has a FIXED cast: "
        + ", ".join(task.get("cast") or []) + ". An instruction may only move, pose, turn or give actions to these characters and to library "
        "props; never ask for a new character, extra person or crowd. No markdown, no extra text. Scenes: "
        + json.dumps(listing, ensure_ascii=False)
    )


def validate(text: str, task: dict) -> str:
    """Canonical JSON of the review, or StudioError. Unknown scenes, missing scenes, bad verdicts are all rejected."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        data = json.loads(cleaned)
    except ValueError as error:
        raise invalid("Kết quả review không phải JSON.") from error
    if not isinstance(data, dict) or set(data) != {"scenes"} or not isinstance(data["scenes"], list):
        raise invalid("Kết quả review cần dạng {scenes:[...]}.")
    expected = [s["scene_id"] for s in task["scenes"]]
    got = [row.get("scene_id") if isinstance(row, dict) else None for row in data["scenes"]]
    if got != expected:
        raise invalid(f"Review phải có đúng các cảnh {expected} theo thứ tự, nhận được {got}.")
    out = []
    for row in data["scenes"]:
        verdict = row.get("verdict")
        issues = row.get("issues") or []
        instruction = str(row.get("instruction") or "").strip()
        if verdict not in ("ok", "fix") or not isinstance(issues, list) or set(row) - {"scene_id", "verdict", "issues", "instruction"}:
            raise invalid(f"{row.get('scene_id')}: verdict hoặc trường không hợp lệ.")
        clean = []
        for issue in issues[:6]:
            if not isinstance(issue, dict) or issue.get("code") not in CODES or not str(issue.get("note") or "").strip():
                raise invalid(f"{row['scene_id']}: issue cần code hợp lệ và note.")
            clean.append({"code": issue["code"], "note": str(issue["note"]).strip()[:MAX_NOTE]})
        if verdict == "fix" and (not clean or not instruction):
            raise invalid(f"{row['scene_id']}: verdict fix cần issue và instruction.")
        out.append({"scene_id": row["scene_id"], "verdict": verdict, "issues": clean if verdict == "fix" else [],
                    "instruction": instruction[:250] if verdict == "fix" else ""})
    return json.dumps({"scenes": out}, ensure_ascii=False)


def scenes_to_fix(review: dict) -> dict[str, dict]:
    return {row["scene_id"]: row for row in review["scenes"] if row["verdict"] == "fix"}
