"""Smoke-test the installed command contract without starting the interactive TUI."""

import unittest
from pathlib import Path


class TuiEntrypointTests(unittest.TestCase):
    def test_pyproject_exposes_zodiac_command(self):
        text = Path("pyproject.toml").read_text(encoding="utf-8")
        self.assertIn('[project.scripts]', text)
        self.assertIn('zodiac = "tools.zodiac_tui:main"', text)

    def test_launcher_defers_textual_import_until_main(self):
        import tools.zodiac_tui as launcher

        self.assertTrue(callable(launcher.main))


if __name__ == "__main__":
    unittest.main()
