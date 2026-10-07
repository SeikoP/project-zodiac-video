"""Job-local artifact primitives for single-job incremental performance."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path


class CacheReason(StrEnum):
    REUSED_APPROVED = "REUSED_APPROVED"
    REUSED_CANDIDATE = "REUSED_CANDIDATE"
    PARTIAL_REUSE = "PARTIAL_REUSE"
    DIRTY_TEXT = "DIRTY_TEXT"
    DIRTY_VOICE_PROFILE = "DIRTY_VOICE_PROFILE"
    DIRTY_PERFORMANCE_CONTEXT = "DIRTY_PERFORMANCE_CONTEXT"
    DIRTY_GENERATION_PROFILE = "DIRTY_GENERATION_PROFILE"
    FORCE_REGENERATE = "FORCE_REGENERATE"
    PROFILE_DRIFT = "PROFILE_DRIFT"
    NO_ARTIFACT = "NO_ARTIFACT"
    GENERATED_NEW = "GENERATED_NEW"
    UNKNOWN = "UNKNOWN"


class VoiceTakeStatus(StrEnum):
    GENERATED = "GENERATED"
    TECH_VALID = "TECH_VALID"
    APPROVED = "APPROVED"
    SUPERSEDED = "SUPERSEDED"


def canonical_hash(value) -> str:
    raw = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class VoiceIdentity:
    text_hash: str
    voice_profile_hash: str
    generation_profile_hash: str
    performance_context_hash: str | None = None


class VoiceArtifactStore:
    """Immutable, job-local voice take storage.

    The existing .runtime/tts-scenes/*.wav files remain compatibility working
    copies. Approved takes live under .runtime/artifacts/voice and can restore a
    missing/corrupted working copy without calling TTS again.
    """

    VERSION = 1

    def __init__(self, package_root: Path) -> None:
        self.root = Path(package_root).resolve()
        self.base = self.root / ".runtime" / "artifacts" / "voice"

    @staticmethod
    def _atomic_write(path: Path, payload: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.name + f".{os.getpid()}.tmp")
        temp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temp, path)

    def _scene_dir(self, scene_id: str) -> Path:
        return self.base / scene_id

    def _index_path(self, scene_id: str) -> Path:
        return self._scene_dir(scene_id) / "index.json"

    def _load(self, scene_id: str) -> dict:
        path = self._index_path(scene_id)
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            payload = {}
        if (
            not isinstance(payload, dict)
            or payload.get("version") != self.VERSION
            or payload.get("scene_id") != scene_id
            or not isinstance(payload.get("takes"), list)
        ):
            return {
                "version": self.VERSION,
                "scene_id": scene_id,
                "active_take": None,
                "takes": [],
            }
        return payload

    def active_take(self, scene_id: str) -> dict | None:
        payload = self._load(scene_id)
        active_id = payload.get("active_take")
        if not active_id:
            return None
        return next(
            (
                dict(item)
                for item in payload["takes"]
                if isinstance(item, dict) and item.get("take_id") == active_id
            ),
            None,
        )

    def register_approved(
        self,
        scene_id: str,
        source_wav: Path,
        *,
        identity: VoiceIdentity,
        approval_source: str,
        migrated_from_checkpoint: bool = False,
    ) -> dict:
        source_wav = Path(source_wav).resolve()
        wav_hash = file_sha256(source_wav)
        take_id = canonical_hash(
            {
                "wav_sha256": wav_hash,
                "text_hash": identity.text_hash,
                "voice_profile_hash": identity.voice_profile_hash,
                "generation_profile_hash": identity.generation_profile_hash,
                "performance_context_hash": identity.performance_context_hash,
            }
        )[:20]

        scene_dir = self._scene_dir(scene_id)
        takes_dir = scene_dir / "takes"
        takes_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = takes_dir / f"{take_id}.wav"

        if artifact_path.exists():
            if file_sha256(artifact_path) != wav_hash:
                raise RuntimeError(
                    f"Voice artifact collision for {scene_id}/{take_id}; refusing overwrite."
                )
        else:
            temp = artifact_path.with_suffix(".tmp.wav")
            shutil.copy2(source_wav, temp)
            os.replace(temp, artifact_path)

        payload = self._load(scene_id)
        takes = [item for item in payload["takes"] if isinstance(item, dict)]
        existing = next((item for item in takes if item.get("take_id") == take_id), None)

        for item in takes:
            if item.get("status") == VoiceTakeStatus.APPROVED and item.get("take_id") != take_id:
                item["status"] = VoiceTakeStatus.SUPERSEDED

        record = {
            "take_id": take_id,
            "status": VoiceTakeStatus.APPROVED,
            "path": artifact_path.relative_to(self.root).as_posix(),
            "wav_sha256": wav_hash,
            "text_hash": identity.text_hash,
            "voice_profile_hash": identity.voice_profile_hash,
            "generation_profile_hash": identity.generation_profile_hash,
            "performance_context_hash": identity.performance_context_hash,
            "approval_source": approval_source,
            "migrated_from_checkpoint": bool(migrated_from_checkpoint),
            "created_at": (
                existing.get("created_at")
                if existing
                else datetime.now(timezone.utc).isoformat()
            ),
        }
        if existing:
            existing.clear()
            existing.update(record)
        else:
            takes.append(record)

        payload["takes"] = takes
        payload["active_take"] = take_id
        self._atomic_write(self._index_path(scene_id), payload)
        return dict(record)

    def restore_approved(
        self,
        scene_id: str,
        target_wav: Path,
        *,
        text_hash: str,
        voice_profile_hash: str,
        performance_context_hash: str | None = None,
    ) -> dict | None:
        record = self.active_take(scene_id)
        if not record or record.get("status") != VoiceTakeStatus.APPROVED:
            return None
        if record.get("text_hash") != text_hash:
            return None
        if record.get("voice_profile_hash") != voice_profile_hash:
            return None
        if record.get("performance_context_hash") != performance_context_hash:
            return None

        artifact = (self.root / str(record.get("path") or "")).resolve()
        if not artifact.is_file() or not artifact.is_relative_to(self.root):
            return None
        expected_hash = record.get("wav_sha256")
        if not expected_hash or file_sha256(artifact) != expected_hash:
            return None

        target = Path(target_wav)
        if target.is_file():
            try:
                if file_sha256(target) == expected_hash:
                    return record
            except OSError:
                pass
        target.parent.mkdir(parents=True, exist_ok=True)
        temp = target.with_suffix(".restore.tmp.wav")
        shutil.copy2(artifact, temp)
        os.replace(temp, target)
        return record
