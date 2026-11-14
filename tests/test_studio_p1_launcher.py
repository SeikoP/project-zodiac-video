"""Opt-in Zodiac V5 CLI launches exactly one Tauri window, Qt default unaffected."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import zodiac_qt


class LauncherTests(unittest.TestCase):
    def test_preview_launcher_inherits_current_python_and_source_root(self):
        with tempfile.TemporaryDirectory() as temp:
            executable = Path(temp) / "zodiac-studio-v5.exe"
            executable.write_bytes(b"mock executable")
            with patch.dict(os.environ, {"ZODIAC_STUDIO_V5_EXE": str(executable)}):
                with patch("sys.argv", ["zodiac", "--v5-preview"]):
                    with patch.object(zodiac_qt.subprocess, "run") as run:
                        run.return_value.returncode = 0
                        self.assertEqual(zodiac_qt.main(), 0)
            run.assert_called_once()
            args, kwargs = run.call_args
            self.assertEqual(args[0], [str(executable)])
            self.assertEqual(kwargs["env"]["ZODIAC_STUDIO_PYTHON"], zodiac_qt.sys.executable)
            self.assertTrue(Path(kwargs["env"]["ZODIAC_STUDIO_SOURCE_ROOT"])
                            .joinpath("tools/studio_project/rpc_stdio.py").is_file())
            self.assertFalse(kwargs["check"])
            self.assertNotIn("shell", kwargs)

    def test_missing_binary_fails_closed_no_qt_fallback(self):
        with patch.dict(os.environ, {"ZODIAC_STUDIO_V5_EXE": ""}):
            with patch("sys.argv", ["zodiac", "--v5-preview"]):
                with patch.object(zodiac_qt.subprocess, "run") as run:
                    self.assertEqual(zodiac_qt.main(), 2)
                    run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
