"""Core-rendered scene accent art (the setting of a scene), in the channel's paper-doodle style.

The agent never writes SVG. It picks up to three parts from a fixed vocabulary (window, awning, lamp...), a slot and a size.
Core draws them: deterministic (the hand-made wobble is seeded by the spec), canonical palette only, flat fills, no text, no
filters. One SVG per scene, 900x420, content-addressed under `.authoring/agent-art/`. The part drawings are Core's own and need the
owner's visual review like any art; this module grants no approval.
"""
from __future__ import annotations

import hashlib
import json
import random
import re
from pathlib import Path

VIEW_W, VIEW_H = 900, 420
FLOOR = 396
SLOTS = {"left": (30, 270), "center": (330, 570), "right": (630, 870), "across": (40, 860)}
SIZES = {"small": 150, "medium": 230, "large": 330}
WALL_CENTRE, TOP_Y = 175, 22
TEAL, BEIGE, CARD, CORAL, OCHRE = "#8EC0B9", "#D0C1B3", "#FFFDF9", "#E97A66", "#F2C45C"
ORIGIN = {"mode": "studio_template", "template": "accent_parts@1"}
PATH = re.compile(r"^\.authoring/agent-art/accent-([0-9a-f]{64})\.svg$")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Doodle:
    """Hand-drawn primitives: every point and edge drifts a little, deterministically."""

    def __init__(self, seed: int):
        self.r = random.Random(seed)
        self.out: list[str] = []

    def j(self, amp: float = 2.2) -> float:
        return self.r.uniform(-amp, amp)

    def pt(self, x: float, y: float, amp: float = 2.2) -> str:
        return f"{x + self.j(amp):.1f} {y + self.j(amp):.1f}"

    def seg(self, x1, y1, x2, y2, amp: float = 2.0) -> str:
        return f"M{self.pt(x1, y1, amp)} Q{(x1 + x2) / 2 + self.j(amp * 1.5):.1f} {(y1 + y2) / 2 + self.j(amp * 1.5):.1f} {self.pt(x2, y2, amp)}"

    def poly(self, points, amp: float = 2.2, close: bool = True) -> str:
        first = self.pt(*points[0], amp)
        parts = [f"M{first}"]
        for i, q in enumerate(points[1:] + ([points[0]] if close else []), start=1):
            p = points[i - 1]
            end = first if (close and i == len(points)) else self.pt(*q, amp)
            parts.append(f"Q{(p[0] + q[0]) / 2 + self.j(amp * 1.4):.1f} {(p[1] + q[1]) / 2 + self.j(amp * 1.4):.1f} {end}")
        return "".join(parts) + ("Z" if close else "")

    def rect(self, x, y, w, h, amp: float = 2.2) -> str:
        return self.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], amp)

    def oval(self, cx, cy, rx, ry, amp: float = 1.6) -> str:
        n, e, s, w = (cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)
        k = 0.88
        c = lambda dx, dy: f"{cx + dx * rx * k + self.j(amp):.1f} {cy + dy * ry * k + self.j(amp):.1f}"
        first = self.pt(*w, amp)
        return (f"M{first} Q{c(-1, -1)} {self.pt(*n, amp)} Q{c(1, -1)} {self.pt(*e, amp)} "
                f"Q{c(1, 1)} {self.pt(*s, amp)} Q{c(-1, 1)} {first}Z")

    def add(self, d: str, stroke: str = TEAL, width: float = 6, fill: str = "none", extra: str = "") -> None:
        self.out.append(f'<path d="{d}" stroke="{stroke}" stroke-width="{width:g}" fill="{fill}"{extra}/>')


def _window(d, x, y, w, h):
    d.add(d.rect(x, y, w, h * 0.9), fill=CARD)
    d.add(d.seg(x + w * .5, y + h * .06, x + w * .5, y + h * .84))
    d.add(d.seg(x + w * .06, y + h * .45, x + w * .94, y + h * .45))
    d.add(d.seg(x - w * .06, y + h * .97, x + w * 1.06, y + h * .97), BEIGE, 7)


