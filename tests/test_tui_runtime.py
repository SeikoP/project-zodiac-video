"""Runtime smoke tests for the Textual control plane."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from textual import events

from tools.studio.voice_catalog import preferred_voice, saved_voices
from tools.tui.app import SelectableLog, ZodiacTui
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
            self.assertEqual(table.row_count, 5)
            self.assertEqual(app.query_one("#voice-select").value, preferred_voice(app.voice_choices))
            self.assertEqual(app.query_one("#run-full").label, "Chạy toàn bộ")
            self.assertFalse(app.query("#studio"))
            self.assertFalse(app.query("#prepare-studio"))
            self.assertFalse(app.query("#final-render"))

    async def test_tui_switches_to_narrow_layout_class(self):
        app = ZodiacTui()
        async with app.run_test(size=(72, 44)) as pilot:
            await pilot.pause()
            self.assertTrue(app.screen.has_class("narrow"))
            self.assertTrue(app.screen.has_class("tiny"))


class FullRunWorkflowTests(unittest.TestCase):
    def test_run_full_uses_unbounded_pipeline_target(self):
        app = ZodiacTui()
        app.controller.job = Path("job")
        calls = []
        app._start_pipeline = lambda **kwargs: calls.append(kwargs)  # type: ignore[method-assign]

        app.action_run_full()

        self.assertEqual(calls, [{"rerun": None}])


class LogSelectionTests(unittest.IsolatedAsyncioTestCase):
    def _drag(self, app, sx, sy, ex, ey):
        screen = app.screen
        screen._forward_event(
            events.MouseDown(x=sx, y=sy, screen_x=sx, screen_y=sy, widget=None, delta_x=0, delta_y=0, button=0, shift=False, meta=False, ctrl=False)
        )
        screen._forward_event(
            events.MouseMove(x=ex, y=ey, screen_x=ex, screen_y=ey, widget=None, delta_x=ex - sx, delta_y=ey - sy, button=0, shift=False, meta=False, ctrl=False)
        )
        screen._forward_event(
            events.MouseUp(x=ex, y=ey, screen_x=ex, screen_y=ey, widget=None, delta_x=0, delta_y=0, button=0, shift=False, meta=False, ctrl=False)
        )

    async def test_drag_select_copies_on_release(self):
        app = ZodiacTui()
        async with app.run_test(size=(132, 46)) as pilot:
            log = app.query_one("#log", SelectableLog)
            log.write("alpha alpha alpha")
            log.write("bbbbbbbbbb")
            await pilot.pause()

            region = app.screen.find_widget(log).region
            self._drag(app, region.x + 3, region.y, region.x + 8, region.y + 1)
            await pilot.pause()

            self.assertEqual(app._clipboard, "ha alpha alpha\nbbbbbbbb")
            self.assertIsNone(log._select_anchor)

    async def test_click_without_drag_clears_and_does_not_copy(self):
        app = ZodiacTui()
        async with app.run_test(size=(132, 46)) as pilot:
            log = app.query_one("#log", SelectableLog)
            log.write("alpha alpha alpha")
            log.write("bbbbbbbbbb")
            await pilot.pause()

            region = app.screen.find_widget(log).region
            app._clipboard = ""
            self._drag(app, region.x + 3, region.y, region.x + 8, region.y + 1)
            await pilot.pause()
            self.assertEqual(app._clipboard, "ha alpha alpha\nbbbbbbbb")

            self._drag(app, region.x + 1, region.y + 1, region.x + 1, region.y + 1)
            await pilot.pause()
            self.assertEqual(app._clipboard, "ha alpha alpha\nbbbbbbbb")
            self.assertIsNone(log._select_anchor)

    async def test_selection_highlight_renders_without_error(self):
        app = ZodiacTui()
        async with app.run_test(size=(132, 46)) as pilot:
            log = app.query_one("#log", SelectableLog)
            log.write("alpha alpha alpha")
            log.write("bbbbbbbbbb")
            await pilot.pause()

            log._select_anchor = (0, 3)
            log._select_end = (1, 8)
            line0 = log.render_line(0).text
            line1 = log.render_line(1).text
            self.assertTrue(line0.startswith("alpha alpha alpha"))
            self.assertTrue(line1.startswith("bbbbbbbbbb"))


if __name__ == "__main__":
    unittest.main()
