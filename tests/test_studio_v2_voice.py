import json
import tempfile
import unittest
import wave
from pathlib import Path

from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.voice import ensure_voice_artifact


def ir_document():
    return {
        "format": "zodiac-authoring-ir@1",
        "fps": 24,
        "video": {"width": 1080, "height": 1920},
        "assets": {},
        "scenes": [
            {"id": "S01", "voice": "xin chao", "duration_hint_frames": 48, "entities": [], "events": []},
            {"id": "S02", "voice": "bo cap", "duration_hint_frames": 48, "entities": [], "events": []},
        ],
    }


def write_pcm(path: Path, *, frames: int = 800) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * frames)


class FakeGenerator:
    def __init__(self):
        self.calls = 0

    def __call__(self, workspace, production, scene_ids, voice_profile, settings):
        self.calls += 1
        for scene_id in scene_ids:
            write_pcm(Path(workspace) / ".runtime" / "tts-scenes" / f"{scene_id}.wav")
        return {scene_id: 0.1 for scene_id in scene_ids}


class FailingGenerator:
    def __call__(self, workspace, production, scene_ids, voice_profile, settings):
        raise RuntimeError("tts exploded")


class StudioV2VoiceTests(unittest.TestCase):
    def test_generates_voice_and_records_dependency_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "narration.txt").write_text("xin chao\nbo cap\n", encoding="utf-8")
            fake = FakeGenerator()
            artifact = ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo", "scene_gap_ms": 0},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            self.assertFalse(artifact.reused)
            self.assertEqual(fake.calls, 1)
            self.assertTrue(artifact.path.is_file())
            self.assertRegex(artifact.output_hash, r"^[0-9a-f]{64}$")
            self.assertEqual(set(artifact.scene_hashes), {"S01", "S02"})
            meta = json.loads((root / ".runtime" / "voice-v2.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["input_key"], artifact.input_key)
            self.assertEqual(meta["output_hash"], artifact.output_hash)

    def test_identical_dependencies_reuse_voice_without_generator(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "narration.txt").write_text("xin chao\nbo cap\n", encoding="utf-8")
            fake = FakeGenerator()
            first = ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo", "scene_gap_ms": 0},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            second = ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"scene_gap_ms": 0, "mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            self.assertFalse(first.reused)
            self.assertTrue(second.reused)
            self.assertEqual(fake.calls, 1)
            self.assertEqual(first.output_hash, second.output_hash)

    def test_visual_only_ir_change_still_reuses_voice(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "narration.txt").write_text("xin chao\nbo cap\n", encoding="utf-8")
            fake = FakeGenerator()
            document = ir_document()
            ensure_voice_artifact(
                root,
                document,
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            document["assets"]["new.visual"] = {"path": "assets/new.svg"}
            reused = ensure_voice_artifact(
                root,
                document,
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            self.assertTrue(reused.reused)
            self.assertEqual(fake.calls, 1)

    def test_narration_change_invalidates_voice(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            narration = root / "narration.txt"
            narration.write_text("xin chao\nbo cap\n", encoding="utf-8")
            fake = FakeGenerator()
            ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            narration.write_text("xin chao\nbo cap thay doi\n", encoding="utf-8")
            regenerated = ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            self.assertFalse(regenerated.reused)
            self.assertEqual(fake.calls, 2)

    def test_corrupt_cached_voice_is_not_reused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "narration.txt").write_text("xin chao\nbo cap\n", encoding="utf-8")
            fake = FakeGenerator()
            first = ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            first.path.write_bytes(b"broken")
            second = ensure_voice_artifact(
                root,
                ir_document(),
                voice_profile="Hai Dang",
                tts_settings={"mode": "v3turbo"},
                engine_version="vieneu-test-1",
                generator=fake,
            )
            self.assertFalse(second.reused)
            self.assertEqual(fake.calls, 2)

    def test_generator_failure_is_structured_voice_error(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "narration.txt").write_text("xin chao\nbo cap\n", encoding="utf-8")
            with self.assertRaises(ControlPlaneError) as caught:
                ensure_voice_artifact(
                    root,
                    ir_document(),
                    voice_profile="Hai Dang",
                    tts_settings={"mode": "v3turbo"},
                    engine_version="vieneu-test-1",
                    generator=FailingGenerator(),
                )
            self.assertEqual(caught.exception.stage, "VOICE")
            self.assertEqual(caught.exception.code, "VOICE_GENERATION_FAILED")


if __name__ == "__main__":
    unittest.main()