def _awning(d, x, y, w, h):
    top, base = y, y + h * 0.30
    scallops = 6
    step = w / scallops
    path = f"M{d.pt(x, top)} L{d.pt(x + w, top)} L{d.pt(x + w, base)}"
    for i in range(scallops):
        x1 = x + w - i * step
        path += f" Q{x1 - step / 2 + d.j(2):.1f} {base + h * .17 + d.j(2):.1f} {d.pt(x1 - step, base)}"
    d.add(path + " Z", fill=CARD)
    for i in (1, 3, 5):
        d.add(d.seg(x + step * (i - .5), top + h * .04, x + step * (i - .5), base + h * .08), CORAL, 5)
    d.add(d.seg(x + w * .03, base + h * .05, x + w * .03, y + h), BEIGE, 6)
    d.add(d.seg(x + w * .97, base + h * .05, x + w * .97, y + h), BEIGE, 6)


def _door(d, x, y, w, h):
    d.add(d.rect(x, y, w, h), fill=CARD)
    d.add(d.rect(x + w * .16, y + h * .1, w * .68, h * .8), BEIGE, 5)
    d.add(d.oval(x + w * .78, y + h * .55, w * .05, w * .05), OCHRE, 5, OCHRE)


def _shelf(d, x, y, w, h):
    base = y + h * .9
    d.add(d.seg(x, base, x + w, base), TEAL, 7)
    for fx, fw, fh in ((.08, .09, .5), (.19, .09, .64), (.30, .09, .42)):
        d.add(d.rect(x + w * fx, base - h * fh, w * fw, h * fh), fill=CARD)
    d.add(d.seg(x + w * .215, base - h * .55, x + w * .215, base - h * .2), CORAL, 4)
    d.add(d.rect(x + w * .55, base - h * .42, w * .16, h * .42), BEIGE, 5, CARD)
    d.add(d.seg(x + w * .8, base, x + w * .8, base - h * .3), TEAL, 5)
    d.add(d.oval(x + w * .8, base - h * .36, w * .06, h * .1), TEAL, 5, CARD)


def _lamp(d, x, y, w, h):
    d.add(d.poly([(x + w * .18, y + h * .05), (x + w * .82, y + h * .05), (x + w * .95, y + h * .38), (x + w * .05, y + h * .38)]), OCHRE, 6, CARD)
    d.add(d.seg(x + w * .5, y + h * .38, x + w * .5, y + h * .9), TEAL, 6)
    d.add(d.oval(x + w * .5, y + h * .94, w * .3, h * .045), BEIGE, 6, CARD)
    for fx, fy, tx, ty in ((.25, .45, .15, .56), (.5, .46, .5, .6), (.75, .45, .85, .56)):
        d.add(d.seg(x + w * fx, y + h * fy, x + w * tx, y + h * ty), OCHRE, 4)


def _clock(d, x, y, w, h):
    cx, cy = x + w / 2, y + h / 2
    d.add(d.oval(cx, cy, w * .46, h * .46), fill=CARD)
    for tx, ty, ux, uy in ((.5, .12, .5, .2), (.88, .5, .8, .5), (.5, .88, .5, .8), (.12, .5, .2, .5)):
        d.add(d.seg(x + w * tx, y + h * ty, x + w * ux, y + h * uy), BEIGE, 5)
    d.add(d.seg(cx, cy, cx, y + h * .26), TEAL, 6)
    d.add(d.seg(cx, cy, x + w * .7, y + h * .58), CORAL, 6)


def _board(d, x, y, w, h):
    d.add(d.rect(x, y, w, h * .85), fill=CARD)
    d.add(d.seg(x + w * .1, y + h * .2, x + w * .72, y + h * .22), TEAL, 6)
    d.add(d.seg(x + w * .1, y + h * .42, x + w * .55, y + h * .4), BEIGE, 5)
    d.add(d.seg(x + w * .1, y + h * .62, x + w * .8, y + h * .6), TEAL, 6)
    d.add(d.seg(x + w * .78, y + h * .2, x + w * .9, y + h * .22), OCHRE, 6)
    d.add(d.seg(x + w * .04, y + h * .93, x + w * .96, y + h * .93), BEIGE, 6)


def _menu_board(d, x, y, w, h):
    d.add(d.seg(x + w * .3, y, x + w * .3, y + h * .14), BEIGE, 5)
    d.add(d.seg(x + w * .7, y, x + w * .7, y + h * .14), BEIGE, 5)
    d.add(d.rect(x, y + h * .14, w, h * .86), fill=CARD)
    d.add(d.seg(x + w * .2, y + h * .3, x + w * .7, y + h * .3), CORAL, 6)
    for i, length in enumerate((.62, .5, .58)):
        yy = y + h * (.5 + i * .17)
        d.add(d.oval(x + w * .14, yy, w * .035, w * .035), CORAL, 4, CORAL)
        d.add(d.seg(x + w * .26, yy, x + w * (.26 + length * .6), yy), TEAL, 5)


