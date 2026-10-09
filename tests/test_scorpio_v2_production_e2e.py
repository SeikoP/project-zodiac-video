import copy
import json
import shutil
import tempfile
import unittest
from unittest.mock import patch
import wave
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.render_plan import target_overlap_count
from tools.studio_v2.controller import StudioV2Controller
from tools.studio_v2.executor import ExecutorConfig, StudioV2Executor
from tools.studio_v2.pipeline import AUDIO, OUTPUT, PLAN, RENDER, TIMING, VOICE
from tools.studio_v2.timing import ensure_timing_artifact
from tools.studio_v2.voice import ensure_voice_artifact

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = ROOT / "tests" / "fixtures" / "scorpio-two-versions"
PACKAGE = FIXTURE_ROOT / "package"
TIMING_FIXTURE = json.loads((FIXTURE_ROOT / "timing.json").read_text(encoding="utf-8"))


def write_pcm(path: Path, *, frames: int = 800) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * frames)


class ScorpioCounters:
    def __init__(self):
        self.voice = 0
        self.timing = 0
        self.render = 0
        self.audio = 0
        self.output = 0
        self.render_overlap_counts = []
        self.e22_ranges = []

    def voice_generator(self, workspace, production, scene_ids, voice_profile, settings):
        self.voice += 1
        for scene_id in scene_ids:
            write_pcm(Path(workspace) / ".runtime" / "tts-scenes" / f"{scene_id}.wav")
        return {scene_id: 0.1 for scene_id in scene_ids}

    def aligner(self, workspace, production, voice, settings):
        self.timing += 1
        return copy.deepcopy(TIMING_FIXTURE)

    def render_handler(self, workspace, props_path, output_path):
        self.render += 1
        plan = json.loads((Path(workspace) / ".runtime" / "render-plan.json").read_text(encoding="utf-8"))
        overlap = target_overlap_count(plan)
        self.render_overlap_counts.append(overlap)
        if overlap:
            raise AssertionError(f"renderer received same-target overlap count={overlap}")
        events = {
            event["event_id"]: event
            for scene in plan["scenes"]
            for event in scene["events"]
        }
        self.e22_ranges.append((events["E22"]["start_frame"], events["E22"]["end_frame"]))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"scorpio-render-" + props_path.read_bytes()[:48])
        return output_path

    def audio_handler(self, workspace, rendered_path, music_path, mix_settings, output_path):
        self.audio += 1
        music = music_path.read_bytes() if music_path is not None else b""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(rendered_path.read_bytes() + b"-voice-music-" + music)
        return output_path

    def output_handler(self, workspace, final_path, output_path):
        self.output += 1
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final_path, output_path)
        return output_path


