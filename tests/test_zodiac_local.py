import json
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import wave
from pathlib import Path

from tools.zodiac_local import (
    PipelineError,
    import_package,
    safe_extract_zip,
    build_timing_from_durations,
    concatenate_wavs,
    configure_background_music,
    build_audio_preview,
    validate_package,
    validate_timing,
)


def package_files():
    production = {
        "version": "1.0",
        "video": {"width": 1080, "height": 1920, "fps": 30},
        "visual_system": {"sfx_profiles": {}},
        "primitives": {"paper.bg": {"kind": "svg_elements", "viewBox": "0 0 1 1", "elements": []}},
        "assets": {
            "lead.pose": {"path": "assets/characters/lead.svg", "format": "image/svg+xml"},
            "prop.note": {"path": "assets/props/note.svg", "format": "image/svg+xml"},
        },
        "scenes": [
            {
                "id": "S01",
                "voice": "Xin chào mọi người.",
                "actors": [{"asset": "lead.pose"}],
                "objects": [{"asset": "prop.note"}, {"primitive": "paper.bg"}],
            }
        ],
    }
    renderer_package = {
        "name": "zodiac-remotion-renderer",
        "scripts": {
            "prestudio": "node scripts/generate-sfx.mjs",
            "studio": "remotion studio src/index.ts",
            "render": "node scripts/render.mjs",
            "typecheck": "tsc --noEmit",
        },
        "dependencies": {
            "@remotion/captions": "4.0.530",
            "@remotion/cli": "4.0.530",
            "@remotion/media": "4.0.530",
            "remotion": "4.0.530",
            "react": "19.0.0",
            "react-dom": "19.0.0",
        },
        "devDependencies": {"@types/node": "24.0.0", "@types/react": "19.0.0", "typescript": "5.8.0"},
    }
    return {
        "README.md": "# Video\n\nPLUGIN SIDE COMPLETE — RENDER_READY PACKAGE\n",
        "narration.txt": "Xin chào mọi người.\n",
        "production.json": json.dumps(production, ensure_ascii=False),
        "assets/characters/lead.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
        "assets/props/note.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="8" height="8"/></svg>',
        "renderer/package.json": json.dumps(renderer_package),
        "renderer/src/index.ts": "export {};\n",
        "renderer/src/Root.tsx": "export {};\n",
        "renderer/scripts/render.mjs": "console.log('render');\n",
        "renderer/scripts/generate-sfx.mjs": "console.log('sfx');\n",
    }


def write_zip(path: Path, files, root="zodiac-venus-virgo"):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(f"{root}/{name}", content)


def valid_timing():
    return {
        "fps": 30,
        "total_duration_frames": 30,
        "scenes": [
            {
                "scene_id": "S01",
                "start_frame": 0,
                "duration_frames": 30,
                "captions": [
                    {"text": "Xin chào mọi người.", "startMs": 0, "endMs": 900, "timestampMs": None, "confidence": None}
                ],
            }
        ],
    }


