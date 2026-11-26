"""Declarative production-pipeline registry.

A node is data (``nodes.json``); adding a step needs a manifest entry plus an
executor, not a change to the derivation or the GUI.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal, Sequence

from ..models import StudioError

MANIFEST = Path(__file__).with_name("nodes.json")
FORMAT = "zodiac-pipeline-nodes@1"
KINDS = ("step", "gate", "fan")
# Existing RPC methods the runner may dispatch to (plus the executors added by this plan).
ALLOWED_EXECUTORS = frozenset({
    "voice.start", "agent.author.start", "scene.compile", "episode.build", "video.export",
    "validators.run", "assets.resolve", "agent.cover.start", "agent.publish.start", "agent.inspect.start",
})


def _invalid(message: str) -> StudioError:
    return StudioError("PIPELINE_REGISTRY_INVALID", message, "pipeline")


@dataclass(frozen=True)
class AgentSpec:
    proposal_kind: str
    context_refs: tuple[str, ...]
    validators: tuple[str, ...]
    max_attempts: int


@dataclass(frozen=True)
class NodeSpec:
    id: str
    title: str
    kind: Literal["step", "gate", "fan"]
    inputs: tuple[str, ...]
    executor: str | None
    fan_over: str | None
    agent: AgentSpec | None = None


@dataclass(frozen=True)
class ExpandedNode:
    node_id: str
    spec_id: str
    scene_id: str | None
    inputs: tuple[str, ...]


@dataclass(frozen=True)
class Registry:
    nodes: tuple[NodeSpec, ...]

    def spec(self, spec_id: str) -> NodeSpec:
        for node in self.nodes:
            if node.id == spec_id:
                return node
        raise StudioError("PIPELINE_NODE_UNKNOWN", spec_id, "pipeline")

    def expand(self, scene_ids: Sequence[str]) -> tuple[ExpandedNode, ...]:
        """Instantiate fan nodes per scene; inputs that name a fan node list every instance.

        A fan node with no instances is replaced by its own inputs so dependants still wait
        for the upstream step instead of becoming vacuously ready.
        """
        scenes = tuple(scene_ids)
        fans = {n.id for n in self.nodes if n.kind == "fan"}

        def resolve(inputs: Iterable[str]) -> tuple[str, ...]:
            out: list[str] = []
            for name in inputs:
                if name in fans:
                    if scenes:
                        out.extend(f"{name}:{s}" for s in scenes)
                    else:
                        out.extend(resolve(self.spec(name).inputs))
                else:
                    out.append(name)
            return tuple(dict.fromkeys(out))

        result: list[ExpandedNode] = []
        for spec in self.nodes:
            if spec.kind == "fan":
                result.extend(ExpandedNode(f"{spec.id}:{s}", spec.id, s, resolve(spec.inputs)) for s in scenes)
            else:
                result.append(ExpandedNode(spec.id, spec.id, None, resolve(spec.inputs)))
        return tuple(result)


def _agent(raw: object, node_id: str) -> AgentSpec | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise _invalid(f"{node_id}: agent must be an object")
    kind = raw.get("proposal_kind")
    attempts = raw.get("max_attempts")
    if not isinstance(kind, str) or not kind:
        raise _invalid(f"{node_id}: agent.proposal_kind required")
    if type(attempts) is not int or not 1 <= attempts <= 3:
        raise _invalid(f"{node_id}: agent.max_attempts must be 1..3")
    refs, validators = raw.get("context_refs", []), raw.get("validators", [])
    if not all(isinstance(x, str) for x in [*refs, *validators]):
        raise _invalid(f"{node_id}: agent lists must contain strings")
    return AgentSpec(kind, tuple(refs), tuple(validators), attempts)


def load_registry(path: Path | None = None, *, extra_executors: Iterable[str] = ()) -> Registry:
    try:
        raw = json.loads(Path(path or MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise _invalid(f"manifest unreadable: {exc}") from exc
    if not isinstance(raw, dict) or raw.get("format") != FORMAT or not isinstance(raw.get("nodes"), list):
        raise _invalid("unexpected manifest format")
    allowed = ALLOWED_EXECUTORS | frozenset(extra_executors)
    seen: set[str] = set()
    nodes: list[NodeSpec] = []
    for row in raw["nodes"]:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"] or ":" in row["id"]:
            raise _invalid("node id must be a non-empty string without ':'")
        node_id, kind = row["id"], row.get("kind")
        if node_id in seen:
            raise _invalid(f"duplicate node {node_id}")
        if kind not in KINDS:
            raise _invalid(f"{node_id}: kind must be one of {KINDS}")
        inputs = row.get("inputs", [])
        if not isinstance(inputs, list) or not all(isinstance(x, str) for x in inputs):
            raise _invalid(f"{node_id}: inputs must be a list of node ids")
        for name in inputs:
            if name not in seen:  # also rejects cycles and forward references
                raise _invalid(f"{node_id}: input {name} is unknown or declared later (cycle?)")
        executor = row.get("executor")
        if kind == "gate":
            if executor is not None:
                raise _invalid(f"{node_id}: a gate has no executor; only the user completes it")
        elif executor not in allowed:
            raise _invalid(f"{node_id}: executor {executor!r} is not allowed")
        fan_over = row.get("fan_over")
        if (kind == "fan") != (fan_over is not None) or fan_over not in (None, "scenes"):
            raise _invalid(f"{node_id}: fan_over must be 'scenes' on fan nodes only")
        nodes.append(NodeSpec(node_id, str(row.get("title") or node_id), kind, tuple(inputs), executor, fan_over,
                              _agent(row.get("agent"), node_id)))
        seen.add(node_id)
    return Registry(tuple(nodes))
