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
SHAPES = ("box", "circle", "line", "arrow", "text", "face", "check", "cross", "heart", "star", "scribble", "wedge", "phone", "pillow", "cup")
COLORS = {"ink": INK, "paper": PAPER, "teal": TEAL, "coral": CORAL, "gold": GOLD, "card": CARD}
MOODS = ("happy", "flat", "angry", "sad", "surprised")
MAX_PARTS, MAX_STEPS, MAX_TEXTS = 18, 4, 6
FIELDS = {"shape", "x", "y", "w", "h", "color", "text", "step"}


def _check_parts(raw_parts, *, low: int, single_step: bool) -> list[dict]:
    """The drawing, checked part by part: nothing outside the canvas, the palette or the part list reaches the file."""
    if not isinstance(raw_parts, list) or not low <= len(raw_parts) <= MAX_PARTS:
        reject("sketch_parts")
    parts = []
    for index, raw in enumerate(raw_parts, 1):
        if not isinstance(raw, dict) or set(raw) != FIELDS:
            reject(f"sketch_part_fields: part {index} needs exactly {sorted(FIELDS)}")
        if raw["shape"] not in SHAPES or raw["color"] not in COLORS:
            reject(f"sketch_part_choice: part {index} shape {raw['shape']!r} / colour {raw['color']!r} is not on the menu")
        nums = [raw[k] for k in ("x", "y", "w", "h", "step")]
        if any(isinstance(n, bool) or not isinstance(n, int) for n in nums):
            reject(f"sketch_part_number: part {index} needs whole numbers")
        x, y, w, h, step = nums
        linear = raw["shape"] in ("line", "arrow")
        inside = 0 <= x <= W and 0 <= y <= H and 0 <= x + w <= W and 0 <= y + h <= H
        if not inside or (not linear and (w < 20 or h < 20)):
            reject(f"sketch_part_bounds: part {index} ({raw['shape']}) x={x} y={y} w={w} h={h}; it must stay inside {W}x{H} (x+w<={W}, y+h<={H}) and a box, circle, face, heart, star, check, cross, scribble or text needs w and h of at least 20")
        if not 1 <= step <= MAX_STEPS or (single_step and step != 1):
            reject(f"sketch_part_step: part {index} step {step}" + (" (a hero state uses step 1 only)" if single_step else ""))
        text = raw["text"]
        if raw["shape"] == "text":
            text = _text(text, 28)
        elif raw["shape"] == "face":
            if text not in MOODS:
                reject(f"sketch_face_mood: part {index} text must be one of {list(MOODS)}")
        elif text not in ("", None):
            reject(f"sketch_part_text: part {index} ({raw['shape']}) takes an empty text")
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
    drawn = [_check_parts(s["parts"], low=2, single_step=True) for s in states]
    for number, parts in enumerate(drawn, 1):  # the object is the picture: it fills the canvas, it is not a speck in a corner
        left, right = min(p["x"] for p in parts), max(p["x"] + p["w"] for p in parts)
        top, low = min(p["y"] for p in parts), max(p["y"] + p["h"] for p in parts)
        if (right - left) < W * .55 and (low - top) < H * .55:
            reject(f"hero_too_small: state {number} spans {right - left}x{low - top} of {W}x{H}; scale the object up until it covers at least 55% of the width or of the height")
    key = lambda p: (p["shape"], p["x"], p["y"], p["w"], p["h"], p["color"], p["text"])  # noqa: E731
    for number in range(1, len(drawn)):  # a state that looks like the one before is not a change the viewer can see
        if len({key(p) for p in drawn[number - 1]} ^ {key(p) for p in drawn[number]}) < 4:
            reject(f"hero_states_alike: state {number + 1} differs from state {number} by fewer than 2 parts; show what the words changed (a piece cut away, moved, crossed out, added)")
    return drawn


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
        elif shape == "wedge":  # a slice of a cake or pie, side view, with its top face and a topping dot
            out.append(f'<path d="M{x} {y + h} L{x + w} {y + h} L{x + w * .88} {y + h * .5} Q{x + w * .45} {y - h * .02} {x + w * .02} {y + h * .72} Z" fill="{fill}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
                       f'<path d="M{x + w * .1} {y + h * .8} L{x + w * .9} {y + h * .8}" stroke="{INK}" stroke-width="4" stroke-linecap="round" fill="none"/>'
                       f'<circle cx="{x + w * .5}" cy="{y + h * .3}" r="{max(6, min(w, h) * .07)}" fill="{CORAL}" stroke="{INK}" stroke-width="3"/>')
        elif shape == "phone":
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(w, h) // 6}" fill="{fill}" stroke="{INK}" stroke-width="6"/>'
                       f'<rect x="{x + w * .1}" y="{y + h * .08}" width="{w * .8}" height="{h * .74}" rx="8" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>'
                       f'<circle cx="{cx}" cy="{y + h * .91}" r="{max(4, min(w, h) * .04)}" fill="{INK}"/>')
        elif shape == "pillow":
            out.append(f'<path d="M{x + w * .06} {y + h * .12} Q{cx} {y - h * .06} {x + w * .94} {y + h * .12} Q{x + w * 1.02} {cy} {x + w * .94} {y + h * .88} '
                       f'Q{cx} {y + h * 1.06} {x + w * .06} {y + h * .88} Q{x - w * .02} {cy} {x + w * .06} {y + h * .12} Z" fill="{fill}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
                       f'<path d="M{x + w * .06} {y + h * .12} l{w * .08} {h * .1} M{x + w * .94} {y + h * .12} l{-w * .08} {h * .1} M{x + w * .06} {y + h * .88} l{w * .08} {-h * .1} M{x + w * .94} {y + h * .88} l{-w * .08} {-h * .1}" '
                       f'stroke="{INK}" stroke-width="4" stroke-linecap="round" fill="none"/>')
        elif shape == "cup":
            out.append(f'<path d="M{x + w * .08} {y + h * .12} L{x + w * .74} {y + h * .12} L{x + w * .66} {y + h * .92} Q{x + w * .4} {y + h} {x + w * .16} {y + h * .92} Z" fill="{fill}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
                       f'<path d="M{x + w * .74} {y + h * .28} Q{x + w * 1.02} {y + h * .3} {x + w * .98} {y + h * .52} Q{x + w * .94} {y + h * .7} {x + w * .7} {y + h * .68}" stroke="{INK}" stroke-width="6" fill="none" stroke-linecap="round"/>')
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