def _sign(d, x, y, w, h):
    d.add(d.seg(x, y + h * .05, x + w * .88, y + h * .05), BEIGE, 6)
    d.add(d.seg(x + w * .25, y + h * .05, x + w * .25, y + h * .22), BEIGE, 4)
    d.add(d.seg(x + w * .72, y + h * .05, x + w * .72, y + h * .22), BEIGE, 4)
    d.add(d.rect(x + w * .1, y + h * .22, w * .8, h * .68), fill=CARD)
    d.add(d.seg(x + w * .22, y + h * .46, x + w * .78, y + h * .46), CORAL, 6)
    d.add(d.seg(x + w * .3, y + h * .68, x + w * .7, y + h * .68), TEAL, 5)


def _string_lights(d, x, y, w, h):
    d.add(f"M{d.pt(x, y + h * .08)} Q{x + w / 2:.1f} {y + h * 1.0:.1f} {d.pt(x + w, y + h * .08)}", BEIGE, 5)
    for i, color in enumerate((OCHRE, CORAL, TEAL, OCHRE, CORAL)):
        t = .12 + i * .19
        bx = x + w * t
        by = y + h * (.08 + 2 * t * (1 - t) * .92)
        d.add(d.seg(bx, by, bx, by + h * .12), BEIGE, 4)
        d.add(d.oval(bx, by + h * .2, w * .017, h * .09), color, 4, color)


def _plant(d, x, y, w, h):
    d.add(d.poly([(x + w * .2, y + h * .62), (x + w * .8, y + h * .62), (x + w * .72, y + h), (x + w * .28, y + h)]), BEIGE, 6, CARD)
    d.add(d.seg(x + w * .5, y + h * .62, x + w * .5, y + h * .3), TEAL, 5)
    d.add(f"M{d.pt(x + w * .5, y + h * .62)} Q{x + w * .06:.1f} {y + h * .4:.1f} {d.pt(x + w * .2, y + h * .12)} Q{x + w * .46:.1f} {y + h * .26:.1f} {d.pt(x + w * .5, y + h * .62)}Z", TEAL, 5, CARD)
    d.add(f"M{d.pt(x + w * .5, y + h * .55)} Q{x + w * .98:.1f} {y + h * .36:.1f} {d.pt(x + w * .84, y + h * .08)} Q{x + w * .56:.1f} {y + h * .24:.1f} {d.pt(x + w * .5, y + h * .55)}Z", TEAL, 5, CARD)
    d.add(f"M{d.pt(x + w * .5, y + h * .4)} Q{x + w * .38:.1f} {y + h * .16:.1f} {d.pt(x + w * .52, y)} Q{x + w * .62:.1f} {y + h * .2:.1f} {d.pt(x + w * .5, y + h * .4)}Z", TEAL, 5, CARD)


def _curtain(d, x, y, w, h):
    d.add(d.seg(x, y + h * .03, x + w, y + h * .03), BEIGE, 6)
    for x0 in (x + w * .02, x + w * .62):
        d.add(f"M{d.pt(x0, y + h * .05)} L{d.pt(x0, y + h * .93)} Q{x0 + w * .05:.1f} {y + h * 1.0:.1f} {d.pt(x0 + w * .18, y + h * .93)} "
              f"Q{x0 + w * .26:.1f} {y + h * 1.0:.1f} {d.pt(x0 + w * .36, y + h * .93)} L{d.pt(x0 + w * .36, y + h * .05)}Z", TEAL, 6, CARD)
        d.add(d.seg(x0 + w * .12, y + h * .1, x0 + w * .12, y + h * .85), BEIGE, 4)
        d.add(d.seg(x0 + w * .24, y + h * .1, x0 + w * .24, y + h * .85), BEIGE, 4)
    d.add(d.seg(x + w * .36, y + h * .5, x + w * .4, y + h * .5), CORAL, 6)
    d.add(d.seg(x + w * .6, y + h * .5, x + w * .64, y + h * .5), CORAL, 6)


