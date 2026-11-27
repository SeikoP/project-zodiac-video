"""Does the script itself call for a story picture? Studio decides this from the narration, never from Phase 1.

The model may still choose 'none' for a scene, but an episode in which no scene shows any countable, comparable or written fact is
refused: Core reads each scene's words for such facts and names the scenes that most plainly state one. Deterministic, no model call.
"""
from __future__ import annotations

import re

CODE = "STORY_GRAPHIC_EXPECTED"
STRONG = 2  # a scene stating facts of two kinds is always sent back when it chose no picture

_NUMBER = r"(?:\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)"
SIGNALS = {
    "chat_thread": re.compile(r"nhắn|tin nhắn|gửi|“[^”]{4,}”|\"[^\"]{4,}\"|trả lời tin", re.I),
    "versus": re.compile(r"một bên|bên kia|đứa này|đứa kia|người này|người kia|hai (?:đứa|bên|phía|người)|bên nào|còn .{1,40} thì", re.I),
    "tally": re.compile(rf"\b{_NUMBER}\s+(?:lần|ngày|người|cái|món|câu|tin)\b|mỗi lần|lần nào|liên tục|lặp lại", re.I),
    "meter": re.compile(r"\d+\s*%|phần trăm|mức độ|quá (?:nhiều|ít)|nhiều hơn|ít hơn", re.I),
    "stamp": re.compile(r"kết luận|phán xử|phán quyết|bị coi là|gọi là|nhãn|hồ sơ", re.I),
}


def signals(text: str) -> list[str]:
    return [name for name, pattern in SIGNALS.items() if pattern.search(text or "")]


def quota(scene_count: int) -> int:
    """At least one picture per episode, and about one in four scenes for longer ones."""
    return max(1, round(scene_count / 4)) if scene_count else 0


def missing(scenes: list[tuple[str, str]], has_picture: set[str]) -> list[dict]:
    """[(scene_id, text)] in order + ids that already show a picture -> findings for scenes that chose none but should not have."""
    scored = [(sid, signals(text)) for sid, text in scenes]
    found: dict[str, list[str]] = {sid: sig for sid, sig in scored if sid not in has_picture and len(sig) >= STRONG}
    owed = quota(len(scenes)) - len(has_picture) - len(found)
    if owed > 0:
        ranked = sorted((row for row in scored if row[0] not in has_picture and row[0] not in found and row[1]),
                        key=lambda row: -len(row[1]))
        for sid, sig in ranked[:owed]:
            found[sid] = sig
    return [{"code": CODE, "scene_id": sid, "detail": "lời đọc nêu một sự thật có thể thấy được (" + ", ".join(sig) + "): chọn một graphic "
             "(motif gợi ý: " + sig[0] + ") thay vì 'none'; đổi motif so với các cảnh khác"} for sid, sig in found.items()]
