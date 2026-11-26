"""Studio graphics: small Core-drawn illustrations that make one story fact visible, in motifs that differ from each other.

The approved script is the only thing fixed. Everything else is Studio's to invent, so the agent picks a motif, fills a few short
fields, and Core draws it in the channel's paper-doodle style (no raw SVG from the model). Motifs reveal piece by piece (`step`).
"""
from __future__ import annotations

from .story_visual_art import CORAL, GOLD, INK, PAPER, TEAL, _text, reject

CARD = "#E9E6DF"
MOTIFS = ("stamp", "meter", "versus", "receipt", "route", "folder")


def steps(spec) -> int:
    kind = spec["type"]
    if kind == "stamp":
        return 1
    if kind == "meter":
        return spec["level"] if isinstance(spec.get("level"), int) else 0
    if kind == "versus":
        return len((spec.get("left") or {}).get("rows") or [])
    if kind == "receipt":
        return len(spec.get("items") or [])
    if kind == "route":
        return len(spec.get("pins") or [])
    return len(spec.get("files") or [])  # folder


def _frame(width, height, color=PAPER):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            f'<rect x="12" y="12" width="{width - 24}" height="{height - 24}" rx="40" fill="{color}" stroke="{INK}" stroke-width="8"/>']


def _fields(spec, names):
    if set(spec) != set(names) | {"type"}:
        reject(f"{spec['type']}_fields")


def stamp(L, spec, step):
    _fields(spec, ("text", "sub"))
    text, sub = _text(spec["text"], 16), _text(spec["sub"], 30)
    size = 120 if L.width(text, 120) <= 700 else 92
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="430" viewBox="0 0 960 430">',
           '<g transform="rotate(-6 480 215)">',
           f'<rect x="90" y="80" width="780" height="230" rx="34" fill="none" stroke="{CORAL}" stroke-width="16"/>',
           f'<rect x="112" y="102" width="736" height="186" rx="22" fill="none" stroke="{CORAL}" stroke-width="5"/>',
           L.draw(text, 480, 232, size, CORAL, "center"), '</g>',
           L.draw(sub, 480, 380, 50, INK, "center"), '</svg>']
    return out


def meter(L, spec, step):
    _fields(spec, ("title", "left", "right", "level"))
    title, left, right = _text(spec["title"], 24), _text(spec["left"], 14), _text(spec["right"], 14)
    level = spec["level"]
    if not isinstance(level, int) or isinstance(level, bool) or not 1 <= level <= 4:
        reject("meter_level")
    shown = level if step is None else max(0, min(step, level))
    out = _frame(960, 400)
    out.append(L.block(title, 480, 100, 56, 840, INK, 1, "center"))
    for index in range(4):
        x = 80 + index * 200
        on = index < shown
        out.append(f'<rect x="{x}" y="150" width="180" height="96" rx="26" fill="{CORAL if on else CARD}" stroke="{INK}" stroke-width="{7 if on else 4}" opacity="{1 if on else .5}"/>')
    out += [L.draw(left, 80, 330, 46, INK), L.draw(right, 880, 330, 46, INK, "right") if False else L.draw(right, 880 - L.width(right, 46), 330, 46, INK), '</svg>']
    return out


def versus(L, spec, step):
    _fields(spec, ("left", "right"))
    sides = []
    for key in ("left", "right"):
        side = spec[key]
        if not isinstance(side, dict) or set(side) != {"title", "rows"} or not isinstance(side["rows"], list) or not 2 <= len(side["rows"]) <= 3:
            reject("versus_side")
        sides.append((_text(side["title"], 14), [_text(r, 24) for r in side["rows"]]))
    if len(sides[0][1]) != len(sides[1][1]):
        reject("versus_rows")
    count = len(sides[0][1])
    shown = count if step is None else max(0, min(step, count))
    height = 250 + count * 120
    out = _frame(960, height)
    for index, (title, rows) in enumerate(sides):
        x = 40 + index * 440
        accent = CORAL if index == 0 else TEAL
        out += [f'<rect x="{x}" y="40" width="420" height="96" rx="28" fill="{accent}" opacity=".7"/>', L.draw(title, x + 210, 106, 52, INK, "center")]
        for row in range(shown):
            out += [f'<rect x="{x}" y="{160 + row * 120}" width="420" height="100" rx="24" fill="{CARD}"/>', L.block(rows[row], x + 24, 224 + row * 120, 40, 372, INK, 1)]
    out.append(f'<path d="M480 150 V{height - 50}" stroke="{INK}" stroke-width="5" stroke-dasharray="14 14" fill="none"/>')
    out.append("</svg>")
    return out


