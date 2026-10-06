#!/usr/bin/env python3
"""Pipeline step model: the resumable plan shared by the worker and the views."""

from __future__ import annotations

from dataclasses import dataclass, field

STATE_VERSION = 2

IMPORT_PACKAGE = "IMPORT_PACKAGE"
PREFLIGHT = "PREFLIGHT"
VOICE_SCENES = "VOICE_SCENES"
CONCAT_VOICE = "CONCAT_VOICE"
ALIGN_TIMING = "ALIGN_TIMING"
VALIDATE_RUNTIME = "VALIDATE_RUNTIME"
PREPARE_RENDERER = "PREPARE_RENDERER"
RENDER_VIDEO = "RENDER_VIDEO"
MIX_MUSIC = "MIX_MUSIC"

STEP_ORDER = (
    IMPORT_PACKAGE,
    PREFLIGHT,
    VOICE_SCENES,
    CONCAT_VOICE,
    ALIGN_TIMING,
    VALIDATE_RUNTIME,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    MIX_MUSIC,
)

PENDING = "PENDING"
RUNNING = "RUNNING"
DONE = "DONE"
FAILED = "FAILED"
SKIPPED = "SKIPPED"
CANCELLED = "CANCELLED"

RESUMABLE_STATUSES = (FAILED, CANCELLED, RUNNING, PENDING)

# Only these steps are re-run when an earlier step is re-executed.
DOWNSTREAM = {
    IMPORT_PACKAGE: STEP_ORDER[1:],
    PREFLIGHT: STEP_ORDER[2:],
    VOICE_SCENES: STEP_ORDER[3:],
    CONCAT_VOICE: STEP_ORDER[4:],
    ALIGN_TIMING: STEP_ORDER[5:],
    VALIDATE_RUNTIME: STEP_ORDER[6:],
    PREPARE_RENDERER: STEP_ORDER[7:],
    RENDER_VIDEO: (MIX_MUSIC,),
    MIX_MUSIC: (),
}

# What each kind of creative edit invalidates. Voice and timing are expensive,
# so layout/anchor/music edits must not touch them.
CHANGE_INVALIDATES = {
    "narration": (VOICE_SCENES, CONCAT_VOICE, ALIGN_TIMING, VALIDATE_RUNTIME, PREPARE_RENDERER, RENDER_VIDEO, MIX_MUSIC),
    "voice": (VOICE_SCENES, CONCAT_VOICE, ALIGN_TIMING, VALIDATE_RUNTIME, PREPARE_RENDERER, RENDER_VIDEO, MIX_MUSIC),
    "anchor": (PREPARE_RENDERER, RENDER_VIDEO, MIX_MUSIC),
    "transform": (PREPARE_RENDERER, RENDER_VIDEO, MIX_MUSIC),
    "music": (MIX_MUSIC),
}


@dataclass
class StepState:
    step: str
    name: str = ""
    status: str = PENDING
    progress: float = 0.0
    error_code: str | None = None
    message: str | None = None
    details: str | None = None
    fingerprint: str | None = None
    scenes: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        payload = {
            "status": self.status,
            "progress": round(float(self.progress), 4),
            "fingerprint": self.fingerprint,
        }
        for key in ("error_code", "message", "details"):
            value = getattr(self, key)
            if value:
                payload[key] = value
        if self.scenes:
            payload["scenes"] = self.scenes
        return payload