def _picture(d, x, y, w, h):
    d.add(d.rect(x, y, w, h), fill=CARD)
    d.add(f"M{d.pt(x + w * .12, y + h * .78)} Q{x + w * .35:.1f} {y + h * .38:.1f} {d.pt(x + w * .55, y + h * .64)} Q{x + w * .7:.1f} {y + h * .5:.1f} {d.pt(x + w * .88, y + h * .78)}", TEAL, 5)
    d.add(d.oval(x + w * .7, y + h * .28, w * .08, w * .08), OCHRE, 5, OCHRE)


def _map(d, x, y, w, h):
    d.add(d.rect(x, y, w, h), fill=CARD)
    d.add(d.seg(x + w * .33, y + h * .05, x + w * .33, y + h * .95), BEIGE, 4)
    d.add(d.seg(x + w * .66, y + h * .05, x + w * .66, y + h * .95), BEIGE, 4)
    d.add(f"M{d.pt(x + w * .12, y + h * .75)} Q{x + w * .35:.1f} {y + h * .15:.1f} {d.pt(x + w * .55, y + h * .55)} Q{x + w * .72:.1f} {y + h * .8:.1f} {d.pt(x + w * .86, y + h * .3)}",
          TEAL, 5, "none", ' stroke-dasharray="10 12"')
    d.add(d.oval(x + w * .86, y + h * .27, w * .05, w * .05), CORAL, 5, CORAL)


def _calendar(d, x, y, w, h):
    d.add(d.rect(x, y, w, h), fill=CARD)
    d.add(d.rect(x, y, w, h * .24), TEAL, 6, CORAL)
    for row in range(3):
        for col in range(3):
            d.add(d.rect(x + w * (.1 + col * .28), y + h * (.36 + row * .21), w * .2, h * .15, 1.2), BEIGE, 4)
    d.add(d.oval(x + w * .66, y + h * .51, w * .12, h * .09), OCHRE, 5)


def _counter(d, x, y, w, h):
    d.add(d.rect(x, y + h * .42, w, h * .1), fill=CARD)
    d.add(d.rect(x + w * .03, y + h * .52, w * .94, h * .48), fill=CARD)
    d.add(d.seg(x + w * .34, y + h * .58, x + w * .34, y + h * .94), BEIGE, 4)
    d.add(d.seg(x + w * .67, y + h * .58, x + w * .67, y + h * .94), BEIGE, 4)
    for fx in (.14, .6):
        d.add(d.poly([(x + w * fx, y + h * .1), (x + w * (fx + .22), y + h * .1), (x + w * (fx + .18), y + h * .42), (x + w * (fx + .04), y + h * .42)]), TEAL, 5, CARD)
        d.add(d.seg(x + w * (fx + .11), y - h * .0, x + w * (fx + .14), y + h * .07), BEIGE, 4)


def _tree(d, x, y, w, h):
    d.add(d.poly([(x + w * .42, y + h), (x + w * .58, y + h), (x + w * .55, y + h * .52), (x + w * .45, y + h * .52)]), BEIGE, 6, CARD)
    d.add(d.seg(x + w * .5, y + h * .62, x + w * .68, y + h * .46), BEIGE, 5)
    cx, cy = x + w * .5, y + h * .3
    bumps = [(cx - w * .27, cy + h * .06), (cx - w * .3, cy - h * .12), (cx - w * .1, cy - h * .26), (cx + w * .14, cy - h * .25),
             (cx + w * .3, cy - h * .08), (cx + w * .26, cy + h * .08), (cx, cy + h * .2)]
    path = f"M{d.pt(*bumps[0])}"
    for i in range(1, len(bumps) + 1):
        p0, p1 = bumps[i - 1], bumps[i % len(bumps)]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        out_x, out_y = (mx - cx) * 1.25 + cx + d.j(2), (my - cy) * 1.25 + cy + d.j(2)
        path += f" Q{out_x:.1f} {out_y:.1f} {d.pt(*p1)}"
    d.add(path + "Z", TEAL, 6, CARD)
    d.add(d.seg(cx - w * .08, cy, cx + w * .02, cy - h * .08), BEIGE, 4)


