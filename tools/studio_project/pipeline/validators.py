"""Run plugin Phase-2 validators and return structured, source-bound issues."""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence

from tools.studio.artifacts import canonical_hash

from ..models import StudioError
from .receipts import write_receipt

BRIDGE = Path(__file__).with_name("validators_bridge.mjs")
NAMES = ("progressive-preflight", "scene-experience", "authoring-completeness", "story-visual-presence")
# Missing Phase-1 input is an upstream blocker, never something the agent may invent (plugin Phase 2 rule).
UPSTREAM_CODES = frozenset({"STORY_VISUAL_DECISION", "STORY_VISUAL_DECISION_MISSING", "STORY_VISUAL_DIRECTION_MISSING",
                            "STORY_VISUAL_DIRECTION_REQUIRED"})
STUDIO_CODES = frozenset({"VALIDATOR_PREREQUISITE_MISSING", "VALIDATOR_FAILED"})
# Findings about how good a scene looks or acts: advice for the owner, never a reason to refuse to build. Anything else a
# validator reports (a missing profile, a broken contract, missing Phase 1 input) is structural and still blocks.
QUALITY_CODES = frozenset({
    "ENVIRONMENT_VISUAL_UNDERDEVELOPED", "FRAME_OCCUPANCY_LOW", "PASSIVE_ACCENT_ONLY", "PASSIVE_STORYTELLING",
    "VISUAL_DEPTH_UNDERDEVELOPED", "SCENE_EXPERIENCE_CRITERION_REVIEW", "STORY_FOCUS_GOAL_MISMATCH", "STORY_FOCUS_DISCONNECTED",
})
LAST_REPORT = Path(".runtime/pipeline/last-validation.json")


@dataclass(frozen=True)
class Issue:
    code: str
    owner: str  # phase1 | studio | visual-intent
    scene_id: str | None
    message: str
    repair_group: str

    def to_dict(self) -> dict:
        return {"code": self.code, "owner": self.owner, "scene_id": self.scene_id,
                "message": self.message, "repair_group": self.repair_group}


@dataclass(frozen=True)
class ValidationReport:
    ok: bool
    issues: tuple[Issue, ...]
    receipt_sha256: str

    @property
    def notes(self) -> tuple[Issue, ...]:
        """The quality findings among the issues: carried along, not blocking."""
        return tuple(i for i in self.issues if i.code in QUALITY_CODES)

    def to_dict(self) -> dict:
        return {"ok": self.ok, "issues": [i.to_dict() for i in self.issues], "notes": [i.to_dict() for i in self.notes],
                "receipt_sha256": self.receipt_sha256}


Runner = Callable[[Path, Sequence[str]], list[dict]]


def node_runner(workspace: Path, names: Sequence[str]) -> list[dict]:
    """Default runner: Node subprocess, argv only, no shell."""
    try:
        done = subprocess.run(["node", str(BRIDGE), str(workspace), ",".join(names)], stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, timeout=120, check=False, shell=False)
        if done.returncode != 0:
            raise StudioError("VALIDATOR_BRIDGE_FAILED", done.stderr.decode("utf-8", "replace")[:300], "pipeline")
        return json.loads(done.stdout.decode("utf-8"))["results"]
    except (OSError, subprocess.TimeoutExpired, ValueError, KeyError) as exc:
        raise StudioError("VALIDATOR_BRIDGE_FAILED", str(exc)[:300], "pipeline") from exc


def _issue(raw: dict) -> Issue:
    code = str(raw.get("code") or "UNKNOWN")
    owner = "phase1" if code in UPSTREAM_CODES else "studio" if code in STUDIO_CODES else "visual-intent"
    scene = raw.get("scene_id") if isinstance(raw.get("scene_id"), str) else None
    extra = {k: v for k, v in raw.items() if k not in ("code", "scene_id")}
    message = str(raw.get("message") or (json.dumps(extra, ensure_ascii=False)[:300] if extra else code))
    return Issue(code, owner, scene, message, owner + (":" + scene if scene else ""))


def run_validators(service, project_id: str, names: Sequence[str], *, runner: Runner | None = None) -> ValidationReport:
    names = tuple(dict.fromkeys(names))
    unknown = [n for n in names if n not in NAMES]
    if not names or unknown:
        raise StudioError("VALIDATOR_UNKNOWN", ",".join(unknown) or "no validator requested", "pipeline")
    workspace = service.registry.get(project_id).workspace
    source_hash = (service.visual.snapshot(project_id) or {}).get("source_hash")
    results = (runner or node_runner)(workspace, names)
    issues: list[Issue] = []
    ok = len(results) == len(names)
    for result in results:
        found = [_issue(i) for i in result.get("issues", [])]
        quality_only = bool(found) and all(i.code in QUALITY_CODES for i in found)
        if result.get("status") not in ("PASS", "SKIPPED") and not quality_only:  # REVIEW also blocks, unless it is only advice
            ok = False
        issues.extend(found)
    receipt = canonical_hash({"names": sorted(names), "source_hash": source_hash, "results": results})
    return ValidationReport(ok and all(i.code in QUALITY_CODES for i in issues), tuple(issues), receipt)


def checks_executor(names: Sequence[str]):
    """Executor for the `checks` node: records the last report; a receipt only when everything passes."""
    def execute(ctx):
        report = run_validators(ctx.service, ctx.project_id, names)
        workspace = ctx.service.registry.get(ctx.project_id).workspace
        target = Path(workspace) / LAST_REPORT
        target.parent.mkdir(parents=True, exist_ok=True)
        source_hash = ctx.service.visual.snapshot(ctx.project_id)["source_hash"]
        target.write_text(json.dumps({**report.to_dict(), "source_hash": source_hash}, ensure_ascii=False), encoding="utf-8")
        if report.ok:
            write_receipt(workspace, "checks", source_hash=source_hash, payload={"receipt_sha256": report.receipt_sha256})
        return report.to_dict()
    return execute


def last_report(workspace: Path) -> dict | None:
    try:
        return json.loads((Path(workspace) / LAST_REPORT).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
