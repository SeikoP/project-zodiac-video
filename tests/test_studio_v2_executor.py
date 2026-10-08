import copy
import json
import shutil
import tempfile
import unittest
import wave
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.studio_v2.controller import StudioV2Controller
from tools.studio_v2.executor import ExecutorConfig, StudioV2Executor
from tools.studio_v2.pipeline import (
    AUDIO,
    DONE,
    OUTPUT,
    PACKAGE,
    PLAN,
    RENDER,
    TIMING,
    VOICE,
)
from tools.studio_v2.state import load_state
from tools.studio_v2.timing import ensure_timing_artifact
from tools.studio_v2.voice import ensure_voice_artifact

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "control-plane-v2" / "minimal"


def write_pcm(path: Path, *, frames: int = 800) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * frames)


def make_source(root: Path) -> Path:
    source = root / "source"
    shutil.copytree(FIXTURE, source)
    timing = source / "timing.json"
    if timing.exists():
        timing.unlink()
    (source / "narration.txt").write_text("xin chao\n", encoding="utf-8")
    manifest = {
        "format": "zodiac-job@5",
        "job": {"id": "scorpio-two-versions", "revision": "1.0.0"},
        "contract": {
            "id": "zodiac-authoring-ir",
            "version": "1.0.0",
            "sha256": canonical_contract_hash("authoring-ir-v1"),
        },
        "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
        "producer": {"plugin": "test-fixture", "version": "2.0.0"},
    }
    (source / "package-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    return source


class StageCounters:
    def __init__(self):
        self.voice = 0
        self.timing = 0
        self.render = 0
        self.audio = 0
        self.output = 0

    def voice_generator(self, workspace, production, scene_ids, voice_profile, settings):
        self.voice += 1
        for scene_id in scene_ids:
            write_pcm(Path(workspace) / ".runtime" / "tts-scenes" / f"{scene_id}.wav")
        return {scene_id: 0.1 for scene_id in scene_ids}

    def aligner(self, workspace, production, voice, settings):
        self.timing += 1
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

    def render_handler(self, workspace, props_path, output_path):
        self.render += 1
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"rendered-" + props_path.read_bytes()[:32])
        return output_path

    def audio_handler(self, workspace, rendered_path, music_path, mix_settings, output_path):
        self.audio += 1
        output_path.parent.mkdir(parents=True, exist_ok=True)
        music = music_path.read_bytes() if music_path is not None else b""
        output_path.write_bytes(rendered_path.read_bytes() + b"-audio-" + music)
        return output_path

    def output_handler(self, workspace, final_path, output_path):
        self.output += 1
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final_path, output_path)
        return output_path


class StudioV2ExecutorTests(unittest.TestCase):
    def _executor(self, root: Path, counters: StageCounters):
        controller = StudioV2Controller(root / "workspace")
        voice_service = lambda workspace, ir, **kwargs: ensure_voice_artifact(
            workspace,
            ir,
            generator=counters.voice_generator,
            **kwargs,
        )
        timing_service = lambda workspace, ir, voice, **kwargs: ensure_timing_artifact(
            workspace,
            ir,
            voice,
            aligner=counters.aligner,
            **kwargs,
        )
        executor = StudioV2Executor(
            controller,
            voice_service=voice_service,
            timing_service=timing_service,
            render_handler=counters.render_handler,
            audio_handler=counters.audio_handler,
            output_handler=counters.output_handler,
        )
        return controller, executor

    def _config(self, root: Path, *, renderer_hash="renderer-a", music_bytes=b"music-a"):
        music = root / "music.mp3"
        music.write_bytes(music_bytes)
        return ExecutorConfig(
            voice_profile="Hai Dang",
            tts_settings={"mode": "v3turbo", "scene_gap_ms": 0},
            tts_engine_version="tts-test-1",
            aligner_settings={"model": "small", "scene_gap_ms": 0},
            aligner_version="align-test-1",
            compiler_version="1.0.0",
            renderer_version="2.0.0",
            renderer_hash=renderer_hash,
            music_path=music,
            mix_settings={"volume": 0.2},
        )

    def test_clean_run_marks_all_stages_done_and_persists_state(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            controller.import_package(make_source(root))
            state = executor.run(self._config(root))
            for step in (PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
                self.assertEqual(state.steps[step].status, DONE, step)
            self.assertEqual((counters.voice, counters.timing, counters.render, counters.audio, counters.output), (1, 1, 1, 1, 1))
            reloaded = load_state(controller.workspace)
            self.assertIsNotNone(reloaded)
            self.assertEqual(reloaded.steps[OUTPUT].status, DONE)

    def test_identical_second_run_reuses_every_expensive_stage(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            controller.import_package(make_source(root))
            config = self._config(root)
            executor.run(config)
            state = executor.run(config)
            self.assertEqual((counters.voice, counters.timing, counters.render, counters.audio, counters.output), (1, 1, 1, 1, 1))
            for step in (VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
                self.assertTrue(state.steps[step].reused, step)

    def test_visual_only_patch_reuses_voice_timing_and_rebuilds_downstream(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            source = make_source(root)
            config = self._config(root)
            controller.import_package(source)
            executor.run(config)

            ir_path = source / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            ir["assets"]["decor.extra"] = {"path": "assets/char-scorpio.svg"}
            ir_path.write_text(json.dumps(ir, indent=2) + "\n", encoding="utf-8")
            controller.import_package(source)
            state = executor.run(config)

            self.assertEqual(counters.voice, 1)
            self.assertEqual(counters.timing, 1)
            self.assertEqual(counters.render, 2)
            self.assertEqual(counters.audio, 2)
            self.assertEqual(counters.output, 2)
            self.assertTrue(state.steps[VOICE].reused)
            self.assertTrue(state.steps[TIMING].reused)
            self.assertFalse(state.steps[PLAN].reused)

    def test_renderer_only_patch_reuses_through_plan(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            controller.import_package(make_source(root))
            executor.run(self._config(root, renderer_hash="renderer-a"))
            state = executor.run(self._config(root, renderer_hash="renderer-b"))
            self.assertEqual(counters.voice, 1)
            self.assertEqual(counters.timing, 1)
            self.assertEqual(counters.render, 2)
            self.assertTrue(state.steps[PLAN].reused)
            self.assertFalse(state.steps[RENDER].reused)

    def test_music_only_patch_reuses_through_render(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            controller.import_package(make_source(root))
            executor.run(self._config(root, music_bytes=b"music-a"))
            state = executor.run(self._config(root, music_bytes=b"music-b"))
            self.assertEqual(counters.voice, 1)
            self.assertEqual(counters.timing, 1)
            self.assertEqual(counters.render, 1)
            self.assertEqual(counters.audio, 2)
            self.assertEqual(counters.output, 2)
            self.assertTrue(state.steps[RENDER].reused)
            self.assertFalse(state.steps[AUDIO].reused)


if __name__ == "__main__":
    unittest.main()
