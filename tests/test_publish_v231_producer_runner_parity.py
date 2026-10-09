"""Producer v2.3.1 -> runner publish contract: source-preserving, no fake media QA."""
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from tools.studio_qt.publish_copy import publish_text_for_job
from tools.studio_v2.executor import _default_output_handler


class PublishV231ParityTests(unittest.TestCase):
    def test_approved_metadata_is_copied_without_mutation(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "publish").mkdir()
            metadata = {
                "format": "zodiac-publish@1",
                "title": "Bọ Cạp: muốn được quan tâm nhưng lại tỏ ra bất cần",
                "cover": {"hook": "MUỐN ĐƯỢC DỖ, CỨ CHỐI!", "layout": "tilted_top_hook"},
                "caption": "Bọ Cạp bảo không sao. Có thật không?",
                "hashtags": ["#BoCap", "#TinhCachBoCap", "#KhoMoLong", "#12CungHoangDao", "#bungmoto"],
                "source": {"narration": "narration.txt", "production": "production.ir.json"},
            }
            src = root / "publish" / "publish.json"
            src.write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
            copy = root / "publish" / "publish-copy.txt"
            copy.write_text(
                "COVER IDENTITY: BỌ CẠP\nHOOK: MUỐN ĐƯỢC DỖ, CỨ CHỐI!\n"
                "TIKTOK CAPTION: Bọ Cạp bảo không sao. Có thật không?\n"
                "HASHTAGS: #BoCap #TinhCachBoCap #KhoMoLong #12CungHoangDao #bungmoto\n"
                "TITLE: Bọ Cạp: muốn được quan tâm nhưng lại tỏ ra bất cần\n",
                encoding="utf-8",
            )
            video = root / "final.mp4"
            video.write_bytes(b"test-only—not a real video")
            target = root / "out" / "zodiac-story.mp4"

            def cover_stub(args, **kwargs):
                self.assertEqual(kwargs["stage"], "OUTPUT")
                Path(args[-1]).write_bytes(b"test-only-cover")
            with patch("tools.studio_v2.executor.run_structured_command", side_effect=cover_stub):
                _default_output_handler(root, video, target)

            self.assertEqual(json.loads((root / "out" / "publish.json").read_text(encoding="utf-8")), metadata)
            self.assertEqual((root / "out" / "publish-copy.txt").read_text(encoding="utf-8"), copy.read_text(encoding="utf-8"))
            self.assertEqual((root / "out" / "cover.png").read_bytes(), b"test-only-cover")
            clipboard = publish_text_for_job(root)
            self.assertIn(metadata["caption"], clipboard)
            for tag in metadata["hashtags"]:
                self.assertIn(tag, clipboard)
            self.assertNotIn("COVER IDENTITY:", clipboard)
            self.assertNotIn("TIKTOK CAPTION:", clipboard)
            self.assertNotIn("TITLE:", clipboard)

    def test_legacy_metadata_without_optional_seo_title_still_copies(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            out = root / "out"
            out.mkdir()
            (out / "publish.json").write_text(
                json.dumps({"caption": "Nội dung cũ", "hashtags": ["#BoCap", "#bungmoto"]}),
                encoding="utf-8",
            )
            self.assertEqual(publish_text_for_job(root), "Nội dung cũ\n\n#BoCap #bungmoto")


if __name__ == "__main__":
    unittest.main()
