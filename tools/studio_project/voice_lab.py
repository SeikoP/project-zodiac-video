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
import shutil
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
from .voice_bank import VoiceBank, recompose_timing, remember_quietly

ROOT = Path(__file__).resolve().parents[2]
FORMAT = "zodiac-voice-lab@1"
# VieNeu temperature per delivery intent: higher = livelier, more varied intonation (engine default 0.8).
INTENT_TEMPERATURE = {"NORMAL": 0.95, "SHARP": 1.1}


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
    for unit in units:
        unit["gap_after_ms"] = default_gap_ms(unit["text"])
    return units


def default_gap_ms(text: str) -> int:
    """Natural pause after a speech unit, from how its text ends. Without it every sentence is glued to the next."""
    tail = text[len(text.rstrip()):]
    body = text.rstrip()
    if tail.count("\n") >= 2:
        return 700
    if tail.count("\n") == 1:
        return 500
    if body.endswith("…") or body.endswith("..."):
        return 450
    if body.endswith(("?", "!")):
        return 400
    if body.endswith("."):
        return 320
    return 120


def scene_groups(text: str, units: list[dict], plan: dict | None) -> list[dict]:
    """Group speech units into scenes for review: the plan's scene_direction when every beat anchor is found in
    the narration, otherwise paragraphs. A scene is only a listening/review group; it never changes the units."""
    def byte_at(index):
        return len(text[:index].encode("utf-8"))
    starts = []  # (byte start, id, title)
    try:
        beats = {b["id"]: b["voice_anchor"] for b in (plan or {}).get("beats", [])}
        cursor = 0
        for number, scene in enumerate((plan or {}).get("scene_direction", []), 1):
            first = beats[scene["beat_ids"][0]]
            found = text.find(first, cursor)
            if found < 0:
                raise KeyError(first)
            cursor = found + len(first)
            for beat_id in scene["beat_ids"][1:]:
                anchor = beats[beat_id]
                where = text.find(anchor, cursor)
                if where < 0:
                    raise KeyError(anchor)
                cursor = where + len(anchor)
            starts.append((0 if not starts else byte_at(found), scene["id"], f"Cảnh {number}" + (f" · {scene['purpose']}" if scene.get("purpose") else "")))
    except (KeyError, TypeError, IndexError, AttributeError):
        starts = []
    if not starts:
        for number, match in enumerate(re.finditer(r"\S[\s\S]*?(?=\n\s*\n|\Z)", text), 1):
            starts.append((0 if number == 1 else byte_at(match.start()), f"P{number:02d}", f"Đoạn {number}"))
    groups = [{"id": sid, "title": title, "unit_ids": [], "_start": start} for start, sid, title in starts]
    for unit in units:
        owner = [g for g in groups if g["_start"] <= unit["source_range"][0]]
        (owner[-1] if owner else groups[0])["unit_ids"].append(unit["id"])
    return [{k: v for k, v in g.items() if k != "_start"} for g in groups if g["unit_ids"]]


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
                    "voice": self.service.settings.read()['values']['voice']['default'] or preferred_voice(), "job": None, "assembly": None, "timing": None, "playbacks": {}}
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

    def _scenes(self, handle, state):
        source = next((p for p in (handle.workspace/".authoring/narration.txt", handle.workspace/"narration.txt") if p.exists()), None)
        plan = None
        plan_path = handle.workspace/".authoring/narrative-plan.json"
        if plan_path.exists() and not plan_path.is_symlink():
            try:
                plan = json.loads(plan_path.read_text(encoding="utf8"))
            except (OSError, ValueError):
                plan = None
        return scene_groups(source.read_text(encoding="utf8"), state["units"], plan) if source else []

    def _scene_take(self, handle, state, scene_id):
        """Audio of one scene: its units' selected takes joined with their own pauses (no pause after the last one)."""
        scene = next((s for s in self._scenes(handle, state) if "scene:" + s["id"] == scene_id), None)
        if scene is None:
            raise StudioError("VOICE_SCENE_UNKNOWN", "Unknown scene", "voice")
        folder, _ = self._paths(handle)
        inputs, selection = [], []
        units = [u for u in state["units"] if u["id"] in scene["unit_ids"]]
        for i, unit in enumerate(units):
            if not unit.get("selected_take"):
                raise StudioError("VOICE_SCENE_INCOMPLETE", "Scene still has sentences without audio", "voice")
            take, path = self._take(handle, state, unit["id"])
            inputs.append(path)
            gap = unit["gap_after_ms"] if i < len(units)-1 else 0
            selection.append([unit["id"], take["take_id"], take["wav_sha256"], gap])
            if gap:
                with wave.open(str(path), "rb") as reader:
                    params = reader.getparams()
                pause = folder/f"pause-{params.nchannels}-{params.framerate}-{gap}.wav"
                with wave.open(str(pause), "wb") as writer:
                    writer.setparams(params)
                    writer.writeframes(b"\0"*(round(params.framerate*gap/1000)*params.nchannels*params.sampwidth))
                inputs.append(pause)
        key = canonical_hash(selection)
        out = _trusted_dir(handle.workspace, folder/"scenes")/(key+".wav")
        if out.is_symlink() or not out.exists():
            temp = out.with_suffix(".tmp.wav")
            concatenate_wavs(inputs, temp)
            os.replace(temp, out)
        take = {"take_id": key, "path": out.relative_to(handle.workspace).as_posix(), "wav_sha256": file_sha256(out)}
        return take, out

    def _take(self, handle, state, unit_id, take_id=None):
        if unit_id.startswith("scene:"):
            take, path = self._scene_take(handle, state, unit_id)
            if take_id and take["take_id"] != take_id:
                raise StudioError("VOICE_TAKE_CHANGED", "Scene audio changed; refresh the player", "voice")
            return take, path
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

    def _segments(self, handle, state):
        """(unit_id, wav_sha256, gap_after_ms) of the current selection, one row per unit that has a selected take."""
        rows = []
        for unit in state["units"]:
            if not unit.get("selected_take"):
                continue
            take, _ = self._take(handle, state, unit["id"])
            rows.append({"unit_id": unit["id"], "wav_sha256": take["wav_sha256"], "gap_after_ms": unit["gap_after_ms"]})
        return rows

    def _segments_needing_listen(self, handle, state):
        """Units whose take or pause has not been heard by the user (zodiac-voice-segment-proof@1)."""
        try:
            current = self._segments(handle, state)
        except (StudioError, OSError, ValueError, KeyError):
            return [u["id"] for u in state["units"]]
        proven = {(p["unit_id"], p["wav_sha256"], p["gap_after_ms"]) for p in state.get("segment_proofs", [])
                  if p.get("narration_sha256") == state["narration_sha256"]}
        missing = [row["unit_id"] for row in current if (row["unit_id"], row["wav_sha256"], row["gap_after_ms"]) not in proven]
        return missing + [u["id"] for u in state["units"] if not u.get("selected_take")]

    def _can_confirm_from_segments(self, handle, state):
        assembly = state.get("assembly")
        # Hearing every segment is enough: the owner decided a second pass over the whole assembly is not required.
        return bool(assembly and not assembly.get("listened") and not self._segments_needing_listen(handle, state))

    def confirm_from_segments(self, project_id, base_revision):
        """The user's explicit confirmation that the assembly may stand on what they already heard.

        Only reachable from a user action (the GUI button); assemble() and the autopilot never call it. It needs every segment
        of the current selection to carry a proof of the user's own listening. The seams between units, around an edited unit
        and around a changed pause were not played back as a whole: this click accepts that.
        """
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            self._revision(state, base_revision)
            if not self._can_confirm_from_segments(handle, state):
                raise StudioError("VOICE_SEGMENTS_NOT_HEARD", "Còn đoạn chưa nghe", "voice")
            stamps = [p["confirmed_at"] for p in state.get("segment_proofs", [])]
            state["assembly"]["listened"] = {"kind": "user_listened", "wav_sha256": state["assembly"]["wav_sha256"], "confirmed_at": time.time(),
                                             "narration_sha256": state["narration_sha256"], "derived_from": "segment_proofs",
                                             "segments_heard_at": max(stamps)}
            state.pop("approval_note", None)
            state["revision"] += 1
            self._save(handle, state)
        return self.snapshot(project_id)

    def approve_episode(self, project_id, base_revision):
        """The user's single "Duyệt giọng" click. Listening is optional: nothing has to have been played first.

        Only reachable from a user action (the GUI button via voice.confirm); assemble() and the autopilot never call it.
        The approval is bound to the assembled audio, so a later take or pause change drops it. What the user did or did
        not hear is recorded honestly: `playback: skipped_by_user` unless every segment already carries a listening proof.
        """
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            self._revision(state, base_revision)
            assembly = state.get("assembly")
            if not assembly:
                raise StudioError("VOICE_NOT_ASSEMBLED", "Ghép audio trước khi duyệt", "voice")
            self._take(handle, state, "episode")  # the assembly must still match its file on disk
            heard = not self._segments_needing_listen(handle, state)
            stamps = [p["confirmed_at"] for p in state.get("segment_proofs", [])]
            assembly["listened"] = {"kind": "user_listened", "wav_sha256": assembly["wav_sha256"], "confirmed_at": time.time(),
                                    "narration_sha256": state["narration_sha256"],
                                    "derived_from": "segment_proofs" if heard else "user_accepted",
                                    **({"segments_heard_at": max(stamps)} if heard and stamps else {"playback": "skipped_by_user"})}
            state.pop("approval_note", None)
            state["playbacks"].pop("episode", None)
            state["revision"] += 1
            self._save(handle, state)
        return self.snapshot(project_id)

    def snapshot(self, project_id):
        return self.service.scoped(('voice', project_id), lambda: self._snapshot(project_id))

    def _snapshot(self, project_id):
        handle = self._handle(project_id)
        with _exclusive_source_lock(handle.workspace, "voice-state"):
            state = self._read(handle)
            result = {**state, "status": voice_evidence(handle.workspace, handle.imported_source_sha256)}
            voices = saved_voices()
            result["voices"] = list(dict.fromkeys([preferred_voice(voices), *voices]))
            result.pop("playbacks", None)
            result["segments_needing_listen"] = self._segments_needing_listen(handle, state)
            result["can_confirm_from_segments"] = self._can_confirm_from_segments(handle, state)
            result["units"] = []
            result["scenes"] = []
            for scene in self._scenes(handle, state):
                entry = {**scene, "take": None}
                try:
                    record, audio = self._take(handle, state, "scene:" + scene["id"])
                    entry["take"] = {k: v for k, v in {**record, **self._info(audio), "valid": True}.items() if k != "path"}
                except (StudioError, OSError, ValueError):
                    pass
                result["scenes"].append(entry)
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
        had_approval = bool(((state.get("assembly") or {}).get("listened") or {}).get("kind") == "user_listened")
        state.update(assembly=None, timing=None, playbacks={})
        if had_approval:  # nothing to explain when the user had not approved yet
            state["approval_note"] = {"reason": reason, "unit_ids": list(unit_ids), "at": time.time()}
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
                            "total": len(selected) if action == "generate" else len(state["units"]), "error": None, "message": "Preparing audio", "explicit": bool(unit_ids)}
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
                            contexts[unit["id"]] = {"tts_text": text, "speech_map": spans, "delivery_intent": intent, "temperature": INTENT_TEMPERATURE[intent],
                                                    "prosody_verified": False, "pronunciation": pronunciation}
                            rows.append({"scene_id": unit["id"], "text": text})
                    # Automatic generation reuses a take already synthesised for the same text, voice and profile (TTS output is
                    # not reproducible, so a fresh take would silently need a new listening approval). An explicit retake never does.
                    bank, banked = VoiceBank(self.service.registry.root / "voice-bank"), set()

                    def identity_hashes(unit_id):
                        unit = next(u for u in state["units"] if u["id"] == unit_id)
                        return (hashlib.sha256(unit["text"].encode("utf8")).hexdigest(), canonical_hash(voice),
                                canonical_hash({"backend": "v3turbo", "precision": "fp32", **contexts[unit_id]}))
                    if not state["job"].get("explicit"):
                        (job_root/"tts-scenes").mkdir(parents=True, exist_ok=True)
                        for row in rows:
                            hit = bank.lookup(*identity_hashes(row["scene_id"]))
                            if hit is not None:
                                shutil.copyfile(hit, job_root/"tts-scenes"/(row["scene_id"]+".wav"))
                                banked.add(row["scene_id"])
                    if banked:
                        self._update_job(handle, job_id, message=f"Reusing {len(banked)} existing takes")
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
                    to_synthesise = [r for r in rows if r["scene_id"] not in banked]
                    try:
                        if to_synthesise:
                            run_tts_batch(job_root, to_synthesise, tts_root=Path(os.environ.get("ZODIAC_STUDIO_TTS_ROOT", DEFAULT_TTS_ROOT)),
                                          voice=voice, vieneu_url=os.environ.get("ZODIAC_STUDIO_TTS_URL") or None,
                                          temperature=INTENT_TEMPERATURE[intent])
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
                            details={**contexts[unit["id"]], "voice": voice, "origin": "bank" if unit["id"] in banked else "generated"})
                        remember_quietly(bank, *identity_hashes(unit["id"]), audio)
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
                    unit_words = {}
                    for index, unit in enumerate(state["units"]):
                        if job_id in self._cancelled:
                            return
                        take, audio = self._take(handle, state, unit["id"])
                        details = take.get("details") or {}
                        aligned = aligned_by_unit[unit["id"]]
                        spans = details.get("speech_map") or speech_input(unit, {})[1]
                        if len(aligned) != len(spans):
                            raise StudioError("VOICE_ALIGNMENT_REVIEW", "ASR words do not map to the approved byte ranges", "voice")
                        local = []
                        for n, (word, span) in enumerate(zip(aligned, spans)):
                            if (not all(type(word[k]) in (int, float) and math.isfinite(word[k]) for k in ("startMs", "endMs")) or
                                    word["startMs"] < 0 or word["endMs"] <= word["startMs"] or
                                    word["endMs"] > self._info(audio)["duration_seconds"]*1000+.01):
                                raise StudioError("VOICE_ALIGNMENT_REVIEW", "Invalid measured word timestamps", "voice")
                            words.append({**word, "startMs": offset+word["startMs"], "endMs": offset+word["endMs"],
                                          "source_range": span, "unit_id": unit["id"], "anchor_id": f"{unit['id']}:{n}"})
                            local.append({**word, "source_range": span, "unit_id": unit["id"], "anchor_id": f"{unit['id']}:{n}"})
                        unit_words[unit["id"]] = {"wav_sha256": take["wav_sha256"], "words": local}
                        offset += self._info(audio)["duration_seconds"]*1000 + round(self._info(audio)["sample_rate"]*unit["gap_after_ms"]/1000)/self._info(audio)["sample_rate"]*1000
                        self._update_job(handle, job_id, completed=index+1, message="Measured alignment: " + unit["id"])
                    with _exclusive_source_lock(handle.workspace, "voice-state"):
                        current = self._read(handle)
                        if current["job"]["id"] != job_id or current["job"]["status"] != "RUNNING":
                            return
                        if (current.get("assembly") or {}).get("wav_sha256") != state["assembly"]["wav_sha256"]:
                            raise StudioError("VOICE_ALIGNMENT_STALE", "Selected audio changed during alignment", "voice")
                        current["unit_words"] = {**(current.get("unit_words") or {}), **unit_words}  # lets a later edit skip ASR
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
            rows = []
            for unit in state["units"]:
                take, path = self._take(handle, state, unit["id"])
                details = self._info(path)
                rows.append({"id": unit["id"], "gap_after_ms": unit["gap_after_ms"], "duration_ms": details["duration_seconds"]*1000,
                             "sample_rate": details["sample_rate"], "wav_sha256": take["wav_sha256"]})
            stale = (state.get("timing") or {}).get("wav_sha256") != info["wav_sha256"]
            recomposed = recompose_timing(rows, state.get("unit_words") or {}) if stale else None
            if recomposed is not None:  # per-unit ASR is cached: a pause or retake of one unit does not need ASR again
                state["timing"] = {"format": "zodiac-speech-time-map@2", "narration_sha256": state["narration_sha256"],
                                   "wav_sha256": info["wav_sha256"], "words": recomposed, "duration_seconds": info["duration_seconds"],
                                   "source": "measured_asr"}
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
            if unit_id != "episode" and not unit_id.startswith("scene:") and next(u for u in state["units"] if u["id"] == unit_id)["selected_take"] != take["take_id"]:
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
            # A scene may be accepted at the user's own discretion, without finishing its playback (an explicit GUI click);
            # single sentences and the whole episode still need a completed playback.
            accepted_freely = unit_id.startswith("scene:") and not playback_id
            if not accepted_freely and (proof.get("token") != playback_id or proof.get("wav_sha256") != take["wav_sha256"] or
                    time.time()-proof.get("started_at", time.time()) < proof.get("duration", math.inf)*.95):
                raise StudioError("VOICE_PLAYBACK_INCOMPLETE", "Listen to the selected audio through the end first", "voice")
            is_scene = unit_id.startswith("scene:")
            scene_units = []
            if is_scene:
                scene_ids = next(s["unit_ids"] for s in self._scenes(handle, state) if "scene:" + s["id"] == unit_id)
                scene_units = [u for u in state["units"] if u["id"] in scene_ids]
                target = {}
            else:
                target = state["assembly"] if unit_id == "episode" else next(u for u in state["units"] if u["id"] == unit_id)
            if unit_id != "episode" and not is_scene and target["selected_take"] != take["take_id"]:
                raise StudioError("VOICE_TAKE_NOT_SELECTED", "Selected audio changed", "voice")
            if unit_id == "episode":
                state.pop("approval_note", None)
                state["episode_heard"] = state["narration_sha256"]  # the whole assembled audio, seams included, was heard once
            heard_ids = {u["id"] for u in scene_units} if is_scene else {unit_id}
            heard = self._segments(handle, state) if unit_id == "episode" else [r for r in self._segments(handle, state) if r["unit_id"] in heard_ids]
            kept = [p for p in state.get("segment_proofs", []) if p.get("narration_sha256") == state["narration_sha256"]
                    and p["unit_id"] not in {r["unit_id"] for r in heard}]
            state["segment_proofs"] = kept + [{**row, "confirmed_at": time.time(), "narration_sha256": state["narration_sha256"]} for row in heard]
            stamp = {"kind": "user_listened", "wav_sha256": take["wav_sha256"], "confirmed_at": time.time(),
                     "narration_sha256": state["narration_sha256"]}
            if accepted_freely:
                stamp["playback"] = "skipped_by_user"
            for member in (scene_units if is_scene else [target]):
                member["listened"] = dict(stamp)
            state["playbacks"].pop(unit_id, None)
            if is_scene and not self._segments_needing_listen(handle, state):
                state["episode_heard"] = state["narration_sha256"]  # every scene was heard through; only the scene-to-scene pauses were not
            state["revision"] += 1
            self._save(handle, state)
        return self.snapshot(project_id)
