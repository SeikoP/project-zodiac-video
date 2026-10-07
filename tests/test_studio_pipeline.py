"""RED tests for the pipeline worker: resume, per-scene voice checkpoints, cancel, cache."""

import contextlib
import json
import os
import sys
import tempfile
import time
import threading
import unittest
import wave
import zipfile
from pathlib import Path
from unittest.mock import patch

from test_zodiac_local import package_files, valid_timing, write_pcm
from tools.studio.controller import StudioController
from tools.studio.job_state import JobStateStore
from tools.studio.pipeline import (
    ALIGN_TIMING,
    PREFLIGHT,
    CANCELLED,
    CONCAT_VOICE,
    DONE,
    FAILED,
    IMPORT_PACKAGE,
    PENDING,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    MIX_MUSIC,
    SKIPPED,
    STEP_ORDER,
    VALIDATE_RUNTIME,
    VOICE_SCENES,
)
from tools.studio.worker import (
    LOG_LINE,
    PIPELINE_CANCELLED,
    STEP_FAILED,
    STEP_STARTED,
    CancelledError,
    PipelineWorker,
)


def write_multi_scene_job(root: Path, scenes: int = 4) -> Path:
    """A v2 job whose scenes are S01..S0N, so per-scene resume is observable."""
    files = package_files()
    production = json.loads(files["production.json"])
    base = production["scenes"][0]
    scenes_json = []
    for index in range(scenes):
        scene = json.loads(json.dumps(base))
        scene["id"] = f"S{index + 1:02d}"
        scene["voice"] = f"Câu thoại số {index + 1}."
        scene["events"][0]["id"] = f"{scene['id']}-E01"
        scenes_json.append(scene)
    production["scenes"] = scenes_json
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    files["narration.txt"] = "\n".join(scene["voice"] for scene in scenes_json) + "\n"

    job = root / "zodiac-multi"
    for name, content in files.items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


class _ReadyPreflight:
    """Stands in for PreflightChecker so environment checks do not block unit tests."""

    def __init__(self, *_args, **_kwargs):
        from tools.studio.preflight import Check

        self._checks = [Check(code="FASTER_WHISPER", label="faster-whisper", ok=True, message="ok")]

    def run(self):
        return self._checks


def write_scene_wav(path: Path, seconds: float = 0.5) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * int(16000 * seconds))


