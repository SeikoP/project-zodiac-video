"""Canonical visual authoring, revisioned commands and managed episode builds."""
from __future__ import annotations

import copy
import json
import math
from pathlib import Path
import re
import subprocess
import threading
import time
import uuid

from tools.runner.process import observe_subprocesses, observe_subprocess_output, run_managed_subprocess
from tools.studio.artifacts import VoiceArtifactStore, canonical_hash, file_sha256
from .importer import _exclusive_source_lock, _trusted_dir
from .models import StudioError
from .visual_server import PreviewServer

ROOT = Path(__file__).resolve().parents[2]
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$")
BUILD_ID = re.compile(r"^[a-f0-9]{32}$")
FORMAT = "zodiac-visual-workspace@1"
COMMANDS = frozenset({"source.replace", "scene.patch", "theme.select", "asset.select", "undo", "redo"})


def _error(code, message):
    return StudioError(code, message, "visual")


def _exact(value, *keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise _error("VISUAL_COMMAND_INVALID", "Unexpected or missing fields")


class VisualWorkspace:
    def __init__(self, service):
        self.service = service
        self._guard = threading.RLock()
        self._workers = {}
        self._processes = {}
        self._job_ids = {}
        self._cancelled = set()
        self._server = None

    def _handle(self, project_id):
        if self.service.project(project_id)["status"]["content"] != "APPROVED":
            raise _error("CONTENT_APPROVAL_REQUIRED", "Approved source is missing or changed")
        return self.service.registry.get(project_id)

    def _paths(self, handle):
        root = _trusted_dir(handle.workspace, handle.workspace/".runtime")
        root = _trusted_dir(handle.workspace, root/"visual-workspace")
        authoring = _trusted_dir(handle.workspace, handle.workspace/".authoring")
        return root, authoring/"visual-intent.json"

    def _narration(self, handle):
        for rel in (".authoring/narration.txt", "narration.txt"):
            path = handle.workspace/rel
            if path.exists():
                if path.is_symlink():
                    raise _error("VISUAL_SOURCE_UNSAFE", "Narration symlink rejected")
                return path.read_bytes().decode("utf8")
        raise _error("VISUAL_NARRATION_MISSING", "Approved narration missing")

    @staticmethod
    def _read_json(path):
        if path.is_symlink() or path.stat().st_size > 8*1024*1024:
            raise _error("VISUAL_SOURCE_UNSAFE", "Symlink or oversized visual source rejected")
        return json.loads(path.read_text(encoding="utf8"))

    def _read(self, handle):
        root, source = self._paths(handle)
        pending, state_path = root/"pending.json", root/"state.json"
        if pending.exists():
            transaction = self._read_json(pending)
            current = canonical_hash(self._read_json(source)) if source.exists() else None
            if current not in (transaction["previous_hash"], transaction["state"]["source_hash"]):
                raise _error("VISUAL_RECOVERY_CONFLICT", "Source changed outside the interrupted transaction")
            VoiceArtifactStore._atomic_write(source, transaction["intent"])
            VoiceArtifactStore._atomic_write(state_path, transaction["state"])
            pending.unlink()
        intent = self._read_json(source) if source.exists() else None
        state = self._read_json(state_path) if state_path.exists() else {
            "format": FORMAT, "project_id": handle.project_id, "source_identity": handle.imported_source_sha256,
            "revision": 0, "source_hash": canonical_hash(intent) if intent else None,
            "history": [intent] if intent else [], "history_index": 0 if intent else -1,
            "theme": "light", "build": None, "job": None, "events": [], "commands": {},
        }
        if (state["format"] != FORMAT or state["source_identity"] != handle.imported_source_sha256 or
                state["source_hash"] != (canonical_hash(intent) if intent else None)):
            raise _error("VISUAL_SOURCE_DRIFT", "Visual Intent changed outside the canonical command API")
        return state, intent

    def _save(self, handle, state):
        root, _ = self._paths(handle)
        VoiceArtifactStore._atomic_write(root/"state.json", state)

    def _commit(self, handle, previous, state, intent):
        root, source = self._paths(handle)
        state["source_hash"] = canonical_hash(intent)
        VoiceArtifactStore._atomic_write(root/"pending.json", {
            "previous_hash": previous["source_hash"], "intent": intent, "state": state,
        })
        VoiceArtifactStore._atomic_write(source, intent)
        self._save(handle, state)
        (root/"pending.json").unlink()

    @staticmethod
    def _revision(state, revision):
        if type(revision) is not int or revision != state["revision"]:
            raise _error("REVISION_CONFLICT", "Visual source changed; refresh before editing")

    def _node(self, handle, payload, process=None, log=None):
        root, _ = self._paths(handle)
        requests = _trusted_dir(handle.workspace, root/"requests")
        name = uuid.uuid4().hex
        request, result = requests/(name+".input.json"), requests/(name+".output.json")
        VoiceArtifactStore._atomic_write(request, payload)
        try:
            with observe_subprocesses(process or (lambda _: None)), observe_subprocess_output(log or (lambda *_args, **_kw: None)):
                run_managed_subprocess(["node", str(Path(__file__).with_name("visual_compiler.mjs")), str(request), str(result)],
                                       cwd=ROOT, capture_output=True, text=True, check=True)
            return self._read_json(result)
        except subprocess.CalledProcessError as error:
            detail = (error.stderr or error.stdout or str(error))[-3000:]
            raise _error("VISUAL_BUILD_BLOCKED", detail) from error
        finally:
            request.unlink(missing_ok=True)
            result.unlink(missing_ok=True)

    @staticmethod
    def _event(state, kind, payload):
        state["events"].append({"event_seq": (state["events"][-1]["event_seq"]+1) if state["events"] else 1,
                                "kind": kind, "revision": state["revision"], "at": time.time(), "payload": payload})
        state["events"] = state["events"][-100:]

    def snapshot(self, project_id):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, intent = self._read(handle)
            result = {k: v for k, v in state.items() if k not in ("history", "commands", "source_identity")}
            result.update(intent=intent, can_undo=state["history_index"]>0, can_redo=state["history_index"]<len(state["history"])-1,
                          approval="NOT_GRANTED", stale_preview=bool(state["build"] and state["build"]["revision"] != state["revision"]))
            if state["build"]:
                voice = self.service.voice.snapshot(project_id)
                if (not voice.get("assembly") or voice["assembly"]["wav_sha256"] != state["build"]["voice_sha256"] or
                        canonical_hash(voice.get("timing")) != state["build"].get("voice_timing_fingerprint")):
                    result.update(stale_preview=True, stale_reason="SELECTED_VOICE_OR_TIMING_CHANGED")
            if state["job"] and state["job"]["status"] == "RUNNING":
                with self._guard:
                    alive = project_id in self._workers and self._workers[project_id].is_alive()
                if not alive:
                    state["job"].update(status="INTERRUPTED", error="Studio restarted; last good build preserved")
                    self._save(handle, state)
                    result["job"] = state["job"]
            return result

    def command(self, project_id, command_id, base_revision, kind, payload):
        if not isinstance(command_id, str) or not ID.fullmatch(command_id) or kind not in COMMANDS:
            raise _error("VISUAL_COMMAND_FORBIDDEN", "Unsupported visual command or command id")
        if len(json.dumps(payload, allow_nan=False)) > 2*1024*1024:
            raise _error("VISUAL_COMMAND_TOO_LARGE", "Visual command exceeds 2 MiB")
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, intent = self._read(handle)
            fingerprint = canonical_hash({"kind": kind, "payload": payload, "base_revision": base_revision})
            prior = state["commands"].get(command_id)
            if prior:
                if prior != fingerprint:
                    raise _error("COMMAND_ID_CONFLICT", "Command id reused with different input")
            else:
                self._revision(state, base_revision)
                previous = copy.deepcopy(state)
                if kind == "source.replace":
                    _exact(payload, "intent")
                    intent = copy.deepcopy(payload["intent"])
                elif intent is None:
                    raise _error("VISUAL_SOURCE_REQUIRED", "Import canonical Visual Intent first")
                elif kind in ("undo", "redo"):
                    _exact(payload)
                    index = state["history_index"]+(-1 if kind == "undo" else 1)
                    if not 0 <= index < len(state["history"]):
                        raise _error("VISUAL_HISTORY_EMPTY", "No history entry in that direction")
                    state["history_index"] = index
                    entry = state["history"][index]
                    if isinstance(entry, dict) and entry.get("history_format") == 1:
                        intent, state["theme"] = copy.deepcopy(entry["intent"]), entry["theme"]
                    else:
                        intent = copy.deepcopy(entry)
                elif kind == "theme.select":
                    _exact(payload, "theme")
                    if payload["theme"] not in ("light", "dark"):
                        raise _error("VISUAL_THEME_UNKNOWN", "Choose light or dark")
                    state["theme"] = payload["theme"]
                elif kind == "scene.patch":
                    _exact(payload, "scene_id", "entity_id", "state_id", "changes")
                    scene, entity, target = self._target(intent, payload)
                    changes = payload["changes"]
                    if not isinstance(changes, dict) or not changes or set(changes)-{"x", "y", "width", "height", "rotation", "opacity", "layer", "visible"}:
                        raise _error("VISUAL_PATCH_UNSUPPORTED", "Only bounded transform, layer and visibility changes are supported")
                    for key, value in changes.items():
                        if key == "visible":
                            if type(value) is not bool:
                                raise _error("VISUAL_PATCH_INVALID", "Visibility must be boolean")
                        elif type(value) not in (int, float) or not math.isfinite(value):
                            raise _error("VISUAL_PATCH_INVALID", "Transform must be a finite number")
                        if key in ("opacity", "layer", "visible"):
                            target[key] = value
                        else:
                            target.setdefault("transform", {})[key] = value
                    if (scene.get("spatial_bindings") or scene.get("environment", {}).get("frame", {}).get("contacts")) and set(changes)&{"x", "y", "width", "height", "rotation"}:
                        raise _error("VISUAL_CONTACT_EDIT_UNSUPPORTED", "Bound actors/props must retain authored contact; edit the complete source composition")
                elif kind == "asset.select":
                    _exact(payload, "scene_id", "candidate_id", "requirement")
                    result = self._node(handle, {"action": "candidates", "intent": intent, "scene_id": payload["scene_id"], "requirement": payload["requirement"], "recent": []})
                    bundle = next((b for b in result["bundles"] if b["candidate_id"] == payload["candidate_id"]), None)
                    if not bundle:
                        raise _error("VISUAL_CANDIDATE_STALE", "Candidate source or constraints changed")
                    scene, entity, target = self._target(intent, bundle)
                    catalog = self._node(handle, {"action": "assets"})
                    row = next(r for r in catalog["items"] if r["id"] == bundle["asset_id"])
                    asset_id = "studio_prop_"+row["id"]
                    intent["assets"][asset_id] = {"path": "library:"+row["path"], "category": "prop", "source_sha256": row["source_sha256"], "prop_identity": row["identity"]}
                    target["asset"] = asset_id
                self._node(handle, {"action": "validate", "intent": intent, "narration": self._narration(handle)})
                if kind not in ("undo", "redo"):
                    history = state["history"][:state["history_index"]+1]
                    history.append({"history_format": 1, "intent": copy.deepcopy(intent), "theme": state["theme"]})
                    # Bound durable undo by bytes as well as edits for large episodes.
                    while len(history)>2 and len(json.dumps(history, ensure_ascii=False).encode("utf8"))>4*1024*1024:
                        history.pop(0)
                    state.update(history=history[-40:], history_index=min(len(history), 40)-1)
                state["revision"] += 1
                state["commands"][command_id] = fingerprint
                state["commands"] = dict(list(state["commands"].items())[-1000:])
                self._event(state, kind, {"command_id": command_id, "scene_id": payload.get("scene_id"), "not_an_approval": True})
                self._commit(handle, previous, state, intent)
        return self.snapshot(project_id)

    @staticmethod
    def _target(intent, payload):
        scene = next((s for s in intent["scenes"] if s["id"] == payload["scene_id"]), None)
        entity = next((e for e in (scene or {}).get("entities", []) if e["id"] == payload["entity_id"]), None)
        state = (entity or {}).get("states", {}).get(payload["state_id"])
        if state is None:
            raise _error("VISUAL_TARGET_UNKNOWN", "Unknown scene/entity/state")
        return scene, entity, state

    def candidates(self, project_id, scene_id, requirement):
        if not isinstance(requirement, dict) or set(requirement)-{"context", "family_id", "asset_id", "role", "contact"}:
            raise _error("VISUAL_REQUIREMENT_INVALID", "Unsupported candidate constraints")
        if any(type(v) not in (str, bool) or isinstance(v, str) and len(v)>200 for v in requirement.values()):
            raise _error("VISUAL_REQUIREMENT_INVALID", "Invalid candidate constraints")
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, intent = self._read(handle)
            if not intent:
                raise _error("VISUAL_SOURCE_REQUIRED", "Import Visual Intent first")
            # Only actually reviewed manifests contribute a reuse warning; technical previews do not.
            recent = []
            for other in self.service.registry.list_projects():
                if other.project_id != project_id and self.service.project(other.project_id)["status"]["visual"] == "APPROVED":
                    path = other.workspace/".runtime/visual-workspace/state.json"
                    if path.is_file():
                        record = self._read_json(path).get("build") or {}
                        recent.append({"asset_ids": list(record.get("assets", {}))})
            return self._node(handle, {"action": "candidates", "intent": intent, "scene_id": scene_id, "requirement": requirement, "recent": recent})

    def describe(self, project_id):
        return self._node(self._handle(project_id), {"action": "assets"})

    def start(self, project_id, base_revision, scene_id=None):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, intent = self._read(handle)
            self._revision(state, base_revision)
            if not intent:
                raise _error("VISUAL_SOURCE_REQUIRED", "Import canonical Visual Intent first")
            if scene_id is not None and scene_id not in {s["id"] for s in intent["scenes"]}:
                raise _error("VISUAL_SCENE_UNKNOWN", "Unknown scene")
            with self._guard:
                if project_id in self._workers and self._workers[project_id].is_alive():
                    raise _error("VISUAL_BUSY", "A build is already running or stopping")
            voice = self.service.voice.snapshot(project_id)
            if (not voice.get("timing") or not voice.get("assembly") or
                    voice["timing"]["wav_sha256"] != voice["assembly"]["wav_sha256"] or voice["assembly"].get("valid") is False):
                raise _error("VISUAL_MEASURED_TIMING_REQUIRED", "Assemble selected voice and measure ASR in Voice Lab first")
            root, _ = self._paths(handle)
            build_id = uuid.uuid4().hex
            output = _trusted_dir(handle.workspace, root/"builds"/build_id)
            cache = _trusted_dir(handle.workspace, root/"compiler-cache")
            payload = {"action": "build", "intent": intent, "narration": self._narration(handle), "timing": voice["timing"],
                       "theme": state["theme"], "revision": state["revision"], "workspace": str(handle.workspace),
                       "output": str(output), "cache": str(cache), "scene_id": scene_id}
            state["job"] = {"id": build_id, "status": "RUNNING", "revision": state["revision"], "scene_id": scene_id,
                            "ready_scenes": [], "total": len(intent["scenes"]), "error": None, "message": "Building source-bound episode"}
            self._event(state, "scene.compile" if scene_id else "episode.build", {"build_id": build_id, "scene_id": scene_id})
            self._save(handle, state)
            worker = threading.Thread(target=self._build, args=(handle, build_id, payload), daemon=True)
            with self._guard:
                self._workers[project_id] = worker
                self._job_ids[project_id] = build_id
            worker.start()
        return self.snapshot(project_id)

    def _build(self, handle, build_id, payload):
        project_id = handle.project_id
        def process(child):
            with self._guard:
                if child is None:
                    self._processes.pop(project_id, None)
                else:
                    self._processes[project_id] = child
                    if build_id in self._cancelled:
                        child.kill()
        def log(line, **_):
            try:
                item = json.loads(line)
                if item.get("event") != "scene.preview_ready":
                    return
                with _exclusive_source_lock(handle.workspace, "visual-state"):
                    state, _ = self._read(handle)
                    if state["job"]["id"] == build_id and state["job"]["status"] == "RUNNING":
                        state["job"]["ready_scenes"].append(item["scene_id"])
                        state["job"]["message"] = "Preview ready: "+item["scene_id"]
                        self._event(state, "scene.preview_ready", {"build_id": build_id, "scene_id": item["scene_id"], "candidate_only": True})
                        self._save(handle, state)
            except (ValueError, KeyError, OSError, StudioError):
                return
        try:
            # Serialize shared cache writers across desktop/CLI instances, not only threads.
            with _exclusive_source_lock(handle.workspace, "visual-build"):
                manifest = self._node(handle, payload, process, log)
            self._handle(project_id)
            voice = self.service.voice.snapshot(project_id)
            with _exclusive_source_lock(handle.workspace, "visual-state"):
                state, intent = self._read(handle)
                if state["job"]["id"] != build_id or state["job"]["status"] != "RUNNING":
                    return
                if (state["revision"] != payload["revision"] or canonical_hash(intent) != canonical_hash(payload["intent"]) or
                        (voice.get("timing") or {}).get("wav_sha256") != manifest["voice_sha256"] or
                        canonical_hash(voice.get("timing")) != canonical_hash(payload["timing"])):
                    raise _error("VISUAL_BUILD_STALE", "Source or selected voice changed during build; previous output preserved")
                for scene in manifest["scenes"]:
                    file = Path(payload["output"])/scene["preview_file"]
                    if file_sha256(file) != scene["preview_sha256"]:
                        raise _error("VISUAL_OUTPUT_DRIFT", "Generated scene hash changed before publication")
                state["build"] = {**manifest, "id": build_id, "voice_timing_fingerprint": canonical_hash(voice["timing"])}
                state["job"].update(status="COMPLETED", message="Verified episode build ready", ready_scenes=[s["id"] for s in manifest["scenes"]])
                self._event(state, "episode.build_ready", {"build_id": build_id, "scene_count": len(manifest["scenes"]), "not_an_approval": True})
                self._save(handle, state)
        except Exception as error:
            with _exclusive_source_lock(handle.workspace, "visual-state"):
                state, _ = self._read(handle)
                if state["job"] and state["job"]["id"] == build_id and state["job"]["status"] == "RUNNING":
                    state["job"].update(status="BLOCKED", error=str(error)[-3000:], message="Build blocked; last good preview preserved")
                    self._save(handle, state)
        finally:
            with self._guard:
                self._workers.pop(project_id, None)
                self._processes.pop(project_id, None)
                self._job_ids.pop(project_id, None)

    def cancel(self, project_id):
        with self._guard:
            job_id = self._job_ids.get(project_id)
            if job_id:
                self._cancelled.add(job_id)
            process = self._processes.get(project_id)
            if process and process.poll() is None:
                process.kill()
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, _ = self._read(handle)
            if state["job"] and state["job"]["status"] == "RUNNING":
                state["job"].update(status="CANCELLED", message="Cancelled; last good output preserved")
                self._save(handle, state)
        return self.snapshot(project_id)

    def _preview_data(self, project_id, build_id, scene_id):
        if not BUILD_ID.fullmatch(build_id) or not ID.fullmatch(scene_id):
            raise _error("VISUAL_PREVIEW_INVALID", "Invalid preview identity")
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, _ = self._read(handle)
            build = state.get("build") or {}
            if build.get("id") == build_id:
                row = next((s for s in build["scenes"] if s["id"] == scene_id), None)
                if not row:
                    raise _error("VISUAL_SCENE_UNKNOWN", "Unknown compiled scene")
                expected = row["preview_sha256"]
            elif (state.get("job") or {}).get("id") == build_id and state["job"]["status"] == "RUNNING" and state["job"]["revision"] == state["revision"] and scene_id in state["job"]["ready_scenes"]:
                expected = None  # candidate output, never a committed artifact
            else:
                raise _error("VISUAL_PREVIEW_STALE", "Preview revision is no longer available")
            root, _ = self._paths(handle)
            file = root/"builds"/build_id/(scene_id+".html")
            if file.is_symlink() or not file.resolve().is_relative_to(root.resolve()) or file.stat().st_size > 8*1024*1024:
                raise _error("VISUAL_PREVIEW_UNSAFE", "Unsafe preview file")
            data = file.read_bytes()
            if expected and file_sha256(file) != expected:
                raise _error("VISUAL_OUTPUT_DRIFT", "Preview hash changed; rebuild required")
            return data

    def _resource(self, project_id, build_id, filename):
        if not filename.endswith(".html"):
            raise _error("VISUAL_PREVIEW_INVALID", "Only compiled scene HTML may be served")
        return self._preview_data(project_id, build_id, filename[:-5])

    def preview(self, project_id, scene_id, build_id=None):
        state = self.snapshot(project_id)
        build_id = build_id or (state.get("build") or {}).get("id")
        if not build_id:
            raise _error("VISUAL_PREVIEW_MISSING", "Build this episode first")
        data = self._preview_data(project_id, build_id, scene_id)
        with self._guard:
            if self._server is None:
                self._server = PreviewServer(self._resource)
            url = self._server.url(project_id, build_id, scene_id)
        build = state.get("build") or {}
        row = next((s for s in build.get("scenes", []) if s["id"] == scene_id), {})
        return {"url": url, "html": data.decode("utf8"), "sha256": file_sha256(self._paths(self._handle(project_id))[0]/"builds"/build_id/(scene_id+".html")),
                "scene": row, "build_id": build_id, "revision": build.get("revision", state["revision"]),
                "candidate_only": build.get("id") != build_id, "stale": state["stale_preview"], "not_an_approval": True}

    def validation(self, project_id):
        state = self.snapshot(project_id)
        return {"status": (state.get("job") or {}).get("status", "NOT_BUILT"), "revision": state["revision"],
                "stale": state["stale_preview"], "scenes": [{"id": s["id"], "qa": s["qa"]} for s in (state.get("build") or {}).get("scenes", [])],
                "human_review": "PENDING", "approval_granted": False}

    def close(self):
        with self._guard:
            workers = list(self._workers.items())
        for project_id, worker in workers:
            try:
                self.cancel(project_id)
            except (StudioError, OSError):
                pass
            worker.join(timeout=3)
        if self._server is not None:
            self._server.close()
