"""Job@5 publish parity regression: video/cover/copy are one OUTPUT set."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import unittest

from tools.studio_v2.executor import _default_output_handler


class PublishParityTests(unittest.TestCase):
    def test_cover_and_copy_export_with_video(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "publish").mkdir()
            (root / "publish" / "publish.json").write_text(
                json.dumps({"format": "zodiac-publish@1", "cover": {"hook": "TWO SIDES"}}),
                encoding="utf-8",
            )
            (root / "publish" / "publish-copy.txt").write_text("caption text", encoding="utf-8")
            video = root / "final.mp4"
            video.write_bytes(b"mock-video")
            target = root / "out" / "zodiac-story.mp4"

            def fake_cover_command(command, **kwargs):
                self.assertEqual(kwargs["stage"], "OUTPUT")
                self.assertTrue(str(command[-1]).endswith("cover.png"))
                Path(command[-1]).write_bytes(b"mock-cover")

            with patch("tools.studio_v2.executor.run_structured_command", side_effect=fake_cover_command):
                _default_output_handler(root, video, target)
            self.assertEqual(target.read_bytes(), b"mock-video")
            self.assertEqual((target.parent / "cover.png").read_bytes(), b"mock-cover")
            self.assertTrue((target.parent / "publish.json").exists())
            self.assertEqual((target.parent / "publish-copy.txt").read_text(), "caption text")

    def test_legacy_output_without_publish_remains_supported(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            video = root / "final.mp4"
            video.write_bytes(b"mock-video")
            target = root / "out" / "zodiac-story.mp4"
            with patch("tools.studio_v2.executor.run_structured_command") as command:
                _default_output_handler(root, video, target)
            command.assert_not_called()
            self.assertEqual(target.read_bytes(), b"mock-video")
