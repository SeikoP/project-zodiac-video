#!/usr/bin/env python3
"""Atomic .runtime/pipeline-state.json plus conservative recovery and migration."""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from tools.zodiac_local import PipelineError
from tools.studio.pipeline import (
    ALIGN_TIMING,
    CONCAT_VOICE,
    DONE,
    IMPORT_PACKAGE,
    PENDING,
    PipelinePlan,
    RUNNING,
    STATE_VERSION,
    STEP_ORDER,
    VOICE_SCENES,
)

STATE_FILENAME = "pipeline-state.json"


class JobStateStore:
    def __init__(self, package_root: Path) -> None:
        self.root = Path(package_root)
        self.path = self.root / ".runtime" / STATE_FILENAME

    def exists(self) -> bool:
        return self.path.is_file()

    def load(self) -> dict | None:
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict) or payload.get("version") != STATE_VERSION:
            return None
        return payload

    def save(self, plan: PipelinePlan) -> None:
        payload = plan.to_dict()
        payload["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.root.mkdir(parents=True, exist_ok=True)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        handle, temporary = tempfile.mkstemp(
            dir=str(self.path.parent), prefix=f"{STATE_FILENAME}.", suffix=".tmp"
        )
        temporary_path = Path(temporary)
        try:
            with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
                json.dump(payload, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary_path, self.path)
        except OSError:
            temporary_path.unlink(missing_ok=True)
            raise
        temporary_path.unlink(missing_ok=True)

    def recover(self, plan: PipelinePlan) -> dict:
        """An interrupted RUNNING step is never trusted as DONE."""
        for step in STEP_ORDER:
            if plan.status(step) == RUNNING:
                plan.mark(step, PENDING, message="Bị gián đoạn, cần chạy lại.")
        return plan.to_dict()

    def open(self) -> PipelinePlan:
        """Load state for a job, migrating legacy jobs that never had one."""
        payload = self.load()
        if payload is not None:
            plan = PipelinePlan(job=payload.get("job", self.root.name))
            plan.load_payload(payload)
        else:
            migrated = migrate_legacy_job(self.root)
            plan = PipelinePlan(job=self.root.name)
            plan.load_payload({"job": self.root.name, "package_fingerprint": None, "steps": migrated})

        self.recover(plan)
        verify_scene_artifacts(self.root, plan)
        return plan


def verify_scene_artifacts(package_root: Path, plan: PipelinePlan) -> PipelinePlan:
    """Verify working WAVs, restoring approved artifacts before invalidating."""
    from tools.studio.artifacts import VoiceArtifactStore
    from tools.zodiac_local import file_sha256, scene_wav_path, validate_package, validate_voice

    step = plan.steps[VOICE_SCENES]
    if not step.scenes:
        return plan
    try:
        production = {scene["id"]: scene for scene in validate_package(package_root)["scenes"]}
    except PipelineError:
        return plan

    artifacts = VoiceArtifactStore(package_root)
    for scene_id, entry in list(step.scenes.items()):
        if entry.get("status") != DONE:
            continue
        path = scene_wav_path(package_root, scene_id)
        scene = production.get(scene_id)

        valid = False
        try:
            validate_voice(path)
            valid = entry.get("file_hash") == file_sha256(path)
        except PipelineError:
            valid = False

        if not valid and entry.get("text_hash") and entry.get("voice_profile_hash"):
            restored = artifacts.restore_approved(
                scene_id,
                path,
                text_hash=entry["text_hash"],
                voice_profile_hash=entry["voice_profile_hash"],
                performance_context_hash=entry.get("performance_context_hash"),
            )
            if restored is not None:
                try:
                    validate_voice(path)
                    valid = entry.get("file_hash") == file_sha256(path)
                except PipelineError:
                    valid = False

        if scene is None or not valid:
            plan.set_scene_state(VOICE_SCENES, scene_id, PENDING)
    return plan


def migrate_legacy_job(package_root: Path) -> dict:
    """First run on an old job: trust provable artifacts, never invent provenance."""
    from tools.zodiac_local import scene_voice_files, validate_package, validate_timing, validate_voice

    root = Path(package_root)
    steps = {
        step: {"status": PENDING, "name": None} for step in STEP_ORDER
    }

    try:
        production = validate_package(root)
    except PipelineError:
        return steps
    steps[IMPORT_PACKAGE]["status"] = DONE

    runtime_valid = False
    try:
        validate_voice(root / "voice.wav")
        validate_timing(root, root / ".runtime" / "timing.json")
        runtime_valid = True
    except PipelineError:
        runtime_valid = False

    scene_files = scene_voice_files(root, production)
    if runtime_valid and all(path.is_file() for path in scene_files):
        # The artifacts exist and validate, so the voice + timing steps are known good.
        # Per-scene provenance (voice id, text hash) stays unknown on purpose.
        steps[VOICE_SCENES]["status"] = DONE
        steps[CONCAT_VOICE]["status"] = DONE
        steps[ALIGN_TIMING]["status"] = DONE
    return steps