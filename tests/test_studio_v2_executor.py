import copy
import json
import shutil
import tempfile
from threading import Event
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from tools.control_plane.artifact_graph import ArtifactGraph
from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.controller import StudioV2Controller
from tools.studio_v2.executor import (
    ExecutorConfig,
    StudioV2Executor,
    _assemble_segments,
    _render_segmented,
)
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
    shutil.rmtree(source / ".runtime", ignore_errors=True)
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
    publish = source / "publish"
    publish.mkdir()
    (publish / "publish.json").write_text(
        json.dumps({"format": "zodiac-publish@1", "source": {"narration": "narration.txt", "production": "production.ir.json"}}),
        encoding="utf-8",
    )
    (publish / "publish-copy.txt").write_text("xin chao\n", encoding="utf-8")
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
        output_path.write_bytes(b"rendered-" + props_path.read_bytes())
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
        def probe(path):
            props_path = Path(path).parent / "props.json"
            props = json.loads(props_path.read_text(encoding="utf-8"))
            return max(
                int(scene["start_frame"]) + int(scene["duration_frames"])
                for scene in props["scenes"]
            )

        def assemble(segments, _frames, destination):
            destination.write_bytes(
                b"assembled" + b"".join(Path(path).read_bytes() for path, _ in segments)
            )
            return destination

        probe_patch = patch("tools.studio_v2.executor._probe_frames", side_effect=probe)
        assembly = patch("tools.studio_v2.executor._assemble_segments", side_effect=assemble)
        probe_patch.start()
        assembly.start()
        self.addCleanup(probe_patch.stop)
        self.addCleanup(assembly.stop)
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

    def test_default_audio_assembly_does_not_cut_renderer_landing_tail(self):
        source = (ROOT / "tools" / "studio_v2" / "executor.py").read_text(encoding="utf-8")
        audio_block = source[source.index("def _default_audio_handler"):source.index("def _default_output_handler")]
        self.assertNotIn("-shortest", audio_block)

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

    def test_explicit_rerun_bypasses_stage_and_scene_caches(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            controller.import_package(make_source(root))
            config = self._config(root)
            executor.run(config)
            executor.run(config, rerun_from=RENDER)
            self.assertEqual((counters.voice, counters.timing, counters.render,
                              counters.audio, counters.output), (1, 1, 2, 2, 2))
            executor.run(config, rerun_from=VOICE)
            self.assertEqual((counters.voice, counters.timing, counters.render,
                              counters.audio, counters.output), (2, 2, 3, 3, 3))

    def test_cancel_preserves_completed_stage_and_pending_rerun_after_restart(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            counters = StageCounters()
            controller, executor = self._executor(root, counters)
            controller.import_package(make_source(root))
            config = self._config(root)
            executor.run(config)
            cancel = Event()
            original = executor.audio_handler
            def stop_after_audio(*args):
                result = original(*args)
                cancel.set()
                return result
            executor.audio_handler = stop_after_audio
            with self.assertRaises(ControlPlaneError) as caught:
                executor.run(config, rerun_from=AUDIO, cancel_event=cancel)
            self.assertEqual(caught.exception.code, "PIPELINE_CANCELLED")
            self.assertEqual(load_state(controller.workspace).steps[AUDIO].status, DONE)
            request = controller.workspace / ".runtime" / "rerun-request.json"
            self.assertEqual(json.loads(request.read_text())["from"], OUTPUT)
            new_controller, resumed = self._executor(root, counters)
            resumed.run(config)
            self.assertEqual((counters.audio, counters.output), (2, 2))
            self.assertEqual(new_controller.state.steps[OUTPUT].status, DONE)
            self.assertFalse(request.exists())

    def test_valid_cached_segment_skips_full_frame_decode(self):
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            props = {
                "fps": 24,
                "scenes": [{"id": "S01", "start_frame": 0, "duration_frames": 24}],
                "assets": {},
            }
            props_path = workspace / "props.json"
            props_path.write_text(json.dumps(props), encoding="utf-8")
            graph = ArtifactGraph(workspace)
            from tools.control_plane.segments import plan_segments

            segment = plan_segments(
                props, renderer_version="2", renderer_hash="renderer", target_seconds=1
            )[0]
            artifact_path = (
                workspace / ".runtime" / "artifacts" / "render" / "segments"
                / segment["segment_id"] / f"{segment['input_fingerprint']}.mp4"
            )
            artifact_path.parent.mkdir(parents=True)
            artifact_path.write_bytes(b"validated segment")
            graph.record(
                f"render.segment.{segment['segment_id']}",
                "render.segment",
                segment["input_fingerprint"],
                artifact_path,
                producer="test",
                producer_version="1",
            )
            output_path = workspace / "rendered.mp4"

            def assemble(_segments, _frames, destination):
                destination.write_bytes(b"assembled")
                return destination

            with patch("tools.studio_v2.executor.shutil.which", return_value="tool"), patch(
                "tools.studio_v2.executor._probe_frames",
                side_effect=AssertionError("cached segment should not be decoded"),
            ), patch("tools.studio_v2.executor._assemble_segments", side_effect=assemble):
                result, dependencies, mode = _render_segmented(
                    workspace,
                    props_path,
                    output_path,
                    graph=graph,
                    render_handler=lambda *_: self.fail("cached segment should not render"),
                    renderer_version="2",
                    renderer_hash="renderer",
                    target_seconds=1,
                    render_fingerprint="plan",
                )

            self.assertEqual(result.read_bytes(), b"assembled")
            self.assertEqual(mode, "segments")
            self.assertIn(f"render.segment.{segment['segment_id']}", dependencies)

    def test_segment_assembly_does_not_decode_each_input_again(self):
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            segment = workspace / "segment.mp4"
            segment.write_bytes(b"validated segment")
            output = workspace / "assembled.mp4"

            def run_ffmpeg(command, **_kwargs):
                Path(command[-1]).write_bytes(b"assembled")
                return type("Result", (), {"stdout": ""})()

            with patch("tools.studio_v2.executor.shutil.which", return_value="ffmpeg"), patch(
                "tools.studio_v2.executor.run_structured_command", side_effect=run_ffmpeg
            ), patch(
                "tools.studio_v2.executor._probe_frames", return_value=24
            ) as probe:
                _assemble_segments([(segment, 24)], 24, output)

            probe.assert_called_once_with(output)

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
            ir["scenes"][0]["entities"][0]["states"]["open"]["asset"] = "decor.extra"
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
