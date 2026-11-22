"""Cancellable measured-ASR worker using the existing exact-word aligner."""
import json
import os
from pathlib import Path
import shutil
import sys

from tools.zodiac_local import load_word_aligner, _align_scene_words
from tools.studio.artifacts import file_sha256
from tools.studio_v2.voice import VoiceArtifact
from tools.studio_v2.timing import _align_cached_scenes, _wav_seconds


def relative_words(words, offset):
    # Global-to-local subtraction can produce -3.6e-12 ms for a true zero.
    # Round only arithmetic noise, far below a WAV sample; validation must still
    # reject actual negative, reversed or out-of-audio measurements.
    return [{**word, "startMs": round(word["startMs"] - offset, 6),
             "endMs": round(word["endMs"] - offset, 6)} for word in words]


def main():
    if sys.argv[1] == "batch":
        manifest = json.loads(Path(sys.argv[2]).read_text(encoding="utf8"))
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
        }, "voice-lab-measured@1")
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
