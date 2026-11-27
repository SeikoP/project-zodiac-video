"""The constructive authoring chain: cast, then each scene (stage, act, Core assembles, look) with bounded re-choices.

The model only picks from menus; Core places everything. A finding is routed (`pipeline.failure_policy.route`): Core repairs
what a rule can repair, the model gets at most MAX_RECHOICES new choices per scene with the findings attached, and anything
left (or any missing art) becomes an owner `Card` whose default keeps the scene as it is. Nothing here approves anything.

`run_chain` talks to the project through an `io` object (see `LiveIO`), so the loop is testable without a model. Finished parts
are stored after every scene together with a fingerprint of the inputs they were authored against: a changed voice, source,
or catalog discards them (the instruction does not), an app reset resumes from them. `LiveIO.discard()` is the explicit start from scratch.
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
from .pipeline.failure_policy import origin, route

MAX_RECHOICES = 5      # a scene is chosen again, from the choice that caused the finding, until its checks are clean (then a card)
EPISODE_ROUNDS = 3     # after the scenes are merged, findings that name a scene send that scene back through the loop
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
    reason: str = ""  # why a scene failed (the model's last error), so a failed run says what went wrong


@dataclass
class ChainResult:
    proposal: dict | None
    cards: list = field(default_factory=list)
    scenes: dict = field(default_factory=dict)


def graphic_motifs_of(text) -> list[str]:
    """The Studio graphic motifs a stored scene part uses (read from the assets Core wrote)."""
    try:
        assets = json.loads(text)["payload"].get("assets") or {}
    except (TypeError, ValueError, KeyError):
        return []
    return sorted({a["creative_origin"]["template"] for a in assets.values()
                   if isinstance(a, dict) and a.get("category") == "studio_graphic" and isinstance(a.get("creative_origin"), dict)
                   and a["creative_origin"].get("template")})


def has_story_visual(text) -> bool:
    """True when the stored scene part carries a Phase 1 story visual (which then is the scene's picture)."""
    try:
        assets = json.loads(text)["payload"].get("assets") or {}
    except (TypeError, ValueError, KeyError):
        return False
    return any(isinstance(a, dict) and a.get("category") == "story_visual" for a in assets.values())


def _keep_brief(io, record: dict) -> None:
    """Leave the production brief (or why there is none) beside the Visual Intent: chain-parts are deleted when the run finishes."""
    workspace = getattr(io, "workspace", None)
    if workspace is None:
        return
    try:
        folder = workspace / ".authoring"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "production-brief.json").write_text(json.dumps(record, ensure_ascii=False, indent=1), "utf8")
    except OSError:
        pass


def _scene_of(text):
    try:
        return json.loads(text)["payload"]
    except (TypeError, ValueError, KeyError):
        return {}


def idle_props(text) -> list[str]:
    """Props of a stored scene part that nothing ever does anything with (invention.md: a prop that only stands there is deleted)."""
    part = _scene_of(text)
    scene = part.get("scene") or {}
    moved = {e.get("target") for e in scene.get("events") or [] if isinstance(e, dict)}
    return sorted(e["id"] for e in scene.get("entities") or []
                  if isinstance(e, dict) and e.get("visual_role") == "interactive_prop" and e.get("id") not in moved)


def accent_hash(text) -> str | None:
    """The identity of the setting a stored scene part draws (the accent asset's content hash), None when it has none."""
    part = _scene_of(text)
    for e in (part.get("scene") or {}).get("entities") or []:
        if isinstance(e, dict) and e.get("kind") == "scene_accent":
            for state in (e.get("states") or {}).values():
                asset = (part.get("assets") or {}).get(state.get("asset") or state.get("asset_key") or "")
                if isinstance(asset, dict) and asset.get("source_sha256"):
                    return asset["source_sha256"]
    return None


def _summary(issues: list[dict]) -> str:
    return "; ".join(sorted({str(i.get("code") or "UNKNOWN") + (f" ({i['detail']})" if i.get("detail") else "") for i in issues}))


