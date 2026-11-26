"""Compose bounded Phase-2 context for one agent node from the plugin's own references."""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from ..models import StudioError
from .registry import load_registry
from .validators import Issue

PLUGIN = Path(__file__).resolve().parents[3] / "plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline"
# Manifest context_refs are logical keys; this table is the only place they map to plugin files.
REFS = {
    "phase02-work-loop": "orchestration/phase02-composition-contract.md",
    "scene-art-direction": "orchestration/scene-art-direction.md",
    "asset-library-selection": "references/asset-library.md",
    "cover-composition-v2": "references/cover-composition-v2.md",
    "publish-package": "orchestration/review-creative-and-publish.md",
    "visual-quality": "references/visual-quality.md",
    "story-visual": "references/story-visual.md",
    "visual-direction": "references/visual-direction.md",
}
DEFAULT_BUDGET = 24000


def _fit(text: str, limit: int) -> str:
    raw = text.encode("utf-8")
    return text if len(raw) <= limit else raw[:max(limit, 0)].decode("utf-8", "ignore")


def build_context(project_id: str, node_id: str, issues: Sequence[Issue], *, budget: int = DEFAULT_BUDGET) -> str:
    spec = load_registry().spec(node_id)
    if spec is None or spec.agent is None:
        raise StudioError("PIPELINE_NODE_NOT_AGENT", f"{node_id} has no agent block", "pipeline")
    head = f"# Node {spec.id}: {spec.title}\nProject: {project_id}\nProposal kind: {spec.agent.proposal_kind}\n"
    if issues:
        head += "\n## Previous attempt issues (fix these first)\n" + "\n".join(
            f"- {i.code}" + (f" [{i.scene_id}]" if i.scene_id else "") + f": {i.message}" for i in issues) + "\n"
    remaining = budget - len(head.encode("utf-8"))
    refs = [r for r in spec.agent.context_refs if r in REFS]
    parts = [head]
    for index, ref in enumerate(refs):
        share = max(remaining // (len(refs) - index), 0)
        try:
            body = (PLUGIN / REFS[ref]).read_text(encoding="utf-8")
        except OSError:
            continue
        chunk = _fit(f"\n## Reference: {ref}\n{body}\n", share)
        remaining -= len(chunk.encode("utf-8"))
        parts.append(chunk)
    return _fit("".join(parts), budget)