class WorkerHarness(unittest.TestCase):
    """Every expensive external operation is stubbed; only pipeline logic runs."""

    fail_scene: str | None = None
    fail_align = False
    fail_runtime_visual = False
    fail_render = False
    emit_tts_warning = False

    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        self.job = write_multi_scene_job(self.root)
        self.events: list[tuple[str, dict]] = []
        self.tts_calls: list[list[str]] = []
        self.align_calls: list[dict] = []
        self.render_calls: list[str] = []
        self.emit_tts_warning = False
        self.fail_runtime_visual = False
        self._patches: list = []
        self.addCleanup(self._stop_patches)

    def _stop_patches(self):
        for patcher in reversed(self._patches):
            patcher.stop()
        self._patches = []

    def stub(self, target: str, replacement) -> None:
        patcher = patch(target, replacement)
        patcher.start()
        self._patches.append(patcher)

    # ---- stubbed operations ------------------------------------------
    def fake_tts(self, package_root, production, scene_ids=None, **kwargs):
        """Writes scenes in order and fails at fail_scene, like a real TTS batch."""
        requested = list(scene_ids) if scene_ids is not None else [s["id"] for s in production["scenes"]]
        self.tts_calls.append(requested)
        if self.emit_tts_warning and kwargs.get("log_callback"):
            kwargs["log_callback"]("TTS_RATE_WARNING: S01 4.40 từ/giây")
        for scene_id in requested:
            if self.fail_scene == scene_id:
                raise RuntimeError(f"VieNeu failed on {scene_id}")
            write_scene_wav(Path(package_root) / ".runtime" / "tts-scenes" / f"{scene_id}.wav")
        return {scene_id: 0.5 for scene_id in requested}

    def fake_concat(self, package_root, production, **kwargs):
        write_pcm(Path(package_root) / "voice.wav", seconds=0.5)
        return Path(package_root) / "voice.wav"

    def fake_align(
        self,
        production,
        durations,
        aligner,
        scene_wavs=None,
        mismatch_recovery=None,
        **kwargs,
    ):
        self.align_calls.append(
            {
                "scenes": list(durations),
                "has_recovery": mismatch_recovery is not None,
            }
        )
        if self.fail_align:
            raise RuntimeError("recognized words do not match approved narration")
        return valid_timing()

    def fake_write_timing(self, package_root, timing, **_kwargs):
        (Path(package_root) / ".runtime").mkdir(parents=True, exist_ok=True)
        (Path(package_root) / ".runtime" / "timing.json").write_text(json.dumps(timing), encoding="utf-8")
        return timing

    def fake_validate_runtime(self, package_root):
        if not (Path(package_root) / ".runtime" / "timing.json").is_file():
            raise RuntimeError("timing.json is missing")
        if self.fail_runtime_visual:
            raise RuntimeError(
                "VISUAL_PROGRESSION_TIMING: scene S02 has a 5.79s gap without a meaningful visual change; max 5.0s."
            )

    def fake_prepare(self, package_root, **kwargs):
        self.render_calls.append("prepare")

    def fake_render(self, package_root):
        self.render_calls.append("render")
        if self.fail_render:
            raise RuntimeError("remotion failed")

    def fake_mix(self, package_root, **kwargs):
        self.render_calls.append("mix")
        return Path(package_root) / "out" / "zodiac-story.mp4"

    def fake_finalize(self, package_root, **kwargs):
        self.render_calls.append("finalize")
        return {"video": Path(package_root) / "out" / "zodiac-story.mp4"}

    def ready_preflight(self, *_args, **_kwargs):
        from tools.studio.preflight import Check

        return _ReadyPreflight()

    def stub_pipeline(self) -> None:
        self.stub("tools.studio.worker.PreflightChecker", self.ready_preflight)
        self.stub("tools.studio.worker.generate_scene_voices", self.fake_tts)
        self.stub("tools.studio.worker.concatenate_scene_voices", self.fake_concat)
        self.stub("tools.studio.worker.align_scene_timings", self.fake_align)
        self.stub("tools.studio.worker.build_and_write_timing", self.fake_write_timing)
        self.stub("tools.studio.worker.validate_runtime", self.fake_validate_runtime)
        self.stub("tools.studio.worker.prepare_renderer", self.fake_prepare)
        self.stub("tools.studio.worker.render_video", self.fake_render)
        self.stub("tools.studio.worker.mix_background_music_into_render", self.fake_mix)
        self.stub("tools.studio.worker.finalize_publish_outputs", self.fake_finalize)
        self.stub("tools.studio.worker.load_word_aligner", lambda *a, **k: object())
        self.stub("tools.studio.worker.require_word_aligner_installed", lambda: None)

    def make_worker(self, plan=None, **kwargs) -> PipelineWorker:
        self.stub_pipeline()
        kwargs.setdefault("voice", "test-voice")
        kwargs.setdefault("tts_mode", "test-mode")
        return PipelineWorker(
            self.job,
            plan=plan,
            on_event=lambda kind, payload: self.events.append((kind, payload)),
            **kwargs,
        )

    def reopened_worker(self) -> PipelineWorker:
        return self.make_worker(plan=JobStateStore(self.job).open())

    def plan(self) -> "PipelinePlan":  # noqa: F821 - only used for typing clarity
        return JobStateStore(self.job).open()


