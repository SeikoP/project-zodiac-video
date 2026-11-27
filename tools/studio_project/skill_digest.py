"""The Zodiac Phase 2 skill, as the Studio agent receives it.

The Codex agent runs isolated (no skills, no files), so Core hands it the skill text: a digest per task kind built from the
modules that kind needs. The text is trusted project guidance and goes before the untrusted task data; its hash is recorded
on the task so a stale answer can be told from a current one.
"""
from __future__ import annotations

import hashlib

from .service import ROOT

SKILL_DIR = ROOT / "plugins/zodiac-video-pipeline/skills/zodiac-studio-visual-production"
BUDGET_CHARS = 36000
BRIEF_BUDGET_CHARS = 56000  # the brief reads the whole skill, every module
HEADER = "## Zodiac Phase 2 skill (trusted project guidance; follow it)"

KINDS: dict[str, tuple[str, ...]] = {
    "skeleton": ("SKILL.md", "cast", "invention", "style", "concepts", "studio"),
    "scene": ("SKILL.md", "invention", "concepts", "scene", "acting", "story-visual", "studio"),
    "revise": ("SKILL.md", "invention", "concepts", "scene", "acting", "review", "studio"),
    "brief": ("SKILL.md", "brief", "invention", "concepts", "style", "cast", "scene", "acting", "story-visual", "review", "studio"),
    "stage": ("SKILL.md", "invention", "concepts", "scene", "story-visual", "studio"),
    "act": ("SKILL.md", "invention", "concepts", "acting", "story-visual", "studio"),
    "publish": ("SKILL.md", "publish", "virality", "studio"),
    "review": ("SKILL.md", "invention", "style", "scene", "review", "studio"),
}
_cache: dict[str, dict] = {}


def _read(name: str) -> str:
    path = SKILL_DIR / ("SKILL.md" if name == "SKILL.md" else f"references/{name}.md")
    return path.read_text("utf8").strip()


def digest(kind: str) -> dict:
    """{"text", "sha256", "modules"} for a task kind; KeyError for an unknown kind, FileNotFoundError for a missing module."""
    modules = KINDS[kind]
    if kind not in _cache:
        parts = [_read(name) for name in modules]
        text = HEADER + "\n\n" + "\n\n".join(parts)
        _cache[kind] = {"text": text, "sha256": hashlib.sha256(text.encode("utf8")).hexdigest(), "modules": list(modules)}
    return _cache[kind]
