from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

PACKAGE = "PACKAGE"
VOICE = "VOICE"
TIMING = "TIMING"
PLAN = "PLAN"
RENDER = "RENDER"
AUDIO = "AUDIO"
OUTPUT = "OUTPUT"

STEP_ORDER = (PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT)

PENDING = "PENDING"
RUNNING = "RUNNING"
DONE = "DONE"
FAILED = "FAILED"

_INVALIDATES = {
    "package": STEP_ORDER,
    "narration": (VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT),
    "voice": (VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT),
    "timing": (TIMING, PLAN, RENDER, AUDIO, OUTPUT),
    "visual": (PLAN, RENDER, AUDIO, OUTPUT),
    "renderer": (RENDER, AUDIO, OUTPUT),
    "music": (AUDIO, OUTPUT),
}


@dataclass
class PackageRevision:
    display_name: str | None = None
    package_hash: str | None = None
    package_version: str | None = None


@dataclass
class StepStateV2:
    name: str
    status: str = PENDING
    input_hash: str | None = None
    output_hash: str | None = None
    reused: bool = False
    cache_reason: str | None = None
    error: dict[str, Any] | None = None

    def reset(self) -> None:
        self.status = PENDING
        self.input_hash = None
        self.output_hash = None
        self.reused = False
        self.cache_reason = None
        self.error = None


@dataclass
class PipelineStateV2:
    workspace_id: str
    package: PackageRevision = field(default_factory=PackageRevision)
    steps: dict[str, StepStateV2] = field(
        default_factory=lambda: {name: StepStateV2(name=name) for name in STEP_ORDER}
    )

    def mark_done(
        self,
        step: str,
        *,
        input_hash: str,
        output_hash: str,
        reused: bool,
        cache_reason: str | None = None,
    ) -> None:
        state = self.steps[step]
        state.status = DONE
        state.input_hash = input_hash
        state.output_hash = output_hash
        state.reused = bool(reused)
        state.cache_reason = cache_reason
        state.error = None

    def mark_failed(self, step: str, *, error: dict[str, Any]) -> None:
        state = self.steps[step]
        state.status = FAILED
        state.error = dict(error)
        state.reused = False
        state.cache_reason = None

    def invalidate_for(self, change: str) -> None:
        try:
            targets = _INVALIDATES[change]
        except KeyError as exc:
            raise ValueError(f"unknown Studio v2 change kind: {change}") from exc
        for step in targets:
            self.steps[step].reset()

    def reuse_if_input_matches(self, step: str, input_hash: str) -> bool:
        state = self.steps[step]
        if (
            state.status == DONE
            and state.input_hash == input_hash
            and state.output_hash is not None
        ):
            state.reused = True
            state.error = None
            return True

        start = STEP_ORDER.index(step)
        for target in STEP_ORDER[start:]:
            self.steps[target].reset()
        return False

    def set_package_revision(
        self,
        *,
        display_name: str,
        package_hash: str,
        package_version: str,
    ) -> None:
        self.package = PackageRevision(
            display_name=display_name,
            package_hash=package_hash,
            package_version=package_version,
        )
