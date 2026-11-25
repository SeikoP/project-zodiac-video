"""Public read entrypoint used by the RPC layer."""
from __future__ import annotations

from typing import Mapping

from . import agent_runs
from .derive import derive
from .evidence import collect_evidence
from .registry import Registry, load_registry

_registry: Registry | None = None


def registry() -> Registry:
    global _registry
    if _registry is None:
        _registry = load_registry()
    return _registry


def pipeline_get(service, project_id: str, *, running: str | None = None,
                 failed: Mapping[str, str] | None = None) -> dict:
    tracked_running, tracked_failed = agent_runs.overlay(service, project_id)
    evidence = collect_evidence(service, project_id, running=running or tracked_running,
                                failed={**tracked_failed, **(failed or {})}, notes=agent_runs.progress(service, project_id))
    graph = derive(registry(), evidence, project_id=project_id, revision=evidence.visual_revision or 0)
    result = graph.to_dict()
    result["revisions"] = {"visual": evidence.visual_revision or 0, "voice": evidence.voice_revision}
    from .proposals import get_mode
    workspace = service.registry.get(project_id).workspace
    result["mode"] = get_mode(workspace)
    from .autopilot import autopilot_for
    result["run"] = autopilot_for(service, project_id).record.to_dict()
    return result


def pipeline_evidence(service, project_id: str) -> dict:
    """Read-only evidence the Visual Review panel shows: what the agent produced, never an approval."""
    from .receipts import read_receipt
    from .validators import last_report
    workspace = service.registry.get(project_id).workspace
    visual = service.visual.snapshot(project_id) or {}

    def payload(name: str):
        receipt = read_receipt(workspace, name)
        return None if receipt is None else receipt.get("payload", {})

    return {"build_id": (visual.get("build") or {}).get("id"), "revision": visual.get("revision"),
            "source_hash": visual.get("source_hash"), "checks": last_report(workspace),
            "inspect": payload("inspect"), "cover": payload("cover"), "publish": payload("publish")}
