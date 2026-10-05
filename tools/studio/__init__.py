"""Zodiac Studio: Vietnamese GUI, background worker, resumable pipeline."""

from tools.studio.messages_vi import APP_TITLE
from tools.studio.pipeline import STEP_ORDER, PipelinePlan

__all__ = ["APP_TITLE", "STEP_ORDER", "PipelinePlan", "open_studio"]


def open_studio() -> "ZodiacStudioApp":  # pragma: no cover - GUI entry point
    from tools.studio.app import ZodiacStudioApp

    return ZodiacStudioApp()