"""One publishing clipboard payload for Zodiac Studio.

Both Job@5 and legacy packages keep their on-disk compatibility files, but
the GUI exposes a single caption+hashtags copy action.
"""
from __future__ import annotations

import json
from pathlib import Path


def _publish_from_json(path: Path) -> str:
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError):
        return ""
    if not isinstance(obj, dict):
        return ""
    caption = obj.get("caption") or obj.get("tiktok_caption") or ""
    hashtags = obj.get("hashtags") or []
    if not isinstance(caption, str):
        caption = ""
    if isinstance(hashtags, list):
        tags = " ".join(str(tag).strip() for tag in hashtags if str(tag).strip())
    elif isinstance(hashtags, str):
        tags = hashtags.strip()
    else:
        tags = ""
    return "\n\n".join(part for part in (caption.strip(), tags) if part)


def _publish_from_copy(path: Path) -> str:
    try:
        content = path.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeDecodeError):
        return ""
    if not content:
        return ""
    caption = ""
    hashtags = ""
    for line in content.splitlines():
        left, _, right = line.partition(":")
        key = left.strip().casefold()
        if key in {"tiktok caption", "caption", "nội dung", "mô tả"}:
            caption = right.strip()
        elif key in {"hashtags", "hashtag"}:
            hashtags = right.strip()
    if caption or hashtags:
        return "\n\n".join(part for part in (caption, hashtags) if part)
    return content


def publish_text_for_job(job_root: Path) -> str:
    root = Path(job_root)
    # Prefer structured data rather than two redundant copies; preserve old
    # package schema and fall back to older publish-copy formats.
    for path in (root / "out" / "publish.json", root / "publish" / "publish.json"):
        if value := _publish_from_json(path):
            return value
    for path in (root / "out" / "publish-copy.txt", root / "publish" / "publish-copy.txt"):
        if value := _publish_from_copy(path):
            return value
    return ""
