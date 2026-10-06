"""RED tests for the faster-whisper root cause, preflight and job state."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_zodiac_local import package_files, write_package
from tools.studio.job_state import JobStateStore
from tools.studio.pipeline import (
    PipelinePlan,
    STEP_ORDER,
    IMPORT_PACKAGE,
    PREFLIGHT,
    VOICE_SCENES,
    CONCAT_VOICE,
    ALIGN_TIMING,
    VALIDATE_RUNTIME,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    MIX_MUSIC,
    PACKAGE_PUBLISH,
)
from tools.studio.preflight import PreflightChecker


class AlignerDependencyTests(unittest.TestCase):
    """Root cause: the aligner was only imported after every scene WAV existed."""

    def test_missing_faster_whisper_is_reported_before_any_tts_call(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            tts_calls = []

            with patch.dict(sys.modules, {"faster_whisper": None}), patch(
                "tools.zodiac_local.run_tts_batch",
                side_effect=lambda *a, **k: tts_calls.append(a),
            ):
                from tools.zodiac_local import synthesize_voice

                with self.assertRaisesRegex(Exception, "faster-whisper") as caught:
                    synthesize_voice(job, tts_root=Path(temp) / "no-tts")

            self.assertEqual(tts_calls, [], "TTS must not run before the dependency check")
            self.assertIn(f'"{sys.executable}"', str(caught.exception))

    def test_requirement_check_reports_the_running_interpreter(self):
        from tools.zodiac_local import require_word_aligner_installed

        with patch.dict(sys.modules, {"faster_whisper": None}):
            with self.assertRaisesRegex(Exception, sys.executable.replace("\\", "\\\\")):
                require_word_aligner_installed()

    def test_requirement_check_passes_when_importable(self):
        from tools.zodiac_local import require_word_aligner_installed

        with patch.dict(sys.modules, {"faster_whisper": object()}):
            require_word_aligner_installed()


class PreflightTests(unittest.TestCase):
    def _checker(self, **kwargs):
        return PreflightChecker(package_root=kwargs.pop("package_root", None), **kwargs)

    def test_reports_every_requirement_with_a_stable_code(self):
        checks = self._checker().run()
        codes = {check.code for check in checks}
        self.assertLessEqual({"FASTER_WHISPER", "NODE", "NPM", "FFMPEG", "PYTHON"}, codes)
        self.assertIn("VIENEU", codes)
        self.assertIn("PACKAGE", codes)
        for check in checks:
            self.assertTrue(check.ok or check.error_code)

    def test_missing_faster_whisper_uses_dependency_missing(self):
        checks = self._checker().run()
        faster = next(check for check in checks if check.code == "FASTER_WHISPER")
        if not faster.ok:
            self.assertEqual(faster.error_code, "DEPENDENCY_MISSING")
            self.assertIn("faster-whisper", faster.message)

    def test_missing_tools_have_distinct_codes(self):
        with patch("tools.studio.preflight.shutil.which", return_value=None):
            codes = {check.code: check.error_code for check in self._checker().run()}
        self.assertEqual(codes["NODE"], "NODE_MISSING")
        self.assertEqual(codes["NPM"], "NPM_MISSING")
        self.assertEqual(codes["FFMPEG"], "FFMPEG_MISSING")

    def test_install_command_targets_a_file_that_exists(self):
        command = self._checker().install_command()
        self.assertTrue(Path(command[-1]).is_file(), command[-1])

    def test_missing_requirements_file_is_reported_not_installed(self):
        from tools.zodiac_local import PipelineError

        with patch("tools.studio.preflight.REQUIREMENTS", Path("nope/requirements-local.txt")):
            with self.assertRaisesRegex(PipelineError, "requirements-local.txt"):
                self._checker().install_command()

    def test_install_command_uses_the_running_interpreter(self):
        command = self._checker().install_command()
        self.assertEqual(command[:4], [sys.executable, "-m", "pip", "install"])
        self.assertEqual(command[4], "-r")
        self.assertTrue(command[5].endswith("requirements-local.txt"))
        self.assertNotIn("pip", command[:1])

    def test_vieneu_missing_does_not_hide_dependency_problems(self):
        checks = PreflightChecker(tts_root=Path("nowhere")).run()
        vieneu = next(check for check in checks if check.code == "VIENEU")
        self.assertFalse(vieneu.ok)
        self.assertEqual(vieneu.error_code, "VIENEU_UNAVAILABLE")
        self.assertTrue(any(check.code == "FASTER_WHISPER" for check in checks))

    def test_valid_package_passes_the_package_check(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            check = next(
                item for item in PreflightChecker(package_root=job).run() if item.code == "PACKAGE"
            )
            self.assertTrue(check.ok, check.message)

    def test_installed_dependency_turns_preflight_ready(self):
        checker = self._checker()
        with patch.object(PreflightChecker, "_module_available", return_value=False):
            failing = next(item for item in checker.run() if item.code == "FASTER_WHISPER")
        self.assertFalse(failing.ok)
        with patch.object(PreflightChecker, "_module_available", return_value=True):
            passing = next(item for item in checker.run() if item.code == "FASTER_WHISPER")
        self.assertTrue(passing.ok)
        self.assertIsNone(passing.error_code)

    def test_faster_whisper_check_uses_the_running_interpreter(self):
        check = next(item for item in self._checker().run() if item.code == "FASTER_WHISPER")
        self.assertEqual(check.details, sys.executable)


class JobStateTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        self.job = write_package(self.root)
        self.plan = PipelinePlan(job="zodiac-test")
        self.plan.mark(IMPORT_PACKAGE, "DONE", fingerprint="abc")
        self.plan.mark(VOICE_SCENES, "FAILED", error_code="VOICE_SCENE_FAILED", message="lỗi")
        self.store = JobStateStore(self.job)

    def tearDown(self):
        self._temp.cleanup()

    def test_save_and_load_round_trip(self):
        self.store.save(self.plan)
        loaded = self.store.load()
        self.assertEqual(loaded["version"], 2)
        self.assertEqual(loaded["job"], "zodiac-test")
        self.assertEqual(loaded["steps"][IMPORT_PACKAGE]["status"], "DONE")
        self.assertEqual(loaded["steps"][IMPORT_PACKAGE]["fingerprint"], "abc")
        self.assertEqual(loaded["steps"][VOICE_SCENES]["error_code"], "VOICE_SCENE_FAILED")

    def test_write_is_atomic_and_leaves_no_temp_files(self):
        self.store.save(self.plan)
        self.store.save(self.plan)
        self.assertEqual(list((self.job / ".runtime").glob("pipeline-state.json*")), [
            self.job / ".runtime" / "pipeline-state.json"
        ])
        json.loads((self.job / ".runtime" / "pipeline-state.json").read_text(encoding="utf-8"))

    def test_corrupt_state_is_not_fatal(self):
        path = self.job / ".runtime" / "pipeline-state.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{ broken", encoding="utf-8")
        self.assertIsNone(self.store.load())

    def test_version_mismatch_is_ignored(self):
        path = self.job / ".runtime" / "pipeline-state.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"version": 99, "steps": {}}), encoding="utf-8")
        self.assertIsNone(self.store.load())

    def test_running_step_is_recovered_conservatively(self):
        self.plan.mark(ALIGN_TIMING, "RUNNING")
        recovered = self.store.recover(self.plan)["steps"]
        self.assertEqual(recovered[ALIGN_TIMING]["status"], "PENDING")
        self.assertEqual(recovered[IMPORT_PACKAGE]["status"], "DONE")

    def test_scene_checkpoints_survive_reload(self):
        self.plan.set_scene_state(VOICE_SCENES, "S01", "DONE", text_hash="t1", file_hash="f1")
        self.plan.set_scene_state(VOICE_SCENES, "S02", "FAILED")
        self.store.save(self.plan)
        loaded = JobStateStore(self.job).load()
        scenes = loaded["steps"][VOICE_SCENES]["scenes"]
        self.assertEqual(scenes["S01"]["status"], "DONE")
        self.assertEqual(scenes["S01"]["text_hash"], "t1")
        self.assertEqual(scenes["S02"]["status"], "FAILED")

    def test_legacy_job_without_state_migrates_without_inventing_provenance(self):
        from tools.studio.job_state import migrate_legacy_job

        migrated = migrate_legacy_job(self.job)
        self.assertEqual(migrated[IMPORT_PACKAGE]["status"], "DONE")
        self.assertEqual(migrated[VOICE_SCENES]["status"], "PENDING")
        self.assertNotIn("scenes", migrated[VOICE_SCENES])

    def test_legacy_job_with_valid_runtime_marks_voice_chain_done(self):
        from test_zodiac_local import valid_timing
        from tools.studio.job_state import migrate_legacy_job

        with wave_written(self.job / "voice.wav"), wave_written(
            self.job / ".runtime" / "tts-scenes" / "S01.wav"
        ):
            (self.job / ".runtime" / "timing.json").write_text(
                json.dumps(valid_timing()), encoding="utf-8"
            )
            migrated = migrate_legacy_job(self.job)
        self.assertEqual(migrated[VOICE_SCENES]["status"], "DONE")
        self.assertEqual(migrated[CONCAT_VOICE]["status"], "DONE")
        self.assertEqual(migrated[ALIGN_TIMING]["status"], "DONE")
        self.assertEqual(migrated[PREPARE_RENDERER]["status"], "PENDING")

    def test_legacy_job_with_broken_timing_stays_pending(self):
        from tools.studio.job_state import migrate_legacy_job

        with wave_written(self.job / "voice.wav"):
            (self.job / ".runtime").mkdir(parents=True, exist_ok=True)
            (self.job / ".runtime" / "timing.json").write_text(
                json.dumps({"fps": 30, "scenes": []}), encoding="utf-8"
            )
            migrated = migrate_legacy_job(self.job)
        self.assertEqual(migrated[ALIGN_TIMING]["status"], "PENDING")


class wave_written:
    def __init__(self, path: Path):
        self.path = path

    def __enter__(self):
        import wave

        self.path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(self.path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(8000)
            wav.writeframes(b"\x00\x00" * 8000)
        return self.path

    def __exit__(self, *args):
        return False


class PipelinePlanTests(unittest.TestCase):
    def test_canonical_step_order(self):
        self.assertEqual(
            STEP_ORDER,
            (
                IMPORT_PACKAGE,
                PREFLIGHT,
                VOICE_SCENES,
                CONCAT_VOICE,
                ALIGN_TIMING,
                VALIDATE_RUNTIME,
                PREPARE_RENDERER,
                RENDER_VIDEO,
                MIX_MUSIC,
                PACKAGE_PUBLISH,
            ),
        )

    def test_next_step_is_the_first_not_done(self):
        plan = PipelinePlan(job="j")
        self.assertEqual(plan.next_step(), IMPORT_PACKAGE)
        plan.mark(IMPORT_PACKAGE, "DONE")
        self.assertEqual(plan.next_step(), PREFLIGHT)

    def test_continue_retries_failed_step_before_downstream(self):
        plan = PipelinePlan(job="j")
        plan.mark(IMPORT_PACKAGE, "DONE")
        plan.mark(PREFLIGHT, "DONE")
        plan.mark(VOICE_SCENES, "FAILED")
        self.assertEqual(plan.continue_from(), VOICE_SCENES)

    def test_finished_plan_has_nothing_to_continue(self):
        plan = PipelinePlan(job="j")
        for step in STEP_ORDER:
            plan.mark(step, "DONE")
        self.assertIsNone(plan.continue_from())
        self.assertFalse(plan.can_resume)

    def test_rerun_invalidates_downstream_only(self):
        plan = PipelinePlan(job="j")
        for step in STEP_ORDER:
            plan.mark(step, "DONE")
        plan.invalidate_from(VOICE_SCENES)
        self.assertEqual(plan.status(VOICE_SCENES), "PENDING")
        self.assertEqual(plan.status(ALIGN_TIMING), "PENDING")
        self.assertEqual(plan.status(PREPARE_RENDERER), "PENDING")

    def test_transform_edit_keeps_voice_and_timing(self):
        plan = PipelinePlan(job="j")
        for step in STEP_ORDER:
            plan.mark(step, "DONE")
        plan.apply_change("transform")
        self.assertEqual(plan.status(VOICE_SCENES), "DONE")
        self.assertEqual(plan.status(ALIGN_TIMING), "DONE")
        self.assertEqual(plan.status(RENDER_VIDEO), "PENDING")
        self.assertEqual(plan.status(MIX_MUSIC), "PENDING")
        self.assertEqual(plan.status(PACKAGE_PUBLISH), "PENDING")

    def test_music_edit_only_invalidates_the_mix(self):
        plan = PipelinePlan(job="j")
        for step in STEP_ORDER:
            plan.mark(step, "DONE")
        plan.apply_change("music")
        self.assertEqual(plan.status(RENDER_VIDEO), "DONE")
        self.assertEqual(plan.status(MIX_MUSIC), "PENDING")
        self.assertEqual(plan.status(PACKAGE_PUBLISH), "PENDING")

    def test_voice_change_invalidates_the_whole_voice_chain(self):
        plan = PipelinePlan(job="j")
        for step in STEP_ORDER:
            plan.mark(step, "DONE")
        plan.apply_change("voice")
        for step in (VOICE_SCENES, CONCAT_VOICE, ALIGN_TIMING, RENDER_VIDEO):
            self.assertEqual(plan.status(step), "PENDING")

    def test_narration_change_invalidates_only_changed_scenes(self):
        plan = PipelinePlan(job="j")
        plan.mark(VOICE_SCENES, "DONE")
        plan.set_scene_state(VOICE_SCENES, "S01", "DONE", text_hash="a")
        plan.set_scene_state(VOICE_SCENES, "S02", "DONE", text_hash="b")
        plan.apply_change("narration", changed_scenes=["S02"])
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S01"), "DONE")
        self.assertEqual(plan.scene_status(VOICE_SCENES, "S02"), "PENDING")

    def test_plan_serialises_vietnamese_labels(self):
        from tools.studio.messages_vi import STEP_NAMES_VI

        plan = PipelinePlan(job="j")
        payload = plan.to_dict()
        self.assertEqual(payload["job"], "j")
        self.assertEqual(payload["version"], 2)
        self.assertEqual(set(payload["steps"]), set(STEP_ORDER))
        for step in STEP_ORDER:
            self.assertTrue(STEP_NAMES_VI[step])
            self.assertNotEqual(STEP_NAMES_VI[step], step)


if __name__ == "__main__":
    unittest.main()