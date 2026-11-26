"""Acting and camera for a finished scene: a character reacts when its pose changes, the camera moves only to show a picture.

Core decides this, deterministically, after the model has chosen poses and pictures. Movement has to earn its place:
- a character moves at most twice per scene, never in the first half-second or the last second, and never while another
  motion of the same character is still running;
- a pose that asserts something (commit, deny, plan, test ...) leans toward the other character with a small hop;
  a pose that receives it (exposed, question, judge ...) recoils a little;
- the camera pushes in slowly when a Studio graphic / story visual appears, and once more on its last piece. Nothing else moves it.
Both return the events / shots they added so a caller can report them; nothing here approves anything.
"""
from __future__ import annotations

STRONG = ("commit", "deny", "plan", "invite", "test", "press", "explain", "propose", "wait")
MAX_PER_CHARACTER = 2
MIN_GAP_SECONDS = 1.6
EDGE_START, EDGE_END = 0.5, 1.0
ACT_FRAMES = 14
CAMERA_NEAR = {"x": 540, "y": 900, "zoom": 1.07}
CAMERA_PUNCH = {"x": 540, "y": 860, "zoom": 1.12}


def _rect(entity: dict) -> dict | None:
    for state in (entity.get("states") or {}).values():
        if state.get("visible") and state.get("transform"):
            return state["transform"]
    return None


def _motion(entity: dict, others: list[dict], state: str) -> dict:
    mine = _rect(entity)
    rival = next((r for r in (_rect(o) for o in others) if r), None)
    toward = 1 if (mine and rival and rival["x"] > mine["x"]) else -1
    if any(word in state for word in STRONG):
        return {"preset": "lean", "duration_frames": ACT_FRAMES,
                "params": {"degrees": 7 * toward, "dx": 18 * toward, "dy": -10, "settle": "return"}}
    return {"preset": "recoil", "duration_frames": 10, "params": {"degrees": -5 * toward, "dx": -14 * toward, "dy": 0, "settle": "return"}}


def animate(scene: dict, anchors: list[dict], event_times: dict[str, float], fps: int, scene_len: float) -> list[str]:
    """Add acting events and camera shots to ``scene`` in place; return a note per addition."""
    chars = {e["id"]: e for e in scene.get("entities", []) if e.get("kind") == "character"}
    candidates = sorted((a for a in anchors if a.get("t") is not None), key=lambda a: a["t"])
    busy: dict[str, list[tuple[float, float]]] = {}
    for event in scene.get("events", []):
        start = event_times.get(event["id"])
        if start is not None:
            frames = (event.get("motion") or {}).get("duration_frames") or ACT_FRAMES
            busy.setdefault(event["target"], []).append((start, start + frames / fps))
    used = {e["id"] for e in scene.get("events", [])}
    added: dict[str, list[float]] = {}
    notes: list[str] = []

    def free(target: str, start: float, end: float) -> bool:
        if any(start < b + 0.05 and end + 0.05 > a for a, b in busy.get(target, [])):
            return False
        return all(abs(start - t) >= MIN_GAP_SECONDS for t in added.get(target, []))

    swaps = sorted((e for e in scene.get("events", []) if e["target"] in chars and e["state_before"] != e["state_after"]
                    and event_times.get(e["id"]) is not None), key=lambda e: event_times[e["id"]])
    for event in swaps:
        target = event["target"]
        if len(added.get(target, [])) >= MAX_PER_CHARACTER:
            continue
        landed = event_times[event["id"]] + (event["motion"].get("duration_frames") or 12) / fps + 0.1
        for anchor in candidates:
            t = anchor["t"]
            if t < max(landed, EDGE_START):
                continue
            if t > landed + 2.5 or t > scene_len - EDGE_END:
                break
            end = t + ACT_FRAMES / fps
            if not free(target, t, end):
                continue
            ident = next(f"m{n}" for n in range(1, 99) if f"m{n}" not in used)
            used.add(ident)
            # the reaction continues the pose the character holds at that moment: after its latest earlier event, in time order
            before = [e for e in scene["events"] if e["target"] == target and event_times.get(e["id"]) is not None and event_times[e["id"]] <= t]
            prev = max(before, key=lambda e: event_times[e["id"]])
            motion = _motion(chars[target], [e for i, e in chars.items() if i != target], prev["state_after"])
            # the state trace replays a target's events in list order, the export in time order: both agree right after `prev`
            scene["events"].insert(scene["events"].index(prev) + 1, {"id": ident, "target": target, "state_before": prev["state_after"],
                                   "state_after": prev["state_after"], "action": "phản ứng theo tư thế vừa đổi",
                                   "trigger": {"type": "voice_anchor", "text": anchor["text"]}, "motion": motion})
            event_times[ident] = t
            busy.setdefault(target, []).append((t, end))
            added.setdefault(target, []).append(t)
            notes.append(f"{target} {motion['preset']} @{t}s")
            break

    pictures = sorted((e for e in scene.get("events", []) if str(e["target"]).startswith(("graphic_", "sv"))
                       and event_times.get(e["id"]) is not None and e["trigger"].get("type") == "voice_anchor"),
                      key=lambda e: event_times[e["id"]])
    if pictures and not scene.get("camera"):
        first, last = pictures[0], pictures[-1]
        shots = [{"id": "c1", "trigger": dict(first["trigger"]), "to": dict(CAMERA_NEAR), "duration_frames": 48,
                  "reason": "đẩy nhẹ vào hình giải thích vừa hiện"}]
        if len(pictures) >= 3 and event_times[last["id"]] - event_times[first["id"]] >= 1.5 and event_times[last["id"]] <= scene_len - 0.8:
            shots.append({"id": "c2", "trigger": dict(last["trigger"]), "to": dict(CAMERA_PUNCH), "duration_frames": 30,
                          "reason": "nhấn vào mảnh cuối của hình"})
        scene["camera"] = shots
        notes.append(f"camera: {len(shots)} cú đẩy")
    return notes
