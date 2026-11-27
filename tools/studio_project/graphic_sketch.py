"""The `sketch` picture: a drawing the agent composes for ONE scene from a small set of paper-doodle parts.

The other motifs (stamp, meter, versus, receipt, route, folder) are fixed layouts. A sketch is invented per scene, so two
episodes never share it. The model never writes SVG: it lists parts (shape, box, colour, step), Core checks every number,
colour and word, letters text with the channel font and draws the parts in the channel's ink-outline style.
Parts appear step by step (`step`), so the drawing builds up on the narration anchors like the other motifs.
"""
from __future__ import annotations

import math

from .story_visual_art import CORAL, GOLD, INK, PAPER, TEAL, _text, reject

CARD = "#E9E6DF"
W, H = 960, 630  # the aspect of the story-visual band (640x420)
SHAPES = ("box", "circle", "line", "arrow", "text", "face", "check", "cross", "heart", "star", "scribble")
COLORS = {"ink": INK, "paper": PAPER, "teal": TEAL, "coral": CORAL, "gold": GOLD, "card": CARD}
MOODS = ("happy", "flat", "angry", "sad", "surprised")
MAX_PARTS, MAX_STEPS, MAX_TEXTS = 18, 4, 6
FIELDS = {"shape", "x", "y", "w", "h", "color", "text", "step"}


def _check_parts(raw_parts, *, low: int, single_step: bool) -> list[dict]:
    """The drawing, checked part by part: nothing outside the canvas, the palette or the part list reaches the file."""
    if not isinstance(raw_parts, list) or not low <= len(raw_parts) <= MAX_PARTS:
        reject("sketch_parts")
    parts = []
    for raw in raw_parts:
        if not isinstance(raw, dict) or set(raw) != FIELDS:
            reject("sketch_part_fields")
        if raw["shape"] not in SHAPES or raw["color"] not in COLORS:
            reject("sketch_part_choice")
        nums = [raw[k] for k in ("x", "y", "w", "h", "step")]
        if any(isinstance(n, bool) or not isinstance(n, int) for n in nums):
            reject("sketch_part_number")
        x, y, w, h, step = nums
        linear = raw["shape"] in ("line", "arrow")
        inside = 0 <= x <= W and 0 <= y <= H and 0 <= x + w <= W and 0 <= y + h <= H
        if not inside or (not linear and (w < 20 or h < 20)):
            reject("sketch_part_bounds")
        if not 1 <= step <= MAX_STEPS or (single_step and step != 1):
            reject("sketch_part_step")
        text = raw["text"]
        if raw["shape"] == "text":
            text = _text(text, 28)
        elif raw["shape"] == "face":
            if text not in MOODS:
                reject("sketch_face_mood")
        elif text not in ("", None):
            reject("sketch_part_text")
        parts.append({**raw, "text": text or ""})
    used = sorted({p["step"] for p in parts})
    if used != list(range(1, len(used) + 1)):
        reject("sketch_steps_gap")
    if sum(p["shape"] == "text" for p in parts) > MAX_TEXTS or all(p["shape"] == "text" for p in parts):
        reject("sketch_needs_drawing")
    return parts


def parts_of(spec) -> list[dict]:
    if set(spec) != {"type", "parts"}:
        reject("sketch_parts")
    return _check_parts(spec["parts"], low=3, single_step=False)


def hero_states(spec) -> list[list[dict]]:
    """The story's own object, drawn in 2-4 states: each state is a whole drawing, the later one replaces the earlier."""
    states = spec.get("states") if set(spec) == {"type", "states"} else None
    if not isinstance(states, list) or not 2 <= len(states) <= 4 or any(not isinstance(s, dict) or set(s) != {"parts"} for s in states):
        reject("hero_states")
    return [_check_parts(s["parts"], low=2, single_step=True) for s in states]


def steps(spec) -> int:
    if isinstance(spec, dict) and spec.get("type") == "hero":
        return len(spec["states"]) if isinstance(spec.get("states"), list) else 0
    parts = spec.get("parts") if isinstance(spec, dict) else None
    if not isinstance(parts, list):
        return 0
    return max((p["step"] for p in parts if isinstance(p, dict) and isinstance(p.get("step"), int) and not isinstance(p["step"], bool)), default=0)


def _stroke(color: str) -> str:
    return INK if color == "paper" else COLORS[color]