class PipelinePlan:
    """Ordered step states plus the dependency rules used to resume."""

    def __init__(self, job: str, fingerprint: str | None = None) -> None:
        self.job = job
        self.fingerprint = fingerprint
        self.steps: dict[str, StepState] = {
            step: StepState(step=step, name=step) for step in STEP_ORDER
        }

    # ---- queries -----------------------------------------------------
    def status(self, step: str) -> str:
        return self.steps[step].status

    def scene_status(self, step: str, scene_id: str) -> str:
        return (self.steps[step].scenes.get(scene_id) or {}).get("status", PENDING)

    def scenes_pending(self, step: str) -> bool:
        """A per-scene step is only finished when every scene checkpoint is."""
        scenes = self.steps[step].scenes
        return any(entry.get("status") != DONE for entry in scenes.values())

    def is_finished(self, step: str) -> bool:
        return self.status(step) == DONE and not self.scenes_pending(step)

    def next_step(self) -> str | None:
        """First step that is not finished: used by 'Chạy toàn bộ'."""
        for step in STEP_ORDER:
            if not self.is_finished(step):
                return step
        return None

    def continue_from(self) -> str | None:
        """First step that still has work: failed/cancelled first, then pending.

        A SKIPPED step is settled work, not pending work, so a finished run with
        no background music has nothing left to resume. Adding music reopens the
        step through apply_change("music").
        """
        for step in STEP_ORDER:
            status = self.status(step)
            if status in (FAILED, CANCELLED):
                return step
        for step in STEP_ORDER:
            if self.status(step) != SKIPPED and not self.is_finished(step):
                return step
        return None

    @property
    def can_resume(self) -> bool:
        return self.continue_from() is not None

    @property
    def finished(self) -> bool:
        return self.next_step() is None

    # ---- mutations ---------------------------------------------------
    def mark(
        self,
        step: str,
        status: str,
        *,
        progress: float = 0.0,
        error_code: str | None = None,
        message: str | None = None,
        details: str | None = None,
        fingerprint: str | None = None,
    ) -> StepState:
        state = self.steps[step]
        state.status = status
        state.progress = progress if status == RUNNING else (1.0 if status == DONE else state.progress)
        state.error_code = error_code
        state.message = message
        state.details = details
        if fingerprint is not None:
            state.fingerprint = fingerprint
        return state

    def set_scene_state(self, step: str, scene_id: str, status: str, **fields) -> None:
        entry = dict(self.steps[step].scenes.get(scene_id) or {})
        entry.update(fields)
        entry["status"] = status
        self.steps[step].scenes[scene_id] = entry

    def invalidate_from(self, step: str, *, drop_scene_checkpoints: bool = False) -> None:
        """Reset one step and everything that depends on it.

        ``drop_scene_checkpoints`` is for an explicit 'Chạy lại bước': the user
        asked for that step to really run again, so per-scene reuse must not
        short-circuit it. A plain resume keeps the checkpoints.
        """
        for target in (step, *DOWNSTREAM.get(step, ())):
            self.mark(target, PENDING)
            if target == VOICE_SCENES and drop_scene_checkpoints:
                self.steps[target].scenes = {}

    def complete_step(self, step: str) -> None:
        """Mark a step finished; finished downstream steps must be redone."""
        for target in DOWNSTREAM.get(step, ()):
            if self.status(target) == DONE:
                self.mark(target, PENDING)
        self.mark(step, DONE)

    def apply_change(self, change: str, *, changed_scenes: list[str] | None = None) -> None:
        """Invalidate exactly the steps affected by a creative edit."""
        targets = CHANGE_INVALIDATES.get(change)
        if targets is None:
            raise ValueError(f"unknown change kind: {change!r}")

        if change == "narration" and changed_scenes and self.status(VOICE_SCENES) == DONE:
            for scene_id in changed_scenes:
                self.set_scene_state(VOICE_SCENES, scene_id, PENDING)
            return
        for target in targets:
            self.mark(target, PENDING)

    # ---- persistence -------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "version": STATE_VERSION,
            "job": self.job,
            "package_fingerprint": self.fingerprint,
            "steps": {step: self.steps[step].to_dict() for step in STEP_ORDER},
        }

    def load_payload(self, payload: dict) -> None:
        self.job = payload.get("job", self.job)
        self.fingerprint = payload.get("package_fingerprint", self.fingerprint)
        for step, entry in (payload.get("steps") or {}).items():
            state = self.steps.get(step)
            if state is None or not isinstance(entry, dict):
                continue
            state.status = entry.get("status", PENDING)
            state.progress = float(entry.get("progress") or 0.0)
            state.error_code = entry.get("error_code")
            state.message = entry.get("message")
            state.details = entry.get("details")
            state.fingerprint = entry.get("fingerprint")
            state.scenes = dict(entry.get("scenes") or {})