class ScorpioProductionE2ETests(unittest.TestCase):
    # Fake MP4 fixture deliberately lacks decodable media. Segmented preflight
    # falls back to one full render; test cache invalidation, not segment count.
    def setUp(self):
        which = shutil.which
        executable = patch("tools.studio_v2.executor.shutil.which", side_effect=lambda name:
                           None if name in {"ffmpeg", "ffprobe", "ffprobe.exe"} else which(name))
        executable.start()
        self.addCleanup(executable.stop)

    def make_source(self, root: Path) -> Path:
        source = root / "source"
        shutil.copytree(PACKAGE, source)
        manifest = json.loads((source / "package-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["format"], "zodiac-job@5")
        self.assertEqual(manifest["job"]["id"], "bocap-hai-phien-ban")
        self.assertIn(manifest["contract"]["sha256"], {canonical_contract_hash("authoring-ir-v1"), "5728656019306975d7b3c4feabad9a02fa02cda2a22b38a27eff4563f3c77f95"})
        self.assertEqual(manifest["renderer"], {"id": "zodiac-renderer", "version": "2.0.0"})
        self.assertEqual(manifest["producer"], {"plugin": "zodiac-video-pipeline", "version": "2.0.0"})
        return source

    def make_executor(self, root: Path, counters: ScorpioCounters):
        controller = StudioV2Controller(root / "workspace")
        voice_service = lambda workspace, ir, **kwargs: ensure_voice_artifact(
            workspace, ir, generator=counters.voice_generator, **kwargs
        )
        timing_service = lambda workspace, ir, voice, **kwargs: ensure_timing_artifact(
            workspace, ir, voice, aligner=counters.aligner, **kwargs
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

    def config(self, root: Path, *, renderer_hash="renderer-a", music_bytes=b"music-a"):
        music = root / "music.mp3"
        music.write_bytes(music_bytes)
        return ExecutorConfig(
            voice_profile="Hai Dang",
            tts_settings={"mode": "v3turbo", "scene_gap_ms": 0},
            tts_engine_version="tts-scorpio-fixture-1",
            aligner_settings={"model": "fixture", "scene_gap_ms": 0, "sentence_pause_ms": 0},
            aligner_version="timing-scorpio-fixture-1",
            compiler_version="1.0.0",
            renderer_version="2.0.0",
            renderer_hash=renderer_hash,
            music_path=music,
            mix_settings={"volume": 0.2},
        )

    def test_clean_scorpio_reaches_output_with_zero_overlap_before_renderer(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = ScorpioCounters()
            controller, executor = self.make_executor(root, counters)
            controller.import_package(self.make_source(root))
            state = executor.run(self.config(root))
            self.assertEqual(counters.render_overlap_counts, [0])
            self.assertEqual(counters.e22_ranges, [(38, 46)])
            self.assertEqual((counters.voice, counters.timing, counters.render, counters.audio, counters.output), (1, 1, 1, 1, 1))
            self.assertTrue((controller.workspace / "out" / "zodiac-story.mp4").is_file())
            for step in (VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
                self.assertEqual(state.steps[step].status, "DONE")

    def test_visual_only_patch_reuses_voice_and_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = ScorpioCounters()
            controller, executor = self.make_executor(root, counters)
            source = self.make_source(root)
            config = self.config(root)
            controller.import_package(source)
            executor.run(config)

            ir_path = source / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            ir["assets"]["char.scorpio"]["visual_revision"] = "patch-2"
            ir_path.write_text(json.dumps(ir, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            manifest_path = source / "package-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["job"]["revision"] = "1.1"
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

            controller.import_package(source)
            state = executor.run(config)
            self.assertEqual(counters.voice, 1)
            self.assertEqual(counters.timing, 1)
            self.assertEqual(counters.render, 2)
            self.assertEqual(counters.render_overlap_counts, [0, 0])
            self.assertEqual(counters.e22_ranges, [(38, 46)] * 2)
            self.assertTrue(state.steps[VOICE].reused)
            self.assertTrue(state.steps[TIMING].reused)
            self.assertFalse(state.steps[PLAN].reused)

    def test_renderer_only_patch_reuses_voice_timing_and_plan(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = ScorpioCounters()
            controller, executor = self.make_executor(root, counters)
            controller.import_package(self.make_source(root))
            executor.run(self.config(root, renderer_hash="renderer-a"))
            state = executor.run(self.config(root, renderer_hash="renderer-b"))
            self.assertEqual((counters.voice, counters.timing, counters.render), (1, 1, 2))
            self.assertTrue(state.steps[VOICE].reused)
            self.assertTrue(state.steps[TIMING].reused)
            self.assertTrue(state.steps[PLAN].reused)
            self.assertFalse(state.steps[RENDER].reused)
            self.assertEqual(counters.render_overlap_counts, [0, 0])
            self.assertEqual(counters.e22_ranges, [(38, 46)] * 2)

    def test_music_only_patch_reuses_through_render(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = ScorpioCounters()
            controller, executor = self.make_executor(root, counters)
            controller.import_package(self.make_source(root))
            executor.run(self.config(root, music_bytes=b"music-a"))
            state = executor.run(self.config(root, music_bytes=b"music-b"))
            self.assertEqual((counters.voice, counters.timing, counters.render, counters.audio, counters.output), (1, 1, 1, 2, 2))
            for step in (VOICE, TIMING, PLAN, RENDER):
                self.assertTrue(state.steps[step].reused, step)
            self.assertFalse(state.steps[AUDIO].reused)
            self.assertEqual(counters.render_overlap_counts, [0])
            self.assertEqual(counters.e22_ranges, [(38, 46)])


if __name__ == "__main__":
    unittest.main()
