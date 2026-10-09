"""E2E-style progress tests using Remotion 4.0.530's actual CLI row grammar.

No renderer package or browser is needed to prove decoding and Qt wiring.
The real pinned CLI/renderer smoke remains a separate CI job.
"""
import sys
import unittest
from unittest.mock import patch

from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.progress import (
    FrameScope, RemotionFrameParser, observe_frame_progress,
    track_render_segment_frames,
)
from tools.studio_v2.runner import (
    observe_structured_command_output, run_structured_command,
)


class RenderFrameParserTests(unittest.TestCase):
    def test_exact_pinned_rendering_and_encoding_rows(self):
        seen = []
        p = RemotionFrameParser(FrameScope("seg01", 120, lambda *args: seen.append(args)))
        with patch("tools.studio_v2.progress.time.monotonic", side_effect=[1, 2, 3, 4]):
            p.feed("Rendering frames      [#####] 20/120\r")
            p.feed("\x1b[1A\x1b[2KRendering frames [########] 120/120\r")
            p.feed("Encoding video [=] 30/120\r")
            p.feed("Encoded video [######] 120/120\n")
        self.assertEqual(seen, [
            ("seg01", 20, 120, "rendering"),
            ("seg01", 120, 120, "rendering"),
            ("seg01", 30, 120, "encoding"),
            ("seg01", 120, 120, "encoding"),
        ])

    def test_actual_non_interactive_remotion_cli_counters(self):
        """Captured from real renderer 2.0.1 smoke (Remotion CLI 4.0.530)."""
        seen = []
        parser = RemotionFrameParser(FrameScope("seg01", 12, lambda *args: seen.append(args)))
        parser.feed("Rendered 0/12\nRendered 1/12, time remaining: 3s\n")
        parser.feed("Rendered 12/12\nEncoded 10/12\nEncoded 12/12\n")
        self.assertIn(("seg01", 12, 12, "rendering"), seen)
        self.assertIn(("seg01", 12, 12, "encoding"), seen)
        self.assertTrue(RemotionFrameParser.is_terminal_progress_line("Rendered 12/12"))
        self.assertTrue(RemotionFrameParser.is_terminal_progress_line("Encoded 12/12"))

    def test_chunk_split_and_untrusted_totals_are_rejected(self):
        seen = []
        parser = RemotionFrameParser(FrameScope("seg02", 90, lambda *args: seen.append(args)))
        parser.feed("Rendering frames [##] 10/")
        parser.feed("90\r")
        parser.feed("Rendering frames [####] 82/999\r")
        parser.feed("Rendering frames [####] 95/90\r")
        self.assertEqual(seen, [("seg02", 10, 90, "rendering")])

    def test_ordinary_log_with_fraction_cannot_look_like_frames(self):
        seen = []
        parser = RemotionFrameParser(FrameScope("seg01", 90, lambda *args: seen.append(args)))
        parser.feed("CAPTION_SAFE_ZONE 12/90\nspatial 50/90\n")
        self.assertEqual(seen, [])

    def test_shell_progress_is_throttled_not_spammed_into_qt(self):
        seen = []
        parser = RemotionFrameParser(FrameScope("seg03", 100, lambda *args: seen.append(args)))
        with patch("tools.studio_v2.progress.time.monotonic", return_value=5.0):
            for n in range(1, 101):
                parser.feed(f"Rendering frames [###] {n}/100\r")
        self.assertLess(len(seen), 5)
        self.assertEqual(seen[-1], ("seg03", 100, 100, "rendering"))

    def test_subprocess_streams_cr_updates_and_incomplete_final_line(self):
        frames, logs = [], []
        script = (
            "import sys;"
            "sys.stdout.write('Rendering frames [#####] 15/90\\r');sys.stdout.flush();"
            "sys.stdout.write('Rendering frames [#######] 90/90\\r');sys.stdout.flush();"
            "sys.stdout.write('Encoding video [####] 90/90\\n');sys.stdout.flush();"
            "sys.stderr.write('warning from encoder');sys.stderr.flush()"
        )
        with observe_structured_command_output(lambda *a: logs.append(a)), \
             observe_frame_progress(lambda *a: frames.append(a)), \
             track_render_segment_frames("seg-real", 90):
            result = run_structured_command(
                [sys.executable, "-c", script],
                stage="RENDER", fallback_code="RENDER_FAILED",
            )
        self.assertEqual(result.returncode, 0)
        self.assertIn(("seg-real", 90, 90, "rendering"), frames)
        self.assertIn(("seg-real", 90, 90, "encoding"), frames)
        self.assertIn(("warning from encoder", "stderr", "RENDER"), logs)
        self.assertIn("Encoding video", result.stdout)
        self.assertIn("warning from encoder", result.stderr)

    def test_nonzero_subprocess_preserves_error(self):
        logs = []
        script = "import sys;sys.stderr.write('fatal encode error');sys.exit(2)"
        with observe_structured_command_output(lambda *a: logs.append(a)):
            with self.assertRaises(ControlPlaneError) as err:
                run_structured_command(
                    [sys.executable, "-c", script],
                    stage="RENDER", fallback_code="RENDER_FAILED",
                )
        self.assertEqual(err.exception.code, "RENDER_FAILED")
        self.assertIn("fatal encode error", str(err.exception.detail))
        self.assertTrue(any("fatal encode error" in item[0] for item in logs))


if __name__ == "__main__":
    unittest.main()
