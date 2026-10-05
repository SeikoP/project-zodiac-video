"""RED tests for the pipeline worker: resume, per-scene voice checkpoints, cancel, cache."""

import contextlib
import json
import tempfile
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

    def fake_concat(self, package_root, production):
        write_pcm(Path(package_root) / "voice.wav", seconds=0.5)
        return Path(package_root) / "voice.wav"

    def fake_align(
        self,
        production,
        durations,
        aligner,
        scene_wavs=None,
        mismatch_recovery=None,
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

    def fake_write_timing(self, package_root, timing):
        (Path(package_root) / ".runtime").mkdir(parents=True, exist_ok=True)
        (Path(package_root) / ".runtime" / "timing.json").write_text(json.dumps(timing), encoding="utf-8")
        return timing

    def fake_validate_runtime(self, package_root):
        if not (Path(package_root) / ".runtime" / "timing.json").is_file():
            raise RuntimeError("timing.json is missing")

    def fake_prepare(self, package_root, **kwargs):
        self.render_calls.append("prepare")

    def fake_render(self, package_root):
        self.render_calls.append("render")
        if self.fail_render:
            raise RuntimeError("remotion failed")

    def fake_mix(self, package_root):
        self.render_calls.append("mix")

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

    def test_deleted_scene_wav_is_regenerated_on_resume(self):
        self.make_worker().run_to_completion()
        (self.job / ".runtime" / "tts-scenes" / "S02.wav").unlink()
        self.tts_calls.clear()
        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())
        self.assertEqual(self.tts_calls, [["S02"]])

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

    def test_backend_or_precision_change_invalidates_cached_wavs(self):
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
        worker.run_from(VOICE_SCENES)
        self.assertEqual(self.tts_calls, [["S01", "S02", "S03", "S04"]])


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

    def test_alignment_mismatch_uses_an_actionable_error_code(self):
        self.fail_align = True
        self.make_worker().run_to_completion()
        failure = next(payload for kind, payload in self.events if kind == STEP_FAILED)
        self.assertEqual(failure["error_code"], "ALIGNMENT_MISMATCH")
        self.assertTrue(failure["message"])
        self.assertNotIn("exit code 2", failure["message"])


class RenderResumeTests(WorkerHarness):
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
        self.assertEqual(plan.status("MIX_MUSIC"), PENDING)


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
            ["python", "-c", "import time; time.sleep(30)"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        worker.attach_process(process)
        worker.request_cancel()
        self.assertTrue(process.wait(timeout=20) != 0 or process.poll() is not None)


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

    def test_controller_restarts_at_voice_when_worker_invalidates_legacy_tts_cache(self):
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

        self.assertEqual(self.tts_calls, [["S01", "S02", "S03", "S04"]])

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