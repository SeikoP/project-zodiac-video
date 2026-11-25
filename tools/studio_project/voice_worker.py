"""Cancellable measured-ASR worker using the existing exact-word aligner."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time

from tools.zodiac_local import load_word_aligner, _align_scene_words, _transcribe_raw_words, _clamp_aligned_words_to_wav_boundary
from tools.studio.artifacts import file_sha256
from tools.studio_v2.voice import VoiceArtifact
from tools.studio_v2.timing import _align_cached_scenes, _wav_seconds


WINDOW_SECONDS = 24.0  # Whisper always encodes a 30 s window, so many short units share one pass
GAP_SECONDS = 0.5


class BatchedWordSource:
    """Hear several short units in one Whisper pass, then verify each unit exactly as a single pass would.

    A unit whose words do not reproduce its own approved text is heard again on its own, so a boundary
    mistake can only cost time, never a wrong timestamp.
    """

    def __init__(self, units):
        # Keyed by the scene file name the aligner asks about; audio is read from the unit's own take.
        self.units = [(u["id"] + ".wav", Path(u["audio"]), _wav_seconds(Path(u["audio"]))) for u in units]
        self.heard = {}

    def _hear_group(self, model, start):
        import wave
        group, total = [], 0.0
        for name, path, seconds in self.units[start:]:
            if group and total + seconds > WINDOW_SECONDS:
                break
            if name not in self.heard:
                group.append((name, path, seconds, total))
                total += seconds + GAP_SECONDS
        if not group:
            return
        frames, params = [], None
        for _, path, _, _ in group:
            with wave.open(str(path), "rb") as source:
                if params is None:
                    params = source.getparams()
                elif source.getparams()[:3] != params[:3]:
                    return  # mixed formats: let each unit be heard alone
                frames.append(source.readframes(source.getnframes()))
        silence = b"\x00" * (int(params.framerate*GAP_SECONDS)*params.sampwidth*params.nchannels)
        joined = group[0][1].with_name("batch-" + group[0][1].stem + ".wav")
        with wave.open(str(joined), "wb") as target:
            target.setparams(params)
            target.writeframes(silence.join(frames))
        try:
            # Greedy decoding is ~2x faster; each unit is still verified against its approved text below.
            words = _transcribe_raw_words(model, joined, beam_size=1, temperature=0.0)
        finally:
            joined.unlink(missing_ok=True)
        for name, _, seconds, offset in group:
            own = [{**w, "start": w["start"] - offset, "end": w["end"] - offset} for w in words
                   if offset - GAP_SECONDS/2 <= w["start"] < offset + seconds + GAP_SECONDS/2]
            self.heard[name] = own

    def __call__(self, model, path, text):
        path = Path(path)
        index = next((i for i, unit in enumerate(self.units) if unit[0] == path.name), None)
        if index is not None and path.name not in self.heard:
            self._hear_group(model, index)
        words = self.heard.pop(path.name, None)
        if words is not None:
            try:
                aligned = _align_scene_words(model, path, text, raw_words=words)
                # A word heard in the shared pass may spill into the gap after its unit: the same boundary rule as
                # a single pass decides, and a unit that fails it is heard alone.
                _clamp_aligned_words_to_wav_boundary(path.stem, aligned, self.units[index][2])
                return aligned
            except Exception:
                pass  # heard together but not verifiable: hear this unit alone below
        return _align_scene_words(model, path, text)


def relative_words(words, offset):
    # Global-to-local subtraction can produce -3.6e-12 ms for a true zero.
    # Round only arithmetic noise, far below a WAV sample; validation must still
    # reject actual negative, reversed or out-of-audio measurements.
    return [{**word, "startMs": round(word["startMs"] - offset, 6),
             "endMs": round(word["endMs"] - offset, 6)} for word in words]


HEARTBEAT_SECONDS = 1.0
HEARTBEAT_TIMEOUT = 8.0


def align_workers(unit_count: int) -> int:
    """Whisper on CPU does not get faster with more threads, so run a few single-stream processes instead.

    Units are heard in batches, so the work is CPU-bound: measured 36 s with 2 workers vs 47 s with 4 (32 units).
    """
    requested = os.environ.get("ZODIAC_STUDIO_ALIGN_WORKERS")
    try:
        workers = int(requested) if requested else min(2, max(1, (os.cpu_count() or 2) // 2))
    except ValueError:
        workers = 1
    return max(1, min(workers, unit_count // 2 or 1))


def watch_parent(heartbeat: Path) -> None:
    """A child must not outlive a cancelled parent: exit when the parent stops touching the heartbeat file."""
    def loop():
        while True:
            time.sleep(HEARTBEAT_SECONDS)
            try:
                age = time.time() - heartbeat.stat().st_mtime
            except OSError:
                os._exit(3)
            if age > HEARTBEAT_TIMEOUT:
                os._exit(3)
    threading.Thread(target=loop, daemon=True).start()


def run_parallel(manifest: dict, workers: int, output: Path) -> None:
    """Align round-robin shares of the units in separate processes and merge their per-unit local words.

    Each share uses its own workspace folder, so scene caches and the artifact graph never race. Round-robin
    keeps the shares stable between runs, so cached scenes are still reused.
    """
    root = Path(manifest["workspace"])
    base = root/".runtime"/"align-parts"
    base.mkdir(parents=True, exist_ok=True)
    heartbeat = base/"heartbeat"
    heartbeat.write_text("1")
    stop = threading.Event()

    def beat():
        while not stop.wait(HEARTBEAT_SECONDS):
            try:
                heartbeat.touch()
            except OSError:
                pass
    threading.Thread(target=beat, daemon=True).start()
    children = []
    try:
        for index in range(workers):
            part_dir = base/f"part-{index}"
            part_dir.mkdir(parents=True, exist_ok=True)
            part = {**manifest, "workspace": str(part_dir), "units": manifest["units"][index::workers], "part": index,
                    "heartbeat": str(heartbeat)}
            manifest_path, result_path = part_dir/"manifest.json", part_dir/"result.json"
            manifest_path.write_text(json.dumps(part, ensure_ascii=False), encoding="utf8")
            if result_path.exists():
                result_path.unlink()
            children.append((subprocess.Popen([sys.executable, "-m", "tools.studio_project.voice_worker", "batch",
                                               str(manifest_path), str(result_path)]), result_path))
        merged, failed = {}, []
        for process, result_path in children:
            if process.wait() != 0 or not result_path.exists():
                failed.append(process.returncode)
                continue
            merged.update(json.loads(result_path.read_text(encoding="utf8")))
        if failed:
            raise RuntimeError(f"ASR worker failed (exit codes {failed})")
        # A serial run stamps every word with its position on the whole-episode timeline (timestampMs). Each share only
        # knew its own earlier units, so move the stamp by the difference between the two offsets.
        durations = {unit["id"]: _wav_seconds(Path(unit["audio"]))*1000 for unit in manifest["units"]}
        global_offset, share_offset = 0.0, [0.0]*workers
        for position, unit in enumerate(manifest["units"]):
            share = position % workers
            delta = global_offset - share_offset[share]
            if delta:
                for word in merged.get(unit["id"], []):
                    if "timestampMs" in word:
                        word["timestampMs"] = round(word["timestampMs"] + delta, 6)
            global_offset += durations[unit["id"]]
            share_offset[share] += durations[unit["id"]]
        output.write_text(json.dumps(merged, ensure_ascii=False, allow_nan=False), encoding="utf8")
    finally:
        stop.set()
        for process, _ in children:
            if process.poll() is None:
                process.kill()


def main():
    if sys.argv[1] == "batch":
        manifest = json.loads(Path(sys.argv[2]).read_text(encoding="utf8"))
        if manifest.get("heartbeat"):
            watch_parent(Path(manifest["heartbeat"]))
        elif align_workers(len(manifest["units"])) > 1:
            run_parallel(manifest, align_workers(len(manifest["units"])), Path(sys.argv[3]))
            return
        root = Path(manifest["workspace"])
        # Windows cache filenames exceed MAX_PATH inside imported workspaces.
        if os.name == "nt":
            resolved = str(root.resolve())
            root = Path("\\\\?\\UNC\\" + resolved[2:] if resolved.startswith("\\\\") else "\\\\?\\" + resolved)
        scene_dir = root/".runtime/tts-scenes"
        scene_dir.mkdir(parents=True, exist_ok=True)
        production = {"video": {"fps": 30}, "scenes": []}
        hashes = {}
        for unit in manifest["units"]:
            target = scene_dir/(unit["id"]+".wav")
            if not target.exists() or file_sha256(target) != unit["wav_sha256"]:
                shutil.copyfile(unit["audio"], target)
            hashes[unit["id"]] = unit["wav_sha256"]
            production["scenes"].append({"id": unit["id"], "voice": unit["tts_text"]})
        artifact = VoiceArtifact(Path(manifest["assembly"]), "speech-units", manifest["assembly_sha256"], hashes, False)
        timing = _align_cached_scenes(root, production, artifact, {
            "model": os.environ.get("ZODIAC_STUDIO_ALIGN_MODEL", "small"), "device": "cpu", "compute_type": "int8",
            "cpu_threads": 2, "num_workers": 1, "scene_gap_ms": 0, "auto_regenerate_alignment_failures": False,
        }, "voice-lab-measured@1", word_source=BatchedWordSource(manifest["units"]))
        offset, result = 0.0, {}
        for row in timing["scenes"]:
            result[row["scene_id"]] = relative_words(row["captions"], offset)
            offset += _wav_seconds(scene_dir/(row["scene_id"]+".wav"))*1000
        Path(sys.argv[3]).write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf8")
        return
    audio, text, output = map(Path, sys.argv[1:])
    model = load_word_aligner(os.environ.get("ZODIAC_STUDIO_ALIGN_MODEL", "small"), "cpu", "int8", cpu_threads=2)
    words = _align_scene_words(model, audio, text.read_text(encoding="utf8"))
    output.write_text(json.dumps(words, ensure_ascii=False, allow_nan=False), encoding="utf8")


if __name__ == "__main__":
    main()
