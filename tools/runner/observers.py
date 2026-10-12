"""Observer composition for current Job@5 execution."""

from __future__ import annotations

from contextlib import ExitStack, contextmanager


@contextmanager
def current_runner_observers(observers):
    """Bind optional process/native/unit/frame observers without GUI branching."""
    with ExitStack() as stack:
        if observers.subprocess is not None:
            from tools.runner.process import observe_subprocess_output
            stack.enter_context(observe_subprocess_output(observers.subprocess))
        if observers.native is not None:
            from tools.studio_v2.runner import observe_structured_command_output
            stack.enter_context(observe_structured_command_output(observers.native))
        if observers.unit is not None or observers.frame is not None:
            from tools.studio_v2.progress import observe_frame_progress, observe_unit_progress
            if observers.unit is not None:
                stack.enter_context(observe_unit_progress(observers.unit))
            if observers.frame is not None:
                stack.enter_context(observe_frame_progress(observers.frame))
        yield
