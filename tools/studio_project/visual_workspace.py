"""Canonical visual authoring, revisioned commands and managed episode builds."""
from __future__ import annotations

import copy
from contextlib import nullcontext
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import threading
import time
import uuid
import weakref

from tools.runner.process import observe_subprocesses, observe_subprocess_output, run_managed_subprocess
from tools.studio.artifacts import VoiceArtifactStore, canonical_hash, file_sha256
from .importer import _exclusive_source_lock, _trusted_dir
from .models import StudioError
from .status import _hash, _export_matches_build
from .visual_server import PreviewServer

ROOT = Path(__file__).resolve().parents[2]
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$")
BUILD_ID = re.compile(r"^[a-f0-9]{32}$")
FORMAT = "zodiac-visual-workspace@1"
COMMANDS = frozenset({"source.replace", "scene.patch", "scene.performance", "theme.select", "asset.select", "undo", "redo"})
_OWNERS = weakref.WeakValueDictionary()


def _process_alive(pid):
    if type(pid) is not int or pid<=0:
        return False
    if os.name=="nt":
        import ctypes
        from ctypes import wintypes
        kernel=ctypes.WinDLL("kernel32",use_last_error=True)
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
        kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.DWORD)]
        kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=kernel.OpenProcess(0x1000,False,pid)
        if not handle:
            return ctypes.get_last_error()==5  # Access denied is not evidence of death.
        try:
            code=wintypes.DWORD()
            return not kernel.GetExitCodeProcess(handle,ctypes.byref(code)) or code.value==259
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid,0)
        return True
    except PermissionError:
        return True
    except ProcessLookupError:
        return False


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
        self._instance_id = uuid.uuid4().hex
        _OWNERS[self._instance_id] = self

    @staticmethod
    def _job_alive(project_id, job):
        owner = _OWNERS.get(job.get("owner_instance"))
        if owner is not None:
            with owner._guard:
                worker = owner._workers.get(project_id)
                return bool(worker and worker.is_alive())
        if job.get("owner_pid") == os.getpid():
            return False
        return _process_alive(job.get("owner_pid"))

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
                if not self._job_alive(project_id, state["job"]):
                    state["job"].update(status="INTERRUPTED", error="Studio restarted; last good build preserved")
                    self._save(handle, state)
                    result["job"] = state["job"]
            return result

    def command(self, project_id, command_id, base_revision, kind, payload, *, voice_dependencies=None):
        if not isinstance(command_id, str) or not ID.fullmatch(command_id) or kind not in COMMANDS:
            raise _error("VISUAL_COMMAND_FORBIDDEN", "Unsupported visual command or command id")
        if len(json.dumps(payload, allow_nan=False)) > 2*1024*1024:
            raise _error("VISUAL_COMMAND_TOO_LARGE", "Visual command exceeds 2 MiB")
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"), (_exclusive_source_lock(handle.workspace, "voice-state") if voice_dependencies else nullcontext()):
            held_voice = None
            if voice_dependencies:
                from .agent_authoring import voice_dependencies as fingerprint_voice
                held_voice = self.service.voice._read(handle)
                if fingerprint_voice(held_voice) != voice_dependencies:
                    raise _error("AGENT_DEPENDENCIES_CHANGED", "Giọng hoặc timing đã thay đổi; yêu cầu đề xuất mới.")
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
                    if payload["theme"] not in ("light", "dark", "apricot-campus", "rose-social", "indigo-noir"):
                        raise _error("VISUAL_THEME_UNKNOWN", "Choose a registered visual palette")
                    state["theme"] = payload["theme"]
                elif kind == "scene.performance":
                    _exact(payload, "scene_id", "events")
                    scene = next((s for s in intent["scenes"] if s["id"] == payload["scene_id"]), None)
                    if scene is None:
                        raise _error("VISUAL_SCENE_UNKNOWN", "Choose an authored scene")
                    events = payload["events"]
                    if not isinstance(events, list) or len(events) > 100:
                        raise _error("VISUAL_PERFORMANCE_INVALID", "At most 100 canonical events are supported")
                    for event in events:
                        if not isinstance(event, dict) or set(event)-{"id", "target", "state_before", "state_after", "trigger", "motion"}:
                            raise _error("VISUAL_PERFORMANCE_INVALID", "Only canonical state events are supported")
                    scene["events"] = copy.deepcopy(events)
                    voice = held_voice if held_voice is not None else self.service.voice.snapshot(project_id)
                    if not voice.get("timing") or not voice.get("assembly") or voice["timing"].get("wav_sha256") != voice["assembly"].get("wav_sha256"):
                        raise _error("VISUAL_MEASURED_TIMING_REQUIRED", "Select and align the voice before authoring acting")
                    self._node(handle, {"action": "validate_performance", "intent": intent,
                                        "scene_id": scene["id"], "narration": self._narration(handle), "timing": voice["timing"]})
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
                    result = self._node(handle, {"action": "candidates", "intent": intent, "scene_id": payload["scene_id"], "requirement": payload["requirement"]})
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
        if not isinstance(requirement, dict) or set(requirement)-{"context", "family_id", "model_id", "view_id", "asset_id", "role", "contact"}:
            raise _error("VISUAL_REQUIREMENT_INVALID", "Unsupported candidate constraints")
        if any(type(v) not in (str, bool) or isinstance(v, str) and len(v)>200 for v in requirement.values()):
            raise _error("VISUAL_REQUIREMENT_INVALID", "Invalid candidate constraints")
        handle = self._handle(project_id)
        usage = self.usage_history(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, intent = self._read(handle)
            if not intent:
                raise _error("VISUAL_SOURCE_REQUIRED", "Import Visual Intent first")
            return self._node(handle, {"action": "candidates", "intent": intent, "scene_id": scene_id, "requirement": requirement, "usage": usage})

    def usage_history(self, project_id):
        records, scanned, cursor = [], 0, None
        # shortcut: scan at most 500 registered projects; add an indexed projection when libraries exceed this bound.
        for _ in range(5):
            page = self.service.registry.list_projects(limit=100, after_project_id=cursor)
            for other in page:
                scanned += 1
                if other.project_id == project_id:
                    continue
                try:
                    root = other.workspace
                    def checked(relative, expected=None):
                        file = root / relative
                        if not file.resolve().is_relative_to(root.resolve()):
                            raise ValueError('Usage path outside project')
                        if any(p.is_symlink() for p in (file, *file.parents) if p == root or root in p.parents):
                            raise ValueError('Usage symlink rejected')
                        digest = _hash(file, root)
                        if digest is None or (expected is not None and digest != expected):
                            raise ValueError('Usage file missing or changed')
                        return file, digest
                    if self.service.project(other.project_id)['status']['content'] != 'APPROVED':
                        continue
                    state_file, _ = checked('.runtime/visual-workspace/state.json')
                    state = self._read_json(state_file)
                    if not isinstance(state, dict):
                        continue
                    build = state.get('build') or {}
                    if not isinstance(build, dict):
                        continue
                    build_id = build.get('id', '')
                    if not isinstance(build_id, str) or not BUILD_ID.fullmatch(build_id):
                        continue
                    prefix = '.runtime/visual-workspace/builds/' + build_id + '/'
                    manifest_file, manifest_hash = checked(prefix + 'manifest.json')
                    manifest = self._read_json(manifest_file)
                    if not isinstance(manifest, dict):
                        continue
                    if manifest.get('format') != 'zodiac-episode-build@1' or manifest.get('status') != 'TECHNICAL_VALID':
                        continue
                    if any(build.get(k) != value for k, value in manifest.items()):
                        continue
                    source_file, _ = checked('.authoring/visual-intent.json')
                    source = self._read_json(source_file)
                    if (state['revision'] != build['revision'] or state['source_hash'] != canonical_hash(source)
                            or manifest['source_sha256'] != state['source_hash']):
                        continue
                    if hashlib.sha256(self._narration(other).encode('utf8')).hexdigest() != manifest['narration_sha256']:
                        continue
                    scenes = manifest['scenes']
                    if not scenes or [s['id'] for s in scenes] != [s['id'] for s in source['scenes']]:
                        continue
                    assets = {}
                    for scene in scenes:
                        checked(prefix + scene['preview_file'], scene['preview_sha256'])
                        for asset_id in scene['asset_ids']:
                            sha = manifest['assets'][asset_id]['sha256']
                            if not isinstance(sha, str) or not re.fullmatch(r'[a-f0-9]{64}', sha):
                                raise ValueError('Invalid usage asset hash')
                            if sha not in assets:
                                checked(prefix + 'assets/' + sha + '.svg', sha)
                                assets[sha] = {'source_sha256': sha, 'scene_ids': []}
                            if scene['id'] not in assets[sha]['scene_ids']:
                                assets[sha]['scene_ids'].append(scene['id'])
                    # A concurrent edit/build cannot lend old outputs to a new source revision.
                    if self._read_json(state_file) != state or canonical_hash(self._read_json(source_file)) != state['source_hash']:
                        continue
                    events = state['events']
                    if not isinstance(events, list) or any(not isinstance(e, dict) or not isinstance(e.get('payload'), dict) for e in events):
                        continue
                    at = next((e['at'] for e in reversed(events) if e['kind'] == 'episode.build_ready' and e['payload'].get('build_id') == build_id), 0)
                    if type(at) not in (int, float) or not math.isfinite(at) or at < 0:
                        continue
                    records.append({'project_id': other.project_id, 'episode_id': other.episode_id,
                                    'build_id': build_id, 'manifest_sha256': manifest_hash,
                                    'source_sha256': manifest['source_sha256'], 'built_at': at,
                                    'review_status': 'NOT_REVIEWED', 'assets': list(assets.values())})
                except (OSError, ValueError, TypeError, KeyError, StudioError):
                    continue
            if len(page) < 100:
                break
            cursor = page[-1].project_id
        records.sort(key=lambda row: (-row['built_at'], row['project_id']))
        return {'format': 'zodiac-asset-usage@1', 'records': records[:50],
                'coverage': {'projects_scanned': scanned, 'scan_limit': 500, 'record_limit': 50,
                             'truncated': scanned == 500 or len(records) > 50}, 'not_an_approval': True}

    def describe(self, project_id):
        return self._node(self._handle(project_id), {"action": "assets"})

    def gallery(self, project_id):
        return self._node(self._handle(project_id), {"action": "gallery", "usage": self.usage_history(project_id)})

    def start(self, project_id, base_revision, scene_id=None):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "visual-state"):
            state, intent = self._read(handle)
            self._revision(state, base_revision)
            if state.get("job") and state["job"]["status"]=="RUNNING" and self._job_alive(project_id,state["job"]):
                raise _error("VISUAL_BUSY", "An active service owns this build")
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
                            "owner_pid": os.getpid(), "owner_instance": self._instance_id,
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
        handle = self.service.registry.get(self.service._id(project_id))
        if handle is None:
            raise _error('PROJECT_NOT_FOUND', 'Unknown project')
        with self._guard:
            job_id = self._job_ids.get(project_id)
            if job_id:
                self._cancelled.add(job_id)
            process = self._processes.get(project_id)
        try:
            with _exclusive_source_lock(handle.workspace, "visual-state"):
                state, _ = self._read(handle)
                if state["job"] and state["job"]["status"] == "RUNNING":
                    state["job"].update(status="CANCELLED", message="Cancelled; last good output preserved")
                    self._save(handle, state)
        finally:
            # Cleanup must still run when source/approval verification has failed.
            if process and process.poll() is None:
                try:
                    if type(process.pid) is int and process.pid > 0:
                        if os.name == 'nt':
                            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW, timeout=10)
                        else:
                            os.killpg(process.pid, signal.SIGKILL)
                finally:
                    process.kill()
        return self.snapshot(project_id)

    def _export_inputs(self, handle, state, intent):
        build = state.get('build') or {}
        if not build or build['revision'] != state['revision'] or build['source_sha256'] != state['source_hash']:
            raise _error('EXPORT_REBUILD_REQUIRED', 'Dựng lại episode hiện tại trước khi xuất MP4')
        if not build.get('production_sha256'):
            raise _error('EXPORT_REBUILD_REQUIRED', 'Dựng lại episode để tạo nguồn HyperFrames có hash')
        if not isinstance(build.get('id'), str) or not BUILD_ID.fullmatch(build['id']):
            raise _error('EXPORT_BUILD_DRIFT', 'Invalid build identity')
        root, _ = self._paths(handle)
        folder = _trusted_dir(handle.workspace, root / 'builds' / build['id'])
        manifest = self._read_json(folder / 'manifest.json')
        if any(build.get(key) != value for key, value in manifest.items()):
            raise _error('EXPORT_BUILD_DRIFT', 'Build manifest changed')
        # Callers hold voice-state through final verification and publication.
        voice = self.service.voice._read(handle)
        take, audio = self.service.voice._take(handle, voice, 'episode')
        if file_sha256(audio) != take['wav_sha256']:
            raise _error('EXPORT_VOICE_CHANGED', 'Selected audio bytes changed')
        if (not voice.get('timing') or take['wav_sha256'] != build['voice_sha256'] or
                canonical_hash(voice['timing']) != build['voice_timing_fingerprint']):
            raise _error('EXPORT_VOICE_CHANGED', 'Voice/timing changed; rebuild first')
        inputs = {'action': 'export_prepare', 'build_root': str(folder), 'manifest_sha256': file_sha256(folder / 'manifest.json'),
                  'source_sha256': state['source_hash'], 'voice_sha256': take['wav_sha256'], 'source_root': str(ROOT),
                  'audio': str(audio), 'voice_duration': take['duration_seconds']}
        inputs['binding'] = canonical_hash({'revision': state['revision'], 'build_id': build['id'], **inputs})
        return inputs

    def export(self, project_id, base_revision):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, 'visual-state'):
            state, intent = self._read(handle)
            self._revision(state, base_revision)
            if state.get('job') and state['job']['status'] == 'RUNNING' and self._job_alive(project_id, state['job']):
                raise _error('VISUAL_BUSY', 'Finish or cancel the current task first')
            with self._guard:
                if project_id in self._workers and self._workers[project_id].is_alive():
                    raise _error('VISUAL_BUSY', 'Previous worker is still stopping')
            with _exclusive_source_lock(handle.workspace, 'voice-state'):
                inputs = self._export_inputs(handle, state, intent)
            job_id = uuid.uuid4().hex
            state['job'] = {'id': job_id, 'action': 'export', 'status': 'RUNNING', 'revision': state['revision'],
                            'owner_pid': os.getpid(), 'owner_instance': self._instance_id,
                            'ready_scenes': [], 'total': 1, 'message': 'Chuẩn bị HyperFrames', 'error': None}
            self._save(handle, state)
            worker = threading.Thread(target=self._export_worker, args=(handle, job_id, inputs), daemon=True)
            with self._guard:
                self._workers[project_id] = worker
                self._job_ids[project_id] = job_id
            worker.start()
        return self.snapshot(project_id)

    def _export_worker(self, handle, job_id, inputs):
        project_id = handle.project_id
        try:
            receipt = self._render_export(handle, job_id, inputs)
            self._handle(project_id)
            with _exclusive_source_lock(handle.workspace, 'visual-state'):
                state, intent = self._read(handle)
                if state['job']['id'] != job_id or state['job']['status'] != 'RUNNING':
                    return
                with _exclusive_source_lock(handle.workspace, 'voice-state'):
                    if self._export_inputs(handle, state, intent).get('binding') != inputs.get('binding'):
                        raise _error('EXPORT_SOURCE_CHANGED', 'Nguồn thay đổi trong lúc render; giữ MP4 trước')
                    state['export'] = {**receipt, 'id': job_id, 'revision': state['revision']}
                    state['job'].update(status='COMPLETED', render_percent=100, message='MP4 HyperFrames đã xuất; chờ xem và duyệt')
                    self._event(state, 'video.exported', {'export_id': job_id, 'sha256': receipt['sha256'], 'not_an_approval': True})
                    self._save(handle, state)
        except Exception as error:
            with _exclusive_source_lock(handle.workspace, 'visual-state'):
                state, _ = self._read(handle)
                if state.get('job') and state['job']['id'] == job_id and state['job']['status'] == 'RUNNING':
                    state['job'].update(status='BLOCKED', error=str(error)[-3000:], message='Xuất MP4 bị chặn; giữ video tốt trước đó')
                    self._save(handle, state)
        finally:
            with self._guard:
                self._workers.pop(project_id, None)
                self._processes.pop(project_id, None)
                self._job_ids.pop(project_id, None)

    def _render_export(self, handle, job_id, inputs):
        root, _ = self._paths(handle)
        output = _trusted_dir(handle.workspace, root / 'exports' / job_id)
        last_log = [0.0]
        def process(child):
            with self._guard:
                if child is None:
                    self._processes.pop(handle.project_id, None)
                else:
                    self._processes[handle.project_id] = child
                    if job_id in self._cancelled:
                        child.kill()
        def log(line, **_):
            if time.monotonic() - last_log[0] < .5:
                return
            last_log[0] = time.monotonic()
            clean = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', line)[-240:]
            progress = None
            if line.startswith('@hf-progress '):
                try:
                    progress = json.loads(line.removeprefix('@hf-progress '))
                    clean = 'HyperFrames · ' + str(progress.get('code', 'render'))
                except ValueError:
                    pass
            with _exclusive_source_lock(handle.workspace, 'visual-state'):
                state, _ = self._read(handle)
                if state['job']['id'] == job_id and state['job']['status'] == 'RUNNING':
                    state['job']['message'] = clean
                    if progress and type(progress.get('pct')) in (int, float) and 0 <= progress['pct'] <= 100:
                        state['job']['render_percent'] = progress['pct']
                    self._save(handle, state)
        receipt = self._node(handle, {**inputs, 'output': str(output)}, process, log)
        shutil.copyfile(inputs['audio'], output / 'voice.wav')
        if file_sha256(output / 'voice.wav') != inputs['voice_sha256']:
            raise _error('EXPORT_VOICE_CHANGED', 'Selected voice changed during snapshot')
        cli = ROOT / 'apps/zodiac-studio/node_modules/hyperframes/bin/hyperframes.mjs'
        if not cli.is_file():
            raise _error('HYPERFRAMES_MISSING', 'Run pnpm install in apps/zodiac-studio')
        def run(command):
            with observe_subprocesses(process), observe_subprocess_output(log):
                return run_managed_subprocess(command, cwd=output, check=True, capture_output=True, text=True)
        run(['node', str(cli), 'check', str(output)])
        run(['node', str(cli), 'render', str(output), '--output', str(output / 'video-only.mp4'), '--fps', str(receipt['fps']), '--quality', 'looks', '--workers', '1', '--no-best-effort'])
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(output / 'video-only.mp4'), '-i', str(output / 'voice.wav'), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', str(output / 'episode.mp4')])
        result = run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(output / 'episode.mp4')])
        probe = json.loads(result.stdout)
        video = next(row for row in probe['streams'] if row['codec_type'] == 'video')
        audio = next(row for row in probe['streams'] if row['codec_type'] == 'audio')
        rate = video['avg_frame_rate'].split('/')
        if ((video['width'], video['height']) != (1080, 1920) or abs(float(rate[0])/float(rate[1])-receipt['fps']) > .01 or
                abs(float(video['duration'])-receipt['duration_seconds']) > 2/receipt['fps'] or
                float(audio['duration'])+.12 < inputs['voice_duration']):
            raise _error('EXPORT_MEDIA_INVALID', 'Video/audio dimensions, frame rate or duration mismatch')
        captions = output / 'captions.srt'
        if file_sha256(captions) != receipt['captions_sha256']:
            raise _error('EXPORT_CAPTIONS_DRIFT', 'Measured captions changed during export')
        cover = output / 'cover.png'
        run(['ffmpeg', '-v', 'error', '-y', '-ss', str(min(1, receipt['duration_seconds']/2)), '-i', str(output / 'episode.mp4'), '-frames:v', '1', '-update', '1', str(cover)])
        receipt.update(path=(output / 'episode.mp4').relative_to(handle.workspace).as_posix(), sha256=file_sha256(output / 'episode.mp4'),
                       bytes=(output / 'episode.mp4').stat().st_size, probe=probe, binding=inputs['binding'],
                       captions={'path': captions.relative_to(handle.workspace).as_posix(), 'sha256': file_sha256(captions)},
                       cover={'path': cover.relative_to(handle.workspace).as_posix(), 'sha256': file_sha256(cover), 'source_video_sha256': file_sha256(output / 'episode.mp4')})
        VoiceArtifactStore._atomic_write(output / 'receipt.json', receipt)
        return receipt

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
        if filename == 'episode.mp4':
            return self._video_data(project_id, build_id), 'video/mp4'
        if not filename.endswith(".html"):
            raise _error("VISUAL_PREVIEW_INVALID", "Only compiled scene HTML may be served")
        return self._preview_data(project_id, build_id, filename[:-5])

    def _video_data(self, project_id, export_id):
        if not BUILD_ID.fullmatch(export_id):
            raise _error('VIDEO_INVALID', 'Invalid export identity')
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, 'visual-state'):
            state, _ = self._read(handle)
            receipt = state.get('export') or {}
            if receipt.get('id') != export_id:
                raise _error('VIDEO_MISSING', 'No verified export with this identity')
            root, _ = self._paths(handle)
            folder = _trusted_dir(handle.workspace, root / 'exports' / export_id)
            file = folder / 'episode.mp4'
            # shortcut: private playback reads up to 256 MiB; stream from disk for larger exports.
            if file.is_symlink() or file.stat().st_size > 256*1024*1024 or _hash(file, handle.workspace) != receipt['sha256']:
                raise _error('VIDEO_OUTPUT_DRIFT', 'Exported video changed; export again')
            return file.read_bytes()

    def video(self, project_id):
        state = self.snapshot(project_id)
        receipt = state.get('export')
        if not receipt:
            raise _error('VIDEO_MISSING', 'Xuất MP4 từ Visual Workspace trước')
        self._video_data(project_id, receipt['id'])
        with self._guard:
            if self._server is None:
                self._server = PreviewServer(self._resource)
            url = self._server.video_url(project_id, receipt['id'])
        handle = self._handle(project_id)
        return {**receipt, 'url': url, 'file_path': str(handle.workspace / receipt['path']),
                'stale': receipt['revision'] != state['revision'] or state['stale_preview'] or not _export_matches_build(handle.workspace, state, receipt), 'not_an_approval': True}

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
        _OWNERS.pop(self._instance_id, None)
