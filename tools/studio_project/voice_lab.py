"""Source-bound Voice Lab. Imported narration is read-only; takes are immutable."""
from __future__ import annotations

import array
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time
import uuid
import wave

from tools.studio.artifacts import VoiceArtifactStore, VoiceIdentity, canonical_hash, file_sha256
from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.runner.audio import concatenate_wavs, validate_voice
from tools.runner.errors import PipelineError
from tools.runner.process import observe_subprocesses, observe_subprocess_output, run_managed_subprocess
from tools.zodiac_local import DEFAULT_TTS_ROOT, run_tts_batch, spoken_scene_text, _normalize_token
from .importer import _exclusive_source_lock, _trusted_dir
from .models import StudioError

ROOT = Path(__file__).resolve().parents[2]
FORMAT = "zodiac-voice-lab@1"


def speech_units(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8")
    offsets = [0]
    for char in text:
        offsets.append(offsets[-1] + len(char.encode("utf-8")))
    ends = sorted(set([m.end() for m in re.finditer(r"[.!?…]+(?=\s|$)|\n+", text)] + [len(text)]))
    units, start = [], 0
    for end in ends:
        # Long sentences split at word boundaries, independently of visual scenes.
        cuts = [m.end() for m in re.finditer(r"\S+\s*", text[start:end])]
        left = start
        for relative in cuts:
            right = start + relative
            if right - left >= 220 and text[left:right].strip():
                a, b = offsets[left], offsets[right]
                units.append({"id": "U" + hashlib.sha256(raw[a:b]).hexdigest()[:10] + f"-{a}",
                              "source_range": [a, b], "text": text[left:right], "gap_after_ms": 0,
                              "selected_take": None, "listened": None})
                left = right
        if text[left:end].strip():
            a, b = offsets[left], offsets[end]
            units.append({"id": "U" + hashlib.sha256(raw[a:b]).hexdigest()[:10] + f"-{a}",
                          "source_range": [a, b], "text": text[left:end], "gap_after_ms": 0,
                          "selected_take": None, "listened": None})
        elif units:
            units[-1]["source_range"][1] = offsets[end]
            a, b = units[-1]["source_range"]
            units[-1]["text"] = raw[a:b].decode("utf-8")
        start = end
    if not units:
        raise StudioError("VOICE_SOURCE_EMPTY", "Approved narration has no speech", "voice")
    return units


def speech_input(unit: dict, pronunciation: dict) -> tuple[str, list[list[int]]]:
    tokens, spans = [], []
    for match in re.finditer(r"\S+", unit["text"]):
        token = spoken_scene_text(match.group())
        core = token.strip('.,!?;:…"“”()')
        if core in pronunciation:
            token = token.replace(core, pronunciation[core], 1)
        a = unit["source_range"][0] + len(unit["text"][:match.start()].encode("utf-8"))
        b = unit["source_range"][0] + len(unit["text"][:match.end()].encode("utf-8"))
        for word in token.split():
            tokens.append(word)
            if _normalize_token(word):
                spans.append([a, b])
    return " ".join(tokens), spans


def wav_info(path: Path) -> dict:
    validate_voice(path)
    with wave.open(str(path), "rb") as reader:
        if reader.getsampwidth() != 2 or reader.getframerate() < 8000:
            raise StudioError("VOICE_FORMAT_UNSUPPORTED", "Voice Lab requires PCM16 WAV at >=8 kHz", "voice")
        frames, rate, channels = reader.getnframes(), reader.getframerate(), reader.getnchannels()
        if frames / rate > 600:
            raise StudioError("VOICE_TOO_LONG", "Speech unit exceeds ten minutes", "voice")
        samples = array.array("h", reader.readframes(frames))
        if sys.byteorder != "little":
            samples.byteswap()
    peak = max((abs(x) for x in samples), default=0)
    rms = math.sqrt(sum(x*x for x in samples) / max(1, len(samples))) / 32768
    stride = max(1, math.ceil(len(samples) / 128))
    peaks = [round(max(abs(x) for x in samples[i:i+stride]) / 32768, 4)
             for i in range(0, len(samples), stride)]
    warnings = []
    if not peak:
        warnings.append("SILENT_AUDIO")
    if sum(abs(x) >= 32760 for x in samples) / max(1, len(samples)) > .002:
        warnings.append("CLIPPING_REVIEW")
    if frames / rate < .15:
        warnings.append("VERY_SHORT_AUDIO")
    block = max(1, round(rate*.02)*channels)
    quiet = [max((abs(x) for x in samples[i:i+block]), default=0) < 120 for i in range(0, len(samples), block)]
    leading = next((i for i, silent in enumerate(quiet) if not silent), len(quiet))*.02
    trailing = next((i for i, silent in enumerate(reversed(quiet)) if not silent), len(quiet))*.02
    if leading > 1 or trailing > 1:
        warnings.append("LONG_BOUNDARY_PAUSE_REVIEW")
    if samples and max(abs(samples[0]), abs(samples[-1])) > 2500:
        warnings.append("ABRUPT_EDGE_REVIEW")
    return {"duration_seconds": frames/rate, "sample_rate": rate, "channels": channels,
            "frames": frames, "peaks": peaks, "rms": round(rms, 5), "warnings": warnings,
            "leading_silence_seconds": leading, "trailing_silence_seconds": trailing}


_EVIDENCE_CACHE: dict[tuple[str, str], tuple[tuple, str]] = {}


def _files_signature(workspace: Path) -> tuple:
    """(path, size, mtime_ns) of every file the evidence verdict depends on; stat only, no hashing."""
    roots = (workspace/".runtime/voice-lab", workspace/".runtime/artifacts/voice", workspace/".authoring/narration.txt",
             workspace/"narration.txt")
    signature = []

    def walk(directory):
        with os.scandir(directory) as entries:
            for entry in entries:
                if entry.is_dir(follow_symlinks=False):
                    walk(entry.path)
                else:
                    info = entry.stat(follow_symlinks=False)
                    signature.append((entry.path, info.st_size, info.st_mtime_ns))
    for root in roots:
        try:
            if root.is_dir():
                walk(root)
            else:
                info = root.stat()
                signature.append((str(root), info.st_size, info.st_mtime_ns))
        except OSError:
            signature.append((str(root), -1, -1))
    return tuple(sorted(signature))


def voice_evidence(workspace: Path, source_sha: str) -> str:
    """Verdict on the voice evidence, re-verified only when a file it depends on changed.

    Verifying hashes every selected take and the assembly (about 0.4 s for 32 units) and the status screens ask
    several times per refresh. Any change to size or modification time re-runs the full check.
    """
    try:
        signature = _files_signature(Path(workspace))
    except OSError:
        return _voice_evidence(workspace, source_sha)
    key = (str(workspace), source_sha)
    cached = _EVIDENCE_CACHE.get(key)
    if cached and cached[0] == signature:
        return cached[1]
    verdict = _voice_evidence(workspace, source_sha)
    _EVIDENCE_CACHE[key] = (signature, verdict)
    return verdict


def _voice_evidence(workspace: Path, source_sha: str) -> str:
    """A legacy APPROVED flag or a valid WAV cannot grant listening approval."""
    path = workspace / ".runtime/voice-lab/state.json"
    if not path.exists():
        return "UNKNOWN"
    try:
        if path.is_symlink() or not path.resolve().is_relative_to(workspace.resolve()):
            return "BLOCKED"
        state = json.loads(path.read_text(encoding="utf8"))
        source = next(p for p in (workspace/".authoring/narration.txt", workspace/"narration.txt") if p.exists())
        if state["format"] != FORMAT or state["source_sha256"] != source_sha or file_sha256(source) != state["narration_sha256"]:
            return "BLOCKED"
        expected = speech_units(source.read_bytes())
        if [(u["id"], u["source_range"], u["text"]) for u in state["units"]] != [(u["id"], u["source_range"], u["text"]) for u in expected]:
            return "BLOCKED"
        selected = []
        all_listened = True
        store = VoiceArtifactStore(workspace)
        for unit in state["units"]:
            take = next((t for t in store.takes(unit["id"]) if t["take_id"] == unit.get("selected_take")), None)
            if take is None:
                return "UNKNOWN"
            if take["text_hash"] != hashlib.sha256(unit["text"].encode("utf8")).hexdigest():
                return "BLOCKED"
            audio = (workspace / take["path"]).resolve()
            if not audio.is_relative_to(workspace.resolve()) or audio.is_symlink() or file_sha256(audio) != take["wav_sha256"]:
                return "BLOCKED"
            selected.append([unit["id"], take["take_id"], take["wav_sha256"], unit["gap_after_ms"]])
            proof = unit.get("listened") or {}
            all_listened &= (proof.get("kind") == "user_listened" and proof.get("wav_sha256") == take["wav_sha256"] and
                             proof.get("narration_sha256") == state["narration_sha256"])
        assembly = state.get("assembly") or {}
        proof = assembly.get("listened") or {}
        selection_hash = canonical_hash(selected)
        # Hearing the assembled episode all the way through is the approval. The assembly is bound by hash to exactly
        # these selected takes and pauses, so a take chosen or changed afterwards no longer matches and drops the
        # approval. Listening to single units stays available (all_listened) but is not required.
        if (assembly.get("selection_hash") == selection_hash and
                proof.get("kind") == "user_listened" and proof.get("wav_sha256") == assembly.get("wav_sha256") and
                proof.get("narration_sha256") == state["narration_sha256"]):
            audio = (workspace / assembly["path"]).resolve()
            if not audio.is_relative_to(workspace.resolve()) or file_sha256(audio) != assembly["wav_sha256"]:
                return "BLOCKED"
            return "USER_LISTENED_APPROVED"
        return "TECHNICAL_VALID"
    except (OSError, ValueError, KeyError, TypeError, StopIteration):
        return "BLOCKED"


class VoiceLab:
    def __init__(self, service):
        self.service = service
        self._guard = threading.RLock()
        self._workers = {}
        self._job_ids = {}
        self._processes = {}
        self._cancelled = set()
        self._audio_stats = {}

    def _handle(self, project_id):
        if self.service.project(project_id)["status"]["content"] != "APPROVED":
            raise StudioError("CONTENT_APPROVAL_REQUIRED", "Approved source is missing or changed", "voice")
        return self.service.registry.get(project_id)

    def _paths(self, handle):
        folder = _trusted_dir(handle.workspace, handle.workspace/".runtime")
        folder = _trusted_dir(handle.workspace, folder/"voice-lab")
        return folder, folder/"state.json"

    def _read(self, handle):
        source = next((p for p in (handle.workspace/".authoring/narration.txt", handle.workspace/"narration.txt") if p.exists()), None)
        if source is None or source.is_symlink():
            raise StudioError("VOICE_SOURCE_MISSING", "Approved narration unavailable", "voice")
        raw = source.read_bytes()
        plan = speech_units(raw)
        _, path = self._paths(handle)
        if not path.exists():
            return {"format": FORMAT, "project_id": handle.project_id, "source_sha256": handle.imported_source_sha256,
                    "narration_sha256": hashlib.sha256(raw).hexdigest(), "revision": 0, "units": plan,
                    "voice": preferred_voice(), "job": None, "assembly": None, "timing": None, "playbacks": {}}
        if path.is_symlink():
            raise StudioError("VOICE_STATE_INVALID", "Symlink voice state rejected", "voice")
        try:
            state = json.loads(path.read_text(encoding="utf8"))
            if (state["format"] != FORMAT or state["source_sha256"] != handle.imported_source_sha256 or
                    state["narration_sha256"] != hashlib.sha256(raw).hexdigest() or
                    [(u["id"], u["source_range"], u["text"]) for u in state["units"]] !=
                    [(u["id"], u["source_range"], u["text"]) for u in plan]):
                raise ValueError("Speech plan/source drift")
            return state
        except (ValueError, KeyError, TypeError) as error:
            raise StudioError("VOICE_STATE_INVALID", str(error), "voice") from error

    def _save(self, handle, state):
        _, path = self._paths(handle)
        VoiceArtifactStore._atomic_write(path, state)

    def _info(self, path):
        signature = (str(path), path.stat().st_size, path.stat().st_mtime_ns)
        if signature not in self._audio_stats:
            try:
                self._audio_stats[signature] = {**wav_info(path), "wav_sha256": file_sha256(path)}
            except (PipelineError, wave.Error, EOFError) as error:
                raise StudioError("VOICE_AUDIO_INVALID", str(error), "voice") from error
        return self._audio_stats[signature]

    def _take(self, handle, state, unit_id, take_id=None):
        if unit_id == "episode":
            take = state.get("assembly")
            if not take:
                raise StudioError("VOICE_ASSEMBLY_MISSING", "Assemble the selected takes first", "voice")
            if take_id and take["take_id"] != take_id:
                raise StudioError("VOICE_TAKE_CHANGED", "Assembled audio changed; refresh the player", "voice")
        else:
            unit = next((u for u in state["units"] if u["id"] == unit_id), None)
            if unit is None:
                raise StudioError("VOICE_UNIT_UNKNOWN", "Unknown speech unit", "voice")
            take_id = take_id or unit["selected_take"]
            take = next((t for t in VoiceArtifactStore(handle.workspace).takes(unit_id) if t["take_id"] == take_id), None)
            if take is None:
                raise StudioError("VOICE_TAKE_UNKNOWN", "Unknown take", "voice")
        rel = Path(take["path"])
        if rel.is_absolute() or ".." in rel.parts:
            raise StudioError("VOICE_PATH_ESCAPE", "Audio requires a project-relative path", "voice")
        path = handle.workspace / rel
        if path.is_symlink() or not path.resolve().is_relative_to(handle.workspace.resolve()):
            raise StudioError("VOICE_PATH_ESCAPE", "Audio must stay inside the project", "voice")
        if self._info(path)["wav_sha256"] != take["wav_sha256"]:
            raise StudioError("VOICE_AUDIO_DRIFT", "Audio hash changed", "voice")
        return take, path

    def snapshot(self, project_id):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            result = {**state, "status": voice_evidence(handle.workspace, handle.imported_source_sha256)}
            voices = saved_voices()
            result["voices"] = list(dict.fromkeys([preferred_voice(voices), *voices]))
            result.pop("playbacks", None)
            result["units"] = []
            store = VoiceArtifactStore(handle.workspace)
            for unit in state["units"]:
                takes = []
                for take in store.takes(unit["id"]):
                    try:
                        record, audio = self._take(handle, state, unit["id"], take["take_id"])
                        item = {**record, **self._info(audio), "valid": True}
                    except (StudioError, OSError, ValueError) as error:
                        item = {**take, "valid": False, "error": str(error), "duration_seconds": 0,
                                "peaks": [], "warnings": ["AUDIO_MISSING_OR_DRIFTED"]}
                    takes.append({k: v for k, v in item.items() if k != "path"})
                result["units"].append({**unit, "takes": takes})
            if state.get("assembly"):
                try:
                    record, audio = self._take(handle, state, "episode")
                    result["assembly"] = {k: v for k, v in {**record, **self._info(audio), "valid": True}.items() if k != "path"}
                except (StudioError, OSError, ValueError) as error:
                    result["assembly"] = None
                    result["assembly_error"] = str(error)
            return result

    @staticmethod
    def _revision(state, revision):
        if type(revision) is not int or revision != state["revision"]:
            raise StudioError("REVISION_CONFLICT", "Voice Lab changed; refresh and retry", "voice")

    def select(self, project_id, unit_id, take_id, base_revision, gap_after_ms):
        handle = self._handle(project_id)
        if type(gap_after_ms) not in (int, float) or not math.isfinite(gap_after_ms) or not 0 <= gap_after_ms <= 1000:
            raise StudioError("VOICE_PAUSE_INVALID", "Pause must be 0–1000 ms", "voice")
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            self._revision(state, base_revision)
            self._take(handle, state, unit_id, take_id)
            unit = next(u for u in state["units"] if u["id"] == unit_id)
            if unit["selected_take"] != take_id or unit["gap_after_ms"] != gap_after_ms:
                reason = "take_changed" if unit["selected_take"] != take_id else "pause_changed"
                unit.update(selected_take=take_id, gap_after_ms=gap_after_ms, listened=None)
                self._invalidate(state, [unit_id], reason)
                state["revision"] += 1
                self._save(handle, state)
        return self.snapshot(project_id)

    @staticmethod
    def _invalidate(state, unit_ids, reason="take_changed"):
        # Say why the listening approval went away, so the GUI can ask for the right thing instead of a blanket re-listen.
        state.update(assembly=None, timing=None, playbacks={},
                     approval_note={"reason": reason, "unit_ids": list(unit_ids), "at": time.time()})
        state["invalidated"] = {"speech_units": unit_ids, "artifacts": ["assembled_voice", "word_timing", "downstream_absolute_times"],
                                "svg_assets_invalidated": False}

    def start(self, project_id, action, unit_ids, voice, intent, pronunciation, base_revision):
        if action not in ("generate", "align") or not isinstance(unit_ids, list):
            raise StudioError("VOICE_REQUEST_INVALID", "Invalid voice job", "voice")
        if (not isinstance(voice, str) or not voice.strip() or len(voice) > 80 or intent not in ("NORMAL", "SHARP") or
                not isinstance(pronunciation, dict) or len(pronunciation) > 30 or
                any(not isinstance(k, str) or not k.strip() or len(k) > 60 or not isinstance(v, str) or not v.strip() or len(v) > 100 for k,v in pronunciation.items())):
            raise StudioError("VOICE_SETTINGS_INVALID", "Invalid voice or pronunciation settings", "voice")
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            self._revision(state, base_revision)
            with self._guard:
                if project_id in self._workers and self._workers[project_id].is_alive():
                    raise StudioError("VOICE_BUSY", "Previous voice worker is still stopping", "voice")
            if state.get("job") and state["job"]["status"] == "RUNNING":
                raise StudioError("VOICE_BUSY", "Cancel the current voice job first", "voice")
            ids = {u["id"] for u in state["units"]}
            if len(unit_ids) != len(set(unit_ids)) or any(u not in ids for u in unit_ids):
                raise StudioError("VOICE_UNIT_UNKNOWN", "Unknown or duplicate speech units", "voice")
            if action == "align" and not state.get("assembly"):
                raise StudioError("VOICE_ASSEMBLY_MISSING", "Assemble the selected audio first", "voice")
            selected = unit_ids or [u["id"] for u in state["units"] if not u["selected_take"]]
            if action == "generate" and not selected:
                raise StudioError("VOICE_REQUEST_EMPTY", "Choose a unit for a retake", "voice")
            job_id = uuid.uuid4().hex
            state["job"] = {"id": job_id, "action": action, "status": "RUNNING", "completed": 0,
                            "total": len(selected) if action == "generate" else len(state["units"]), "error": None, "message": "Preparing audio"}
            state["revision"] += 1
            self._save(handle, state)
            worker = threading.Thread(target=self._run, args=(project_id, job_id, selected, voice.strip(), intent, pronunciation), daemon=True)
            with self._guard:
                self._workers[project_id] = worker
                self._job_ids[project_id] = job_id
            worker.start()
        return self.snapshot(project_id)

    def _update_job(self, handle, job_id, **fields):
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            try:
                state = self._read(handle)
            except StudioError:
                return False
            if state.get("job", {}).get("id") != job_id or state["job"]["status"] != "RUNNING":
                return False
            state["job"].update(fields)
            self._save(handle, state)
            return True

    def _run(self, project_id, job_id, ids, voice, intent, pronunciation):
        handle = self.service.registry.get(project_id)
        def process_changed(process):
            with self._guard:
                if process is None:
                    self._processes.pop(project_id, None)
                else:
                    self._processes[project_id] = process
                    if job_id in self._cancelled:
                        process.kill()
        def log(line, **_):
            fields = {"message": str(line)[-250:]}
            if str(line).startswith("VieNeu DONE:"):
                completed = str(line).split(":", 1)[1].strip()
                if completed in ids:
                    completed_ids.add(completed)
                    fields["completed"] = len(completed_ids)
            self._update_job(handle, job_id, **fields)
        completed_ids = set()
        try:
            folder, _ = self._paths(handle)
            job_root = _trusted_dir(handle.workspace, folder/"jobs"/job_id)
            with observe_subprocesses(process_changed), observe_subprocess_output(log):
                with _exclusive_source_lock(handle.workspace, "voice-state"):
                    state = self._read(handle)
                if state["job"]["action"] == "generate":
                    rows, contexts = [], {}
                    for unit in state["units"]:
                        if unit["id"] in ids:
                            text, spans = speech_input(unit, pronunciation)
                            contexts[unit["id"]] = {"tts_text": text, "speech_map": spans, "delivery_intent": intent,
                                                    "prosody_verified": False, "pronunciation": pronunciation}
                            rows.append({"scene_id": unit["id"], "text": text})
                    generation_error = None
                    finished = threading.Event()

                    def report_progress():  # the engine only returns at the end; its finished WAV files show real progress
                        seen = -1
                        while not finished.wait(2):
                            count = sum(1 for row in rows if (job_root/"tts-scenes"/(row["scene_id"]+".wav")).exists())
                            if count != seen:
                                seen = count
                                try:
                                    self._update_job(handle, job_id, completed=count, message=f"Generating audio {count}/{len(rows)}")
                                except Exception:
                                    return
                    threading.Thread(target=report_progress, daemon=True).start()
                    try:
                        run_tts_batch(job_root, rows, tts_root=Path(os.environ.get("ZODIAC_STUDIO_TTS_ROOT", DEFAULT_TTS_ROOT)),
                                      voice=voice, vieneu_url=os.environ.get("ZODIAC_STUDIO_TTS_URL") or None)
                    except Exception as error:
                        generation_error = error
                    finally:
                        finished.set()
                    generated = {}
                    for row in rows:
                        audio = job_root/"tts-scenes"/(row["scene_id"]+".wav")
                        if generation_error is not None and not audio.exists():
                            continue
                        try:
                            info = wav_info(audio)
                        except (OSError, PipelineError, StudioError, wave.Error, EOFError):
                            if generation_error is not None:
                                continue
                            raise
                        if "SILENT_AUDIO" in info["warnings"]:
                            if generation_error is not None:
                                continue
                            raise StudioError("VOICE_SILENT_AUDIO", "Generated audio is silent", "voice")
                        unit = next(u for u in state["units"] if u["id"] == row["scene_id"])
                        generated[unit["id"]] = VoiceArtifactStore(handle.workspace).register_candidate(
                            unit["id"], audio, identity=VoiceIdentity(
                                text_hash=hashlib.sha256(unit["text"].encode("utf8")).hexdigest(),
                                voice_profile_hash=canonical_hash(voice),
                                generation_profile_hash=canonical_hash({"backend": "v3turbo", "precision": "fp32", **contexts[unit["id"]]})),
                            details={**contexts[unit["id"]], "voice": voice, "origin": "generated"})
                    self._handle(project_id)  # Recheck source after the external engine returns.
                    with _exclusive_source_lock(handle.workspace, "voice-state"):
                        current = self._read(handle)
                        if current["job"]["id"] != job_id or current["job"]["status"] != "RUNNING":
                            return
                        for unit in current["units"]:
                            if unit["id"] in generated and unit["selected_take"] is None:
                                unit["selected_take"] = generated[unit["id"]]["take_id"]
                        current["voice"] = voice
                        if any(u["id"] in generated and state["units"][i]["selected_take"] is None
                               for i, u in enumerate(current["units"])):
                            self._invalidate(current, list(generated))
                        current["revision"] += 1
                        if generation_error is None:
                            current["job"].update(status="COMPLETED", completed=len(generated), message="Audio ready — listen before approving")
                        else:
                            # Commit partial recovery and REVIEW together; never expose a false COMPLETED.
                            detail = (generation_error.stderr or generation_error.stdout or str(generation_error)) if isinstance(generation_error, subprocess.CalledProcessError) else str(generation_error)
                            current["job"].update(status="REVIEW", completed=len(generated), error=str(detail)[-1200:], message="Audio needs review; completed takes preserved")
                        self._save(handle, current)
                else:
                    words, offset = [], 0.0
                    manifest_path, result_path = job_root/"alignment-input.json", job_root/"alignment-output.json"
                    manifest = {"workspace": str(_trusted_dir(handle.workspace, folder/"alignment")),
                                "assembly": str(handle.workspace/state["assembly"]["path"]),
                                "assembly_sha256": state["assembly"]["wav_sha256"], "units": []}
                    for unit in state["units"]:
                        take, audio = self._take(handle, state, unit["id"])
                        manifest["units"].append({"id": unit["id"], "audio": str(audio), "wav_sha256": take["wav_sha256"],
                                                  "tts_text": (take.get("details") or {}).get("tts_text") or spoken_scene_text(unit["text"])})
                    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf8")
                    self._update_job(handle, job_id, message="Measuring word timing with ASR (about 40 s for a short episode)")
                    run_managed_subprocess([sys.executable, "-m", "tools.studio_project.voice_worker", "batch", str(manifest_path), str(result_path)],
                                           cwd=ROOT, check=True, capture_output=True, text=True)
                    aligned_by_unit = json.loads(result_path.read_text(encoding="utf8"))
                    for index, unit in enumerate(state["units"]):
                        if job_id in self._cancelled:
                            return
                        take, audio = self._take(handle, state, unit["id"])
                        details = take.get("details") or {}
                        aligned = aligned_by_unit[unit["id"]]
                        spans = details.get("speech_map") or speech_input(unit, {})[1]
                        if len(aligned) != len(spans):
                            raise StudioError("VOICE_ALIGNMENT_REVIEW", "ASR words do not map to the approved byte ranges", "voice")
                        for n, (word, span) in enumerate(zip(aligned, spans)):
                            if (not all(type(word[k]) in (int, float) and math.isfinite(word[k]) for k in ("startMs", "endMs")) or
                                    word["startMs"] < 0 or word["endMs"] <= word["startMs"] or
                                    word["endMs"] > self._info(audio)["duration_seconds"]*1000+.01):
                                raise StudioError("VOICE_ALIGNMENT_REVIEW", "Invalid measured word timestamps", "voice")
                            words.append({**word, "startMs": offset+word["startMs"], "endMs": offset+word["endMs"],
                                          "source_range": span, "unit_id": unit["id"], "anchor_id": f"{unit['id']}:{n}"})
                        offset += self._info(audio)["duration_seconds"]*1000 + round(self._info(audio)["sample_rate"]*unit["gap_after_ms"]/1000)/self._info(audio)["sample_rate"]*1000
                        self._update_job(handle, job_id, completed=index+1, message="Measured alignment: " + unit["id"])
                    with _exclusive_source_lock(handle.workspace, "voice-state"):
                        current = self._read(handle)
                        if current["job"]["id"] != job_id or current["job"]["status"] != "RUNNING":
                            return
                        if (current.get("assembly") or {}).get("wav_sha256") != state["assembly"]["wav_sha256"]:
                            raise StudioError("VOICE_ALIGNMENT_STALE", "Selected audio changed during alignment", "voice")
                        current["timing"] = {"format": "zodiac-speech-time-map@2", "narration_sha256": state["narration_sha256"],
                                             "wav_sha256": state["assembly"]["wav_sha256"], "words": words,
                                             "duration_seconds": state["assembly"]["duration_seconds"], "source": "measured_asr"}
                        current["job"].update(status="COMPLETED", message="Measured word timing ready")
                        current["revision"] += 1
                        self._save(handle, current)
        except Exception as error:
            detail = (error.stderr or error.stdout or str(error)) if isinstance(error, subprocess.CalledProcessError) else str(error)
            self._update_job(handle, job_id, status="REVIEW", error=str(detail)[-1200:], message="Audio needs review; source was not rewritten")
        finally:
            with self._guard:
                self._workers.pop(project_id, None)
                self._job_ids.pop(project_id, None)

    def cancel(self, project_id):
        handle = self.service.registry.get(self.service._id(project_id))
        if handle is None:
            raise StudioError("PROJECT_NOT_FOUND", str(project_id), "voice")
        # Cancel owned processes even when the approved source has drifted.
        with self._guard:
            if project_id in self._job_ids:
                self._cancelled.add(self._job_ids[project_id])
            process = self._processes.get(project_id)
            if process and process.poll() is None:
                process.kill()
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            if state.get("job") and state["job"]["status"] == "RUNNING":
                self._cancelled.add(state["job"]["id"])
                state["job"].update(status="CANCELLED", message="Stopped; existing takes preserved")
                state["revision"] += 1
                self._save(handle, state)
        return self.snapshot(project_id)

    def close(self):
        with self._guard:
            workers = list(self._workers.items())
        for project_id, worker in workers:
            try:
                self.cancel(project_id)
            except (StudioError, OSError):
                pass
            finally:
                worker.join(timeout=2)

    def assemble(self, project_id, base_revision):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            self._revision(state, base_revision)
            inputs, selection, timings, offset, profile = [], [], [], 0.0, None
            folder, _ = self._paths(handle)
            for i, unit in enumerate(state["units"]):
                take, path = self._take(handle, state, unit["id"])
                if profile is not None and profile != take["voice_profile_hash"]:
                    raise StudioError("VOICE_PROFILE_MISMATCH", "Selected units must use one voice identity", "voice")
                profile = take["voice_profile_hash"]
                duration = self._info(path)["duration_seconds"]
                timings.append({"unit_id": unit["id"], "startMs": offset, "endMs": offset+duration*1000,
                                "source_range": unit["source_range"]})
                inputs.append(path)
                selection.append([unit["id"], take["take_id"], take["wav_sha256"], unit["gap_after_ms"]])
                offset += duration*1000
                if i < len(state["units"])-1 and unit["gap_after_ms"]:
                    with wave.open(str(path), "rb") as reader:
                        params = reader.getparams()
                    pause = folder/f"pause-{params.nchannels}-{params.framerate}-{unit['gap_after_ms']}.wav"
                    count = round(params.framerate*unit["gap_after_ms"]/1000)
                    with wave.open(str(pause), "wb") as writer:
                        writer.setparams(params)
                        writer.writeframes(b"\0"*(count*params.nchannels*params.sampwidth))
                    inputs.append(pause)
                    offset += count/params.framerate*1000
            key = canonical_hash(selection)
            out = _trusted_dir(handle.workspace, folder/"assembled")/(key+".wav")
            previous = state.get("assembly") or {}
            if (out.is_symlink() or not out.exists() or previous.get("selection_hash") != key or
                    self._info(out)["wav_sha256"] != previous.get("wav_sha256")):
                temp = out.with_suffix(".tmp.wav")
                concatenate_wavs(inputs, temp)
                os.replace(temp, out)
            info = self._info(out)
            state["assembly"] = {"take_id": key, "selection_hash": key, "path": out.relative_to(handle.workspace).as_posix(),
                                 "wav_sha256": info["wav_sha256"], **info, "units": timings,
                                 "listened": previous.get("listened") if previous.get("wav_sha256") == info["wav_sha256"] else None}
            state["revision"] += 1
            self._save(handle, state)
        return self.snapshot(project_id)

    def audio(self, project_id, unit_id, take_id, offset):
        if type(offset) is not int or offset < 0:
            raise StudioError("VOICE_AUDIO_OFFSET_INVALID", "Invalid audio cursor", "voice")
        handle = self._handle(project_id)
        state = self._read(handle)
        take, path = self._take(handle, state, unit_id, take_id)
        size = path.stat().st_size
        if size > 64*1024*1024 or offset > size:
            raise StudioError("VOICE_AUDIO_SIZE_INVALID", "Invalid or oversized audio", "voice")
        with path.open("rb") as reader:
            reader.seek(offset)
            data = reader.read(512*1024)
        return {"data": base64.b64encode(data).decode(), "offset": offset, "total": size, "wav_sha256": take["wav_sha256"]}

    def playback(self, project_id, unit_id, take_id):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            take, path = self._take(handle, state, unit_id, take_id)
            if unit_id != "episode" and next(u for u in state["units"] if u["id"] == unit_id)["selected_take"] != take["take_id"]:
                raise StudioError("VOICE_TAKE_NOT_SELECTED", "Select this take before confirming it", "voice")
            token = uuid.uuid4().hex
            state["playbacks"][unit_id] = {"token": token, "wav_sha256": take["wav_sha256"], "started_at": time.time(),
                                           "duration": self._info(path)["duration_seconds"]}
            self._save(handle, state)
        return {"playback_id": token}

    def confirm(self, project_id, unit_id, take_id, playback_id, confirm, base_revision):
        if confirm is not True:
            raise StudioError("VOICE_LISTENING_CONFIRMATION_REQUIRED", "Explicit listening confirmation required", "voice")
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            self._revision(state, base_revision)
            take, _ = self._take(handle, state, unit_id, take_id)
            proof = state["playbacks"].get(unit_id) or {}
            if (proof.get("token") != playback_id or proof.get("wav_sha256") != take["wav_sha256"] or
                    time.time()-proof.get("started_at", time.time()) < proof.get("duration", math.inf)*.95):
                raise StudioError("VOICE_PLAYBACK_INCOMPLETE", "Listen to the selected audio through the end first", "voice")
            target = state["assembly"] if unit_id == "episode" else next(u for u in state["units"] if u["id"] == unit_id)
            if unit_id != "episode" and target["selected_take"] != take["take_id"]:
                raise StudioError("VOICE_TAKE_NOT_SELECTED", "Selected audio changed", "voice")
            if unit_id == "episode":
                state.pop("approval_note", None)
            target["listened"] = {"kind": "user_listened", "wav_sha256": take["wav_sha256"], "confirmed_at": time.time(),
                                  "narration_sha256": state["narration_sha256"]}
            state["playbacks"].pop(unit_id, None)
            state["revision"] += 1
            self._save(handle, state)
        return self.snapshot(project_id)
