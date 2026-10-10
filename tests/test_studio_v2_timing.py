import copy
import json
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.timing import ensure_timing_artifact
from tools.studio_v2.voice import VoiceArtifact


def ir_document():
    return {
        "format": "zodiac-authoring-ir@1",
        "fps": 24,
        "video": {"width": 1080, "height": 1920},
        "assets": {},
        "scenes": [
            {"id": "S01", "voice": "xin chao", "duration_hint_frames": 48, "entities": [], "events": []},
        ],
    }


def write_pcm(path: Path, *, frames: int = 800) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * frames)


def voice_artifact(root: Path) -> VoiceArtifact:
    voice = root / "voice.wav"
    scene = root / ".runtime" / "tts-scenes" / "S01.wav"
    write_pcm(voice)
    write_pcm(scene)
    import hashlib
    output_hash = hashlib.sha256(voice.read_bytes()).hexdigest()
    scene_hash = hashlib.sha256(scene.read_bytes()).hexdigest()
    return VoiceArtifact(
        path=voice,
        input_key="voice-key",
        output_hash=output_hash,
        scene_hashes={"S01": scene_hash},
        reused=False,
    )


class FakeAligner:
    def __init__(self):
        self.calls = 0

    def __call__(self, workspace, production, voice, settings):
        self.calls += 1
        return {
            "fps": 24,
            "total_duration_frames": 24,
            "scenes": [
                {
                    "scene_id": "S01",
                    "start_frame": 0,
                    "duration_frames": 24,
                    "captions": [
                        {"text": "xin", "startMs": 0, "endMs": 400, "timestampMs": 0},
                        {"text": "chao", "startMs": 400, "endMs": 800, "timestampMs": 400},
                    ],
                }
            ],
        }


class StudioV2TimingTests(unittest.TestCase):
    def test_medium_retry_model_loads_once_per_run_for_multiple_scenes(self):
        from tools.studio_v2.timing import _align_cached_scenes
        from tools.zodiac_local import AlignmentMismatchError
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            voice = voice_artifact(root)
            paths = [root / ".runtime" / "tts-scenes" / f"{scene_id}.wav" for scene_id in ("S01", "S02")]
            write_pcm(paths[1])
            production = {"scenes": [{"id": scene_id, "voice": "xin chao"} for scene_id in ("S01", "S02")]}
            primary, medium = object(), object()
            def load(name, *args, **kwargs):
                return primary if name == "small" else medium
            def align(model, *args):
                if model is primary:
                    raise AlignmentMismatchError("primary mismatch")
                return [{"word": "xin", "start": 0.0, "end": 0.05}]
            with patch("tools.studio_v2.timing.scene_voice_files", return_value=paths), \
                 patch("tools.studio_v2.timing.require_word_aligner_installed"), \
                 patch("tools.studio_v2.timing.load_word_aligner", side_effect=load) as loaded, \
                 patch("tools.studio_v2.timing._align_scene_words", side_effect=align), \
                 patch("tools.studio_v2.timing.build_timing_from_word_alignment", return_value={}), \
                 patch("tools.zodiac_local._emit_tts_log"):
                for _ in range(2):
                    _align_cached_scenes(root, production, voice, {"model": "small"}, "test", force=True)
                self.assertEqual([call.args[0] for call in loaded.call_args_list], ["small", "medium", "small", "medium"])

    def _root(self, temp):
        root = Path(temp)
        (root / "narration.txt").write_text("xin chao\n", encoding="utf-8")
        return root

    def test_generates_and_normalizes_canonical_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            aligner = FakeAligner()
            artifact = ensure_timing_artifact(
                root,
                ir_document(),
                voice,
                aligner_settings={"model": "small", "scene_gap_ms": 0},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            self.assertFalse(artifact.reused)
            self.assertEqual(aligner.calls, 1)
            timing = json.loads(artifact.path.read_text(encoding="utf-8"))
            self.assertEqual(timing["format"], "zodiac-timing@1")
            self.assertEqual(timing["scenes"][0]["id"], "S01")
            self.assertNotIn("scene_id", timing["scenes"][0])

    def test_identical_dependencies_reuse_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            aligner = FakeAligner()
            first = ensure_timing_artifact(
                root,
                ir_document(),
                voice,
                aligner_settings={"model": "small", "scene_gap_ms": 0},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            second = ensure_timing_artifact(
                root,
                ir_document(),
                voice,
                aligner_settings={"scene_gap_ms": 0, "model": "small"},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            self.assertFalse(first.reused)
            self.assertTrue(second.reused)
            self.assertEqual(aligner.calls, 1)
            self.assertEqual(first.output_hash, second.output_hash)

    def test_visual_only_ir_change_reuses_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            aligner = FakeAligner()
            base = ir_document()
            ensure_timing_artifact(
                root,
                base,
                voice,
                aligner_settings={"model": "small"},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            changed = copy.deepcopy(base)
            changed["assets"]["new"] = {"path": "assets/new.svg"}
            second = ensure_timing_artifact(
                root,
                changed,
                voice,
                aligner_settings={"model": "small"},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            self.assertTrue(second.reused)
            self.assertEqual(aligner.calls, 1)

    def test_aligner_setting_change_invalidates_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            aligner = FakeAligner()
            ensure_timing_artifact(
                root,
                ir_document(),
                voice,
                aligner_settings={"model": "small"},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            second = ensure_timing_artifact(
                root,
                ir_document(),
                voice,
                aligner_settings={"model": "medium"},
                aligner_version="faster-whisper-test-1",
                aligner=aligner,
            )
            self.assertFalse(second.reused)
            self.assertEqual(aligner.calls, 2)

    def test_timing_stage_never_mutates_voice_wav(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            before = voice.path.read_bytes()
            ensure_timing_artifact(
                root,
                ir_document(),
                voice,
                aligner_settings={"model": "small"},
                aligner_version="faster-whisper-test-1",
                aligner=FakeAligner(),
            )
            self.assertEqual(voice.path.read_bytes(), before)

    def test_nonzero_sentence_pause_is_rejected_in_v2_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            with self.assertRaises(ControlPlaneError) as caught:
                ensure_timing_artifact(
                    root,
                    ir_document(),
                    voice,
                    aligner_settings={"model": "small", "sentence_pause_ms": 320},
                    aligner_version="faster-whisper-test-1",
                    aligner=FakeAligner(),
                )
            self.assertEqual(caught.exception.code, "TIMING_CONFIG_INVALID")

    def test_aligner_failure_is_structured(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self._root(temp)
            voice = voice_artifact(root)
            def fail(*args, **kwargs):
                raise RuntimeError("align exploded")
            with self.assertRaises(ControlPlaneError) as caught:
                ensure_timing_artifact(
                    root,
                    ir_document(),
                    voice,
                    aligner_settings={"model": "small"},
                    aligner_version="faster-whisper-test-1",
                    aligner=fail,
                )
            self.assertEqual(caught.exception.stage, "TIMING")
            self.assertEqual(caught.exception.code, "TIMING_ALIGNMENT_FAILED")


if __name__ == "__main__":
    unittest.main()
