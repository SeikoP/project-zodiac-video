from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

_ALLOWED_STAGES = {"PACKAGE", "VOICE", "TIMING", "PLAN", "RENDER", "AUDIO", "OUTPUT"}


@dataclass
class ControlPlaneError(Exception):
    code: str
    stage: str
    message: str
    scene_id: str | None = None
    event_id: str | None = None
    target: str | None = None
    detail: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.stage not in _ALLOWED_STAGES:
            raise ValueError(f"invalid control-plane stage: {self.stage!r}")
        if not self.code or not isinstance(self.code, str):
            raise ValueError("error code must be a non-empty string")
        if not self.message or not isinstance(self.message, str):
            raise ValueError("error message must be a non-empty string")
        Exception.__init__(self, self.message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": False,
            "code": self.code,
            "stage": self.stage,
            "message": self.message,
            "scene_id": self.scene_id,
            "event_id": self.event_id,
            "target": self.target,
            "detail": dict(self.detail),
        }


def error_result(error: ControlPlaneError) -> dict[str, Any]:
    return error.to_dict()