class SafeExtractionTests(unittest.TestCase):
    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive_path = root / "bad.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../outside.txt", "no")
            with self.assertRaisesRegex(PipelineError, "unsafe ZIP path"):
                safe_extract_zip(archive_path, root / "out")
            self.assertFalse((root / "outside.txt").exists())

    def test_rejects_symbolic_link_members(self):
        with tempfile.TemporaryDirectory() as temp:
            archive_path = Path(temp) / "link.zip"
            entry = zipfile.ZipInfo("zodiac/link")
            entry.create_system = 3
            entry.external_attr = (stat.S_IFLNK | 0o777) << 16
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr(entry, "../../outside")
            with self.assertRaisesRegex(PipelineError, "symbolic links"):
                safe_extract_zip(archive_path, Path(temp) / "out")

    def test_imports_and_validates_render_ready_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "video.zip"
            write_zip(archive, package_files())
            imported = import_package(archive, root / "jobs")
            self.assertEqual(imported.name, "zodiac-venus-virgo")
            self.assertTrue((imported / "assets/characters/lead.svg").is_file())
            self.assertEqual(len(validate_package(imported)["scenes"]), 1)

    def test_rejects_carousel_skill_zip_without_video_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "carousel.zip"
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("zodiac-content-pipeline/SKILL.md", "carousel workflow")
                handle.writestr("zodiac-content-pipeline/README.md", "not a video package")
            with self.assertRaisesRegex(PipelineError, "production.json"):
                import_package(archive, root / "jobs")

    def test_rejects_missing_video_specific_object_asset(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = package_files()
            del files["assets/props/note.svg"]
            archive = root / "missing-asset.zip"
            write_zip(archive, files)
            with self.assertRaisesRegex(PipelineError, "assets/props/note.svg"):
                import_package(archive, root / "jobs")

    def test_accepts_available_typescript_patch_version(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = package_files()
            renderer_package = json.loads(files["renderer/package.json"])
            renderer_package["devDependencies"]["typescript"] = "5.8.2"
            files["renderer/package.json"] = json.dumps(renderer_package)
            archive = root / "typescript-patch.zip"
            write_zip(archive, files)
            imported = import_package(archive, root / "jobs")
            self.assertEqual(validate_package(imported)["video"]["fps"], 30)


class RuntimeTimingTests(unittest.TestCase):
    def test_builds_continuous_timing_from_measured_scene_durations(self):
        production = json.loads(package_files()["production.json"])
        timing = build_timing_from_durations(production, {"S01": 0.5})
        self.assertEqual(timing["total_duration_frames"], 15)
        self.assertEqual(timing["scenes"][0]["start_frame"], 0)
        self.assertEqual(timing["scenes"][0]["duration_frames"], 15)
        self.assertEqual(timing["scenes"][0]["captions"][0]["text"], "Xin chào mọi người.")

    def test_concatenates_pcm_wavs_without_reencoding(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            inputs = []
            for index, frames in enumerate((3, 5)):
                path = root / f"scene-{index}.wav"
                with wave.open(str(path), "wb") as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(10)
                    wav.writeframes((index + 1).to_bytes(2, "little") * frames)
                inputs.append(path)
            output = root / "voice.wav"
            concatenate_wavs(inputs, output)
            with wave.open(str(output), "rb") as wav:
                self.assertEqual(wav.getnframes(), 8)
                self.assertEqual(wav.readframes(8), b"\x01\x00" * 3 + b"\x02\x00" * 5)

    def test_accepts_measured_timing_covering_scene_voice(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name, content in package_files().items():
                target = root / "zodiac-venus-virgo" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            result = validate_timing(root / "zodiac-venus-virgo", valid_timing())
            self.assertEqual(result["total_duration_frames"], 30)

    def test_rejects_timing_with_caption_text_outside_scene_voice(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name, content in package_files().items():
                target = root / "zodiac-venus-virgo" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            timing = valid_timing()
            timing["scenes"][0]["captions"][0]["text"] = "Nội dung khác."
            with self.assertRaisesRegex(PipelineError, "caption text"):
                validate_timing(root / "zodiac-venus-virgo", timing)


class BackgroundMusicTests(unittest.TestCase):
    def _runtime_job(self, root: Path) -> Path:
        job = root / "job"
        (job / ".runtime").mkdir(parents=True)
        (job / "renderer" / "src").mkdir(parents=True)
        (job / ".runtime" / "timing.json").write_text(
            json.dumps(valid_timing(), ensure_ascii=False),
            encoding="utf-8",
        )
        (job / "renderer" / "src" / "ZodiacComposition.tsx").write_text(
            'const C = () => (<>\n  <Audio src={staticFile("voice.wav")} />\n</>);\n',
            encoding="utf-8",
        )
        (job / "renderer" / "src" / "types.ts").write_text(
            "type RuntimeSceneTiming = {};\nexport type RuntimeTiming = {fps: number; scenes: RuntimeSceneTiming[];};\n",
            encoding="utf-8",
        )
        with wave.open(str(job / "voice.wav"), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(8000)
            wav.writeframes(b"\x00\x00" * 8000)
        return job

    def test_background_music_uses_public_media_path_and_accepts_100_percent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._runtime_job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake mp3")
            configure_background_music(job, music, 1.0)
            timing = json.loads((job / ".runtime" / "timing.json").read_text(encoding="utf-8"))
            self.assertEqual(timing["background_music"], "media/background-music.mp3")
            self.assertEqual(timing["background_music_volume"], 1.0)
            self.assertTrue((job / "media" / "background-music.mp3").is_file())
            source = (job / "renderer" / "src" / "ZodiacComposition.tsx").read_text(encoding="utf-8")
            self.assertIn("timing.background_music", source)

    def test_background_music_rejects_volume_above_100_percent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._runtime_job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake mp3")
            with self.assertRaisesRegex(PipelineError, "between 0 and 1"):
                configure_background_music(job, music, 1.01)

    def test_audio_preview_uses_selected_mix_volume(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._runtime_job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake mp3")

            def fake_run(command, check):
                Path(command[-1]).write_bytes(b"preview")

            with patch("tools.zodiac_local.shutil.which", return_value="ffmpeg"), patch(
                "tools.zodiac_local.subprocess.run", side_effect=fake_run
            ) as run:
                output = build_audio_preview(job, music, 0.75, 5)
            self.assertEqual(output, job / ".runtime" / "audio-preview.wav")
            command = run.call_args.args[0]
            filter_complex = command[command.index("-filter_complex") + 1]
            self.assertIn("volume=0.750", filter_complex)
            self.assertIn("atrim=0:5.000", filter_complex)


if __name__ == "__main__":
    unittest.main()