def receipt(L, spec, step):
    _fields(spec, ("title", "items", "total"))
    title, total = _text(spec["title"], 20), _text(spec["total"], 24)
    items = spec["items"]
    if not isinstance(items, list) or not 2 <= len(items) <= 4:
        reject("receipt_items")
    rows = []
    for item in items:
        if not isinstance(item, dict) or set(item) != {"name", "price"}:
            reject("receipt_item")
        rows.append((_text(item["name"], 22), _text(item["price"], 8)))
    shown = len(rows) if step is None else max(0, min(step, len(rows)))
    height = 300 + len(rows) * 90
    out = _frame(760, height, "#FFFEFA")
    out += [L.block(title, 380, 100, 56, 640, INK, 1, "center"), f'<path d="M60 130 H700" stroke="{INK}" stroke-width="5" stroke-dasharray="16 12" fill="none"/>']
    for index in range(shown):
        y = 200 + index * 90
        out += [L.draw(rows[index][0], 64, y, 42, INK), L.draw(rows[index][1], 696 - L.width(rows[index][1], 42), y, 42, INK)]
    if shown >= len(rows):
        y = 230 + len(rows) * 90
        out += [f'<path d="M60 {y - 50} H700" stroke="{INK}" stroke-width="5" fill="none"/>', L.draw(total, 380, y + 10, 54, CORAL, "center")]
    out.append("</svg>")
    return out


def route(L, spec, step):
    _fields(spec, ("pins", "caption"))
    pins, caption = spec["pins"], _text(spec["caption"], 34)
    if not isinstance(pins, list) or not 2 <= len(pins) <= 4:
        reject("route_pins")
    names = [_text(p, 16) for p in pins]
    shown = len(names) if step is None else max(0, min(step, len(names)))
    out = _frame(960, 570)
    points = [(130 + index * (700 / (len(names) - 1)), 200 if index % 2 == 0 else 330) for index in range(len(names))]
    for index in range(1, shown):
        (x1, y1), (x2, y2) = points[index - 1], points[index]
        out.append(f'<path d="M{x1:.0f} {y1} C{x1 + 120:.0f} {y1} {x2 - 120:.0f} {y2} {x2:.0f} {y2}" stroke="{GOLD}" stroke-width="12" stroke-linecap="round" stroke-dasharray="4 22" fill="none"/>')
    for index in range(shown):
        x, y = points[index]
        out += [f'<circle cx="{x:.0f}" cy="{y}" r="46" fill="{CORAL}" stroke="{INK}" stroke-width="7"/>', L.draw(str(index + 1), x, y + 22, 62, INK, "center"),
                L.block(names[index], x, y + 100, 38, 190, INK, 1, "center")]
    if shown >= len(names):
        out.append(L.block(caption, 480, 535, 44, 840, INK, 1, "center"))
    out.append("</svg>")
    return out


def folder(L, spec, step):
    _fields(spec, ("name", "files"))
    name = _text(spec["name"], 28)
    files = spec["files"]
    if not isinstance(files, list) or not 1 <= len(files) <= 3:
        reject("folder_files")
    labels = [_text(f, 24) for f in files]
    shown = len(labels) if step is None else max(0, min(step, len(labels)))
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">',
           f'<path d="M30 90 Q30 40 80 40 H340 L400 100 H880 Q930 100 930 150 V500 Q930 540 880 540 H80 Q30 540 30 490 Z" fill="{GOLD}" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>',
           f'<rect x="60" y="150" width="840" height="360" rx="24" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>',
           L.block(name, 90, 124, 46, 560, INK, 1)]
    for index in range(shown):
        y = 220 + index * 100
        out += [f'<rect x="96" y="{y}" width="768" height="76" rx="18" fill="{CARD}"/>', L.draw(labels[index], 126, y + 52, 40, INK)]
    out.append("</svg>")
    return out


DRAW = {"stamp": stamp, "meter": meter, "versus": versus, "receipt": receipt, "route": route, "folder": folder}