class VoiceResumeTests(WorkerHarness):
    def test_scene_failure_keeps_previous_scene_checkpoints(self):
        self.fail_scene = "S04"
        plan = self.make_worker().run_to_completion()
        self.assertEqual(plan.status(VOICE_SCENES), FAILED)
        scenes = plan.steps[VOICE_SCENES].scenes
        self.assertEqual(scenes["S01"]["status"], DONE)
        self.assertEqual(scenes["S03"]["status"], DONE)
        self.assertEqual(scenes["S04"]["status"], FAILED)
        self.assertFalse((self.job / "voice.wav").exists())

    def test_retry_after_failure_regenerates_only_the_failed_scene(self):
        self.fail_scene = "S04"
        self.make_worker().run_to_completion()
        self.tts_calls.clear()
        self.fail_scene = None
        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [["S04"]])

    def test_scene_checkpoints_survive_an_app_restart(self):
        self.make_worker().run_to_completion()
        reopened = JobStateStore(self.job).open()
        for scene_id in ("S01", "S02", "S03", "S04"):
            self.assertEqual(reopened.scene_status(VOICE_SCENES, scene_id), DONE)
        self.assertEqual(reopened.status(CONCAT_VOICE), DONE)

    def test_reusable_scene_wav_is_verified_against_text_and_voice(self):
        self.make_worker().run_to_completion()
        entry = JobStateStore(self.job).load()["steps"][VOICE_SCENES]["scenes"]["S01"]
        self.assertTrue(entry["text_hash"])
        self.assertTrue(entry["file_hash"])
        self.assertEqual(entry["voice_id"], "test-voice")
        self.assertEqual(entry["tts_mode"], "test-mode")
        self.assertEqual(len(entry["voice_profile_hash"]), 64)
        self.assertEqual(len(entry["generation_profile_hash"]), 64)
        self.assertTrue(entry["artifact_take_id"])

    def test_deleted_scene_wav_is_restored_from_approved_artifact(self):
        self.make_worker().run_to_completion()
        working = self.job / ".runtime" / "tts-scenes" / "S02.wav"
        working.unlink()
        self.tts_calls.clear()

        # Reopening the job is enough to restore the compatibility working WAV
        # before PipelineWorker decides whether the scene is dirty.
        plan = JobStateStore(self.job).open()
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S02"), DONE)
        self.assertTrue(working.is_file())

        plan.mark(VOICE_SCENES, PENDING)
        JobStateStore(self.job).save(plan)
        worker = self.make_worker(plan=JobStateStore(self.job).open())
        worker.run_from(VOICE_SCENES, stop_after=VOICE_SCENES)

        self.assertEqual(self.tts_calls, [])
        index = json.loads(
            (self.job / ".runtime" / "artifacts" / "voice" / "S02" / "index.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertTrue(index["active_take"])

    def test_changed_scene_voice_only_regenerates_that_scene(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.set_scene_state(VOICE_SCENES, "S03", PENDING)
        JobStateStore(self.job).save(plan)
        self.tts_calls.clear()
        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [["S03"]])

    def test_voice_change_invalidates_the_whole_voice_chain(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.apply_change("voice")
        self.assertEqual(plan.status(VOICE_SCENES), PENDING)
        self.assertEqual(plan.status(CONCAT_VOICE), PENDING)
        self.assertEqual(plan.status(PREPARE_RENDERER), PENDING)

    def test_narration_change_of_one_scene_keeps_the_other_scenes(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.apply_change("narration", changed_scenes=["S02"])
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S01"), DONE)
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S02"), PENDING)
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S03"), DONE)

    def test_scene_cache_includes_backend_and_precision(self):
        self.make_worker(
            tts_mode="v3turbo",
            tts_backend="onnx",
            tts_precision="fp32",
        ).run_to_completion()
        entry = JobStateStore(self.job).load()["steps"][VOICE_SCENES]["scenes"]["S01"]
        self.assertEqual(entry["tts_backend"], "onnx")
        self.assertEqual(entry["tts_precision"], "fp32")

    def test_generation_profile_change_preserves_approved_wavs(self):
        self.make_worker(
            tts_mode="v3turbo",
            tts_backend="onnx",
            tts_precision="fp32",
        ).run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.mark(VOICE_SCENES, PENDING)
        JobStateStore(self.job).save(plan)
        self.tts_calls.clear()

        worker = self.make_worker(
            plan=JobStateStore(self.job).open(),
            tts_mode="v3turbo",
            tts_backend="onnx",
            tts_precision="int8",
        )
        worker.run_from(VOICE_SCENES, stop_after=VOICE_SCENES)
        self.assertEqual(self.tts_calls, [])
        logs = [payload["text"] for kind, payload in self.events if kind == LOG_LINE]
        self.assertTrue(any("VOICE_PROFILE_DRIFT" in text for text in logs))


class RerunStepTests(WorkerHarness):
    """'Chạy lại bước' is an explicit request: it must really redo that step."""

    def test_rerun_voice_step_regenerates_every_scene(self):
        from tools.studio.controller import StudioController

        self.make_worker().run_to_completion()
        controller = StudioController(workspace=self.root / "ws")
        controller.use_job(self.job)
        self.assertEqual(controller.plan.scene_status(VOICE_SCENES, "S01"), DONE)

        self.tts_calls.clear()
        self.stub_pipeline()
        controller.start_pipeline(rerun=VOICE_SCENES)
        controller.worker.join(timeout=60)
        self.assertEqual(self.tts_calls, [["S01", "S02", "S03", "S04"]])

    def test_rerun_renderer_keeps_the_voice_checkpoints(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.invalidate_from("RENDER_VIDEO")
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S01"), DONE)

    def test_resume_after_a_scene_failure_still_reuses_finished_scenes(self):
        self.fail_scene = "S04"
        self.make_worker().run_to_completion()
        self.tts_calls.clear()
        self.fail_scene = None
        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [["S04"]])


class AlignmentResumeTests(WorkerHarness):
    def test_alignment_failure_preserves_scene_wavs_and_voice(self):
        self.fail_align = True
        plan = self.make_worker().run_to_completion()
        self.assertEqual(plan.status(ALIGN_TIMING), FAILED)
        self.assertEqual(plan.status(CONCAT_VOICE), DONE)
        for scene_id in ("S01", "S02", "S03", "S04"):
            self.assertTrue((self.job / ".runtime" / "tts-scenes" / f"{scene_id}.wav").is_file())
        self.assertTrue((self.job / "voice.wav").is_file())

    def test_continue_after_alignment_failure_only_aligns_again(self):
        self.fail_align = True
        self.make_worker().run_to_completion()
        self.tts_calls.clear()
        self.align_calls.clear()
        self.fail_align = False
        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [])
        self.assertTrue(self.align_calls)

    def test_visual_progression_failure_happens_after_alignment_cache_is_saved(self):
        self.fail_runtime_visual = True
        plan = self.make_worker().run_to_completion()
        self.assertEqual(plan.status(ALIGN_TIMING), DONE)
        self.assertEqual(plan.status(VALIDATE_RUNTIME), FAILED)
        self.assertTrue((self.job / ".runtime" / "timing.json").is_file())
        self.assertEqual(plan.steps[VALIDATE_RUNTIME].error_code, "VISUAL_PROGRESSION_TIMING")

    def test_visual_density_error_is_not_reported_as_alignment_mismatch(self):
        worker = self.make_worker()
        message, code = worker._classify(
            ALIGN_TIMING,
            RuntimeError(
                "VISUAL_PROGRESSION_DENSITY: scene S01 has 14 words without a meaningful visual change; max 10 words before local timing."
            ),
        )
        self.assertEqual(code, "PACKAGE_INVALID")
        self.assertIn("Gói video", message)

    def test_alignment_mismatch_uses_an_actionable_error_code(self):
        self.fail_align = True
        self.make_worker().run_to_completion()
        failure = next(payload for kind, payload in self.events if kind == STEP_FAILED)
        self.assertEqual(failure["error_code"], "ALIGNMENT_MISMATCH")
        self.assertTrue(failure["message"])
        self.assertNotIn("exit code 2", failure["message"])


class RenderResumeTests(WorkerHarness):
    def test_completed_run_without_music_has_nothing_to_resume(self):
        plan = self.make_worker().run_to_completion()
        self.assertEqual(plan.status(MIX_MUSIC), DONE)
        self.assertIn("finalize", self.render_calls)
        self.assertIsNone(plan.continue_from())
        self.assertFalse(plan.can_resume)

    def test_existing_job_migrates_pacing_without_regenerating_scene_tts(self):
        self.make_worker().run_to_completion()
        pacing = self.job / ".runtime" / "pacing.json"
        pacing.unlink()
        plan = JobStateStore(self.job).open()
        self.assertEqual(plan.status(VOICE_SCENES), DONE)
        worker = self.make_worker(plan=plan)
        self.assertEqual(worker.plan.status(VOICE_SCENES), DONE)
        self.assertEqual(worker.plan.status(CONCAT_VOICE), PENDING)
        self.assertEqual(worker.plan.status(ALIGN_TIMING), PENDING)
        self.assertEqual(worker.plan.status(RENDER_VIDEO), PENDING)

    def test_sentence_pause_change_rebuilds_from_concat_without_tts(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        self.tts_calls.clear()
        worker = self.make_worker(
            plan=plan,
            sentence_pause_ms=500,
        )
        self.assertEqual(worker.plan.status(VOICE_SCENES), DONE)
        self.assertEqual(worker.plan.status(CONCAT_VOICE), PENDING)
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [])

    def test_worker_defaults_to_breathing_gap_and_100_playback(self):
        worker = self.make_worker()
        self.assertEqual(worker.scene_gap_ms, 350.0)
        self.assertEqual(worker.sentence_pause_ms, 320.0)
        self.assertEqual(worker.playback_rate, 1.0)

    def test_finalization_runs_after_render_even_without_music(self):
        self.make_worker().run_to_completion()
        self.assertIn("render", self.render_calls)
        self.assertIn("mix", self.render_calls)
        self.assertIn("finalize", self.render_calls)
        self.assertLess(self.render_calls.index("render"), self.render_calls.index("mix"))
        self.assertLess(self.render_calls.index("mix"), self.render_calls.index("finalize"))

    def test_failed_step_still_wins_over_a_skipped_tail(self):
        plan = self.make_worker().run_to_completion()
        plan.invalidate_from("RENDER_VIDEO")
        plan.mark("RENDER_VIDEO", FAILED, message="render died")
        self.assertEqual(plan.continue_from(), "RENDER_VIDEO")

    def test_music_change_reopens_only_the_skipped_step(self):
        plan = self.make_worker().run_to_completion()
        plan.apply_change("music")
        self.assertEqual(plan.status(MIX_MUSIC), PENDING)
        self.assertEqual(plan.continue_from(), MIX_MUSIC)

    def test_render_failure_preserves_voice_and_timing(self):
        self.fail_render = True
        plan = self.make_worker().run_to_completion()
        self.assertEqual(plan.status(RENDER_VIDEO), FAILED)
        self.assertEqual(plan.status(ALIGN_TIMING), DONE)
        self.assertEqual(plan.status(VALIDATE_RUNTIME), DONE)
        self.assertTrue((self.job / "voice.wav").is_file())
        self.assertTrue((self.job / ".runtime" / "timing.json").is_file())

    def test_continue_after_render_failure_skips_tts_and_alignment(self):
        self.fail_render = True
        self.make_worker().run_to_completion()
        self.tts_calls.clear()
        self.align_calls.clear()
        self.render_calls.clear()
        self.fail_render = False
        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [])
        self.assertEqual(self.align_calls, [])
        self.assertIn("render", self.render_calls)

    def test_music_only_change_keeps_the_rendered_video(self):
        self.make_worker().run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.apply_change("music")
        self.assertEqual(plan.status(RENDER_VIDEO), DONE)
        self.assertEqual(plan.status(MIX_MUSIC), PENDING)


    def test_music_only_rerun_applies_new_track_without_rerendering_video(self):
        first = self.root / "first.mp3"
        second = self.root / "second.mp3"
        first.write_bytes(b"first-track")
        second.write_bytes(b"second-track")

        self.make_worker(music=first).run_to_completion()
        plan = JobStateStore(self.job).open()
        plan.apply_change("music")
        JobStateStore(self.job).save(plan)

        self.render_calls.clear()
        worker = self.make_worker(
            plan=JobStateStore(self.job).open(),
            music=second,
        )
        worker.run_from(worker.plan.continue_from())

        self.assertNotIn("render", self.render_calls)
        self.assertIn("mix", self.render_calls)
        copied = self.job / "media" / "background-music.mp3"
        self.assertEqual(copied.read_bytes(), b"second-track")


class CancelTests(WorkerHarness):
    def test_cancel_marks_running_step_cancelled_and_keeps_done_steps(self):
        worker = PipelineWorker(
            self.job,
            on_event=lambda kind, payload: self.events.append((kind, payload)),
        )
        self.stub_pipeline()

        def block(package_root, production, scene_ids=None, **kwargs):
            worker.request_cancel()
            raise CancelledError("dừng theo yêu cầu")

        self.stub("tools.studio.worker.generate_scene_voices", block)
        worker.run_to_completion()

        self.assertEqual(worker.plan.status(VOICE_SCENES), CANCELLED)
        self.assertEqual(worker.plan.status(IMPORT_PACKAGE), DONE)
        self.assertIn(PIPELINE_CANCELLED, [kind for kind, _ in self.events])

    def test_cancel_before_any_step_stays_cancellable(self):
        self.stub_pipeline()
        worker = self.make_worker()
        worker.request_cancel()
        worker.run_to_completion()
        self.assertEqual(worker.plan.status(PREFLIGHT), CANCELLED)

    def test_cancelled_state_persists_for_the_next_start(self):
        self.stub_pipeline()
        worker = self.make_worker()
        worker.request_cancel()
        worker.run_to_completion()
        reopened = JobStateStore(self.job).open()
        self.assertEqual(reopened.status(PREFLIGHT), CANCELLED)
        self.assertEqual(reopened.continue_from(), PREFLIGHT)

    def test_cancel_terminates_the_subprocess_tree(self):
        import subprocess

        worker = PipelineWorker(self.job)
        process = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(30)"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=(os.name != "nt"),
        )
        worker.attach_process(process)
        worker.request_cancel()
        self.assertTrue(process.wait(timeout=10) != 0 or process.poll() is not None)

    def test_cancel_interrupts_a_runtime_managed_subprocess(self):
        import subprocess

        from tools.zodiac_local import observe_subprocesses, run_managed_subprocess

        worker = PipelineWorker(self.job)
        errors = []

        def run_child():
            try:
                with observe_subprocesses(worker.attach_process):
                    run_managed_subprocess(
                        [sys.executable, "-c", "import time; time.sleep(30)"],
                        check=True,
                    )
            except subprocess.CalledProcessError as exc:
                errors.append(exc)

        thread = threading.Thread(target=run_child)
        thread.start()
        deadline = time.time() + 5
        while worker._process is None and time.time() < deadline:
            time.sleep(0.01)
        self.assertIsNotNone(worker._process, "managed subprocess was never registered")
        worker.request_cancel()
        thread.join(timeout=10)
        self.assertFalse(thread.is_alive(), "managed subprocess did not stop after cancel")
        self.assertTrue(errors, "killed subprocess should surface a non-zero exit")


class PerformanceTelemetryTests(WorkerHarness):
    def test_worker_records_performance_and_artifact_snapshot(self):
        self.make_worker().run_to_completion()

        performance = json.loads(
            (self.job / ".runtime" / "performance.json").read_text(encoding="utf-8")
        )
        records = performance["records"]
        recorded_steps = {record["step"] for record in records}
        self.assertIn(RENDER_VIDEO, recorded_steps)
        self.assertIn(MIX_MUSIC, recorded_steps)
        for record in records:
            self.assertGreaterEqual(record["elapsed_ms"], 0)
            self.assertEqual(len(record["input_fingerprint"]), 64)
            self.assertEqual(len(record["output_fingerprint"]), 64)
            if record["step"] != VOICE_SCENES:
                self.assertIsNone(record["cache_hit"])
            self.assertIn("cache_reason", record)

        artifacts = json.loads(
            (self.job / ".runtime" / "artifacts.json").read_text(encoding="utf-8")
        )
        self.assertEqual(artifacts["version"], 1)
        self.assertIn("renderer", artifacts["fingerprints"])
        self.assertIn("render_profile", artifacts["fingerprints"])


class WorkerThreadingTests(WorkerHarness):
    def test_worker_runs_on_its_own_thread(self):
        worker = self.make_worker()
        seen: dict = {}
        thread = threading.Thread(target=lambda: (seen.update(thread=threading.current_thread()), worker.run_to_completion()))
        thread.start()
        thread.join(timeout=60)
        self.assertIsNotNone(seen.get("thread"))
        self.assertIsNot(seen["thread"], threading.current_thread())

    def test_events_are_emitted_per_executed_step(self):
        worker = self.make_worker()
        worker.run_to_completion()
        kinds = [kind for kind, _ in self.events]
        executed = [step for step in STEP_ORDER if step in {payload["step"] for kind, payload in self.events if kind == STEP_STARTED}]
        self.assertEqual(kinds.count(STEP_STARTED), len(executed))
        self.assertEqual(kinds.count("STEP_DONE"), len(executed))

    def test_logs_are_streamed_to_the_listener(self):
        self.make_worker().run_to_completion()
        logs = [payload["text"] for kind, payload in self.events if kind == LOG_LINE]
        self.assertTrue(any("S01" in text for text in logs))

    def test_tts_rate_warning_is_streamed_to_studio_log(self):
        self.emit_tts_warning = True
        self.make_worker().run_to_completion()
        logs = [payload["text"] for kind, payload in self.events if kind == LOG_LINE]
        self.assertTrue(any("TTS_RATE_WARNING" in text for text in logs))

    def test_worker_can_run_in_background_and_be_joined(self):
        worker = self.make_worker()
        worker.start()
        worker.join(timeout=60)
        self.assertFalse(worker.is_alive())
        self.assertEqual(worker.plan.status(VOICE_SCENES), DONE)


class ControllerTests(WorkerHarness):
    def _controller(self) -> StudioController:
        controller = StudioController(workspace=self.root / "ws")
        controller.use_job(self.job)
        return controller

    def test_controller_exposes_single_final_video_and_cover_paths(self):
        controller = self._controller()
        self.assertEqual(
            controller.video_path,
            self.job / "out" / "zodiac-story.mp4",
        )
        self.assertEqual(
            controller.cover_path,
            self.job / "out" / "cover.png",
        )

    def test_pipeline_rows_are_vietnamese_and_ordered(self):
        from tools.studio.messages_vi import STEP_NAMES_VI

        rows = self._controller().pipeline_rows()
        self.assertEqual([row["step"] for row in rows], list(STEP_ORDER))
        self.assertEqual([row["name"] for row in rows], [STEP_NAMES_VI[step] for step in STEP_ORDER])

    def test_continue_is_only_enabled_when_resumable(self):
        controller = self._controller()
        self.assertTrue(controller.can_continue())
        for step in STEP_ORDER:
            controller.plan.mark(step, DONE)
        self.assertFalse(controller.can_continue())

    def test_editor_is_only_available_for_a_valid_v2_job(self):
        controller = self._controller()
        self.assertTrue(controller.editor_available())
        (self.job / "production.json").write_text('{"version": "1.0"}', encoding="utf-8")
        self.assertFalse(controller.editor_available())

    def test_patch_version_suffix_reuses_the_same_logical_job_workspace(self):
        controller = self._controller()
        base = self.root / "zodiac-bocap-hai-phien-ban.zip"
        patch = self.root / "zodiac-bocap-hai-phien-ban-v1.1.zip"
        self.assertEqual(
            controller.job_name_for(base),
            "zodiac-bocap-hai-phien-ban",
        )
        self.assertEqual(
            controller.job_name_for(patch),
            "zodiac-bocap-hai-phien-ban",
        )
        self.assertEqual(
            controller.job_name_for(self.root / "zodiac-bocap-hai-phien-ban-v2.3.4.zip"),
            "zodiac-bocap-hai-phien-ban",
        )

    def test_patch_archive_reuses_existing_legacy_versioned_workspace(self):
        controller = StudioController(workspace=self.root / "ws")
        legacy = controller.jobs_dir / "zodiac-bocap-hai-phien-ban-v1.1"
        legacy.mkdir(parents=True, exist_ok=True)
        (legacy / "production.json").write_text(
            '{"version":"2.0","scenes":[]}',
            encoding="utf-8",
        )
        controller.use_job(legacy)
        patch = self.root / "zodiac-bocap-hai-phien-ban-v1.2.zip"
        self.assertEqual(
            controller._destination_for_archive(patch),
            legacy,
        )

    def test_selecting_a_new_archive_is_not_silently_reused(self):
        controller = self._controller()
        first = self._archive("a")
        second = self._archive("b")
        controller.select_archive(first)
        controller.sync_package()
        self.assertFalse(controller.package_changed)

        controller.select_archive(second)
        self.assertTrue(controller.package_changed)
        self.assertNotEqual(controller.archive_fingerprint, controller.stored_fingerprint)
        self.assertEqual(controller.plan.status(IMPORT_PACKAGE), PENDING)

    def test_changed_zip_masks_stale_downstream_pipeline_rows(self):
        controller = self._controller()
        first = self._archive("a")
        second = self._archive("b")
        controller.select_archive(first)
        controller.sync_package()
        for step in STEP_ORDER:
            controller.plan.mark(step, DONE)

        controller.select_archive(second)

        rows = {row["step"]: row for row in controller.pipeline_rows()}
        self.assertEqual(rows[IMPORT_PACKAGE]["status"], PENDING)
        for step in STEP_ORDER[1:]:
            self.assertEqual(rows[step]["status"], PENDING)
            self.assertEqual(rows[step]["progress"], 0.0)
            self.assertEqual(rows[step]["scenes"], {})
            self.assertIn("ZIP mới", rows[step]["message"])

    def test_conflicting_archive_needs_an_explicit_choice(self):
        controller = self._controller()
        controller.select_archive(self._archive("a"))
        controller.sync_package()
        controller.select_archive(self._archive("b"))
        controller.accept_package_conflict("keep")
        self.assertFalse(controller.package_changed)
        self.assertEqual(controller.plan.status(IMPORT_PACKAGE), DONE)

    def test_accepting_the_conflict_reimports_the_selected_package(self):
        controller = self._controller()
        first = self._archive("a")
        second = self._archive("b")
        controller.select_archive(first)
        controller.sync_package()
        controller.select_archive(second)
        controller.accept_package_conflict("import")
        self.assertFalse(controller.package_changed)
        controller.select_archive(second)
        controller.sync_package()
        self.assertEqual(
            controller.stored_fingerprint,
            controller.archive_fingerprint,
        )

    def test_ui_change_is_persisted_immediately(self):
        controller = self._controller()
        for step in STEP_ORDER:
            controller.plan.mark(step, DONE)
        controller.store.save(controller.plan)

        controller.apply_change("music")

        reopened = JobStateStore(controller.job).open()
        self.assertEqual(reopened.status(MIX_MUSIC), PENDING)

    def test_package_conflict_blocks_rerun_before_mutating_plan(self):
        controller = self._controller()
        first = self._archive("a")
        second = self._archive("b")
        controller.select_archive(first)
        controller.sync_package()
        for step in STEP_ORDER:
            controller.plan.mark(step, DONE)
        controller.store.save(controller.plan)

        controller.select_archive(second)
        self.assertTrue(controller.package_changed)
        started = controller.start_pipeline(rerun=RENDER_VIDEO)

        self.assertFalse(started)
        self.assertEqual(controller.plan.status(RENDER_VIDEO), DONE)
        self.assertIn("ZIP", controller.status_text)

    def test_invalid_current_package_stops_at_package_before_worker_start(self):
        controller = self._controller()
        production_path = controller.job / "production.json"
        production = json.loads(production_path.read_text(encoding="utf-8"))
        production["scenes"][0]["voice"] = " ".join(f"tu{i}" for i in range(40))
        production_path.write_text(
            json.dumps(production, ensure_ascii=False),
            encoding="utf-8",
        )
        (controller.job / "narration.txt").write_text(
            production["scenes"][0]["voice"] + "\n",
            encoding="utf-8",
        )
        controller.plan.mark(IMPORT_PACKAGE, DONE)
        controller.plan.mark(ALIGN_TIMING, PENDING)
        controller.store.save(controller.plan)

        started = controller.start_pipeline(resume=True)

        self.assertFalse(started)
        self.assertIsNone(controller.worker)
        self.assertEqual(controller.plan.status(IMPORT_PACKAGE), FAILED)
        self.assertEqual(controller.plan.steps[IMPORT_PACKAGE].error_code, "PACKAGE_INVALID")
        self.assertIn("VISUAL_PROGRESSION_DENSITY", controller.plan.steps[IMPORT_PACKAGE].details)

    def test_running_worker_blocks_second_start(self):
        controller = self._controller()

        class AliveWorker:
            @staticmethod
            def is_alive():
                return True

        controller.worker = AliveWorker()
        self.assertFalse(controller.start_pipeline())
        self.assertEqual(controller.status_text, "Pipeline đang chạy.")

    def test_visual_only_package_refresh_preserves_runtime_cache(self):
        controller = self._controller()
        first = self._archive("a")
        controller.select_archive(first)
        controller.sync_package()

        for step in STEP_ORDER:
            controller.plan.mark(step, DONE)
        controller.store.save(controller.plan)
        sentinel = controller.job / ".runtime" / "cache-sentinel.txt"
        sentinel.parent.mkdir(parents=True, exist_ok=True)
        sentinel.write_text("keep-me", encoding="utf-8")

        design = self.job / "design.md"
        original = design.read_text(encoding="utf-8")
        try:
            design.write_text(original + "\nvisual-refresh\n", encoding="utf-8")
            second = self._archive("b")
        finally:
            design.write_text(original, encoding="utf-8")

        controller.select_archive(second)
        self.assertTrue(controller.package_changed)
        self.assertTrue(controller.accept_package_conflict("import"))

        self.assertTrue(sentinel.is_file())
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep-me")
        self.assertEqual(controller.plan.status(VOICE_SCENES), DONE)
        self.assertEqual(controller.plan.status(ALIGN_TIMING), DONE)
        self.assertEqual(controller.plan.status(VALIDATE_RUNTIME), PENDING)
        self.assertEqual(controller.plan.status(RENDER_VIDEO), PENDING)

    def test_publish_copy_only_refresh_does_not_rerender_video(self):
        controller = self._controller()
        first = self._archive("publish-a")
        controller.select_archive(first)
        controller.sync_package()
        for step in STEP_ORDER:
            controller.plan.mark(step, DONE)
        controller.store.save(controller.plan)

        publish_copy = self.job / "publish" / "publish-copy.txt"
        original = publish_copy.read_text(encoding="utf-8")
        try:
            publish_copy.write_text(
                original + "\n# copy-only refresh\n",
                encoding="utf-8",
            )
            second = self._archive("publish-b")
        finally:
            publish_copy.write_text(original, encoding="utf-8")

        controller.select_archive(second)
        self.assertTrue(controller.accept_package_conflict("import"))

        self.assertEqual(controller.plan.status(RENDER_VIDEO), DONE)
        self.assertEqual(controller.plan.status(MIX_MUSIC), PENDING)

    def test_controller_preserves_approved_voice_when_legacy_generation_fields_are_missing(self):
        self.make_worker(
            tts_mode="v3turbo",
            tts_backend="onnx",
            tts_precision="fp32",
        ).run_to_completion()

        plan = JobStateStore(self.job).open()
        for entry in plan.steps[VOICE_SCENES].scenes.values():
            entry.pop("tts_backend", None)
            entry.pop("tts_precision", None)
        plan.mark(ALIGN_TIMING, PENDING)
        JobStateStore(self.job).save(plan)

        self.tts_calls.clear()
        controller = StudioController(workspace=self.root / "ws")
        controller.use_job(self.job)
        controller.start_pipeline(resume=True, voice="test-voice")
        controller.worker.join(timeout=60)

        self.assertEqual(self.tts_calls, [])
        reopened = JobStateStore(self.job).open()
        for entry in reopened.steps[VOICE_SCENES].scenes.values():
            self.assertTrue(entry.get("artifact_take_id"))

    def test_dependency_installer_streams_output_through_callback(self):
        from tools.studio.controller import subprocess_run

        lines = []
        result = subprocess_run(
            [
                sys.executable,
                "-c",
                "import sys; print('[notice] stdout'); print('stderr-line', file=sys.stderr)",
            ],
            on_line=lines.append,
        )

        self.assertEqual(result.returncode, 0)
        self.assertIn("[notice] stdout", lines)
        self.assertIn("stderr-line", lines)
        self.assertIn("[notice] stdout", result.stdout)

    def test_install_command_uses_the_running_interpreter(self):
        import sys

        command = self._controller().preflight().install_command()
        self.assertEqual(command[0], sys.executable)
        self.assertIn("requirements-local.txt", command[-1])

    def test_dependency_install_is_never_silent(self):
        controller = self._controller()
        self.assertIsInstance(controller.dependencies_missing(), str)

    def test_ui_copy_has_no_english_operational_strings(self):
        from tools.studio import messages_vi

        forbidden = ("Render", "Preview", "Done", "Failed", "Video package", "All files", "Stop server")
        offenders = []
        for name in dir(messages_vi):
            if name.startswith("_"):
                continue
            value = getattr(messages_vi, name)
            if isinstance(value, str) and any(word in value for word in forbidden):
                offenders.append((name, value))
        self.assertEqual(offenders, [])

    def _archive(self, marker: str) -> Path:
        # same file name in different folders -> same job slug, different package
        archive = self.root / marker / "zodiac-multi.zip"
        archive.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive, "w") as handle:
            for path in sorted(Path(self.job).rglob("*")):
                if path.is_file() and ".runtime" not in path.parts and "out" not in path.parts:
                    handle.write(path, f"zodiac-multi/{path.relative_to(self.job).as_posix()}")
            handle.writestr(f"zodiac-multi/.marker-{marker}", marker)
        return archive


if __name__ == "__main__":
    unittest.main()