"""Typed agent proposals: validate, then apply through canonical commands only.

The model never writes files. A proposal is data; applying it either issues an existing
revisioned VisualWorkspace command or stores a source-bound technical receipt. Nothing here
can create or imply a human approval (content, voice listening, visual review).
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Literal

from ..models import StudioError
from .derive import PipelineEvidence
from .evidence import collect_evidence
from .receipts import write_receipt
from .validators import Issue

ProposalKind = Literal["visual.intent", "assets.select", "cover.design", "publish.copy", "inspect.report"]
KINDS = ("visual.intent", "assets.select", "cover.design", "publish.copy", "inspect.report")
VISUAL_COMMANDS = ("source.replace", "scene.patch", "scene.performance")
FORBIDDEN_KEYS = frozenset({"receipt", "receipts", "approved", "approval", "approvals", "listened", "gate_receipt"})
MODES = ("autopilot", "confirm")
DEFAULT_MODE = "confirm"
_MODE_FILE = Path(".runtime/pipeline/mode.json")


def _issue(code: str, message: str, *, scene_id: str | None = None, owner: str = "visual-intent") -> Issue:
    return Issue(code, owner, scene_id, message, owner + (":" + scene_id if scene_id else ""))


def _forbidden_keys(value: Any, depth: int = 0) -> bool:
    if depth > 40:
        return True
    if isinstance(value, dict):
        return any(k in FORBIDDEN_KEYS or _forbidden_keys(v, depth + 1) for k, v in value.items())
    if isinstance(value, list):
        return any(_forbidden_keys(v, depth + 1) for v in value)
    return False


def _scene_known(scene_id: Any, evidence: PipelineEvidence) -> bool:
    return isinstance(scene_id, str) and scene_id in evidence.scene_ids


def _intent_issues(intent: Any) -> list[Issue]:
    if not isinstance(intent, dict) or not isinstance(intent.get("scenes"), list):
        return [_issue("PROPOSAL_PAYLOAD_INVALID", "source.replace needs an intent with scenes")]
    assets = intent.get("assets") if isinstance(intent.get("assets"), dict) else {}
    issues: list[Issue] = []
    # A character's state "asset" names one of its cast states (neutral, reaction...), not an entry of `assets`.
    cast_states = {m.get("entity_id"): set((m.get("states") or {})) for m in (intent.get("cast") or []) if isinstance(m, dict)}
    for scene in intent["scenes"]:
        sid = scene.get("id") if isinstance(scene, dict) else None
        for entity in (scene.get("entities", []) if isinstance(scene, dict) else []):
            for state in (entity.get("states") or {}).values():
                ref = state.get("asset") if isinstance(state, dict) else None
                if ref is None:
                    continue
                if entity.get("kind") == "character" and ref in cast_states.get(entity.get("id"), ()):
                    continue
                if ref not in assets:
                    issues.append(_issue("PROPOSAL_ASSET_DANGLING", f"entity {entity.get('id')} uses unknown asset {ref}", scene_id=sid))
                    continue
                asset = assets[ref]
                if entity.get("kind") == "story_visual" or asset.get("category") == "story_visual":
                    origin = (asset.get("creative_origin") or {}).get("phase1_visual_id") or asset.get("phase1_visual_id")
                    if not origin:
                        issues.append(_issue("PROPOSAL_STORY_VISUAL_REFERENCE_MISSING",
                                             f"story visual {ref} has no approved Phase 1 reference", scene_id=sid))
    return issues


def validate_proposal(kind: str, payload: Any, evidence: PipelineEvidence, *, base_revision: int | None = None) -> tuple[Issue, ...]:
    if kind not in KINDS:
        return (_issue("PROPOSAL_KIND_UNKNOWN", f"unsupported proposal kind {kind!r}", owner="studio"),)
    if not isinstance(payload, dict):
        return (_issue("PROPOSAL_PAYLOAD_INVALID", "proposal payload must be an object", owner="studio"),)
    issues: list[Issue] = []
    if _forbidden_keys(payload):
        return (_issue("PROPOSAL_APPROVAL_FORBIDDEN", "proposals cannot carry receipt/approval/listened fields", owner="studio"),)
    if base_revision is not None and base_revision != evidence.visual_revision:
        issues.append(_issue("PROPOSAL_REVISION_STALE", f"base revision {base_revision} != current {evidence.visual_revision}", owner="studio"))
    if kind == "visual.intent":
        command, body = payload.get("command"), payload.get("payload")
        if set(payload) != {"command", "payload"} or command not in VISUAL_COMMANDS or not isinstance(body, dict):
            issues.append(_issue("PROPOSAL_PAYLOAD_INVALID", "visual.intent needs {command, payload}"))
        elif command == "source.replace":
            issues.extend(_intent_issues(body.get("intent")))
        elif not _scene_known(body.get("scene_id"), evidence):
            issues.append(_issue("PROPOSAL_SCENE_UNKNOWN", "scene is not authored", scene_id=str(body.get("scene_id"))))
    elif kind == "assets.select":
        if set(payload) != {"scene_id", "candidate_id", "requirement"}:
            issues.append(_issue("PROPOSAL_PAYLOAD_INVALID", "assets.select needs scene_id, candidate_id, requirement"))
        elif not _scene_known(payload["scene_id"], evidence):
            issues.append(_issue("PROPOSAL_SCENE_UNKNOWN", "scene is not authored", scene_id=str(payload["scene_id"])))
    elif kind == "cover.design":
        head = payload.get("headline")
        if set(payload) != {"headline", "scene_id"} or not isinstance(head, str) or not 1 <= len(head) <= 80:
            issues.append(_issue("PROPOSAL_PAYLOAD_INVALID", "cover.design needs headline (1-80 chars) and scene_id"))
        elif not _scene_known(payload["scene_id"], evidence):
            issues.append(_issue("PROPOSAL_SCENE_UNKNOWN", "cover scene is not authored", scene_id=str(payload["scene_id"])))
    elif kind == "publish.copy":
        tags = payload.get("hashtags")
        extra = {"alt_hooks", "cover_hook", "search_keyword"}
        ok = ({"title", "description", "hashtags"} <= set(payload) <= {"title", "description", "hashtags"} | extra and isinstance(payload["title"], str) and 1 <= len(payload["title"]) <= 100
              and isinstance(payload["description"], str) and len(payload["description"]) <= 2200
              and isinstance(tags, list) and len(tags) <= 30 and all(isinstance(t, str) and t for t in tags)
              and all(isinstance(payload.get(k, ""), str) for k in ("cover_hook", "search_keyword"))
              and isinstance(payload.get("alt_hooks", []), list) and all(isinstance(h, str) for h in payload.get("alt_hooks", [])))
        if not ok:
            issues.append(_issue("PROPOSAL_PAYLOAD_INVALID", "publish.copy needs title<=100, description<=2200, hashtags<=30"))
    elif kind == "inspect.report":
        findings = payload.get("findings")
        ok = (set(payload) == {"build_id", "method", "findings"} and isinstance(payload["build_id"], str) and payload["build_id"]
              and payload["method"] in ("structural", "visual") and isinstance(findings, list) and len(findings) <= 200
              and all(isinstance(f, dict) and set(f) == {"scene_id", "severity", "note"} and f["severity"] in ("ok", "warn", "fail")
                      and isinstance(f["note"], str) and len(f["note"]) <= 500 for f in findings))
        if not ok:
            issues.append(_issue("PROPOSAL_PAYLOAD_INVALID", "inspect.report needs build_id, method, findings[{scene_id,severity,note}]"))
    return tuple(issues)


def _issues_dict(issues: tuple[Issue, ...]) -> list[dict]:
    return [i.to_dict() for i in issues]


def _guarded_base(kind: str, base_revision: int) -> int | None:
    """Command kinds are idempotent and revision-checked by the canonical command itself (a replay after
    success must not be rejected as stale); receipt kinds have no such command, so check here."""
    return None if kind in ("visual.intent", "assets.select") else base_revision


def apply_proposal(service, project_id: str, kind: str, payload: dict, base_revision: int, command_id: str, *,
                   voice_dependencies: str | None = None) -> dict:
    """Validate against fresh evidence, then map to an existing command or a source-bound receipt."""
    evidence = collect_evidence(service, project_id)
    issues = validate_proposal(kind, payload, evidence, base_revision=_guarded_base(kind, base_revision))
    if issues:
        raise StudioError("PROPOSAL_INVALID", json.dumps(_issues_dict(issues), ensure_ascii=False)[:1500], "pipeline")
    workspace = Path(service.registry.get(project_id).workspace)
    if kind == "visual.intent":
        return service.visual.command(project_id, command_id, base_revision, payload["command"], payload["payload"],
                                      voice_dependencies=voice_dependencies)
    if kind == "assets.select":
        return service.visual.command(project_id, command_id, base_revision, "asset.select", payload)
    source_hash = evidence.visual_source_hash
    if kind == "inspect.report":
        write_receipt(workspace, "inspect", source_hash=source_hash, build_id=payload["build_id"], payload=payload)
    else:  # cover.design / publish.copy: Studio has no plugin-canonical writer yet; staged, shown at Visual Review.
        write_receipt(workspace, "cover" if kind == "cover.design" else "publish", source_hash=source_hash, payload=payload)
    return {"applied": True, "kind": kind, "source_changed": False}


def submit_proposal(service, project_id: str, kind: str, payload: dict, base_revision: int, command_id: str, *,
                    confirmed: bool = False, voice_dependencies: str | None = None) -> dict:
    """Autopilot applies validated proposals; confirm mode waits for the click (confirmed=True)."""
    evidence = collect_evidence(service, project_id)
    issues = validate_proposal(kind, payload, evidence, base_revision=_guarded_base(kind, base_revision))
    if issues:
        return {"applied": False, "waiting": False, "issues": _issues_dict(issues)}
    workspace = Path(service.registry.get(project_id).workspace)
    if get_mode(workspace) == "confirm" and not confirmed:
        return {"applied": False, "waiting": True, "issues": []}
    try:
        result = apply_proposal(service, project_id, kind, payload, base_revision, command_id, voice_dependencies=voice_dependencies)
    except StudioError as error:
        if error.code != "REVISION_CONFLICT":
            raise
        stale = _issue("PROPOSAL_REVISION_STALE", "source changed since the proposal was made", owner="studio")
        return {"applied": False, "waiting": False, "issues": _issues_dict((stale,))}
    return {"applied": True, "waiting": False, "issues": [], "result": result}


def get_mode(workspace: Path) -> str:
    try:
        mode = json.loads((Path(workspace) / _MODE_FILE).read_text(encoding="utf-8")).get("mode")
    except (OSError, ValueError, AttributeError):
        return DEFAULT_MODE
    return mode if mode in MODES else DEFAULT_MODE


def set_mode(workspace: Path, mode: str) -> str:
    if mode not in MODES:
        raise StudioError("PIPELINE_MODE_INVALID", "mode must be autopilot or confirm", "pipeline")
    path = Path(workspace) / _MODE_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".mode.", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as writer:
        json.dump({"mode": mode}, writer)
    os.replace(tmp, path)
    return mode
