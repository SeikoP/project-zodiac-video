"""Runtime smoke tests for the Textual control plane."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.tui.app import ZodiacTui
from tools.tui.file_picker import FilteredDirectoryTree


class FilePickerRegressionTests(unittest.TestCase):
    def test_filtered_tree_accepts_textual_widget_kwargs(self):
        with tempfile.TemporaryDirectory() as temp:
            tree = FilteredDirectoryTree(Path(temp), suffixes=(".zip",), id="picker-tree")
        self.assertEqual(tree.id, "picker-tree")


class VoiceCatalogTests(unittest.TestCase):
    def test_saved_voices_are_loaded_for_dropdown(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "voices.json"
            path.write_text(
                '{"presets":{"Hải Đăng":{},"cuongdepzai":{}}}',
                encoding="utf-8",
            )
            voices = saved_voices(path)
        self.assertEqual(voices, ["Hải Đăng", "cuongdepzai"])
        self.assertEqual(preferred_voice(voices), "cuongdepzai")


class TuiMountSmokeTests(unittest.IsolatedAsyncioTestCase):
    async def test_tui_mounts_at_desktop_size(self):
        app = ZodiacTui()
        async with app.run_test(size=(132, 46)):
            table = app.query_one("#pipeline-table")
            self.assertEqual(table.row_count, 6)
            self.assertEqual(app.query_one("#voice-select").value, preferred_voice(app.voice_choices))

    async def test_tui_switches_to_narrow_layout_class(self):
        app = ZodiacTui()
        async with app.run_test(size=(72, 44)) as pilot:
            await pilot.pause()
            self.assertTrue(app.screen.has_class("narrow"))
            self.assertTrue(app.screen.has_class("tiny"))


if __name__ == "__main__":
    unittest.main()
