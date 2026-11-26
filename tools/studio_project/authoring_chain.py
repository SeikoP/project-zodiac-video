"""The constructive authoring chain: cast, then each scene (stage, act, Core assembles, look) with bounded re-choices.

The model only picks from menus; Core places everything. A finding is routed (`pipeline.failure_policy.route`): Core repairs
what a rule can repair, the model gets at most MAX_RECHOICES new choices per scene with the findings attached, and anything
left (or any missing art) becomes an owner `Card` whose default keeps the scene as it is. Nothing here approves anything.

`run_chain` talks to the project through an `io` object (see `LiveIO`), so the loop is testable without a model. Finished parts
are stored after every scene together with a fingerprint of the inputs they were authored against: a changed voice, source,
catalog or instruction discards them, an app reset resumes from them.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from dataclasses import dataclass, field
from typing import Callable

from .models import StudioError
from .pipeline.failure_policy import route

MAX_RECHOICES = 2
# Findings the episode-level proposal completes itself (story-visual briefs and coverage are filled in by `agent_authoring.proposal`),
# so a single scene checked alone must not spend the model's re-choices on them.
COMPLETED_LATER = frozenset({"NARRATIVE_BRIEF_REQUIRED", "STORY_VISUAL_ASSET_ROLE_INVALID", "STORY_VISUAL_COVERAGE_MISSING"})
PARALLEL_SCENES = 2
CARD_OPTIONS = ("accept", "restage", "redo")


def enabled() -> bool:
    """ZODIAC_STUDIO_CHAIN: 'on' (default) authors with the constructive chain, 'off' keeps the single-blob scene-by-scene path."""
    return os.environ.get("ZODIAC_STUDIO_CHAIN", "on").strip().lower() not in ("off", "0", "false")


class ChoiceError(Exception):
    """The model could not give a schema-valid choice."""


@dataclass(frozen=True)
class Card:
    scene_id: str
    reason: str
    options: tuple = CARD_OPTIONS
    default: str = "accept"


@dataclass
class SceneOutcome:
    status: str  # "ok" | "card" | "failed"
    rechoices: int = 0
    still: str | None = None


@dataclass
class ChainResult:
    proposal: dict | None
    cards: list = field(default_factory=list)
    scenes: dict = field(default_factory=dict)


def _summary(issues: list[dict]) -> str:
    return "; ".join(sorted({str(i.get("code") or "UNKNOWN") + (f" ({i['detail']})" if i.get("detail") else "") for i in issues}))


def _author_scene(io, skeleton: str, sid: str) -> dict:
    """One scene: choose, assemble, look, repair. Returns {text, status, rechoices, reason}."""
    feedback, rechoices = None, 0
    while True:
        try:
            stage = io.choose("stage", *io.stage_request(skeleton, sid, feedback))
            act = io.choose("act", *io.act_request(skeleton, sid, stage, feedback))
            part = io.assemble(skeleton, sid, stage, act)
        except ChoiceError as error:
            return {"text": None, "status": "failed", "rechoices": rechoices, "reason": str(error)}
        text = part["text"]
        issues = io.check_scene(skeleton, sid, text)
        core = [i for i in issues if route(i) == "core"]
        if core:  # a rule repairs these; the model is never asked
            text = io.core_fix(sid, text, core)
            issues = io.check_scene(skeleton, sid, text)
        reasons = [f"thiếu art: {r.get('wanted')}" for r in part.get("asset_requests") or []]
        reasons += [f"cần chủ quyết: {_summary([i])}" for i in issues if route(i) == "owner"]
        reasons += [f"Core không sửa được: {_summary([i])}" for i in issues if route(i) == "core"]
        model = [i for i in issues if route(i) == "model"]
        if model and rechoices < MAX_RECHOICES and not reasons:
            rechoices += 1
            feedback = [{"code": i.get("code"), "detail": i.get("detail")} for i in model]
            continue
        if model:
            reasons.append(f"đã chọn lại {rechoices} lần, còn: {_summary(model)}")
        status = "card" if reasons else "ok"
        return {"text": text, "status": status, "rechoices": rechoices, "reason": "; ".join(reasons)}


def run_chain(io, *, stopped: Callable[[], bool]) -> ChainResult:
    """Cast, then the scenes PARALLEL_SCENES at a time. `proposal` is None while any scene is unfinished or failed."""
    order = io.scene_ids()
    stored = io.load() or {}
    if stored.get("fingerprint") != io.fingerprint():
        stored = {"fingerprint": io.fingerprint(), "skeleton": None, "scenes": {}}
    lock = threading.Lock()
    if not stored.get("skeleton"):
        if stopped():
            return ChainResult(None)
        stored["skeleton"] = io.skeleton()
        io.save(stored)
    skeleton = stored["skeleton"]
    outcomes: dict[str, SceneOutcome] = {}
    cards: list[Card] = []
    for sid, row in list(stored["scenes"].items()):
        if sid in order and row.get("text"):
            outcomes[sid] = SceneOutcome(row["status"], row.get("rechoices", 0), row.get("still"))
            if row["status"] == "card":
                cards.append(Card(sid, row.get("reason", "")))

    def work(sid: str) -> None:
        if stopped():
            return
        row = _author_scene(io, skeleton, sid)
        with lock:
            if row["status"] == "failed":
                outcomes[sid] = SceneOutcome("failed", row["rechoices"])
                return
            stored["scenes"][sid] = {k: row[k] for k in ("text", "status", "rechoices", "reason")}
            io.save(stored)
            outcomes[sid] = SceneOutcome(row["status"], row["rechoices"])
            if row["status"] == "card":
                cards.append(Card(sid, row["reason"]))

    todo = [sid for sid in order if sid not in outcomes]
    with ThreadPoolExecutor(max_workers=PARALLEL_SCENES) as pool:
        list(pool.map(work, todo))
    done = all(sid in outcomes and outcomes[sid].status != "failed" for sid in order)
    proposal = None
    if done:
        texts = {sid: stored["scenes"][sid]["text"] for sid in order}
        proposal = {"text": io.merge(skeleton, texts, order)}
    return ChainResult(proposal, sorted(cards, key=lambda c: order.index(c.scene_id)), {sid: outcomes[sid] for sid in order if sid in outcomes})


class LiveIO:
    """The chain's ports on a real project: Codex choices through the bridge, Core assembly, the pipeline's own checks.

    The look at a built frame (vision) joins in Task 7 when the chain is wired into the node, because it needs the scene built
    by the episode build; until then `check_scene` runs the plugin's scene validators for that scene.
    """

    STORE = ".runtime/chain-parts.json"
    WAIT_SECONDS = 300.0

    def __init__(self, service, project_id: str, instruction: str, capsule: dict | None = None):
        from . import agent_authoring
        self.service, self.project_id = service, project_id
        self.on_save = None  # progress hook: called with the stored state after every scene
        self.capsule = capsule or agent_authoring.capsule(service, project_id, instruction)
        self.workspace = service.visual._handle(project_id).workspace
        self.words = (service.voice.snapshot(project_id).get("timing") or {}).get("words") or []
        self._fingerprint = agent_authoring.canonical_hash({
            "dependencies": self.capsule.get("dependencies"), "source": self.capsule.get("source_hash"),
            "catalog": agent_authoring.canonical_hash(self.capsule["catalog"]), "instruction": instruction})

    def fingerprint(self) -> str:
        return self._fingerprint

    def scene_ids(self) -> list[str]:
        return [row["id"] for row in self.capsule["scene_ranges"]]

    def load(self) -> dict:
        try:
            return json.loads((self.workspace / self.STORE).read_text("utf8"))
        except (OSError, ValueError):
            return {}

    def save(self, state: dict) -> None:
        path = self.workspace / self.STORE
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False), "utf8")
        tmp.replace(path)
        if self.on_save:
            self.on_save(state)

    def _wait(self, task_id: str) -> dict:
        end = time.monotonic() + self.WAIT_SECONDS
        while time.monotonic() < end:
            task = self.service.agent.task(task_id)
            if task["status"] in ("COMPLETED", "FAILED", "CANCELLED", "INTERRUPTED"):
                return task
            time.sleep(0.5)
        raise ChoiceError("hết thời gian chờ agent")

    def skeleton(self) -> str:
        from . import agent_parts
        kept = agent_parts.existing_skeleton(self.capsule)
        if kept is not None:
            return kept
        error = "không rõ"
        for _ in range(2):
            task = self._wait(self.service.agent.start(self.project_id, part_task=agent_parts.skeleton_task(self.capsule))["task_id"])
            if task["status"] == "COMPLETED" and task.get("suggestion"):
                return task["suggestion"]
            error = str(task.get("error") or task["status"])[:200]
        raise ChoiceError(f"cast: {error}")

    def choose(self, kind: str, schema: dict, data: dict) -> dict:
        error = "không rõ"
        for _ in range(2):  # a failed or schema-invalid reply is asked once more before the scene gives up
            task = self._wait(self._start_choice(schema, data, kind)["task_id"])
            if task["status"] == "COMPLETED" and task.get("suggestion"):
                return json.loads(task["suggestion"])
            error = str(task.get("error") or task["status"])[:200]
        raise ChoiceError(f"{kind}: {error}")

    def _start_choice(self, schema: dict, data: dict, kind: str) -> dict:
        end = time.monotonic() + self.WAIT_SECONDS
        while True:  # a full agent slot is a wait, not a failure
            try:
                return self.service.agent.start_choice(self.project_id, schema, data, skill=kind)
            except StudioError as error:
                if error.code != "AGENT_BUSY" or time.monotonic() > end:
                    raise ChoiceError(f"{kind}: {error}") from error
                time.sleep(1.0)

    def _row(self, sid: str) -> dict:
        return next(r for r in self.capsule["scene_ranges"] if r["id"] == sid)

    @staticmethod
    def _intent(skeleton: str) -> dict:
        return json.loads(skeleton)["payload"]["intent"]

    def _menus(self, skeleton: str, sid: str) -> dict:
        from . import authoring_menus
        return authoring_menus.scene_menus(self.capsule, self._intent(skeleton), sid, self.words)

    def _goal(self, sid: str) -> str:
        return self._row(sid)["text"][:80]

    def stage_request(self, skeleton: str, sid: str, feedback):
        from . import authoring_menus
        menus = self._menus(skeleton, sid)
        data = authoring_menus.stage_data(menus, sid, self._row(sid)["text"], self._goal(sid))
        if feedback:
            data["previous_findings"] = feedback
        return authoring_menus.stage_schema(menus), data

    def act_request(self, skeleton: str, sid: str, stage: dict, feedback):
        from . import authoring_menus
        menus = self._menus(skeleton, sid)
        data = {"scene_id": sid, "scene_text": self._row(sid)["text"], "goal": self._goal(sid), "stage": stage,
                "anchors": [{"id": a["id"], "text": a["text"]} for a in menus["anchors"]],
                "targets": [p["prop_id"] for p in stage["props"]] + [p["entity_id"] for p in stage["present"]]}
        if feedback:
            data["previous_findings"] = feedback
        return authoring_menus.act_schema(menus, stage), data

    def assemble(self, skeleton: str, sid: str, stage: dict, act: dict) -> dict:
        from . import agent_parts, scene_assembler
        row, intent = self._row(sid), self._intent(skeleton)
        menus = self._menus(skeleton, sid)
        visuals = scene_assembler.story_visual_assets(self.capsule, intent.get("assets") or {}, sid)
        try:
            part = scene_assembler.assemble_scene(menus, stage, act, sid, row["narration_range"], row["text"], self._goal(sid),
                                                  story_visuals=visuals, art_dir=self.workspace)
            task = {"scene_id": sid, "scene_range": row["narration_range"], "scene_text": row["text"],
                    "cast": [{"entity_id": m["entity_id"], "states": sorted(m["states"])} for m in intent["cast"]],
                    "story_visual_assets": visuals}
            text = agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), task)
        except (ValueError, KeyError, TypeError) as error:  # an id outside the menus or a malformed choice
            raise ChoiceError(f"assemble: {str(error)[:200]}") from error
        return {"text": text, "asset_requests": part.get("asset_requests") or [], "notes": part.get("core_notes") or []}

    def check_scene(self, skeleton: str, sid: str, text: str) -> list[dict]:
        from .pipeline.validators import node_runner
        payload = json.loads(text)["payload"]
        intent = json.loads(json.dumps(self._intent(skeleton)))
        intent["scenes"] = [payload["scene"]]
        intent["assets"] = {**(intent.get("assets") or {}), **(payload.get("assets") or {})}
        found: list[dict] = []
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp)
            sources = [self.workspace / "narration.txt", self.workspace / "studio-import-receipt.json",
                       *(self.workspace / ".authoring").glob("*.json")]
            for source in sources:
                if source.is_file() and source.name != "visual-intent.json":
                    target = copy / source.relative_to(self.workspace)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, target)
            if (self.workspace / ".authoring/agent-art").is_dir():
                shutil.copytree(self.workspace / ".authoring/agent-art", copy / ".authoring/agent-art")
            (copy / ".authoring/visual-intent.json").write_text(json.dumps(intent, ensure_ascii=False), "utf8")
            for result in node_runner(copy, ("scene-experience", "story-visual-presence", "authoring-completeness")):
                for issue in result.get("issues", []):
                    if issue.get("scene_id") == sid and issue.get("code") not in COMPLETED_LATER:
                        found.append({"code": issue.get("code"), "detail": result.get("name")})
        return found

    def core_fix(self, sid: str, text: str, issues: list[dict]) -> str:
        from .scene_repairs import prune_non_story_references
        data = json.loads(text)
        prune_non_story_references(data["payload"]["scene"])
        return json.dumps(data, ensure_ascii=False)

    def merge(self, skeleton: str, texts: dict, order: list[str]) -> str:
        from . import agent_parts
        return agent_parts.merge(skeleton, texts, order)
