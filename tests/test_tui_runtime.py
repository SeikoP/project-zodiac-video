"""Runtime smoke tests for the Textual control plane."""

from __future__ import annotations

import tempfile
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from textual import events

from tools.studio.pipeline import DONE, MIX_MUSIC, RENDER_VIDEO
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
        async with app.run_test(size=(132, 46)) as pilot:
            await pilot.pause()
            table = app.query_one("#pipeline-table")
            self.assertEqual(table.row_count, 5)
            self.assertEqual(app.query_one("#voice-select").value, preferred_voice(app.voice_choices))
            self.assertEqual(app.query_one("#run-full").label, "Chạy toàn bộ")
            self.assertFalse(app.query("#studio"))
            self.assertFalse(app.query("#prepare-studio"))
            self.assertFalse(app.query("#final-render"))

            # Regression for the Windows screenshot where one-line Textual
            # buttons rendered as empty colored bars with no visible labels.
            for selector in (
                "#pick-zip",
                "#check",
                "#install-deps",
                "#listen",
                "#clear-music",
                "#rerun-stage",
                "#toggle-log",
                "#open-video",
                "#open-folder",
                "#run-full",
                "#stop",
            ):
                button = app.query_one(selector)
                self.assertGreaterEqual(button.region.height, 3, selector)

            log_section = app.query_one("#log-section")
            self.assertTrue(log_section.has_class("hidden"))
            self.assertFalse(app.log_visible)
            self.assertFalse(app.query_one("#log").markup)

            self.assertEqual(app._command_status(), "Nạp ZIP hoặc chọn job để bắt đầu.")

            # Pipeline console: stages on the left, all run controls on the right.
            self.assertTrue(app.query("#pipeline-left"))
            self.assertTrue(app.query("#pipeline-actions"))
            actions = app.query_one("#pipeline-actions")
            action_ids = [button.id for button in actions.query("Button")]
            self.assertEqual(
                action_ids,
                ["rerun-stage", "toggle-log", "run-full", "stop"],
            )
            self.assertFalse(app.query("#primary-actions"))

            # All right-side actions must fit inside the pipeline console.
            actions_panel = app.query_one("#pipeline-actions")
            for selector in ("#rerun-stage", "#toggle-log", "#run-full", "#stop"):
                button = app.query_one(selector)
                self.assertGreaterEqual(button.region.height, 3, selector)
                self.assertLessEqual(
                    button.region.bottom,
                    actions_panel.region.bottom,
                    f"{selector} is clipped below the action panel",
                )

            # Health lights live at the top of the pipeline console.
            self.assertTrue(app.query("#pipeline-status"))
            self.assertIn("[bold red]●[/]", app._status_light("JOB", "Chưa chọn", ok=False))
            self.assertIn("[bold green]●[/]", app._status_light("ENV", "Sẵn sàng", ok=True))
            self.assertIn("[dim]●[/]", app._status_light("ENV", "Chưa kiểm tra", ok=None))

    async def test_tui_switches_to_narrow_layout_class(self):
        app = ZodiacTui()
        async with app.run_test(size=(72, 44)) as pilot:
            await pilot.pause()
            self.assertTrue(app.screen.has_class("narrow"))
            self.assertTrue(app.screen.has_class("tiny"))


class ListenButtonVisibilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_listen_button_is_not_clipped_at_common_terminal_height(self):
        """Nghe thử used to be cut off silently: Vertical defaults to height:1fr,
        so the sidebar sections split the height and clipped their overflow."""
        app = ZodiacTui()
        async with app.run_test(size=(132, 40)) as pilot:
            await pilot.pause()
            button = app.screen.find_widget(app.query_one("#listen"))
            sidebar = app.screen.find_widget(app.query_one("#sidebar"))
            self.assertGreaterEqual(button.region.y, sidebar.region.y)
            self.assertLessEqual(
                button.region.bottom,
                sidebar.region.bottom,
                "Nghe thử is clipped out of the sidebar; clicks land on nothing",
            )
            self.assertLess(button.region.bottom, 40)


class LogLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_failed_step_logs_code_message_and_details(self):
        app = ZodiacTui()
        async with app.run_test(size=(132, 46)) as pilot:
            app._handle_engine_event(
                "STEP_FAILED",
                {
                    "step": "RENDER_VIDEO",
                    "error_code": "RENDER_FAILED",
                    "message": "Không render được.",
                    "details": "renderer stderr detail",
                },
            )
            await pilot.pause()
            log = app.query_one("#log", SelectableLog)
            text = "\n".join(line.text for line in log.lines)
            self.assertIn("RENDER_FAILED", text)
            self.assertIn("Không render được.", text)
            self.assertIn("renderer stderr detail", text)
            self.assertTrue(app.log_visible)


class NativeAudioPlaybackTests(unittest.TestCase):
    def test_windows_preview_uses_winsound_async(self):
        calls = []
        fake = types.SimpleNamespace(
            SND_FILENAME=1,
            SND_ASYNC=2,
            SND_NODEFAULT=4,
            PlaySound=lambda path, flags: calls.append((path, flags)),
        )
        app = ZodiacTui()
        preview = Path("preview.wav")
        fake_os = types.SimpleNamespace(name="nt")
        with patch("tools.tui.app.os", fake_os), patch.dict(
            sys.modules, {"winsound": fake}
        ):
            app._play_audio_file(preview)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1], 7)


class FullRunWorkflowTests(unittest.TestCase):
    def test_run_full_uses_unbounded_pipeline_target(self):
        app = ZodiacTui()
        app.controller.job = Path("job")
        calls = []
        app._start_pipeline = lambda **kwargs: calls.append(kwargs)  # type: ignore[method-assign]

        app.action_run_full()

        self.assertEqual(calls, [{"rerun": None}])


    def test_run_full_recovers_when_state_is_done_but_video_is_missing(self):
        app = ZodiacTui()
        app.controller.job = Path("job")
        app.controller.plan.mark(RENDER_VIDEO, DONE)
        app.controller.plan.mark(MIX_MUSIC, DONE)
        calls = []
        app._start_pipeline = lambda **kwargs: calls.append(kwargs)  # type: ignore[method-assign]

        self.assertFalse(app._final_complete())
        self.assertTrue(app._final_pipeline_settled())
        app.action_run_full()

        self.assertEqual(calls, [{"rerun": RENDER_VIDEO}])


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
            app._set_log_visible(True)
            await pilot.pause()
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
            app._set_log_visible(True)
            await pilot.pause()
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
            app._set_log_visible(True)
            await pilot.pause()
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
