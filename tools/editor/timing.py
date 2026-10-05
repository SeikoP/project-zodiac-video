#!/usr/bin/env python3
"""Read-only view of .runtime/timing.json plus canonical voice-anchor resolution.

This module never writes timing. production.json keeps semantic anchors; the
renderer owns resolved frames. Only the editor-side resolution semantics live here
so the timeline, the Event Inspector and pre-save validation agree.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from tools.zodiac_local import PipelineError, _normalize_words, validate_timing

NO_TIMING = "NO_TIMING"
TIMING_VALID = "TIMING_VALID"
TIMING_STALE_OR_INVALID = "TIMING_STALE_OR_INVALID"

ANCHOR_NOT_FOUND = "ANCHOR_NOT_FOUND"
ANCHOR_AMBIGUOUS = "ANCHOR_AMBIGUOUS"
ANCHOR_OCCURRENCE_INVALID = "ANCHOR_OCCURRENCE_INVALID"


class AnchorProblem(Exception):
    """An anchor that cannot be resolved against measured words."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True)
class WordToken:
    text: str
    start_ms: float
    end_ms: float


@dataclass(frozen=True)
class SceneTiming:
    scene_id: str
    start_frame: int
    duration_frames: int
    fps: int
    words: tuple[WordToken, ...]

    @property
    def end_frame(self) -> int:
        return self.start_frame + self.duration_frames

    def frame_of(self, index: int) -> int:
        return ms_to_frame(self.words[index].start_ms, self.fps)


@dataclass(frozen=True)
class AnchorMatch:
    """A resolved anchor in both global and scene-local frames."""

    kind: str
    label: str
    word_start: int
    word_end: int
    occurrence_count: int
    global_frame: int
    local_frame: int
    start_ms: float
    end_ms: float


# ---- time <-> pixel mapping (pure, no widget state) -------------------
def ms_to_frame(ms: float, fps: int) -> int:
    return int(round(float(ms) * fps / 1000))


def frame_to_ms(frame: float, fps: int) -> float:
    return float(frame) * 1000 / fps


def frame_to_x(frame: float, total_frames: int, width: float) -> float:
    if not total_frames:
        return 0.0
    return float(frame) / float(total_frames) * float(width)


def x_to_frame(x: float, total_frames: int, width: float) -> float:
    if not width:
        return 0.0
    return float(x) / float(width) * float(total_frames)


def scene_frame_to_x(local_frame: float, duration_frames: int, width: float) -> float:
    if not duration_frames:
        return 0.0
    return float(local_frame) / float(duration_frames) * float(width)


# ---- anchor resolution ------------------------------------------------
def anchor_tokens(text: str) -> list[str]:
    return _normalize_words(str(text or "")).split()


def find_phrase_matches(scene: SceneTiming, text: str) -> list[tuple[int, int]]:
    """Contiguous measured word runs matching the anchor, 1-based-safe tuples."""
    tokens = anchor_tokens(text)
    if not tokens:
        return []
    measured = [_normalize_words(word.text) for word in scene.words]
    matches = []
    for start in range(len(measured) - len(tokens) + 1):
        if measured[start : start + len(tokens)] == tokens:
            matches.append((start, start + len(tokens) - 1))
    return matches


def resolve_anchor(scene: SceneTiming, text: str, occurrence=None) -> AnchorMatch:
    """Resolve one voice_anchor trigger, refusing to guess when ambiguous."""
    matches = find_phrase_matches(scene, text)
    label = f"{text!r}"
    if not matches:
        raise AnchorProblem(
            ANCHOR_NOT_FOUND,
            f"{label} is not in the measured words of scene {scene.scene_id}.",
        )
    if occurrence is None:
        if len(matches) > 1:
            raise AnchorProblem(
                ANCHOR_AMBIGUOUS,
                f"{label} matches {len(matches)} times in scene {scene.scene_id}; "
                "set trigger.occurrence (1-based).",
            )
        chosen = 0
    else:
        if (
            not isinstance(occurrence, int)
            or isinstance(occurrence, bool)
            or occurrence < 1
            or occurrence > len(matches)
        ):
            raise AnchorProblem(
                ANCHOR_OCCURRENCE_INVALID,
                f"occurrence {occurrence!r} is out of range for {label} "
                f"({len(matches)} matches in scene {scene.scene_id}).",
            )
        chosen = occurrence - 1
    word_start, word_end = matches[chosen]
    return AnchorMatch(
        kind="voice_anchor",
        label=label,
        word_start=word_start,
        word_end=word_end,
        occurrence_count=len(matches),
        global_frame=scene.frame_of(word_start),
        local_frame=scene.frame_of(word_start) - scene.start_frame,
        start_ms=scene.words[word_start].start_ms,
        end_ms=scene.words[word_end].end_ms,
    )


def resolve_scene_start(scene: SceneTiming) -> AnchorMatch:
    return AnchorMatch(
        kind="scene_start",
        label="scene_start",
        word_start=0,
        word_end=-1,
        occurrence_count=1,
        global_frame=scene.start_frame,
        local_frame=0,
        start_ms=frame_to_ms(scene.start_frame, scene.fps),
        end_ms=frame_to_ms(scene.end_frame, scene.fps),
    )


def resolve_event(scene: SceneTiming, event: dict) -> AnchorMatch:
    trigger = event.get("trigger") or {}
    if trigger.get("source") == "scene_start":
        return resolve_scene_start(scene)
    return resolve_anchor(scene, trigger.get("text", ""), trigger.get("occurrence"))


class RuntimeTimingDocument:
    """Read-only .runtime/timing.json with an explicit runtime state."""

    def __init__(self, path: Path, state: str, error: str | None = None, scenes: dict | None = None) -> None:
        self.path = Path(path)
        self.state = state
        self.error = error
        self._scenes = scenes or {}

    @classmethod
    def load(cls, package_root: Path) -> "RuntimeTimingDocument":
        root = Path(package_root)
        path = root / ".runtime" / "timing.json"
        if not path.is_file():
            return cls(path, NO_TIMING)

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("timing.json must contain a JSON object")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            return cls(path, TIMING_STALE_OR_INVALID, f"cannot read .runtime/timing.json: {exc}")

        try:
            validate_timing(root, payload)
        except PipelineError as exc:
            return cls(path, TIMING_STALE_OR_INVALID, f".runtime/timing.json is invalid: {exc}")

        fps = int(payload["fps"])
        scenes = {}
        for row in payload["scenes"]:
            words = tuple(
                WordToken(str(cue["text"]), float(cue["startMs"]), float(cue["endMs"]))
                for cue in row["captions"]
            )
            scenes[row["scene_id"]] = SceneTiming(
                scene_id=row["scene_id"],
                start_frame=int(row["start_frame"]),
                duration_frames=int(row["duration_frames"]),
                fps=fps,
                words=words,
            )
        return cls(path, TIMING_VALID, None, scenes)

    @property
    def scene_ids(self) -> list[str]:
        return list(self._scenes)

    def scene(self, scene_id: str) -> SceneTiming | None:
        return self._scenes.get(scene_id)