"""Publish copy (title, caption, hashtags, alternative hooks) written by the agent after reading the whole episode.

The rules are the skill's `virality.md` (the Studio form of the plugin's publish-virality). Core cleans what the agent returns
(hashtag syntax, banned tags, brand and sign tags, lengths) and falls back to a plain draft when the agent cannot answer.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

BRAND = "#bungmoto"
BANNED = {"#fyp", "#viral", "#xuhuong", "#foryou", "#foryoupage"}
TAG = re.compile(r"^#[^\W]+$", re.UNICODE)  # letters, digits and underscore only
TITLE_MAX, CAPTION_MAX, TAGS_MIN, TAGS_MAX = 100, 300, 5, 9


def sign_tag(sign: str) -> str:
    """'Thiên Bình' -> '#ThiênBình' (the sign as one word)."""
    return "#" + "".join(ch for ch in str(sign).title() if ch.isalnum()) if sign else ""


def clean_tags(tags, sign: str = "") -> list[str]:
    """Distinct, well-formed hashtags; the sign's tag and the brand tag are always there; at most TAGS_MAX."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in [sign_tag(sign), *(tags or []), BRAND]:
        tag = "#" + str(raw).strip().lstrip("#").replace(" ", "")
        key = unicodedata.normalize("NFC", tag).lower()
        if not TAG.match(tag) or key in BANNED or key in seen or len(tag) > 40:
            continue
        seen.add(key)
        out.append(tag)
    if len(out) > TAGS_MAX:  # keep the sign first and the brand last, trim the middle
        out = out[:TAGS_MAX - 1] + [BRAND]
    return out


def _read(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def dossier(service, project_id: str) -> dict:
    """Everything the episode carries that the copy is written from."""
    handle = service.visual._handle(project_id)
    auth = Path(handle.workspace) / ".authoring"
    brief = (_read(auth / "production-brief.json") or {}).get("brief") or {}
    narration = service.visual._narration(handle)
    scope = _read(auth / "episode-scope.json") or {}
    return {"narration": narration, "episode_scope": scope, "narrative_plan": _read(auth / "narrative-plan.json"),
            "writer_brief": _read(auth / "phase3-writer-brief.json"), "production_brief": {k: brief.get(k) for k in ("story_read", "tone", "cover")},
            "spoken_hook": narration.strip().split("\n")[0][:300], "sign": scope.get("sign") or "",
            "recent_episodes": getattr(service, "recent_copy", lambda _pid: None)(project_id)}


def schema() -> dict:
    text = lambda n: {"type": "string", "maxLength": n}  # noqa: E731
    obj = {"title": text(TITLE_MAX), "cover_hook": text(80), "caption": text(CAPTION_MAX),
           "hashtags": {"type": "array", "minItems": TAGS_MIN, "maxItems": TAGS_MAX, "items": text(40)},
           "alt_hooks": {"type": "array", "maxItems": 3, "items": text(100)}, "search_keyword": text(60)}
    return {"type": "object", "properties": obj, "required": list(obj), "additionalProperties": False}


RULES = ("Write the publish copy for this episode exactly as virality.md describes, from the narration and every document in the data. "
         "Vietnamese. Title: the sign plus this episode's specific tension, at most 100 characters. cover_hook: 6-14 words, a complete "
         "contradiction, start from production_brief.cover.hook. caption: one natural, specific line or honest question for TikTok, at most 300 "
         "characters, not a summary. hashtags: 5-9, the sign, zodiac niche, this episode's behaviour, format or audience term, and #bungmoto; no #fyp/#viral. "
         "alt_hooks: up to 3 different angles. Never copy the narration's first line as the title.")


def normalise(raw: dict, sign: str, fallback_hook: str = "") -> dict:
    """The agent's answer cleaned into the publish.copy payload (raises ValueError when it is unusable)."""
    title = str(raw.get("title") or "").strip()[:TITLE_MAX]
    caption = str(raw.get("caption") or "").strip()[:CAPTION_MAX]
    if not title or not caption:
        raise ValueError("publish copy needs a title and a caption")
    if sign and sign.lower() not in title.lower():
        title = f"{sign}: {title}"[:TITLE_MAX]
    tags = clean_tags(raw.get("hashtags"), sign)
    if len(tags) < TAGS_MIN:
        raise ValueError("publish copy needs at least five distinct hashtags")
    hooks = [str(h).strip() for h in raw.get("alt_hooks") or [] if str(h).strip()][:3]
    payload = {"title": title, "description": caption, "hashtags": tags}
    hook = str(raw.get("cover_hook") or fallback_hook or "").strip()[:80]
    if hook:
        payload["cover_hook"] = hook
    if hooks:
        payload["alt_hooks"] = hooks
    if str(raw.get("search_keyword") or "").strip():
        payload["search_keyword"] = str(raw["search_keyword"]).strip()[:60]
    return payload


def write(service, project_id: str) -> dict | None:
    """The agent-written payload, or None when the agent cannot answer (the caller then drafts a plain one)."""
    from ..authoring_chain import ChoiceError, LiveIO

    class Chooser(LiveIO):  # only the choice plumbing is needed, not a capsule
        def __init__(self):
            self.service, self.project_id = service, project_id

    try:
        data = dossier(service, project_id)
        raw = Chooser().choose("publish", schema(), {"documents": data, "rules": RULES})
        return normalise(raw, data["sign"], (data["production_brief"].get("cover") or {}).get("hook") or "")
    except (ChoiceError, ValueError, KeyError, TypeError, AttributeError, OSError):
        return None