# aspect = width / height of the drawing; mount: where it sits (floor = on the floor line, wall = hung around eye level, top = from the top edge)
PARTS: dict[str, dict] = {
    "window": {"mount": "wall", "wide": False, "aspect": 1.15, "draw": _window, "reads": "two-by-two pane window (room, cafe, night)"},
    "awning": {"mount": "top", "wide": True, "aspect": 3.2, "draw": _awning, "reads": "striped shop awning with posts (cafe, food stall, shop front)"},
    "door": {"mount": "floor", "wide": False, "aspect": 0.5, "draw": _door, "reads": "door with a knob (entrance, home, shop)"},
    "shelf": {"mount": "wall", "wide": False, "aspect": 1.3, "draw": _shelf, "reads": "shelf with books and a jar (home, study, shop)"},
    "lamp": {"mount": "floor", "wide": False, "aspect": 0.55, "draw": _lamp, "reads": "standing lamp with glow (evening, night, home)"},
    "clock": {"mount": "wall", "wide": False, "aspect": 1.0, "draw": _clock, "reads": "wall clock (time, waiting, schedule)"},
    "board": {"mount": "wall", "wide": False, "aspect": 1.7, "draw": _board, "reads": "notice or chalk board with scribbles (school, plans, office)"},
    "menu_board": {"mount": "top", "wide": False, "aspect": 0.8, "draw": _menu_board, "reads": "hanging menu board with items (food, cafe, stall)"},
    "sign": {"mount": "top", "wide": False, "aspect": 1.3, "draw": _sign, "reads": "hanging shop sign on a bracket (street, shop)"},
    "string_lights": {"mount": "top", "wide": True, "aspect": 5.0, "draw": _string_lights, "reads": "string of coloured bulbs (celebration, evening, outdoors)"},
    "plant": {"mount": "floor", "wide": False, "aspect": 0.7, "draw": _plant, "reads": "potted plant (home, cafe, office)"},
    "curtain": {"mount": "top", "wide": True, "aspect": 2.2, "draw": _curtain, "reads": "curtains on a rod (bedroom, home, stage)"},
    "picture": {"mount": "wall", "wide": False, "aspect": 1.3, "draw": _picture, "reads": "framed picture with hills and sun (home, office)"},
    "map": {"mount": "wall", "wide": False, "aspect": 1.3, "draw": _map, "reads": "folded paper map with a route and pin (travel, planning, directions)"},
    "calendar": {"mount": "wall", "wide": False, "aspect": 0.9, "draw": _calendar, "reads": "wall calendar with a marked day (dates, plans, deadlines)"},
    "counter": {"mount": "floor", "wide": False, "aspect": 1.6, "draw": _counter, "reads": "service counter with two cups (cafe, shop, food stall)"},
    "tree": {"mount": "floor", "wide": False, "aspect": 0.85, "draw": _tree, "reads": "street tree (outdoors, park, street)"},
}
AT = tuple(SLOTS)


def _check(spec) -> list[dict]:
    if not isinstance(spec, dict) or set(spec) != {"parts"} or not isinstance(spec["parts"], list) or not 1 <= len(spec["parts"]) <= 3:
        raise ValueError("accent cần 1-3 bộ phận trong 'parts'")
    seen = set()
    for row in spec["parts"]:
        if not isinstance(row, dict) or set(row) != {"part", "at", "size"}:
            raise ValueError("mỗi bộ phận cần đúng part, at, size")
        if row["part"] not in PARTS:
            raise ValueError(f"bộ phận {row['part']!r} không có trong danh sách")
        if row["at"] not in AT or row["size"] not in SIZES:
            raise ValueError(f"vị trí/kích thước không hợp lệ: {row['at']!r}/{row['size']!r}")
        if (row["at"] == "across") != PARTS[row["part"]]["wide"]:
            raise ValueError(f"{row['part']}: chỉ bộ phận rộng mới đặt 'across', và bộ phận rộng chỉ đặt 'across'")
        if row["at"] in seen:
            raise ValueError(f"hai bộ phận cùng vị trí {row['at']!r}")
        seen.add(row["at"])
    if "across" in seen:  # an across part hangs from the top edge: only floor parts may share the picture with it
        for row in spec["parts"]:
            if row["at"] != "across" and PARTS[row["part"]]["mount"] != "floor":
                raise ValueError(f"{row['part']} đụng bộ phận 'across'; chỉ bộ phận đặt dưới sàn đi cùng được")
    return spec["parts"]


