"""Deterministic native SVG art for Story Visual lettering, not an arbitrary chat board.
Canonical entity role remains story_visual; text is part of its rendered state.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

FONT = Path(__file__).resolve().parents[2] / "runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf"
INK, PAPER, TEAL, CORAL, GOLD = "#2F3C44", "#FFFCF7", "#82BFB4", "#E97A66", "#F2C45C"
ALLOWED = {"story_text", "chat_compare", "tally", "chat_thread"}
CLEAN = re.compile(r"^[^<>\x00-\x1f]{1,90}$", re.UNICODE)


def reject(reason):
    raise ValueError("STORY_VISUAL_ART_INVALID " + reason)


def _text(value, limit=60):
    if not isinstance(value, str) or len(value) > limit or not CLEAN.fullmatch(value) or not value.strip():
        reject("text")
    return " ".join(value.split())


class Letterer:
    def __init__(self):
        self.font = TTFont(FONT)
        self.glyphset = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.metrics = self.font["hmtx"].metrics
        self.units = self.font["head"].unitsPerEm
        self.paths = {}

    def _glyph(self, ch):
        name = self.cmap.get(ord(ch))
        if name is None:
            reject("font_missing_glyph")
        if name not in self.paths:
            pen = SVGPathPen(self.glyphset)
            self.glyphset[name].draw(pen)
            self.paths[name] = pen.getCommands()
        return name, self.paths[name]

    def width(self, text, size):
        return sum(self.metrics[self._glyph(c)[0]][0] for c in text) * size / self.units

    def wrap(self, text, size, max_width, max_lines=2):
        lines = [""]
        for word in text.split():
            candidate = (lines[-1] + " " + word).strip()
            if self.width(candidate, size) <= max_width:
                lines[-1] = candidate
            elif len(lines) < max_lines:
                if self.width(word, size) > max_width:reject(f"word_overflow: {word!r} is wider than the box; use a shorter word")
                lines.append(word)
            else:
                reject(f"text_overflow: {text!r} needs more than {max_lines} line(s); shorten it (about {max(8, len(text) * 2 // 3)} characters)")
        return lines

    def draw(self, text, x, baseline, size, color=INK, align="left"):
        scale = size / self.units
        if align == "center":
            x -= self.width(text, size) / 2
        parts = [f'<g fill="{color}" transform="translate({x:.2f} {baseline:.2f}) scale({scale:.5f} {-scale:.5f})">']
        at = 0
        for ch in text:
            name, d = self._glyph(ch)
            if d:
                parts.append(f'<path transform="translate({at} 0)" d="{d}"/>')
            at += self.metrics[name][0]
        parts.append("</g>")
        return "".join(parts)

    def block(self, text, x, baseline, size, max_width, color=INK, max_lines=2, align="left"):
        lines = self.wrap(text, size, max_width, max_lines)
        return "".join(self.draw(line, x, baseline + index * size * 1.17, size, color, align)
                       for index, line in enumerate(lines))


def steps(spec) -> int:
    """How many states the picture has when it is revealed one piece at a time: a chat_compare shows left then both; a tally one
    cell per count; a chat_thread one message per step; a story_text appears once."""
    if not isinstance(spec, dict) or spec.get("type") not in ALLOWED:
        reject("type")
    return {"story_text": 1, "chat_compare": 2, "tally": int(spec.get("count", 0)) if isinstance(spec.get("count"), int) else 0,
            "chat_thread": len(spec.get("messages") or [])}[spec["type"]]


def _tally(letterer, spec, step):
    if set(spec) != {"type", "title", "count", "caption"} or not isinstance(spec["count"], int) or isinstance(spec["count"], bool) or not 2 <= spec["count"] <= 5:
        reject("tally_fields")
    title, caption = _text(spec["title"], 28), _text(spec["caption"], 40)
    count, shown = spec["count"], spec["count"] if step is None else max(0, min(step, spec["count"]))
    width = 960
    cell, gap = 150, 24
    left = (width - (count * cell + (count - 1) * gap)) / 2
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="430" viewBox="0 0 960 430">',
           f'<rect x="12" y="12" width="936" height="406" rx="40" fill="{PAPER}" stroke="{INK}" stroke-width="8"/>',
           letterer.block(title, 480, 96, 54, 840, INK, 1, "center")]
    for index in range(count):
        x = left + index * (cell + gap)
        on = index < shown
        out += [f'<rect x="{x:.1f}" y="140" width="{cell}" height="{cell}" rx="30" fill="{CORAL if on else "#E9E6DF"}" stroke="{INK}" stroke-width="{7 if on else 4}" opacity="{1 if on else .55}"/>']
        if on:
            out.append(letterer.draw(str(index + 1), x + cell / 2, 140 + cell / 2 + 28, 84, INK, "center"))
    if shown >= count:
        out.append(letterer.block(caption, 480, 372, 50, 840, INK, 1, "center"))
    out.append("</svg>")
    return out


def _thread(letterer, spec, step):
    messages = spec.get("messages")
    if set(spec) != {"type", "title", "messages"} or not isinstance(messages, list) or not 2 <= len(messages) <= 4:
        reject("chat_thread_fields")
    title = _text(spec["title"], 20)
    rows = []
    for item in messages:
        if not isinstance(item, dict) or set(item) != {"from", "text"} or item["from"] not in ("me", "them"):
            reject("chat_thread_message")
        rows.append((item["from"], _text(item["text"], 46)))
    shown = len(rows) if step is None else max(0, min(step, len(rows)))
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="690" viewBox="0 0 960 690">',
           f'<rect x="12" y="12" width="936" height="666" rx="44" fill="{PAPER}" stroke="{INK}" stroke-width="8"/>',
           f'<rect x="17" y="17" width="926" height="112" rx="40" fill="{TEAL}" opacity=".65"/>',
           letterer.block(title, 480, 92, 54, 760, INK, 1, "center")]
    y = 160
    for index, (who, text) in enumerate(rows):
        if index >= shown:
            break
        mine = who == "me"
        fill = CORAL if mine else "#E9E6DF"
        x = 470 if mine else 52
        out += [f'<rect x="{x}" y="{y}" width="438" height="118" rx="30" fill="{fill}"/>',
                letterer.block(text, x + 24, y + 52, 42, 392, INK, 2)]
        y += 138
    out.append("</svg>")
    return out


def visual_svg(spec, step=None):
    if not isinstance(spec, dict) or spec.get("type") not in ALLOWED:
        reject("type")
    letterer = Letterer()
    if spec["type"] == "tally":
        elements = _tally(letterer, spec, step)
    elif spec["type"] == "chat_thread":
        elements = _thread(letterer, spec, step)
    elif spec["type"] == "story_text":
        if set(spec) != {"type", "text", "purpose"} or spec["purpose"] not in ("contrast", "annotation", "payoff", "dialogue"):
            reject("story_text_fields")
        text = _text(spec["text"], 68)
        size = 74 if letterer.width(text, 74) < 780 else 61
        if len(letterer.wrap(text, size, 810, 2)) > 2:reject("story_text_lines")
        elements = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="350" viewBox="0 0 960 350">',
            '<path d="M72 220 Q480 250 895 218" fill="none" stroke="#F2C45C" stroke-width="27" stroke-linecap="round" opacity=".75"/>',
            '<path d="M88 70 Q84 52 100 46 M855 47 Q873 70 882 88" fill="none" stroke="#E97A66" stroke-width="9" stroke-linecap="round"/>',
            letterer.block(text,480,163,size,810,INK,2,"center"),
            '<path d="M875 258 l24 -11 -8 27" fill="none" stroke="#2F3C44" stroke-width="7" stroke-linecap="round"/>',
            '</svg>'
        ]
    else:
        if set(spec) != {"type", "left", "right"}:reject("chat_compare_fields")
        panels = []
        for side in ("left", "right"):
            data = spec[side]
            if not isinstance(data, dict) or set(data) != {"sender", "question", "reply"}:
                reject("chat_fields")
            panels.append({field: _text(data[field], 20 if field == "sender" else 52)
                           for field in ("sender", "question", "reply")})
        elements = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="610" viewBox="0 0 960 610">']
        for index, entry in enumerate(panels):
            if step == 1 and index == 1:
                break  # first reveal: only the left conversation
            x = 12 + index * 486
            accent = CORAL if index == 0 else TEAL
            elements += [
                f'<rect x="{x+10}" y="22" width="456" height="560" rx="40" fill="#B8AA9F" opacity=".22"/>',
                f'<rect x="{x}" y="12" width="456" height="560" rx="39" fill="{PAPER}" stroke="{INK}" stroke-width="8"/>',
                f'<rect x="{x+5}" y="17" width="446" height="120" rx="34" fill="{accent}" opacity=".65"/>',
                f'<circle cx="{x+58}" cy="76" r="28" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>',
                f'<path d="M{x+46} 83 q12 -26 24 0" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>',
                letterer.block(entry["sender"], x+107, 89, 47, 322, INK, 1),
                f'<rect x="{x+32}" y="163" width="380" height="146" rx="30" fill="#E9E6DF"/>',
                letterer.block(entry["question"], x+52, 219, 43, 336, INK),
                f'<rect x="{x+62}" y="357" width="350" height="155" rx="29" fill="{accent}"/>',
                letterer.draw("Nhân Mã", x+83, 400, 29, INK),
                letterer.block(entry["reply"], x+83, 452, 46, 307, INK),
                f'<path d="M{x+382} 511 l30 13 -4 -29" fill="{accent}"/>',
            ]
        elements.append("</svg>")
    data = "".join(elements).encode("utf8")
    if len(data) > 1024 * 1024:
        reject("asset_size")
    return data


def normalized_asset(spec, *, directory: Path, phase1_id: str, write: bool, step=None):
    svg = visual_svg(spec, step)
    sha = hashlib.sha256(svg).hexdigest()
    rel = ".authoring/agent-art/story-" + sha + ".svg"
    if write:
        path = directory / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() != svg:
            reject("content_hash_drift")
        path.write_bytes(svg)
    return {"path": rel, "category": "story_visual", "source_sha256": sha,
            "creative_origin": {"mode": "phase1_directed", "phase1_visual_id": phase1_id},
            "source_visual_type": spec["type"]}


def visual_schema():
    return (
        "Optional Story Visual assets using one canonical entity kind:'story_visual',visual_role:'story_visual'. "
        "Asset value {visual:{type:'story_text',text:'short meaningful phrase',purpose:'contrast|annotation|payoff|dialogue'}, "
        "category:'story_visual',phase1_visual_id:'approved narrative_plan.story_visuals ID'} OR "
        "{visual:{type:'chat_compare',left:{sender,question,reply},right:{sender,question,reply}}, "
        "category:'story_visual',phase1_visual_id:'approved narrative_plan.story_visuals ID'}. "
        "Two more templates REVEAL STEP BY STEP on the beat's anchors (each step is its own state): "
        "{visual:{type:'tally',title:<=28 chars,count:2-5,caption:<=40 chars shown after the last cell}, category:'story_visual',phase1_visual_id} "
        "for a repeated action that adds up (a count that reaches its meaning), and "
        "{visual:{type:'chat_thread',title:<=20,messages:[{from:'me'|'them',text:<=46}] 2-4 messages}, category:'story_visual',phase1_visual_id} "
        "for a conversation that unfolds; chat_compare also reveals left then right. "
        "Fixed boxes, so keep text SHORT: chat_compare sender <= 12 characters, question <= 34, reply <= 30 (story_text <= 40); "
        "a longer line fails validation with text_overflow. "
        "These are deterministic native vector artwork, not scene-wide text boards. "
        "Reveal by an exact voice_anchor state change, hide or replace after its story beat; "
        "keep captions in the separate caption safe zone. "
        "Story Text is lettering INSIDE Story Visual; never create a separate story_text entity."
    )