def _author_scene(io, skeleton: str, sid: str, *, feedback=None, rechoices: int = 0) -> dict:
    """One scene: choose, assemble, look, repair. Returns {text, status, rechoices, reason}.

    A finding sends the scene back to the choice that caused it: events and timing problems choose the act again with the stage
    kept; anything about the frame, cast, props or setting chooses the stage (and so the act) again. Each pass carries the findings."""
    stage = None
    while True:
        try:
            if stage is None:
                stage = io.choose("stage", *io.stage_request(skeleton, sid, feedback))
            act = io.choose("act", *io.act_request(skeleton, sid, stage, feedback))
            part = io.assemble(skeleton, sid, stage, act)
        except ChoiceError as error:
            if str(error).startswith("assemble:") and rechoices < MAX_RECHOICES:
                # the choice was well-formed but could not be drawn or placed: say why and choose again, from the stage
                rechoices += 1
                feedback = [{"code": "CHOICE_UNUSABLE", "detail": str(error)[:420]}]
                stage = None
                continue
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
            if any(origin(i) == "stage" for i in model):
                stage = None  # the stage itself is the cause: choose it again; act-only findings keep it
            continue
        if model:
            reasons.append(f"đã chọn lại {rechoices} lần, còn: {_summary(model)}")
        status = "card" if reasons else "ok"
        return {"text": text, "status": status, "rechoices": rechoices, "reason": "; ".join(reasons)}


def run_chain(io, *, stopped: Callable[[], bool]) -> ChainResult:
    """Cast, then the scenes PARALLEL_SCENES at a time. `proposal` is None while any scene is unfinished or failed."""
    order = io.scene_ids()
    stored = io.load() or {}
    legacy = getattr(io, "legacy_fingerprints", lambda: ())()
    if stored.get("fingerprint") in legacy:  # stored before the instruction left the fingerprint: same inputs, keep the scenes
        stored["fingerprint"] = io.fingerprint()
        io.save(stored)
    if stored.get("fingerprint") != io.fingerprint():
        stored = {"fingerprint": io.fingerprint(), "skeleton": None, "scenes": {}}
    lock = threading.Lock()
    read_brief = getattr(io, "read_brief", None)
    if read_brief is not None:  # one read of the whole script and its documents comes first; a failed read leaves the scenes to choose alone
        if not stored.get("brief") and not stopped():
            try:
                stored["brief"] = read_brief()
                io.save(stored)
                _keep_brief(io, {"brief": stored["brief"]})
            except ChoiceError as error:
                _keep_brief(io, {"failed": str(error)[:600]})  # the scenes choose alone, and the owner can see why
        io.use_brief(stored.get("brief") or {})
    if not stored.get("skeleton"):
        if stopped():
            return ChainResult(None)
        stored["skeleton"] = io.skeleton()
        wanted = [c for c in (stored.get("brief") or {}).get("characters") or [] if isinstance(c, dict) and c.get("on_screen")]
        counter = getattr(io, "cast_size", None)
        if counter and wanted and counter(stored["skeleton"]) < min(len(wanted), 4):  # the cast is smaller than the people the brief puts on screen: once more
            io.use_brief({**(stored.get("brief") or {}), "cast_findings": f"dàn nhân vật phải có đủ {min(len(wanted), 4)} người xuất hiện trên màn hình"})
            stored["skeleton"] = io.skeleton()
            io.use_brief(stored.get("brief") or {})
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
                outcomes[sid] = SceneOutcome("failed", row["rechoices"], reason=row.get("reason", ""))
                stored.setdefault("failures", {})[sid] = row.get("reason", "")
                io.save(stored)
                return
            stored.get("failures", {}).pop(sid, None)
            stored["scenes"][sid] = {k: row[k] for k in ("text", "status", "rechoices", "reason")}
            io.save(stored)
            outcomes[sid] = SceneOutcome(row["status"], row["rechoices"])
            if row["status"] == "card":
                cards.append(Card(sid, row["reason"]))

    todo = [sid for sid in order if sid not in outcomes]
    with ThreadPoolExecutor(max_workers=PARALLEL_SCENES) as pool:
        list(pool.map(work, todo))
    done = all(sid in outcomes and outcomes[sid].status != "failed" for sid in order)
    check_episode = getattr(io, "check_episode", None)
    if done and check_episode is not None:
        done = _episode_loop(io, check_episode, skeleton, order, stored, outcomes, cards, lock, stopped)
    proposal = None
    if done:
        texts = {sid: stored["scenes"][sid]["text"] for sid in order}
        proposal = {"text": io.merge(skeleton, texts, order)}
    return ChainResult(proposal, sorted(cards, key=lambda c: order.index(c.scene_id)), {sid: outcomes[sid] for sid in order if sid in outcomes})


