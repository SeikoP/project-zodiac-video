import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_validation import validate_job5_package_root
from tools.studio.preflight import Check, Job5PreflightChecker

FIXTURE = Path(__file__).parent / "fixtures" / "scorpio-two-versions" / "package"


class Job5PreflightTests(unittest.TestCase):
    def test_local_outputs_are_allowed_only_for_workspace_validation(self):
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp) / "job"
            shutil.copytree(FIXTURE, job)
            (job / ".runtime").mkdir()
            (job / "out").mkdir()
            (job / "voice.wav").write_bytes(b"existing-voice")
            with self.assertRaises(ControlPlaneError):
                validate_job5_package_root(job)
            self.assertTrue(Job5PreflightChecker(job)._package(None).ok)
            (job / "narration.txt").write_text("changed narration", encoding="utf-8")
            result = Job5PreflightChecker(job)._package(None)
            self.assertFalse(result.ok)
            self.assertIn("narration", result.message)
            self.assertIn("nhập lại", result.details)

    def test_dependency_failure_has_install_command_for_current_python(self):
        checker = Job5PreflightChecker(FIXTURE)
        with patch.object(checker, "_module_available", return_value=False), \
             patch.object(checker, "_vieneu", return_value=Check("VIENEU", "VieNeu", True)):
            checks = checker.run()
        whisper = next(check for check in checks if check.code == "FASTER_WHISPER")
        self.assertFalse(whisper.ok)
        self.assertIn("requirements-local.txt", whisper.details)
        self.assertIn("pip", whisper.details)


if __name__ == "__main__":
    unittest.main()
