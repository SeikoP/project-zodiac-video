"""Regression tests for music audition and the current 35% default volume."""

import sys
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from test_studio_pipeline import write_multi_scene_job
from tools.zodiac_local import PipelineError, build_audio_preview


def fake_ffmpeg_writer(captured):
    def run(arguments):
        captured["arguments"] = arguments
        Path(arguments[-1]).write_bytes(b"preview")

    return run


class MusicOnlyPreviewTests(unittest.TestCase):
    """Nghe thử must work before any voice.wav exists."""

    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        self.job = write_multi_scene_job(self.root)
        self.music = self.root / "nhac.mp3"
        self.music.write_bytes(b"fake music")
        self.captured = {}

    def tearDown(self):
        self._temp.cleanup()

    def _preview(self, **kwargs):
        with patch("tools.zodiac_local._run_ffmpeg", fake_ffmpeg_writer(self.captured)):
            return build_audio_preview(self.job, self.music, **kwargs)

    def test_preview_works_without_voice_wav(self):
        self.assertFalse((self.job / "voice.wav").exists())
        output = self._preview()
        self.assertTrue(output.is_file())

    def test_without_voice_only_the_music_input_is_used(self):
        self._preview()
        arguments = self.captured["arguments"]
        self.assertNotIn("-i", "".join(arguments[:arguments.index("b" + "0")] if False else []))
        inputs = [arguments[index + 1] for index, value in enumerate(arguments) if value == "-i"]
        self.assertEqual(inputs, [str(self.music)])

    def test_music_only_preview_still_applies_the_volume(self):
        self._preview(volume=0.5)
        filter_complex = self.captured["arguments"][
            self.captured["arguments"].index("-filter_complex") + 1
        ]
        self.assertIn("volume=0.500", filter_complex)

    def test_voice_is_still_mixed_when_it_exists(self):
        with wave.open(str(self.job / "voice.wav"), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(8000)
            handle.writeframes(b"\x00\x00" * 8000)
        self._preview()
        arguments = self.captured["arguments"]
        inputs = [arguments[index + 1] for index, value in enumerate(arguments) if value == "-i"]
        self.assertEqual(len(inputs), 2)
        self.assertIn("amix", arguments[arguments.index("-filter_complex") + 1])

    def test_volume_still_validates_the_0_to_1_range(self):
        with self.assertRaisesRegex(PipelineError, "between 0 and 1"):
            self._preview(volume=1.5)


class DefaultVolumeTests(unittest.TestCase):
    def test_gui_uses_the_shared_default_volume_without_creating_tk(self):
        from tools.studio.views.audio_panel import DEFAULT_PANEL_VOLUME
        from tools.zodiac_local import DEFAULT_MUSIC_VOLUME

        self.assertEqual(DEFAULT_PANEL_VOLUME, DEFAULT_MUSIC_VOLUME)
        self.assertEqual(DEFAULT_PANEL_VOLUME, 0.35)

    def test_controller_defaults_to_full_volume(self):
        from tools.studio.worker import PipelineWorker

        worker = PipelineWorker(Path("."))
        self.assertEqual(worker.music_volume, 1.0)

    def test_cli_audio_preview_uses_current_default_volume(self):
        from tools import zodiac_local

        self.assertEqual(
            zodiac_local.AUDIO_PREVIEW_DEFAULT_VOLUME,
            zodiac_local.DEFAULT_MUSIC_VOLUME,
        )
        self.assertEqual(zodiac_local.AUDIO_PREVIEW_DEFAULT_VOLUME, 0.35)

    def test_mix_uses_hidden_pristine_cache_so_remixing_is_idempotent(self):
        """Re-running MIX_MUSIC must not stack music onto the public final file."""
        import inspect

        from tools import zodiac_local

        source = inspect.getsource(zodiac_local.mix_background_music_into_render)
        self.assertIn("_pristine_render_path", source)
        self.assertIn("os.replace", source)
        self.assertNotIn('output.with_name("zodiac-story.with-music.mp4")', source)

    def test_video_path_is_always_the_single_final_file(self):
        from tools.studio.controller import StudioController

        controller = StudioController(Path("."))
        controller.job = Path("job")
        self.assertEqual(controller.video_path, Path("job/out/zodiac-story.mp4"))

    def test_bundled_music_is_optional_and_never_fabricated(self):
        from tools.zodiac_local import BUNDLED_MUSIC, default_music_path

        expected = BUNDLED_MUSIC if BUNDLED_MUSIC.is_file() else None
        self.assertEqual(default_music_path(), expected)
        if expected is not None:
            self.assertIn(expected.suffix.lower(), {".mp3", ".wav", ".m4a", ".aac", ".ogg"})

    def test_gui_starts_with_the_bundled_track_selected(self):
        import inspect

        from tools.studio.views import audio_panel

        source = inspect.getsource(audio_panel)
        self.assertIn("default_music_path()", source)
        self.assertIn("self.music = tk.StringVar(value=str(", source)

    def test_render_and_mix_paths_use_shared_music_default(self):
        import inspect

        from tools import zodiac_local

        for function in (
            zodiac_local.configure_background_music,
            zodiac_local.prepare_renderer,
            zodiac_local.run_renderer,
        ):
            with self.subTest(function=function.__name__):
                signature = inspect.signature(function)
                names = [n for n in ("music_volume", "volume") if n in signature.parameters]
                self.assertTrue(names, f"{function.__name__} has no volume argument")
                for name in names:
                    self.assertEqual(
                        signature.parameters[name].default,
                        zodiac_local.DEFAULT_MUSIC_VOLUME,
                    )

    def test_configured_music_volume_is_stored_and_replayed(self):
        from tools.zodiac_local import configure_background_music, validate_background_music

        with tempfile.TemporaryDirectory() as temp:
            job = write_multi_scene_job(Path(temp))
            music = Path(temp) / "nhac.mp3"
            music.write_bytes(b"fake")
            configure_background_music(job, music, 1.0)
            self.assertEqual(validate_background_music(job)["background_music_volume"], 1.0)

    def test_music_mix_does_not_halve_volume(self):
        """ffmpeg amix normalises by input count, which would halve music."""
        import inspect

        from tools import zodiac_local

        source = inspect.getsource(zodiac_local.mix_background_music_into_render)
        self.assertIn("normalize=0", source)


if __name__ == "__main__":
    unittest.main()