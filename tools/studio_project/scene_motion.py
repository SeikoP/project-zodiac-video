"""Motion for a finished scene, using the registered presets (plugin motion-registry-v1): no camera, no custom moves.

Core decides this after the model has chosen poses and pictures, so the same story always moves the same way:
- a character's pose change plays WITH the change (one event, not a second one) as `small-bounce`; a character's first
  pose change in the scene stays a plain swap so the scene opens calmly. Tilt and scale presets are not used: the characters
  fill the canvas width (x 20..440 and 640..1060), so a rotation or a swell makes them leave it (OUTSIDE_CANVAS in the QA);
- the first piece of a Studio graphic / story visual pops in (`pop-in`); its later pieces stay plain swaps.
Presets keep their default duration, so nothing needs a duration override.
"""
from __future__ import annotations

SWAP = "state_swap"
MAX_PER_CHARACTER = 3


def animate(scene: dict) -> list[str]:
    """Set presets on the scene's existing events in place; return a note per change."""
    chars = {e["id"] for e in scene.get("entities", []) if e.get("kind") == "character"}
    seen: dict[str, int] = {}
    notes: list[str] = []
    for event in scene.get("events", []):
        motion = event.get("motion") or {}
        if motion.get("preset") != SWAP or event["state_before"] == event["state_after"]:
            continue
        target = event["target"]
        if target in chars:
            seen[target] = seen.get(target, 0) + 1
            if seen[target] == 1 or seen[target] > MAX_PER_CHARACTER + 1:
                continue
            preset = "small-bounce"
        elif str(target).startswith(("graphic_", "sv")) and event["state_before"] == "hidden":
            preset = "pop-in"
        else:
            continue
        event["motion"] = {"preset": preset, "duration_frames": 12 if preset != "pop-in" else 10}
        notes.append(f"{target} {preset} @{event['id']}")
    return notes