def layout(spec) -> list[dict]:
    """Where each part is drawn: its box in the 900x420 view, inside its slot and on the shared floor line."""
    out = []
    for row in _check(spec):
        meta = PARTS[row["part"]]
        lo, hi = SLOTS[row["at"]]
        cap = SIZES[row["size"]]
        w = min(hi - lo, cap * meta["aspect"])
        h = w / meta["aspect"]
        x = (lo + hi) / 2 - w / 2
        y = FLOOR - h if meta["mount"] == "floor" else TOP_Y if meta["mount"] == "top" else max(TOP_Y, WALL_CENTRE - h / 2)
        out.append({**row, "box": {"x": round(x, 1), "y": round(y, 1), "w": round(w, 1), "h": round(h, 1)}})
    return out


def _is_floor(row: dict) -> bool:
    return PARTS[row["part"]]["mount"] == "floor"


def layer_view(spec, kind: str) -> dict | None:
    """The crop of the 900-wide picture a layer is drawn in: 'wall' (hung parts, from the top edge) or 'floor' (standing parts down to the floor).

    `floor_y` is where the floor line sits inside the full picture, so Core can seat that line on the actors' ground.
    """
    rows = [r for r in layout(spec) if _is_floor(r) == (kind == "floor")]
    if not rows:
        return None
    if kind == "wall":
        bottom = min(VIEW_H, int(max(r["box"]["y"] + r["box"]["h"] for r in rows)) + 14)
        return {"y": 0, "w": VIEW_W, "h": bottom, "floor_y": FLOOR}
    top = max(0, int(min(r["box"]["y"] for r in rows)) - 24)
    return {"y": top, "w": VIEW_W, "h": VIEW_H - top, "floor_y": FLOOR}


def _render(spec, kind: str | None) -> bytes | None:
    rows = layout(spec)
    if kind:
        view = layer_view(spec, kind)
        if view is None:
            return None
        rows = [r for r in rows if _is_floor(r) == (kind == "floor")]
    else:
        view = {"y": 0, "w": VIEW_W, "h": VIEW_H}
    seed = int(sha256(json.dumps(spec, sort_keys=True).encode())[:12], 16)
    drawing = Doodle(seed)
    for row in rows:
        box = row["box"]
        PARTS[row["part"]]["draw"](drawing, box["x"], box["y"], box["w"], box["h"])
    floor = [r["box"] for r in rows if _is_floor(r)]
    if floor:  # things that stand need something to stand on: one low line under them all
        drawing.add(drawing.seg(min(b["x"] for b in floor) - 14, FLOOR + 3, max(b["x"] + b["w"] for b in floor) + 14, FLOOR + 3), BEIGE, 5)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{view["w"]}" height="{view["h"]}" viewBox="0 {view["y"]} {view["w"]} {view["h"]}">'
           '<metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata>'
           '<g stroke-linecap="round" stroke-linejoin="round">' + "".join(drawing.out) + "</g></svg>")
    return svg.encode("utf8")


def accent_svg(spec) -> bytes:
    return _render(spec, None)


def layer_svg(spec, kind: str) -> bytes | None:
    return _render(spec, kind)


def _asset(svg: bytes, directory: Path, write: bool) -> dict:
    digest = sha256(svg)
    rel = f".authoring/agent-art/accent-{digest}.svg"
    if write:
        target = Path(directory) / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(svg)
    return {"path": rel, "category": "scene_accent", "source_sha256": digest, "creative_origin": dict(ORIGIN)}


def normalized_accent(spec, *, directory: Path, write: bool) -> dict:
    return _asset(accent_svg(spec), directory, write)


def normalized_layers(spec, *, directory: Path, write: bool) -> dict:
    """{'wall': {asset, view}, 'floor': {asset, view}} for the layers the spec actually has."""
    out = {}
    for kind in ("wall", "floor"):
        svg = layer_svg(spec, kind)
        if svg is not None:
            out[kind] = {"asset": _asset(svg, directory, write), "view": layer_view(spec, kind)}
    return out


def is_drawn_accent(asset, directory: Path) -> bool:
    """True only for an accent Core drew: right keys, content-addressed path, and the file's bytes still match the hash."""
    if not isinstance(asset, dict) or set(asset) != {"path", "category", "source_sha256", "creative_origin"}:
        return False
    match = PATH.match(str(asset["path"]))
    if not match or asset["category"] != "scene_accent" or asset["creative_origin"] != ORIGIN or match.group(1) != asset["source_sha256"]:
        return False
    try:
        return sha256((Path(directory) / asset["path"]).read_bytes()) == asset["source_sha256"]
    except OSError:
        return False
