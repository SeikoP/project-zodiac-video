"""Stable runner exception types shared by current and compatibility entrypoints."""

from __future__ import annotations


class PipelineError(Exception):
    """A package, runtime, or local-tool prerequisite is invalid."""


class AlignmentMismatchError(PipelineError):
    """ASR differs from approved narration, with coverage metadata for retry policy."""

    def __init__(
        self,
        message: str,
        *,
        expected: list[str],
        heard: list[str],
        coverage_gap: bool,
    ) -> None:
        super().__init__(message)
        self.expected = expected
        self.heard = heard
        self.coverage_gap = bool(coverage_gap)


class InvalidAlignmentTimestampError(PipelineError):
    """ASR returned word timing that cannot safely be repaired from neighbors."""
