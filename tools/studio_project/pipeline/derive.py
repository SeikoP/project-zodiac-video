"""Pure derivation of node status from evidence. No I/O: see evidence.py for the adapter."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Mapping

from .registry import Registry

NodeStatus = Literal["PENDING", "READY", "RUNNING", "DONE", "FAILED", "STALE", "BLOCKED", "AWAITING_USER"]
Receipt = Literal["NONE", "OK", "STALE"]
FORMAT = "zodiac-pipeline@1"
# Nodes whose output is bound to the built video: stale when the build no longer matches source/voice.
BUILD_BOUND = frozenset({"scene", "build", "inspect", "visual_review", "export"})


@dataclass(frozen=True)
class PipelineEvidence:
    content_approved: bool = False
    voice_units_total: int = 0
    voice_units_selected: int = 0
    voice_assembled: bool = False
    voice_listened: bool = False
    timing_ready: bool = False
    has_intent: bool = False
    visual_revision: int | None = None
    visual_source_hash: str | None = None
    scene_ids: tuple[str, ...] = ()
    built_scene_ids: frozenset[str] = frozenset()
    build_revision: int | None = None
    build_voice_fingerprint: str | None = None
    current_voice_fingerprint: str | None = None
    checks_state: Receipt = "NONE"
    assets_state: Receipt = "NONE"
    cover_state: Receipt = "NONE"
    publish_state: Receipt = "NONE"
    inspect_state: Receipt = "NONE"
    review_state: Receipt = "NONE"
    export_state: Literal["NONE", "EXPORTED", "STALE", "BLOCKED"] = "NONE"
    voice_revision: int = 0
    voice_job_done: int = 0  # progress of the running voice/timing job, when there is one
    voice_job_total: int = 0
    running_node: str | None = None
    failed: Mapping[str, str] = field(default_factory=dict)
    notes: Mapping[str, str] = field(default_factory=dict)  # live detail for a running node, e.g. agent attempt/elapsed


@dataclass(frozen=True)
class NodeState:
    node_id: str
    title: str
    kind: str
    status: NodeStatus
    inputs: tuple[str, ...]
    detail: str
    scene_id: str | None


@dataclass(frozen=True)
class PipelineGraph:
    project_id: str
    revision: int
    nodes: tuple[NodeState, ...]

    def to_dict(self) -> dict:
        return {"format": FORMAT, "project_id": self.project_id, "revision": self.revision,
                "nodes": [{"id": n.node_id, "title": n.title, "kind": n.kind, "status": n.status,
                           "inputs": list(n.inputs), "detail": n.detail, "scene_id": n.scene_id}
                          for n in self.nodes]}


def _receipt(value: str) -> str:
    return value if value in ("OK", "STALE") else "NONE"


def _own(spec_id: str, scene_id: str | None, e: PipelineEvidence) -> str:
    """The node's own evidence: OK, STALE, BLOCKED or NONE (before looking at its inputs)."""
    if spec_id == "content":
        return "OK" if e.content_approved else "NONE"
    if spec_id == "voice":
        ok = e.voice_units_total > 0 and e.voice_units_selected == e.voice_units_total and e.voice_assembled
        return "OK" if ok else "NONE"
    if spec_id == "voice_review":
        return "OK" if e.voice_listened else "NONE"
    if spec_id == "timing":
        return "OK" if e.timing_ready else "NONE"
    if spec_id == "visual":
        return "OK" if e.has_intent else "NONE"
    if spec_id == "scene":
        return "OK" if scene_id in e.built_scene_ids else "NONE"
    if spec_id == "build":
        return "OK" if e.build_revision is not None else "NONE"
    if spec_id == "export":
        return {"EXPORTED": "OK", "STALE": "STALE", "BLOCKED": "BLOCKED"}.get(e.export_state, "NONE")
    named = {"checks": e.checks_state, "assets": e.assets_state, "cover": e.cover_state,
             "publish": e.publish_state, "inspect": e.inspect_state, "visual_review": e.review_state}
    return _receipt(named[spec_id]) if spec_id in named else "NONE"  # unknown (new) nodes: no evidence yet


def _detail(status: str, node_id: str, e: PipelineEvidence) -> str:
    if node_id in e.failed and status == "FAILED":
        return e.failed[node_id]
    if status in ("RUNNING", "READY") and node_id in e.notes:
        return e.notes[node_id]
    if status == "RUNNING" and node_id in ("voice", "timing") and e.voice_job_total:
        return f"Xong {e.voice_job_done}/{e.voice_job_total}"
    if node_id == "voice":
        taken = f"{e.voice_units_selected}/{e.voice_units_total} đoạn có take"
        if status != "DONE" and e.voice_units_total and e.voice_units_selected == e.voice_units_total:
            return taken + " · còn ghép audio, bấm Chạy lần nữa"  # the second click assembles the takes
        return taken
    return {"BLOCKED": "Chưa đủ điều kiện", "PENDING": "Chờ bước trước", "AWAITING_USER": "Chờ bạn duyệt",
            "STALE": "Nguồn hoặc giọng đã đổi, cần chạy lại"}.get(status, "")


def derive(registry: Registry, evidence: PipelineEvidence, *, project_id: str, revision: int) -> PipelineGraph:
    e = evidence
    build_stale = e.build_revision is not None and (
        e.build_revision != e.visual_revision or e.build_voice_fingerprint != e.current_voice_fingerprint)
    status: dict[str, str] = {}
    titles: dict[str, str] = {}
    root: dict[str, str] = {}
    nodes: list[NodeState] = []
    for item in registry.expand(e.scene_ids):
        spec = registry.spec(item.spec_id)
        own = _own(item.spec_id, item.scene_id, e)
        inputs_done = all(status[name] == "DONE" for name in item.inputs)
        # An unconfirmed gate does not invalidate technical output that already exists (legacy flows);
        # a gate that was confirmed and later went STALE does (its status is STALE, not AWAITING_USER).
        inputs_valid = all(status[name] in ("DONE", "AWAITING_USER") for name in item.inputs)
        if item.node_id == e.running_node:
            state = "RUNNING"
        elif own == "BLOCKED":
            state = "BLOCKED"
        elif own == "OK":
            state = "DONE" if inputs_valid else "STALE"
        elif own == "STALE":
            state = "STALE"
        elif spec.kind == "gate":
            state = "BLOCKED" if not item.inputs else "AWAITING_USER" if inputs_done else "PENDING"
        else:
            state = "READY" if inputs_done else "PENDING"
        if state == "DONE" and item.spec_id in BUILD_BOUND and build_stale:
            state = "STALE"
        if state in ("READY", "STALE") and item.node_id in e.failed:
            state = "FAILED"
        status[item.node_id] = state
        if not inputs_valid:  # the earliest step that is really not done, however far upstream
            bad = next(name for name in item.inputs if status[name] not in ("DONE", "AWAITING_USER"))
            root[item.node_id] = root.get(bad, bad)
        detail = _detail(state, item.node_id, e)
        if state == "STALE" and own == "OK" and not inputs_valid and not (item.spec_id in BUILD_BOUND and build_stale):
            # Output exists but an earlier step is not done (e.g. checks failed): do not blame source/voice changes.
            detail = f"Đã dựng nhưng bước trước chưa đạt: {titles.get(root[item.node_id], root[item.node_id])}"
        titles[item.node_id] = spec.title
        nodes.append(NodeState(item.node_id, spec.title if not item.scene_id else f"{spec.title} {item.scene_id}", spec.kind, state,
                               item.inputs, detail, item.scene_id))  # type: ignore[arg-type]
    return PipelineGraph(project_id, revision, tuple(nodes))
