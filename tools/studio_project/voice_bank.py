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
import time
import uuid
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


def remember_quietly(bank: "VoiceBank", text_hash: str, voice_profile_hash: str, generation_profile_hash: str, wav: Path) -> bool:
    """Banking is an optimisation: a full disk or a locked file must never fail the voice job that produced the take."""
    try:
        bank.remember(text_hash, voice_profile_hash, generation_profile_hash, wav)
        return True
    except OSError:
        return False


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
        temp = target.with_name(f"{key}.{uuid.uuid4().hex}.tmp")  # unique per call: concurrent writers never share a temp file
        shutil.copyfile(wav, temp)
        index_temp = index.with_name(f"{key}.{uuid.uuid4().hex}.tmp")
        try:
            index_temp.write_text(json.dumps({"wav_sha256": _sha(temp)}), encoding="utf8")
            for attempt in range(20):
                try:
                    os.replace(temp, target)
                    os.replace(index_temp, index)
                    return target
                except PermissionError:  # Windows: another writer holds the file right now
                    if index.exists() and target.exists() and self.lookup(text_hash, voice_profile_hash, generation_profile_hash):
                        return target  # it won the race with identical content; nothing left to do
                    time.sleep(0.01 * (attempt + 1))
            raise OSError("voice bank is busy")
        finally:
            temp.unlink(missing_ok=True)
            index_temp.unlink(missing_ok=True)

    def lookup(self, text_hash: str, voice_profile_hash: str, generation_profile_hash: str) -> Path | None:
        key = self._key(text_hash, voice_profile_hash, generation_profile_hash)
        target, index = self.root / f"{key}.wav", self.root / f"{key}.json"
        try:
            if json.loads(index.read_text(encoding="utf8"))["wav_sha256"] == _sha(target):
                return target
        except (OSError, ValueError, KeyError):
            pass
        return None
