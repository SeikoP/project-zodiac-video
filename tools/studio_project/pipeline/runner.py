"""Dispatch a pipeline node to the existing services. Never writes files, never approves."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from ..models import StudioError
from . import agent_runs
from .api import pipeline_get, registry as default_registry
from .registry import Registry

AUTHORING_INSTRUCTION = ("Soạn Visual Intent cho cả episode từ nội dung đã duyệt và giọng đã đo, "
                         "theo luật Phase 2 của plugin; không đổi narration.")
VISUAL_DOMAIN = frozenset({"scene.compile", "episode.build", "video.export"})


def _error(code: str, message: str) -> StudioError:
    return StudioError(code, message, "pipeline")


@dataclass(frozen=True)
class RunContext:
    service: object
    project_id: str
    node_id: str
    spec_id: str
    scene_id: str | None
    base_revision: int
    graph: dict


Executor = Callable[[RunContext], dict | None]


def _voice(ctx: RunContext):
    voice = ctx.service.voice.snapshot(ctx.project_id)
    revision, name = voice["revision"], voice["voice"]
    if ctx.spec_id == "timing":
        return ctx.service.voice.start(ctx.project_id, "align", [], name, "NORMAL", {}, revision)
    units = voice.get("units") or []
    missing = [u["id"] for u in units if not u.get("selected_take") or not any(
        t.get("take_id") == u["selected_take"] and t.get("valid") is not False for t in u.get("takes", []))]
    if units and not missing:  # every unit has a take: assemble them
        return ctx.service.voice.assemble(ctx.project_id, revision)
    return ctx.service.voice.start(ctx.project_id, "generate", missing, name, "NORMAL", {}, revision)


_EXECUTORS: dict[str, Executor] = {
    "voice.start": _voice,
    "agent.author.start": lambda c: c.service.agent.start_authoring_scenes(c.project_id, AUTHORING_INSTRUCTION),
    "scene.compile": lambda c: c.service.visual.start(c.project_id, c.base_revision, c.scene_id),
    "episode.build": lambda c: c.service.visual.start(c.project_id, c.base_revision),
    "video.export": lambda c: c.service.visual.export(c.project_id, c.base_revision),
    "validators.run": lambda c: _checks(c),
    "assets.resolve": lambda c: _drafted(c),
    "agent.cover.start": lambda c: _drafted(c),
    "agent.publish.start": lambda c: _drafted(c),
    "agent.inspect.start": lambda c: _drafted(c),
}


def _drafted(ctx):
    """Steps without a model task: a deterministic draft, validated and receipted like an agent proposal.
    Clicking Chạy is the confirmation, so this also works in confirm mode."""
    from . import drafts, proposals
    if ctx.spec_id == "assets":
        return drafts.record_assets(ctx.service, ctx.project_id)
    kind, payload = drafts.draft(ctx.service, ctx.project_id, ctx.spec_id)
    return proposals.apply_proposal(ctx.service, ctx.project_id, kind, payload, ctx.base_revision, f"draft-{ctx.spec_id}-{ctx.base_revision}")



def _checks(ctx):
    from .registry import load_registry  # noqa: F401  (keeps import order explicit)
    from .validators import checks_executor
    node = load_registry().spec("checks")
    return checks_executor(node.agent.validators)(ctx)


def register_executor(name: str, executor: Executor | None) -> None:
    """Later tasks add validators/assets/cover/publish/inspect; passing None unregisters."""
    if executor is None:
        _EXECUTORS.pop(name, None)
    else:
        _EXECUTORS[name] = executor


def run_node(service, project_id: str, node_id: str, base_revision: int, *,
             caller: Literal["gui", "autopilot", "agent"], registry: Registry | None = None) -> dict:
    reg = registry or default_registry()
    graph = pipeline_get(service, project_id)
    nodes = {n["id"]: n for n in graph["nodes"]}
    node = nodes.get(node_id)
    if node is None:
        raise _error("PIPELINE_NODE_UNKNOWN", node_id)
    spec = reg.spec(node_id.split(":")[0])
    if caller not in ("gui", "autopilot") or spec.kind == "gate":
        raise _error("PIPELINE_GATE_USER_ONLY", f"{node_id}: chỉ người dùng được hoàn thành bước duyệt hoặc chạy từ GUI")
    for name in node["inputs"]:
        if nodes[name]["status"] != "DONE":
            code = "PIPELINE_NODE_BLOCKED" if nodes[name]["status"] == "BLOCKED" else "PIPELINE_INPUT_NOT_READY"
            raise _error(code, f"{node_id}: bước {name} chưa xong ({nodes[name]['status']})")
    if node["status"] == "BLOCKED":
        raise _error("PIPELINE_NODE_BLOCKED", node_id)
    if any(n["status"] == "RUNNING" for n in graph["nodes"]):
        raise _error("PIPELINE_BUSY", "Một bước khác đang chạy")
    executor = _EXECUTORS.get(spec.executor or "")
    if executor is None:
        raise _error("PIPELINE_EXECUTOR_UNAVAILABLE", f"{node_id}: chưa hỗ trợ trong Studio ({spec.executor})")
    result = executor(RunContext(service, project_id, node_id, spec.id, node["scene_id"], base_revision, graph))
    if (spec.executor or "").startswith("agent.") and isinstance(result, dict) and result.get("task_id"):
        agent_runs.track(service, project_id, node_id, result["task_id"])
    return pipeline_get(service, project_id)


def cancel_running(service, project_id: str) -> dict:
    graph = pipeline_get(service, project_id)
    running = next((n for n in graph["nodes"] if n["status"] == "RUNNING"), None)
    if running is None:
        raise _error("PIPELINE_NOTHING_RUNNING", "Không có bước nào đang chạy")
    entry = agent_runs.tracked(service, project_id)
    if entry and entry[0] == running["id"]:
        service.agent.cancel(entry[1])
        agent_runs.forget(service, project_id)
    elif running["id"] in ("voice", "timing"):
        service.voice.cancel(project_id)
    else:
        service.visual.cancel(project_id)
    return pipeline_get(service, project_id)
