"""Pure helpers around the voice lab: timing recomposition and a content-addressed bank of synthesised takes.

TTS is not deterministic, so re-synthesising identical text yields different audio and therefore a new listening
approval. The bank keeps every take under (text, voice profile, generation profile); the same key returns the same
bytes. A bank hit supplies audio only: it never carries a listening proof from anywhere.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path


def recompose_timing(units: list[dict], unit_words: dict) -> list[dict] | None:
    """Whole-episode words from cached per-unit words (local times), or None when any unit has no valid cache.

    units: [{id, gap_after_ms, duration_ms, sample_rate, wav_sha256}] in episode order.
    unit_words: {unit_id: {wav_sha256, words:[{startMs, endMs, ...local}]}}.
    """
    words, offset = [], 0.0
    for index, unit in enumerate(units):
        cached = unit_words.get(unit["id"])
        if not cached or cached.get("wav_sha256") != unit["wav_sha256"]:
            return None
        for word in cached["words"]:
            words.append({**word, "startMs": round(word["startMs"] + offset, 6), "endMs": round(word["endMs"] + offset, 6)})
        offset += unit["duration_ms"]
        if index < len(units) - 1 and unit["gap_after_ms"]:
            rate = unit["sample_rate"]
            offset += round(rate * unit["gap_after_ms"] / 1000) / rate * 1000
    return words


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


class VoiceBank:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def _key(self, text_hash: str, voice_profile_hash: str, generation_profile_hash: str) -> str:
        return hashlib.sha256("|".join((text_hash, voice_profile_hash, generation_profile_hash)).encode()).hexdigest()

    def remember(self, text_hash: str, voice_profile_hash: str, generation_profile_hash: str, wav: Path) -> Path:
        key = self._key(text_hash, voice_profile_hash, generation_profile_hash)
        self.root.mkdir(parents=True, exist_ok=True)
        target, index = self.root / f"{key}.wav", self.root / f"{key}.json"
        if index.exists() and target.exists():
            return target  # first take for a key wins; never overwritten in place
        temp = target.with_suffix(".tmp")
        shutil.copyfile(wav, temp)
        os.replace(temp, target)
        index.write_text(json.dumps({"wav_sha256": _sha(target)}), encoding="utf8")
        return target

    def lookup(self, text_hash: str, voice_profile_hash: str, generation_profile_hash: str) -> Path | None:
        key = self._key(text_hash, voice_profile_hash, generation_profile_hash)
        target, index = self.root / f"{key}.wav", self.root / f"{key}.json"
        try:
            if json.loads(index.read_text(encoding="utf8"))["wav_sha256"] == _sha(target):
                return target
        except (OSError, ValueError, KeyError):
            pass
        return None
