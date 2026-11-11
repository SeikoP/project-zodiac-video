"""Human/agent review contracts for actual TTS and final rendered video.

These reviews are evidence-bound editorial/performance checks. Deterministic
validation proves lineage and completeness; it does not infer creative quality.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

TTS_CRITERIA = (
    "pronunciation",
    "pause_and_breath",
    "pace_realization",
    "emphasis_realization",
    "internal_voice_distinction",
    "punchline_landing",
    "ending_cadence",
)
RENDERED_CRITERIA = (
    "voice_delivery_survives_mix",
    "caption_reveal_timing",
    "visual_preemption",
    "cut_and_pause_alignment",
    "attention_competition",
    "payoff_sync",
    "ending_energy_after_render",
)

def file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON_OBJECT_REQUIRED:{path}")
    return value

def _criterion_template() -> dict[str, str]:
    return {"result": "REVIEW", "observation": "", "evidence": ""}

def _spoken_plan_path(workspace: Path) -> Path:
    root_plan = workspace / "spoken-performance-plan.json"
    return root_plan if root_plan.is_file() else workspace / ".authoring" / "spoken-performance-plan.json"

def init_tts_review(workspace: Path) -> dict[str, Any]:
    runtime = workspace / ".runtime"
    voice = workspace / "voice.wav"
    timing = runtime / "timing.json"
    plan = _spoken_plan_path(workspace)
    for label, p in (("voice", voice), ("timing", timing), ("spoken_plan", plan)):
        if not p.is_file():
            raise FileNotFoundError(f"{label.upper()}_MISSING:{p}")
    return {
        "format": "zodiac-tts-performance-review@1",
        "reviewer_role": "spoken_performance_reviewer",
        "source": {
            "voice_sha256": file_sha(voice),
            "timing_sha256": file_sha(timing),
            "spoken_performance_plan_sha256": file_sha(plan),
        },
        "criteria": {key: _criterion_template() for key in TTS_CRITERIA},
        "decision": "REVIEW",
        "revision_targets": [],
        "prosody_verified": False,
        "not_an_approval": True,
    }

def validate_tts_review(workspace: Path, review: dict[str, Any] | None = None) -> dict[str, Any]:
    runtime = workspace / ".runtime"
    voice = workspace / "voice.wav"
    timing = runtime / "timing.json"
    plan = _spoken_plan_path(workspace)
    review = review or _read_json(runtime / "tts-performance-review.json")
    if review.get("format") != "zodiac-tts-performance-review@1":
        raise ValueError("TTS_REVIEW_FORMAT")
    if review.get("reviewer_role") != "spoken_performance_reviewer":
        raise ValueError("TTS_REVIEW_ROLE")
    expected = {
        "voice_sha256": file_sha(voice),
        "timing_sha256": file_sha(timing),
        "spoken_performance_plan_sha256": file_sha(plan),
    }
    if review.get("source") != expected:
        raise ValueError("TTS_REVIEW_SOURCE_CHANGED")
    criteria = review.get("criteria")
    if not isinstance(criteria, dict) or set(criteria) != set(TTS_CRITERIA):
        raise ValueError("TTS_REVIEW_CRITERIA")
    unresolved = []
    for key in TTS_CRITERIA:
        item = criteria[key]
        if not isinstance(item, dict) or item.get("result") not in {"PASS", "REVIEW"}:
            raise ValueError("TTS_REVIEW_RESULT:" + key)
        if len(str(item.get("observation", "")).strip()) < 20:
            raise ValueError("TTS_REVIEW_OBSERVATION:" + key)
        if len(str(item.get("evidence", "")).strip()) < 5:
            raise ValueError("TTS_REVIEW_EVIDENCE:" + key)
        if item["result"] == "REVIEW":
            unresolved.append(key)
    if review.get("decision") not in {"PASS", "REVIEW"}:
        raise ValueError("TTS_REVIEW_DECISION")
    targets = review.get("revision_targets")
    if not isinstance(targets, list):
        raise ValueError("TTS_REVIEW_TARGETS")
    if review["decision"] == "PASS" and (unresolved or targets):
        raise ValueError("TTS_REVIEW_PASS_WITH_UNRESOLVED")
    if review["decision"] == "REVIEW" and not targets:
        raise ValueError("TTS_REVIEW_REVIEW_WITHOUT_TARGETS")
    if review["decision"] != "PASS":
        raise ValueError("TTS_PERFORMANCE_REVIEW_REQUIRED")
    return {**review, "prosody_verified": True}

def init_rendered_review(workspace: Path) -> dict[str, Any]:
    runtime = workspace / ".runtime"
    video = workspace / "out" / "zodiac-story.mp4"
    timing = runtime / "timing.json"
    tts_review_path = runtime / "tts-performance-review.json"
    tts = validate_tts_review(workspace)
    for label, p in (("video", video), ("timing", timing), ("tts_review", tts_review_path)):
        if not p.is_file():
            raise FileNotFoundError(f"{label.upper()}_MISSING:{p}")
    return {
        "format": "zodiac-rendered-performance-review@1",
        "reviewer_role": "rendered_performance_reviewer",
        "source": {
            "video_sha256": file_sha(video),
            "timing_sha256": file_sha(timing),
            "tts_performance_review_sha256": file_sha(tts_review_path),
        },
        "criteria": {key: _criterion_template() for key in RENDERED_CRITERIA},
        "decision": "REVIEW",
        "revision_targets": [],
        "rendered_effect_verified": False,
        "not_an_approval": True,
    }

def validate_rendered_review(workspace: Path, review: dict[str, Any] | None = None) -> dict[str, Any]:
    runtime = workspace / ".runtime"
    video = workspace / "out" / "zodiac-story.mp4"
    timing = runtime / "timing.json"
    tts_review_path = runtime / "tts-performance-review.json"
    validate_tts_review(workspace)
    review = review or _read_json(runtime / "rendered-performance-review.json")
    if review.get("format") != "zodiac-rendered-performance-review@1":
        raise ValueError("RENDERED_REVIEW_FORMAT")
    if review.get("reviewer_role") != "rendered_performance_reviewer":
        raise ValueError("RENDERED_REVIEW_ROLE")
    expected = {
        "video_sha256": file_sha(video),
        "timing_sha256": file_sha(timing),
        "tts_performance_review_sha256": file_sha(tts_review_path),
    }
    if review.get("source") != expected:
        raise ValueError("RENDERED_REVIEW_SOURCE_CHANGED")
    criteria = review.get("criteria")
    if not isinstance(criteria, dict) or set(criteria) != set(RENDERED_CRITERIA):
        raise ValueError("RENDERED_REVIEW_CRITERIA")
    unresolved = []
    for key in RENDERED_CRITERIA:
        item = criteria[key]
        if not isinstance(item, dict) or item.get("result") not in {"PASS", "REVIEW"}:
            raise ValueError("RENDERED_REVIEW_RESULT:" + key)
        if len(str(item.get("observation", "")).strip()) < 20:
            raise ValueError("RENDERED_REVIEW_OBSERVATION:" + key)
        if len(str(item.get("evidence", "")).strip()) < 5:
            raise ValueError("RENDERED_REVIEW_EVIDENCE:" + key)
        if item["result"] == "REVIEW":
            unresolved.append(key)
    if review.get("decision") not in {"PASS", "REVIEW"}:
        raise ValueError("RENDERED_REVIEW_DECISION")
    targets = review.get("revision_targets")
    if not isinstance(targets, list):
        raise ValueError("RENDERED_REVIEW_TARGETS")
    if review["decision"] == "PASS" and (unresolved or targets):
        raise ValueError("RENDERED_REVIEW_PASS_WITH_UNRESOLVED")
    if review["decision"] == "REVIEW" and not targets:
        raise ValueError("RENDERED_REVIEW_REVIEW_WITHOUT_TARGETS")
    if review["decision"] != "PASS":
        raise ValueError("RENDERED_PERFORMANCE_REVIEW_REQUIRED")
    return {**review, "rendered_effect_verified": True}

def _write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", type=Path)
    parser.add_argument("action", choices=("init-tts", "validate-tts", "init-rendered", "validate-rendered"))
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    try:
        if args.action == "init-tts":
            out = workspace / ".runtime" / "tts-performance-review.json"
            _write(out, init_tts_review(workspace))
            print(json.dumps({"status": "REVIEW_REQUIRED", "review": str(out)}))
        elif args.action == "validate-tts":
            validate_tts_review(workspace)
            print(json.dumps({"status": "PASS", "review": str(workspace / ".runtime/tts-performance-review.json")}))
        elif args.action == "init-rendered":
            out = workspace / ".runtime" / "rendered-performance-review.json"
            _write(out, init_rendered_review(workspace))
            print(json.dumps({"status": "REVIEW_REQUIRED", "review": str(out)}))
        else:
            validate_rendered_review(workspace)
            print(json.dumps({"status": "PASS", "review": str(workspace / ".runtime/rendered-performance-review.json")}))
        return 0
    except Exception as exc:
        print(json.dumps({"status": "BLOCKED", "error": str(exc)}, ensure_ascii=False))
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
