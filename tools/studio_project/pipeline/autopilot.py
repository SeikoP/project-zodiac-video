"""Autopilot: walks the production graph, lets the agent author/repair, stops at every human gate.

It never confirms a gate, never fabricates a receipt for a gate and never waives a validator.
One call to ``step()`` is one scheduling decision, so the scheduler is testable without threads.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Literal, Sequence

from ..models import StudioError
from .api import pipeline_get, registry
from .context import build_context
from .proposals import get_mode, submit_proposal
from .receipts import write_receipt
from .runner import cancel_running, run_node
from .validators import Issue, last_report

FORMAT = "zodiac-pipeline-run@1"
RUN_FILE = Path(".runtime/pipeline/run.json")
State = Literal["IDLE", "RUNNING", "WAITING_GATE", "WAITING_USER", "DONE", "STOPPED"]
MAX_RUN_ATTEMPTS = 2  # relaunches of a plain (non-agent) step whose job ended without producing evidence
UPSTREAM_OWNERS = ("phase1", "studio")
LOG_LIMIT = 50
POLL_SECONDS = 1.0


@dataclass(frozen=True)
class LogLine:
    at: float
    node: str | None
    text: str


@dataclass(frozen=True)
class NeedsYou:
    node_id: str
    kind: Literal["gate", "blocked", "failed"]
    title: str
    detail: str
    issues: tuple[Issue, ...] = ()

    def to_dict(self) -> dict:
        return {"node_id": self.node_id, "kind": self.kind, "title": self.title, "detail": self.detail,
                "issues": [i.to_dict() for i in self.issues]}


@dataclass(frozen=True)
class RunRecord:
    run_id: str
    state: State
    node: str | None = None
    needs_you: tuple[NeedsYou, ...] = ()
    log: tuple[LogLine, ...] = ()

    def to_dict(self) -> dict:
        return {"format": FORMAT, "run_id": self.run_id, "state": self.state, "node": self.node,
                "needs_you": [n.to_dict() for n in self.needs_you],
                "log": [{"at": l.at, "node": l.node, "text": l.text} for l in self.log]}


def _issue_from(data: dict) -> Issue:
    return Issue(str(data.get("code")), str(data.get("owner", "visual-intent")), data.get("scene_id"),
                 str(data.get("message", "")), str(data.get("repair_group", "visual-intent")))


def read_run(workspace: Path) -> dict | None:
    try:
        data = json.loads((Path(workspace) / RUN_FILE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and data.get("format") == FORMAT else None


def _load(workspace: Path) -> RunRecord:
    data = read_run(workspace)
    if data is None:
        return RunRecord(uuid.uuid4().hex[:8], "IDLE")
    log = tuple(LogLine(float(l["at"]), l.get("node"), str(l["text"])) for l in data.get("log", []))
    needs = tuple(NeedsYou(n["node_id"], n["kind"], n["title"], n["detail"], tuple(_issue_from(i) for i in n.get("issues", [])))
                  for n in data.get("needs_you", []))
    state = data.get("state", "IDLE")
    if state == "RUNNING":  # a crash or restart cannot leave a phantom running autopilot
        line = LogLine(time.time(), None, "Đặt lại về IDLE sau khi khởi động lại (restart)")
        return RunRecord(data["run_id"], "IDLE", None, (), (log + (line,))[-LOG_LIMIT:])
    return RunRecord(data["run_id"], state, data.get("node"), needs, log)


REPAIR_HINTS = ("Sửa Visual Intent hiện có, giữ nguyên các quyết định đã đạt. ENVIRONMENT_VISUAL_UNDERDEVELOPED: thêm entity đồ vật id bắt đầu bằng depth__ "
                "(bàn, điện thoại...) ở lớp khác nhân vật; KHÔNG dùng scene_set_id. FRAME_OCCUPANCY_LOW: phóng to nhân vật/đồ vật chính (khoảng 26% khung 1080x1400). PASSIVE_STORYTELLING / SCENE_EXPERIENCE_CRITERION_REVIEW (character_action): mỗi event của nhân vật/đồ vật phải có trường action (cụm từ tiếng Việt: nhân vật làm gì). Lỗi:")


def _revise_scenes(service, project_id: str, node_id: str, by_scene: dict, pilot) -> list[dict] | None:
    """Revise only the scenes the validator named (two agents at a time), then merge them into ONE source.replace.

    Returns None when any revision fails, so the caller can fall back to regenerating; raises AGENT_CANCELLED when the
    autopilot was stopped. The merge starts from the current intent, so every other scene stays byte-identical.
    """
    import copy
    import json
    from concurrent.futures import ThreadPoolExecutor
    from . import agent_runs

    def one(scene_id: str, issues: list) -> dict:
        lines = [f"- {i.code}: {i.message}" for i in issues]
        instruction = (REPAIR_HINTS + chr(10) + chr(10).join(lines))[:1200]
        slot_deadline = time.time() + 10 * 60
        while True:  # wait for a free agent slot
            with pilot._state_lock:
                if pilot._stopped:
                    raise StudioError("AGENT_CANCELLED", "Autopilot đã dừng", "pipeline")
                try:
                    task = service.agent.start_scene_revision(project_id, scene_id, instruction, automatic=True)
                    break
                except StudioError as error:
                    if error.code != "AGENT_BUSY":
                        raise
            if time.time() > slot_deadline:
                raise StudioError("AGENT_TIMEOUT", "Không có agent rảnh", "agent")
            time.sleep(0.5)
        agent_runs.track(service, project_id, node_id, task["task_id"])
        deadline = time.time() + 10 * 60
        while time.time() < deadline:
            task = service.agent.task(task["task_id"])
            if pilot._stopped:  # a stop must not leave the agent working on a result nobody will apply
                service.agent.cancel(task["task_id"])
                raise StudioError("AGENT_CANCELLED", "Autopilot đã dừng", "pipeline")
            if task["status"] == "COMPLETED":
                return task
            if task["status"] in ("FAILED", "CANCELLED"):
                raise StudioError("AGENT_" + task["status"], str(task.get("error") or "agent không hoàn thành")[:300], "agent")
            time.sleep(1.0)
        service.agent.cancel(task["task_id"])
        raise StudioError("AGENT_TIMEOUT", "Agent quá thời gian chờ", "agent")

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = {sid: pool.submit(one, sid, issues) for sid, issues in by_scene.items()}
            tasks = {sid: future.result() for sid, future in futures.items()}
    except StudioError as error:
        if error.code == "AGENT_CANCELLED":
            raise
        return None
    except Exception:  # a malformed revision must fall back to regenerating, not abort the repair
        return None
    fingerprints = {task["dependencies"] for task in tasks.values()}
    if len(fingerprints) != 1:  # the voice changed between the revisions: none of them can be trusted together
        return None
    try:
        merged = copy.deepcopy(service.visual.snapshot(project_id)["intent"])
        for scene_id, task in tasks.items():
            revised = json.loads(task["suggestion"])["payload"]["intent"]
            scene = next(s for s in revised["scenes"] if s["id"] == scene_id)
            merged["scenes"] = [scene if s["id"] == scene_id else s for s in merged["scenes"]]
            for key, value in (revised.get("assets") or {}).items():
                merged.setdefault("assets", {}).setdefault(key, value)
    except (KeyError, ValueError, StopIteration, TypeError):
        return None
    return [{"kind": "visual.intent", "payload": {"command": "source.replace", "payload": {"intent": merged}},
             "voice_dependencies": fingerprints.pop()}]


def default_agent(service, project_id: str, node_id: str, spec, context_text: str, attempt: int, issues=()) -> list[dict]:
    """Real agent seam. Only initial visual authoring has a Studio agent task today."""
    if spec.id not in ("visual", "checks"):  # checks repairs the existing Visual Intent from its validator issues
        raise StudioError("PIPELINE_AGENT_UNSUPPORTED", f"{node_id}: agent chưa hỗ trợ trong Studio", "pipeline")
    repair = spec.id == "checks"
    from . import agent_runs
    from .. import agent_authoring
    notes = [line for line in context_text.split("\n") if line.startswith("- ")]
    instruction = ("Soạn Visual Intent đầy đủ theo Phase 2." + ("\nSửa các lỗi sau:\n" + "\n".join(notes) if notes else ""))[:1200]
    if repair:
        instruction = (REPAIR_HINTS + (chr(10) + chr(10).join(notes) if notes else ""))[:1200]
    pilot = autopilot_for(service, project_id)
    by_scene: dict = {}
    for found in issues:
        by_scene.setdefault(found.scene_id, []).append(found)
    if repair and by_scene and None not in by_scene:  # every issue names a scene: edit those scenes, keep the rest
        revised = _revise_scenes(service, project_id, node_id, by_scene, pilot)
        if revised is not None:
            return revised
    capsule = agent_authoring.capsule(service, project_id, instruction, repair=repair)
    with pilot._state_lock:
        if pilot._stopped:
            raise StudioError("AGENT_CANCELLED", "Autopilot đã dừng", "pipeline")
        task = service.agent.start_authoring_scenes(project_id, instruction, repair=repair)
        agent_runs.track(service, project_id, node_id, task["task_id"])
    deadline = time.time() + 15 * 60
    while time.time() < deadline:
        task = service.agent.task(task["task_id"])
        if task["status"] == "COMPLETED":
            text, _ = agent_authoring.bind_proposal(task["suggestion"], capsule)
            intent = agent_authoring.proposal(text, service, project_id, write_visuals=True)
            return [{"kind": "visual.intent", "payload": {"command": "source.replace", "payload": {"intent": intent}},
                     "voice_dependencies": capsule["dependencies"]}]
        if task["status"] in ("FAILED", "CANCELLED"):
            raise StudioError("AGENT_" + task["status"], str(task.get("error") or "agent không hoàn thành")[:300], "agent")
        time.sleep(1.0)
    service.agent.cancel(task["task_id"])
    raise StudioError("AGENT_TIMEOUT", "Agent quá thời gian chờ", "agent")


from .drafts import DRAFTED  # noqa: E402


class Autopilot:
    def __init__(self, service, project_id: str, *, graph: Callable | None = None, run: Callable | None = None,
                 agent: Callable | None = None, submit: Callable | None = None, cancel: Callable | None = None,
                 sleep: Callable[[float], None] = time.sleep):
        self.service, self.project_id = service, project_id
        self._graph = graph or pipeline_get
        self._run = run or run_node
        self._agent = agent or default_agent
        self._submit = submit or submit_proposal
        self._cancel = cancel or cancel_running
        self._sleep = sleep
        self._workspace = Path(service.registry.get(project_id).workspace)
        self._step_lock, self._state_lock = threading.Lock(), threading.Lock()
        self._attempts: dict[str, int] = {}
        self._issues: dict[str, tuple[Issue, ...]] = {}
        self._stopped = False
        self._thread: threading.Thread | None = None
        self._rec = _load(self._workspace)

    @property
    def record(self) -> RunRecord:
        return self._rec

    # -- public API ---------------------------------------------------------------------------------------
    def start(self, base_revision: int, *, background: bool = False) -> RunRecord:
        if get_mode(self._workspace) != "autopilot":
            raise StudioError("PIPELINE_MODE_CONFIRM", "Chuyển sang chế độ tự động trước khi chạy autopilot", "pipeline")
        if self._graph(self.service, self.project_id)["revision"] != base_revision:
            raise StudioError("REVISION_CONFLICT", "Dự án đã thay đổi; tải lại trước khi chạy autopilot", "pipeline")
        return self._begin("Bắt đầu autopilot", background)

    def resume_after_gate(self, *, background: bool = False) -> RunRecord:
        if get_mode(self._workspace) != "autopilot":
            return self._rec
        if self._rec.state not in ("WAITING_GATE", "WAITING_USER", "IDLE"):
            return self._rec
        return self._begin("Tiếp tục sau khi bạn xử lý", background)

    def stop(self) -> RunRecord:
        with self._state_lock:
            self._stopped = True
        try:
            self._cancel(self.service, self.project_id)
        except StudioError as error:
            if error.code != "PIPELINE_NOTHING_RUNNING":
                raise
        with self._state_lock:
            self._set("STOPPED", None, (), "Đã dừng autopilot; các bước xong được giữ nguyên")
        return self._rec

    def join(self, timeout: float | None = None) -> None:
        if self._thread is not None:
            self._thread.join(timeout)

    def step(self) -> RunRecord:
        with self._step_lock:
            if self._rec.state != "RUNNING":
                return self._rec
            try:
                self._schedule()
            except StudioError as error:
                self._fail_current("failed", error.code, str(error))
            except Exception as error:  # the background loop must surface, never die silently
                self._fail_current("failed", "PIPELINE_AUTOPILOT_ERROR", str(error))
            if self._stopped and self._rec.state == "RUNNING":
                self._set("STOPPED", None, (), "Đã dừng autopilot")
            return self._rec

    # -- internals ----------------------------------------------------------------------------------------
    def _begin(self, text: str, background: bool) -> RunRecord:
        with self._state_lock:
            if self._rec.state == "RUNNING":
                return self._rec
            if self._thread is not None and self._thread.is_alive():
                raise StudioError("PIPELINE_BUSY", "Previous run is still stopping", "pipeline")
            self._attempts.clear()
            self._issues.clear()
            self._stopped = False
            self._rec = RunRecord(uuid.uuid4().hex[:8], "IDLE", log=self._rec.log)
            self._set("RUNNING", None, (), text)
        if background:
            self._thread = threading.Thread(target=self._loop, name=f"zodiac-autopilot-{self.project_id}", daemon=True)
            self._thread.start()
        return self._rec

    def _loop(self) -> None:
        while self._rec.state == "RUNNING":
            self.step()
            if self._rec.state == "RUNNING":
                self._sleep(POLL_SECONDS)

    def _set(self, state: State, node: str | None, needs: Sequence[NeedsYou], text: str | None = None) -> None:
        if self._stopped and state != "STOPPED":
            return
        log = self._rec.log
        if text:
            log = (log + (LogLine(time.time(), node, text),))[-LOG_LIMIT:]
        self._rec = RunRecord(self._rec.run_id, state, node, tuple(needs), log)
        self._save()

    def _save(self) -> None:
        path = self._workspace / RUN_FILE
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".run.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as writer:
                json.dump(self._rec.to_dict(), writer, ensure_ascii=False)
            os.replace(tmp, path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def _needs(self, state: State, kind: str, node: dict | None, title: str, detail: str, issues: Sequence[Issue] = ()) -> None:
        node_id = node["id"] if node else "pipeline"
        prefix = {"gate": "Cần bạn duyệt", "blocked": "Bị chặn", "failed": "Không tự xử lý được"}[kind]
        item = NeedsYou(node_id, kind, f"{prefix}: {title}", detail[:400], tuple(issues))
        with self._state_lock:
            self._set(state, node_id, (item,), f"{prefix}: {title}")

    def _fail_current(self, kind: str, code: str, detail: str) -> None:
        node = self._rec.node
        self._needs("WAITING_USER", kind, {"id": node} if node else None, node or "autopilot", f"{code}: {detail}",
                    (Issue(code, "studio", None, detail[:300], "studio"),))

    def _schedule(self) -> None:
        if get_mode(self._workspace) != "autopilot":
            self._needs("WAITING_USER", "blocked", None, "Chế độ từng bước", "Bật Tự động để chạy tiếp")
            return
        graph = self._graph(self.service, self.project_id)
        if self._stopped:
            return
        nodes = graph["nodes"]
        running = next((n for n in nodes if n["status"] == "RUNNING"), None)
        if running:
            with self._state_lock:
                if self._rec.node != running["id"]:
                    self._set("RUNNING", running["id"], (), f"Đang chạy: {running['title']}")
            return
        pending_left = False
        for node in nodes:
            status = node["status"]
            if status == "DONE":
                self._attempts.pop(node["id"], None)
                self._issues.pop(node["id"], None)
                continue
            if node["kind"] == "gate":
                self._needs("WAITING_GATE", "gate", node, node["title"], node.get("detail") or "Chờ bạn xác nhận")
                return
            if status == "BLOCKED":
                self._needs("WAITING_USER", "blocked", node, node["title"], node.get("detail") or "Thiếu đầu vào ở Phase 1")
                return
            if status in ("READY", "STALE", "FAILED"):
                self._work(node, graph)
                return
            pending_left = True
        if pending_left:
            self._needs("WAITING_USER", "blocked", None, "Không có bước nào sẵn sàng", "Các bước còn lại đang chờ đầu vào")
        else:
            with self._state_lock:
                self._set("DONE", None, (), "Hoàn tất: mọi bước đã xong")

    def _work(self, node: dict, graph: dict) -> None:
        spec = registry().spec(node["id"].split(":")[0])
        if spec.executor == "validators.run":
            self._checks(node, spec, graph)
        elif spec.id in DRAFTED and self._agent is default_agent:
            self._launch(node, graph)  # deterministic draft through the same runner as the Chạy button
        elif spec.agent is not None:
            self._agent_attempt(node, spec, ())
        else:
            self._launch(node, graph)

    def _launch(self, node: dict, graph: dict) -> None:
        used = self._attempts.get(node["id"], 0)
        if used >= MAX_RUN_ATTEMPTS:
            self._needs("WAITING_USER", "failed", node, node["title"], "Bước chạy xong nhưng chưa có kết quả hợp lệ")
            return
        self._attempts[node["id"]] = used + 1
        try:
            with self._state_lock:
                if self._stopped:
                    return
                self._run(self.service, self.project_id, node["id"], graph["revision"], caller="autopilot")
        except StudioError as error:
            self._attempts[node["id"]] = used
            if error.code == "PIPELINE_BUSY":
                return
            kind = "blocked" if error.code in ("PIPELINE_EXECUTOR_UNAVAILABLE", "PIPELINE_NODE_BLOCKED") else "failed"
            self._needs("WAITING_USER", kind, node, node["title"], f"{error.code}: {error}",
                        (Issue(error.code, "studio", None, str(error)[:300], "studio"),))
            return
        with self._state_lock:
            self._set("RUNNING", node["id"], (), f"Chạy: {node['title']}")

    def _checks(self, node: dict, spec, graph: dict) -> None:
        try:
            with self._state_lock:
                if self._stopped:
                    return
                self._run(self.service, self.project_id, node["id"], graph["revision"], caller="autopilot")
        except StudioError as error:
            if error.code == "PIPELINE_BUSY":
                return
            raise
        report = last_report(self._workspace)
        if report is None:
            raise StudioError("VALIDATOR_REPORT_MISSING", "Không đọc được kết quả kiểm tra", "pipeline")
        if report.get("ok"):
            return
        issues = tuple(_issue_from(i) for i in report.get("issues", []))
        if any(i.owner in UPSTREAM_OWNERS for i in issues):
            self._needs("WAITING_USER", "blocked", node, node["title"], "Thiếu đầu vào từ Phase 1 hoặc Studio; agent không được tự bịa", issues)
            return
        self._agent_attempt(node, spec, issues)

    def _agent_attempt(self, node: dict, spec, issues: Sequence[Issue]) -> None:
        node_id, limit = node["id"], spec.agent.max_attempts
        issues = tuple(issues) or self._issues.get(node_id, ())
        used = self._attempts.get(node_id, 0)
        if used >= limit:
            self._needs("WAITING_USER", "failed", node, node["title"], f"Đã thử {used}/{limit} lần nhưng chưa đạt", issues)
            return
        self._attempts[node_id] = attempt = used + 1
        context_text = build_context(self.project_id, spec.id, issues)
        base_revision = self._graph(self.service, self.project_id)["revision"]
        if self._stopped:
            return
        try:
            items = self._agent(self.service, self.project_id, node_id, spec, context_text, attempt,
                                **({"issues": issues} if self._agent is default_agent else {}))
        except StudioError as error:
            if error.code == "PIPELINE_AGENT_UNSUPPORTED":
                self._needs("WAITING_USER", "blocked", node, node["title"], str(error),
                            (Issue(error.code, "studio", None, str(error)[:300], "studio"),))
                return
            self._issues[node_id] = (Issue(error.code, "studio", None, str(error)[:300], "studio"),)
            with self._state_lock:
                self._set("RUNNING", node_id, (), f"Agent lỗi lần {attempt}: {error.code}")
            return
        found: list[Issue] = []
        for index, item in enumerate(items or []):
            if self._stopped:
                return
            revision = self._graph(self.service, self.project_id)["revision"]
            if revision != base_revision:
                self._needs("WAITING_USER", "blocked", node, node["title"], "Nguồn đã đổi khi agent đang chạy; chạy lại từ bản mới")
                return
            command_id = re.sub(r"[^A-Za-z0-9_.-]", ".", f"ap-{self._rec.run_id}-{node_id}-{attempt}-{index}")
            try:
                with self._state_lock:
                    if self._stopped:
                        return
                    result = self._submit(self.service, self.project_id, item["kind"], item["payload"], revision, command_id,
                                          **({"voice_dependencies": item["voice_dependencies"]} if item.get("voice_dependencies") else {}))
            except StudioError as error:
                found.append(Issue(error.code, "studio", None, str(error)[:300], "studio"))
                break
            if result.get("waiting"):
                self._needs("WAITING_USER", "blocked", node, node["title"], "Đang ở chế độ xác nhận; chuyển sang tự động để tiếp tục")
                return
            if not result.get("applied"):
                found.extend(_issue_from(i) for i in result.get("issues", []))
                break
        if not items:
            found.append(Issue("AGENT_EMPTY", "studio", None, "Agent không đề xuất gì", "studio"))
        if found:
            self._issues[node_id] = tuple(found)
        else:
            self._issues.pop(node_id, None)
            if spec.id == "assets":
                source = self.service.visual.snapshot(self.project_id)["source_hash"]
                write_receipt(self._workspace, "assets", source_hash=source)
        with self._state_lock:
            self._set("RUNNING", node_id, (), f"Agent {node['title']} lần {attempt}: " + ("cần sửa" if found else "đã áp dụng"))


_PILOTS_KEY = "_pipeline_autopilots"


def autopilot_for(service, project_id: str) -> Autopilot:
    pilots = service.__dict__.setdefault(_PILOTS_KEY, {})
    if project_id not in pilots:
        pilots[project_id] = Autopilot(service, project_id)
    return pilots[project_id]
