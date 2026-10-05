import json
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.zodiac_local import (
    PipelineError,
    import_package,
    safe_extract_zip,
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


class RuntimeTimingTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
