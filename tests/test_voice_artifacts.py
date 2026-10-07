"""Regression coverage for job-local approved voice artifacts."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from test_studio_pipeline import WorkerHarness, write_scene_wav
from tools.studio.artifacts import VoiceArtifactStore, VoiceIdentity, VoiceTakeStatus
from tools.studio.job_state import JobStateStore
from tools.studio.pipeline import PENDING, VOICE_SCENES
from tools.studio.voice_catalog import voice_profile_hash


class VoiceProfileHashTests(unittest.TestCase):
    def test_reference_audio_content_changes_profile_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            ref = root / "reference.wav"
            ref.write_bytes(b"voice-a")
            catalog = root / "voices.json"
            catalog.write_text(
                json.dumps(
                    {
                        "presets": {
                            "demo": {
                                "reference_audio": "reference.wav",
                                "speaker": "demo",
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            before = voice_profile_hash("demo", catalog)
            ref.write_bytes(b"voice-b")
            after = voice_profile_hash("demo", catalog)
        self.assertNotEqual(before, after)


class VoiceArtifactStoreTests(unittest.TestCase):
    def test_new_take_never_overwrites_previous_wav(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first = root / "first.wav"
            second = root / "second.wav"
            write_scene_wav(first, 0.4)
            write_scene_wav(second, 0.7)
            store = VoiceArtifactStore(root)
            identity = VoiceIdentity(
                text_hash="t" * 64,
                voice_profile_hash="v" * 64,
                generation_profile_hash="g" * 64,
            )

            take1 = store.register_approved(
                "S01",
                first,
                identity=identity,
                approval_source="test",
            )
            first_artifact = root / take1["path"]
            original = first_artifact.read_bytes()

            take2 = store.register_approved(
                "S01",
                second,
                identity=identity,
                approval_source="test",
            )

            self.assertNotEqual(take1["take_id"], take2["take_id"])
            self.assertEqual(first_artifact.read_bytes(), original)
            index = json.loads(
                (root / ".runtime" / "artifacts" / "voice" / "S01" / "index.json").read_text(
                    encoding="utf-8"
                )
            )
            old = next(item for item in index["takes"] if item["take_id"] == take1["take_id"])
            self.assertEqual(old["status"], VoiceTakeStatus.SUPERSEDED)
            self.assertEqual(index["active_take"], take2["take_id"])


class VoiceArtifactWorkerTests(WorkerHarness):
    def test_worker_records_approved_reuse_in_performance_telemetry(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.mark(VOICE_SCENES, PENDING)
        JobStateStore(self.job).save(plan)
        self.tts_calls.clear()

        worker = self.make_worker(plan=JobStateStore(self.job).open())
        worker.run_from(VOICE_SCENES, stop_after=VOICE_SCENES)

        self.assertEqual(self.tts_calls, [])
        performance = json.loads(
            (self.job / ".runtime" / "performance.json").read_text(encoding="utf-8")
        )
        record = [row for row in performance["records"] if row["step"] == VOICE_SCENES][-1]
        self.assertTrue(record["cache_hit"])
        self.assertEqual(record["cache_reason"], "REUSED_APPROVED")

    def test_partial_voice_resume_records_partial_reuse(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.set_scene_state(VOICE_SCENES, "S03", PENDING)
        plan.mark(VOICE_SCENES, PENDING)
        JobStateStore(self.job).save(plan)
        self.tts_calls.clear()

        worker = self.make_worker(plan=JobStateStore(self.job).open())
        worker.run_from(VOICE_SCENES, stop_after=VOICE_SCENES)

        self.assertEqual(self.tts_calls, [["S03"]])
        performance = json.loads(
            (self.job / ".runtime" / "performance.json").read_text(encoding="utf-8")
        )
        record = [row for row in performance["records"] if row["step"] == VOICE_SCENES][-1]
        self.assertFalse(record["cache_hit"])
        self.assertEqual(record["cache_reason"], "PARTIAL_REUSE")


if __name__ == "__main__":
    unittest.main()
