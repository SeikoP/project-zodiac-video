"""Adapter: existing Project Core read APIs -> PipelineEvidence. Read-only."""
from __future__ import annotations

from typing import Mapping

from tools.studio.artifacts import canonical_hash

from ..models import StudioError
from .derive import PipelineEvidence
from .receipts import receipt_state
from .review import visual_review_status
from .validators import last_report


def _safe(call):
    try:
        return call()
    except StudioError:
        return None


def _running(visual: dict | None, voice: dict | None) -> str | None:
    job = (voice or {}).get("job") or {}
    if job.get("status") == "RUNNING":
        return "voice" if job.get("action") == "generate" else "timing"
    job = (visual or {}).get("job") or {}
    if job.get("status") == "RUNNING":
        if job.get("action") == "export":
            return "export"
        return f"scene:{job['scene_id']}" if job.get("scene_id") else "build"
    return None


def collect_evidence(service, project_id: str, *, running: str | None = None,
                     failed: Mapping[str, str] | None = None, notes: Mapping[str, str] | None = None) -> PipelineEvidence:
    """Raises PROJECT_NOT_FOUND; every other missing piece becomes absent evidence."""
    project = service.project(project_id)
    failed = dict(failed or {})
    if project["status"]["content"] != "APPROVED":
        return PipelineEvidence(content_approved=False, failed=failed)
    visual = _safe(lambda: service.visual.snapshot(project_id))
    voice = _safe(lambda: service.voice.snapshot(project_id))
    workspace = service.registry.get(project_id).workspace

    units = (voice or {}).get("units") or []
    selected = sum(1 for u in units if u.get("selected_take") and
                   any(t.get("take_id") == u["selected_take"] and t.get("valid") is not False for t in u.get("takes", [])))
    assembly = (voice or {}).get("assembly")
    timing = (voice or {}).get("timing")
    intent = (visual or {}).get("intent")
    build = (visual or {}).get("build")
    source_hash = (visual or {}).get("source_hash")
    build_id = build.get("id") if build else None
    video = project["status"]["video"]
    checks_state = receipt_state(workspace, "checks", source_hash)
    voice_job = (voice or {}).get("job") or {}
    report = last_report(workspace) if intent else None
    check_notes = len(report.get("notes") or []) if report and checks_state == "OK" and report.get("source_hash") == source_hash else 0
    if report and checks_state != "OK" and not report.get("ok") and report.get("source_hash") == source_hash and report.get("issues"):
        # Running the checks step otherwise looks like nothing happened: say why it is still not done.
        blocking = len(report["issues"]) - len(report.get("notes") or [])
        failed.setdefault("checks", f"{blocking} vấn đề cần sửa, mở bước này để xem")
    return PipelineEvidence(
        content_approved=True,
        voice_units_total=len(units), voice_units_selected=selected, voice_assembled=bool(assembly),
        voice_listened=bool(assembly) and (assembly.get("listened") or {}).get("kind") == "user_listened",
        timing_ready=bool(timing and assembly and timing.get("wav_sha256") == assembly.get("wav_sha256")),
        has_intent=bool(intent), visual_revision=(visual or {}).get("revision") if intent else None,
        visual_source_hash=source_hash,
        scene_ids=tuple(s["id"] for s in (intent or {}).get("scenes", [])),
        built_scene_ids=frozenset(s["id"] for s in (build or {}).get("scenes", [])),
        build_revision=build.get("revision") if build else None,
        build_voice_fingerprint=build.get("voice_timing_fingerprint") if build else None,
        current_voice_fingerprint=canonical_hash(timing) if timing else None,
        checks_state=checks_state,
        assets_state=receipt_state(workspace, "assets", source_hash),
        cover_state=receipt_state(workspace, "cover", source_hash),
        publish_state=receipt_state(workspace, "publish", source_hash),
        inspect_state=receipt_state(workspace, "inspect", source_hash, build_id),
        review_state={"APPROVED": "OK", "STALE": "STALE"}.get(visual_review_status(workspace), "NONE"),
        export_state={"EXPORTED": "EXPORTED", "STALE": "STALE", "BLOCKED": "BLOCKED"}.get(video, "NONE"),
        voice_revision=(voice or {}).get("revision", 0),
        voice_job_done=int(voice_job.get("completed") or 0) if voice_job.get("status") == "RUNNING" else 0,
        voice_job_total=int(voice_job.get("total") or 0) if voice_job.get("status") == "RUNNING" else 0,
        check_notes=check_notes, running_node=running or _running(visual, voice), failed=failed, notes=dict(notes or {}))