def _episode_loop(io, check_episode, skeleton, order, stored, outcomes, cards, lock, stopped) -> bool:
    """Check the merged episode; a finding that names a scene sends that scene back through its own loop, then check again.

    Stops when nothing is left, or after EPISODE_ROUNDS; what remains becomes cards on the scenes it names (global ones on the first
    scene). Returns False only when a model call failed or the run was stopped, so no half-checked proposal is offered."""
    for round_no in range(EPISODE_ROUNDS + 1):
        texts = {sid: stored["scenes"][sid]["text"] for sid in order}
        issues = [i for i in check_episode(skeleton, texts, order) if route(i) == "model"]
        if not issues:
            # a clean episode means the quality findings an earlier run left on a scene are gone; art and owner questions stay
            for sid in order:
                row = stored["scenes"][sid]
                reason = row.get("reason") or ""
                if row.get("status") == "card" and reason and not any(k in reason for k in ("thiếu art", "cần chủ quyết", "Core không sửa được")):
                    with lock:
                        row.update(status="ok", reason="")
                        cards[:] = [c for c in cards if c.scene_id != sid]
                        outcomes[sid] = SceneOutcome("ok", outcomes[sid].rechoices)
                        io.save(stored)
            return True
        by_scene: dict[str, list[dict]] = {}
        for found in issues:
            by_scene.setdefault(found.get("scene_id") if found.get("scene_id") in order else order[0], []).append(found)
        if round_no == EPISODE_ROUNDS or stopped():
            for sid, rows in by_scene.items():
                reason = f"sau khi ghép cả tập còn: {_summary(rows)}"
                with lock:
                    cards[:] = [c for c in cards if c.scene_id != sid] + [Card(sid, reason)]
                    stored["scenes"][sid].update(status="card", reason=reason)
                    outcomes[sid] = SceneOutcome("card", outcomes[sid].rechoices)
                    io.save(stored)
            return not stopped()
        for sid, rows in by_scene.items():
            feedback = [{"code": r.get("code"), "detail": r.get("detail")} for r in rows]
            row = _author_scene(io, skeleton, sid, feedback=feedback, rechoices=outcomes[sid].rechoices)
            with lock:
                if row["status"] == "failed":
                    outcomes[sid] = SceneOutcome("failed", row["rechoices"])
                    return False
                stored["scenes"][sid] = {k: row[k] for k in ("text", "status", "rechoices", "reason")}
                outcomes[sid] = SceneOutcome(row["status"], row["rechoices"])
                cards[:] = [c for c in cards if c.scene_id != sid] + ([Card(sid, row["reason"])] if row["status"] == "card" else [])
                io.save(stored)
    return True


def discard_stored(workspace) -> bool:
    """Forget every stored part, so the next run authors the whole episode again. Only an explicit user request does this."""
    path = Path(workspace) / LiveIO.STORE
    existed = path.exists()
    path.unlink(missing_ok=True)
    return existed