def _face(p, cx, cy, fill) -> str:
    r = min(p["w"], p["h"]) / 2
    mood = p["text"]
    mouth = {"happy": f"M{cx - r * .4} {cy + r * .25} Q{cx} {cy + r * .65} {cx + r * .4} {cy + r * .25}",
             "flat": f"M{cx - r * .4} {cy + r * .4} L{cx + r * .4} {cy + r * .4}",
             "angry": f"M{cx - r * .4} {cy + r * .5} Q{cx} {cy + r * .2} {cx + r * .4} {cy + r * .5}",
             "sad": f"M{cx - r * .4} {cy + r * .5} Q{cx} {cy + r * .2} {cx + r * .4} {cy + r * .5}",
             "surprised": f"M{cx - r * .12} {cy + r * .25} a{r * .12} {r * .16} 0 1 0 {r * .24} 0 a{r * .12} {r * .16} 0 1 0 {-r * .24} 0"}[mood]
    brows = (f'<path d="M{cx - r * .55} {cy - r * .45} L{cx - r * .15} {cy - r * .3} M{cx + r * .55} {cy - r * .45} L{cx + r * .15} {cy - r * .3}" '
             f'stroke="{INK}" stroke-width="6" stroke-linecap="round"/>') if mood == "angry" else ""
    eye = r * .08 + 2
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="6"/>'
            f'<circle cx="{cx - r * .33}" cy="{cy - r * .1}" r="{eye}" fill="{INK}"/><circle cx="{cx + r * .33}" cy="{cy - r * .1}" r="{eye}" fill="{INK}"/>'
            f'<path d="{mouth}" stroke="{INK}" stroke-width="6" stroke-linecap="round" fill="none"/>{brows}')


def draw(L, spec, step):
    hero = spec.get("type") == "hero"
    if hero:  # the object itself, no card behind it: state k replaces state k-1
        states = hero_states(spec)
        shown = len(states) if step is None else step
        parts = states[max(1, min(shown, len(states))) - 1]
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    else:
        parts = parts_of(spec)
        shown = steps(spec) if step is None else step
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
               f'<rect x="12" y="12" width="{W - 24}" height="{H - 24}" rx="40" fill="{PAPER}" stroke="{INK}" stroke-width="8"/>']
    for p in parts:
        if not hero and p["step"] > shown:
            continue
        x, y, w, h = p["x"], p["y"], p["w"], p["h"]
        cx, cy, fill, ink = x + w / 2, y + h / 2, COLORS[p["color"]], _stroke(p["color"])
        shape = p["shape"]
        if shape == "box":
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(w, h) // 5}" fill="{fill}" stroke="{INK}" stroke-width="6"/>')
        elif shape == "circle":
            out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{w / 2}" ry="{h / 2}" fill="{fill}" stroke="{INK}" stroke-width="6"/>')
        elif shape in ("line", "arrow"):
            out.append(f'<path d="M{x} {y} L{x + w} {y + h}" stroke="{ink}" stroke-width="9" stroke-linecap="round" fill="none"/>')
            if shape == "arrow":
                a = math.atan2(h, w)
                tip = (x + w, y + h)
                left = (tip[0] - 34 * math.cos(a - .5), tip[1] - 34 * math.sin(a - .5))
                right = (tip[0] - 34 * math.cos(a + .5), tip[1] - 34 * math.sin(a + .5))
                out.append(f'<path d="M{left[0]:.1f} {left[1]:.1f} L{tip[0]} {tip[1]} L{right[0]:.1f} {right[1]:.1f}" stroke="{ink}" '
                           f'stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
        elif shape == "text":
            size = min(h, 110)
            if L.width(p["text"], size) > w + 6:
                size = max(24, int(size * w / L.width(p["text"], size)))
                if L.width(p["text"], size) > w + 6:
                    reject("sketch_text_overflow: " + p["text"])
            out.append(L.draw(p["text"], cx, y + h * .78, size, ink, "center"))
        elif shape == "face":
            out.append(_face(p, cx, cy, fill))
        elif shape == "check":
            out.append(f'<path d="M{x} {y + h * .55} L{x + w * .38} {y + h} L{x + w} {y}" stroke="{ink}" stroke-width="16" '
                       f'stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
        elif shape == "cross":
            out.append(f'<path d="M{x} {y} L{x + w} {y + h} M{x + w} {y} L{x} {y + h}" stroke="{ink}" stroke-width="16" stroke-linecap="round" fill="none"/>')
        elif shape == "heart":
            out.append(f'<path d="M{cx} {y + h} C{x - w * .2} {y + h * .45} {x + w * .15} {y - h * .1} {cx} {y + h * .3} '
                       f'C{x + w * .85} {y - h * .1} {x + w * 1.2} {y + h * .45} {cx} {y + h} Z" fill="{fill}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>')
        elif shape == "star":
            out.append(f'<path d="M{cx} {y} L{cx + w * .13} {cy - h * .12} L{x + w} {cy - h * .1} L{cx + w * .22} {cy + h * .12} L{x + w * .8} {y + h} '
                       f'L{cx} {cy + h * .28} L{x + w * .2} {y + h} L{cx - w * .22} {cy + h * .12} L{x} {cy - h * .1} L{cx - w * .13} {cy - h * .12} Z" '
                       f'fill="{fill}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>')
        else:  # scribble
            zig = " ".join(f"L{x + w * i / 6:.1f} {y + (h if i % 2 else 0)}" for i in range(1, 7))
            out.append(f'<path d="M{x} {y + h / 2} {zig}" stroke="{ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
    out.append("</svg>")
    return out