class LiveIO:
    """The chain's ports on a real project: Codex choices through the bridge, Core assembly, the pipeline's own checks.

    The look at a built frame (vision) joins in Task 7 when the chain is wired into the node, because it needs the scene built
    by the episode build; until then `check_scene` runs the plugin's scene validators for that scene.
    """

    STORE = ".runtime/chain-parts.json"
    WAIT_SECONDS = 200.0  # a choice task is limited to 150 s by the bridge; past this the agent is stuck

    def __init__(self, service, project_id: str, instruction: str, capsule: dict | None = None):
        from . import agent_authoring
        self.service, self.project_id = service, project_id
        self.on_save = None  # progress hook: called with the stored state after every scene
        self.capsule = capsule or agent_authoring.capsule(service, project_id, instruction)
        self.workspace = service.visual._handle(project_id).workspace
        self.words = (service.voice.snapshot(project_id).get("timing") or {}).get("words") or []
        self._fingerprint = agent_authoring.canonical_hash({
            "dependencies": self.capsule.get("dependencies"), "source": self.capsule.get("source_hash"),
            "catalog": agent_authoring.canonical_hash(self.capsule["catalog"])})
        # The instruction is only a hint for the agents and is not part of the fingerprint: the autopilot appends the previous
        # attempt's findings to it, so a retry would otherwise throw away every scene that already succeeded.

    def fingerprint(self) -> str:
        return self._fingerprint

    def legacy_fingerprints(self) -> tuple[str, ...]:
        """Fingerprints written while the instruction was still part of it (the pipeline's own wording and this run's), so a
        run saved by an older build is resumed instead of authored again."""
        from . import agent_authoring
        from .pipeline.runner import AUTHORING_INSTRUCTION
        base = {"dependencies": self.capsule.get("dependencies"), "source": self.capsule.get("source_hash"),
                "catalog": agent_authoring.canonical_hash(self.capsule["catalog"])}
        return tuple(agent_authoring.canonical_hash({**base, "instruction": text})
                     for text in dict.fromkeys((AUTHORING_INSTRUCTION, self.capsule.get("instruction") or "")))

    def scene_ids(self) -> list[str]:
        return [row["id"] for row in self.capsule["scene_ranges"]]

    def load(self) -> dict:
        try:
            return json.loads((self.workspace / self.STORE).read_text("utf8"))
        except (OSError, ValueError):
            return {}

    def discard(self) -> bool:
        return discard_stored(self.workspace)

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
            part = agent_parts.skeleton_task(self.capsule)
            if getattr(self, "_brief", None):
                part["production_brief"] = self._brief  # the cast is designed for the story the brief read, not from scratch
            task = self._wait(self.service.agent.start(self.project_id, part_task=part, role="design")["task_id"])
            if task["status"] == "COMPLETED" and task.get("suggestion"):
                return task["suggestion"]
            error = str(task.get("error") or task["status"])[:200]
        raise ChoiceError(f"cast: {error}")

    def choose(self, kind: str, schema: dict, data: dict) -> dict:
        error = "không rõ"
        for _ in range(2):  # a failed, stuck or schema-invalid reply is asked once more before the scene gives up
            started = self._start_choice(schema, data, kind)
            try:
                task = self._wait(started["task_id"])
            except ChoiceError as stuck:
                try:
                    self.service.agent.cancel(started["task_id"])
                except Exception:
                    pass
                error = str(stuck)
                continue
            if task["status"] == "COMPLETED" and task.get("suggestion"):
                return json.loads(task["suggestion"])
            error = str(task.get("error") or task["status"])[:200]
        raise ChoiceError(f"{kind}: {error}")

    def _start_choice(self, schema: dict, data: dict, kind: str) -> dict:
        end = time.monotonic() + self.WAIT_SECONDS
        while True:  # a full agent slot is a wait, not a failure
            try:
                return self.service.agent.start_choice(self.project_id, schema, data, skill=kind, role="design")
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

    def used_motifs(self, exclude: str | None = None) -> list[str]:
        """The picture motifs the other scenes already stored, so a scene can choose a different one."""
        found = []
        for other, row in (self.load().get("scenes") or {}).items():
            if other != exclude:
                found += graphic_motifs_of(row.get("text"))
        return found

    def _dossier(self) -> dict:
        """Every document the episode carries, whole: the agent is not asked to work from a summary."""
        from . import agent_authoring
        from . import authoring_menus
        read = lambda name: (json.loads((self.workspace / ".authoring" / name).read_text("utf8"))  # noqa: E731
                             if (self.workspace / ".authoring" / name).is_file() else None)
        catalog = self.capsule.get("catalog") or {}
        return {"narration_by_scene": [{"scene_id": r["id"], "text": r["text"]} for r in self.capsule["scene_ranges"]],
                "narrative_plan": self.capsule.get("narrative_plan"), "episode_scope": self.capsule.get("episode_scope"),
                "writer_brief": read("phase3-writer-brief.json"), "voice_direction": read("voice-profile.json"),
                "duration_seconds": self.capsule.get("duration_seconds"),
                "vocabulary": {"frames": [f["id"] for f in catalog.get("frames", [])], "mechanics": [m["id"] for m in catalog.get("mechanics", [])],
                               "props": authoring_menus._prop_ids(),
                               "picture_motifs": list(authoring_menus.GRAPHIC_MOTIFS)},
                "recent_episodes": self.capsule.get("visual_reuse")}

    def read_brief(self) -> dict:
        """The production brief: one agent read of the whole script and its documents (brief.md describes it)."""
        from . import authoring_menus
        schema, data = authoring_menus.brief_schema(self.scene_ids()), authoring_menus.brief_data(self._dossier())
        brief = self.choose("brief", schema, data)
        pictures = sum(1 for row in brief.get("scenes", []) if (row.get("picture") or {}).get("motif") not in (None, "none"))
        owed = authoring_menus.pictures_owed(len(self.scene_ids()))
        if pictures < owed:  # an episode of talking characters only: ask the SAME agent to reconsider once, with the reason; its answer stands
            brief = self.choose("brief", schema, {**data, "previous_brief": brief, "previous_findings": [{
                "code": "BRIEF_PICTURES_MISSING", "detail": f"{pictures} of {len(self.scene_ids())} scenes carry a picture; an episode of this length "
                f"needs at least {owed}. Reread the script for the scenes where a viewer would follow better by SEEING a count, a comparison, "
                "messages or a verdict, and plan those; keep 'none' only where the characters already carry the beat."}]})
        return brief

    def use_brief(self, brief: dict) -> None:
        self._brief = brief or {}

    def planned(self, sid: str) -> dict | None:
        """This scene's entry of the brief plus the episode-wide lines, or None when there is no brief."""
        brief = getattr(self, "_brief", None) or {}
        row = next((r for r in brief.get("scenes", []) if r.get("scene_id") == sid), None)
        if not row:
            return None
        return {**{k: v for k, v in row.items() if k != "scene_id"}, "story_read": brief.get("story_read", ""), "tone": brief.get("tone", ""),
                "rhythm": brief.get("rhythm", ""), "characters": brief.get("characters", [])}

    def stage_request(self, skeleton: str, sid: str, feedback):
        from . import authoring_menus
        menus = self._menus(skeleton, sid)
        data = authoring_menus.stage_data(menus, sid, self._row(sid)["text"], self._goal(sid), used_motifs=self.used_motifs(exclude=sid),
                                          planned=self.planned(sid))
        if feedback:
            data["previous_findings"] = feedback
        return authoring_menus.stage_schema(menus), data

    def act_request(self, skeleton: str, sid: str, stage: dict, feedback):
        from . import authoring_menus
        menus = self._menus(skeleton, sid)
        data = {"scene_id": sid, "scene_text": self._row(sid)["text"], "goal": self._goal(sid), "stage": stage,
                "anchors": [{"id": a["id"], "text": a["text"]} for a in menus["anchors"]],
                "targets": [p["prop_id"] for p in stage["props"]] + [p["entity_id"] for p in stage["present"]]}
        if self.planned(sid):
            data["production_brief_for_this_scene"] = self.planned(sid)
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
                                                  story_visuals=visuals, art_dir=self.workspace,
                                                  story_reveal=scene_assembler.story_reveal_text(self.capsule, sid),
                                                  story_specs={k: v for k, v in (intent.get("assets") or {}).items() if isinstance(v, dict) and isinstance(v.get("visual"), dict)})
            task = {"scene_id": sid, "scene_range": row["narration_range"], "scene_text": row["text"],
                    "cast": [{"entity_id": m["entity_id"], "states": sorted(m["states"])} for m in intent["cast"]],
                    "story_visual_assets": visuals}
            text = agent_parts.validate_scene(json.dumps(part, ensure_ascii=False), task)
        except (ValueError, KeyError, TypeError) as error:  # an id outside the menus or a malformed choice
            raise ChoiceError(f"assemble: {str(error)[:420]}") from error
        return {"text": text, "asset_requests": part.get("asset_requests") or [], "notes": part.get("core_notes") or []}

    def _validator_issues(self, intent: dict) -> list[dict]:
        """The plugin's scene validators on a copy of the workspace holding `intent`: [{code, scene_id, detail}]."""
        from .pipeline.validators import node_runner
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
            (copy / ".authoring").mkdir(exist_ok=True)
            (copy / ".authoring/visual-intent.json").write_text(json.dumps(intent, ensure_ascii=False), "utf8")
            for result in node_runner(copy, ("scene-experience", "story-visual-presence", "authoring-completeness")):
                for issue in result.get("issues", []):
                    found.append({"code": issue.get("code"), "scene_id": issue.get("scene_id"), "detail": result.get("name")})
        return found

    def check_scene(self, skeleton: str, sid: str, text: str) -> list[dict]:
        payload = json.loads(text)["payload"]
        intent = json.loads(json.dumps(self._intent(skeleton)))
        intent["scenes"] = [payload["scene"]]
        intent["assets"] = {**(intent.get("assets") or {}), **(payload.get("assets") or {})}
        return [i for i in self._validator_issues(intent) if i["scene_id"] == sid and i["code"] not in COMPLETED_LATER]

    def cast_size(self, skeleton: str) -> int:
        try:
            return len(json.loads(skeleton)["payload"]["intent"].get("cast") or [])
        except (TypeError, ValueError, KeyError):
            return 0

    def check_episode(self, skeleton: str, texts: dict, order: list[str]) -> list[dict]:
        """Everything the proposal check and the plugin validators say about the merged episode, tied to scenes where they name one."""
        from . import agent_authoring, agent_parts
        found: list[dict] = []
        final = None
        try:
            merged = agent_parts.merge(skeleton, texts, order)
            text, _ = agent_authoring.bind_proposal(merged, self.capsule)
            final = agent_authoring.proposal(text, self.service, self.project_id, write_visuals=True)  # the story visual art must exist for the check
        except (StudioError, ValueError, KeyError, TypeError) as error:
            message = str(error)[:1500]
            named = agent_parts.failing_scenes(message, order)
            found += [{"code": "PROPOSAL_INVALID", "scene_id": sid, "detail": message[:300]} for sid in named]
            if not named:
                found.append({"code": "PROPOSAL_INVALID", "scene_id": None, "detail": message[:300]})
        if isinstance(final, dict):
            found += [i for i in self._validator_issues(final) if i["code"] not in COMPLETED_LATER]
        seen: dict[str, str] = {}
        for sid in order:  # the same picture motif twice reads as a template, not as a story: the later scene chooses again
            for motif in graphic_motifs_of(texts.get(sid)):
                if motif in seen and motif not in ("sketch", "hero"):  # a sketch or a hero is drawn anew each time
                    found.append({"code": "GRAPHIC_MOTIF_REPEATED", "scene_id": sid, "detail": f"{motif} đã dùng ở {seen[motif]}"})
                seen.setdefault(motif, sid)
        for sid in order:  # the scene's own object, drawn and changed by the words: without it the picture is clip-art beside the actors
            if texts.get(sid) and "hero" not in graphic_motifs_of(texts.get(sid)) and not has_story_visual(texts.get(sid)):
                found.append({"code": "HERO_MISSING", "scene_id": sid,
                              "detail": "cảnh chưa có vật chính do agent vẽ: chọn graphic motif 'hero', vẽ đúng vật mà lời đọc nói tới ở 2-4 trạng thái "
                                        "đổi theo từng câu (nguyên → cắt → trao…), mỗi trạng thái một neo lời"})
        for sid in order:  # a prop that nothing acts on is decoration: the scene's act is chosen again with the prop doing something
            idle = idle_props(texts.get(sid))
            if idle:
                found.append({"code": "PROP_IDLE", "scene_id": sid,
                              "detail": f"{', '.join(idle)} đứng yên, không có sự kiện nào dùng đến; cho nhân vật làm gì đó với vật (đưa, cầm, đẩy, mở) hoặc bỏ vật"})
        used: dict[str, list[str]] = {}
        for sid in order:  # the same drawn setting behind most of the episode reads as one room, not a story
            digest = accent_hash(texts.get(sid))
            if digest:
                used.setdefault(digest, []).append(sid)
        for digest, sids in used.items():
            if len(sids) >= 3:
                found += [{"code": "SETTING_REPEATED", "scene_id": sid, "detail": f"cùng một bối cảnh ở {len(sids)} cảnh ({', '.join(sids)}); vẽ nơi chốn theo việc nhân vật đang làm"}
                          for sid in sids[2:]]
        for sid in order:  # the agent's own plan, written from one read of the whole script, is kept unless the picture cannot be drawn
            picture = (self.planned(sid) or {}).get("picture") or {}
            if picture.get("motif") not in (None, "none") and not graphic_motifs_of(texts.get(sid)):
                found.append({"code": "STORY_GRAPHIC_PLANNED", "scene_id": sid,
                              "detail": f"brief (đọc cả kịch bản) đã định hình '{picture['motif']}' cho cảnh này ({picture.get('fact') or picture.get('why')}); "
                                        "chọn graphic đó, hoặc một motif khác nếu không vẽ được"})
        return found

    def core_fix(self, sid: str, text: str, issues: list[dict]) -> str:
        from .scene_repairs import prune_non_story_references
        data = json.loads(text)
        prune_non_story_references(data["payload"]["scene"])
        return json.dumps(data, ensure_ascii=False)

    def merge(self, skeleton: str, texts: dict, order: list[str]) -> str:
        from . import agent_parts
        return agent_parts.merge(skeleton, texts, order)
