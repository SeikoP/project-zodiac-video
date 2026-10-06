import hashlib
import json
import shutil
import stat
import tempfile
import unittest
from unittest.mock import patch
import wave
import zipfile
from pathlib import Path

from tools.zodiac_local import (
    AlignmentMismatchError,
    PipelineError,
    _align_scene_words,
    _alignment_coverage_gap,
    _alignment_units,
    _run_ffmpeg,
    _select_vieneu_gradio_dependency,
    align_scene_timings,
    build_audio_preview,
    build_parser,
    build_timing_from_word_alignment,
    build_tts_diagnostics,
    canonical_narration_text,
    effective_tts_generation_config,
    generate_scene_voices,
    recover_scene_alignment_with_adaptive_frame_cap,
    tts_scene_frame_cap_retry_eligible,
    concatenate_wavs,
    configure_background_music,
    import_package,
    mix_background_music_into_render,
    package_publish_outputs,
    safe_extract_zip,
    validate_background_music,
    validate_package,
    validate_publish_contract,
    validate_publish_outputs,
    validate_timing,
)


EXPECTED_DEPENDENCIES = {
    "@remotion/captions": "4.0.530",
    "@remotion/cli": "4.0.530",
    "@remotion/media": "4.0.530",
    "remotion": "4.0.530",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@remotion/layout-utils": "4.0.530",
    "@fontsource/be-vietnam-pro": "5.3.0",
    "ajv": "8.20.0",
}
EXPECTED_SCRIPTS = {
    "prepare:runtime": "node scripts/render.mjs --prepare-only",
    "studio": "npm run prepare:runtime && remotion studio src/index.ts --props=../.runtime/render-props.json",
    "render": "node scripts/render.mjs",
    "test": "node --test tests/*.test.mjs",
    "typecheck": "tsc --noEmit",
    "compile:style": "node scripts/compile-style-token.mjs",
}


def style_token():
    return {
        "id": "zodiac-paper-stickers-v1",
        "version": "1.0",
        "palette_roles": {
            "paper": "#F4EFE6",
            "ink": "#252A2E",
            "sticker_edge": "#FFFDF8",
            "coral": "#E36C54",
        },
        "character_construction": {
            "head_to_body_ratio": [1.1, 1.35],
            "outline_px_at_1080": [5, 7],
        },
        "shape_language": {
            "medium": "cut-paper-notebook-stickers",
        },
        "caption_emphasis": {
            "font_family": "Be Vietnam Pro",
            "font_weight": 500,
            "font_size_px": 46,
            "min_font_size_px": 34,
            "max_lines": 2,
            "color_role": "ink",
            "highlight_role": "coral",
            "background_role": "sticker_edge",
        },
        "safe_zone": {
            "x": 90,
            "y": 1430,
            "width": 900,
            "height": 150,
        },
        "motion_grammar": {
            "state_swap": "voice-anchored-character-pose-change",
        },
        "layout_zones": {
            "content": {
                "x": 48,
                "y": 70,
                "width": 984,
                "height": 1260,
                "radius": 28,
                "border_px": 3,
            },
            "caption": {
                "x": 90,
                "y": 1430,
                "width": 900,
                "height": 150,
            },
            "gap_px": 100,
        },
    }


def token_hash(token):
    encoded = json.dumps(
        token,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def design_markdown(token):
    fence = chr(96) * 3
    return (
        "# Zodiac test design\n\n"
        "<!-- STYLE_TOKEN_BEGIN -->\n"
        + fence
        + "json\n"
        + json.dumps(token, ensure_ascii=False, indent=2)
        + "\n"
        + fence
        + "\n<!-- STYLE_TOKEN_END -->\n"
    )


def package_files():
    token = style_token()
    compiled = {**token, "source_hash": token_hash(token)}
    transform = {
        "x": 100,
        "y": 100,
        "width": 300,
        "height": 500,
    }
    production = {
        "version": "2.0",
        "video": {
            "width": 1080,
            "height": 1920,
            "fps": 30,
        },
        "visual_system": {
            "palette": token["palette_roles"],
            "background_primitive": "paper.bg",
            "primitive_renderer": {
                "allowed_tags": ["rect"],
            },
            "motion_presets": {
                "state_swap": {
                    "keyframes": [
                        {"frame": 0, "opacity": 0},
                        {"frame": 1, "opacity": 1},
                    ],
                    "easing": "linear",
                },
            },
            "transition_presets": {
                "hard_cut": {
                    "renderer": "instant_cut",
                },
            },
            "sfx_profiles": {},
            "style_token": compiled,
        },
        "caption_style": {
            "font_family": "Be Vietnam Pro",
            "font_size_px": 46,
            "min_font_size_px": 34,
            "font_weight": 500,
            "color": "#252A2E",
            "highlight_color": "#E36C54",
            "background": "transparent",
            "safe_area": token["safe_zone"],
            "max_lines": 2,
        },
        "primitives": {
            "paper.bg": {
                "kind": "svg_elements",
                "viewBox": "0 0 1 1",
                "elements": [],
            },
        },
        "assets": {
            "lead.neutral": {
                "kind": "svg",
                "category": "character_pose",
                "character_id": "lead",
                "pose": "neutral",
                "path": "assets/characters/lead-neutral.svg",
                "format": "image/svg+xml",
                "style_id": token["id"],
            },
            "lead.active": {
                "kind": "svg",
                "category": "character_pose",
                "character_id": "lead",
                "pose": "active",
                "path": "assets/characters/lead-active.svg",
                "format": "image/svg+xml",
                "style_id": token["id"],
            },
        },
        "scenes": [
            {
                "id": "S01",
                "voice": "Xin chào mọi người.",
                "timing": {"mode": "from_voice"},
                "entities": [
                    {
                        "id": "character.lead",
                        "kind": "character",
                        "initial_state": "neutral",
                        "states": {
                            "neutral": {
                                "asset": "lead.neutral",
                                "transform": transform,
                                "layer": 2,
                                "visible": True,
                            },
                            "active": {
                                "asset": "lead.active",
                                "transform": transform,
                                "layer": 2,
                                "visible": True,
                            },
                        },
                    },
                ],
                "events": [
                    {
                        "id": "S01-E01",
                        "target": "character.lead",
                        "action": "reacts",
                        "state_before": "neutral",
                        "state_after": "active",
                        "trigger": {"source": "scene_start"},
                        "motion": {
                            "preset": "state_swap",
                            "duration_frames": 6,
                        },
                    },
                ],
                "transition": {
                    "type": "hard_cut",
                    "duration_frames": 0,
                },
                "captions": {
                    "source": "voice",
                    "page_target_words": 4,
                    "max_words": 7,
                    "max_lines": 2,
                },
            },
        ],
    }
    renderer_package = {
        "name": "zodiac-remotion-renderer",
        "private": True,
        "type": "module",
        "scripts": EXPECTED_SCRIPTS,
        "dependencies": EXPECTED_DEPENDENCIES,
        "devDependencies": {
            "@types/node": "24.0.0",
            "@types/react": "19.0.0",
            "typescript": "5.8.0",
        },
    }
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    )
    files = {
        "README.md": "# Video\n\nPLUGIN SIDE COMPLETE\n",
        "design.md": design_markdown(token),
        "narration.txt": "Xin chào mọi người.\n",
        "production.json": json.dumps(production, ensure_ascii=False),
        "handoff-manifest.json": json.dumps(
            {
                "package_id": "zodiac-test",
                "plugin_version": "test",
                "status": ["LOCAL_RUNTIME_PENDING"],
                "render_ready": False,
            },
            ensure_ascii=False,
        ),
        "assets/characters/lead-neutral.svg": svg,
        "assets/characters/lead-active.svg": svg,
        "renderer/package.json": json.dumps(renderer_package),
        "publish/publish-copy.txt": (
            "COVER IDENTITY:\nXỬ NỮ ♍\n\n"
            "HOOK:\nBẬT CHẾ ĐỘ KIỂM LỖI 24/7?\n\n"
            "TIKTOK CAPTION:\nMột caption thử nghiệm.\n\n"
            "HASHTAGS:\n#xunu #cungxunu #virgo\n"
        ),
        "publish/publish.json": json.dumps(
            {
                "version": "1.1",
                "platform": "tiktok",
                "cover": {
                    "layout": "tilted_top_hook",
                    "identity": {
                        "sign_id": "virgo",
                        "label": "XỬ NỮ",
                        "glyph": "♍",
                    },
                    "hook": "BẬT CHẾ ĐỘ KIỂM LỖI 24/7?",
                    "source_scene_id": "S01",
                    "visuals": [
                        {
                            "entity_id": "character.lead",
                            "state_id": "neutral",
                        }
                    ],
                },
                "caption": "Một caption thử nghiệm.",
                "hashtags": ["#xunu", "#cungxunu", "#virgo"],
            },
            ensure_ascii=False,
        ),
    }
    renderer_sources = {
        "renderer/src/index.ts": "registerRoot(RemotionRoot);\n",
        "renderer/src/Root.tsx": (
            "const calculateMetadata = ({props}) => ({durationInFrames: props.total_duration_frames});\n"
            "export const RemotionRoot = () => <>"
            "<Composition id=\"ZodiacVideo\" calculateMetadata={calculateMetadata} durationInFrames={1} />"
            "<Still id=\"ZodiacCover\" component={ZodiacCover} />"
            "</>;\n"
        ),
        "renderer/src/ZodiacCover.tsx": (
            "const scene = production.scenes.find((item) => item.id === publish.cover.source_scene_id);\n"
            "const entity = scene.entities.find((item) => item.id === visual.entity_id);\n"
            "const state = entity.states[visual.state_id];\n"
            "const tilted = {transform: \"rotate(-3deg)\"};\n"
            "export const ZodiacCover = () => <div>{publish.cover.identity.label}{publish.cover.hook}</div>;\n"
        ),
        "renderer/src/ZodiacComposition.tsx": (
            "export const ZodiacComposition = (timing) => production.scenes.map((scene) => {\n"
            "  const row = timing.scenes.find((item) => item.scene_id === scene.id);\n"
            "  return <Sequence from={row.start_frame} durationInFrames={row.duration_frames}>\n"
            "    <Audio src={staticFile(\"voice.wav\")} />{scene.entities.map(() => null)}{scene.events.map(() => null)}\n"
            "  </Sequence>;\n"
            "});\n"
            "const captionStyle = {width: \"fit-content\", maxWidth: area.width, left: \"50%\", transform: \"translateX(-50%)\"};\n"
            "const canonicalContentZone = () => ({x:48,y:70,width:984,height:1260});\n"
            "const contentFrameStyle = () => ({overflow: \"hidden\"});\n"
        ),
        "renderer/src/PrimitiveSvg.tsx": "export const PrimitiveSvg = () => null;\n",
        "renderer/src/types.ts": (
            "export type ProductionScene = {id: string};\n"
            "export type Production = {version: \"2.0\"; scenes: ProductionScene[]};\n"
            "export type RuntimeTiming = {total_duration_frames: number; scenes: unknown[]};\n"
        ),
        "renderer/src/runtime-contract.mjs": "export const resolveProductionEvents = () => ({});\n",
        "renderer/scripts/render.mjs": (
            "const renderPropsPath = path.join(packageRoot, '.runtime', 'render-props.json');\n"
            "await writeFile(renderPropsPath, JSON.stringify(timing));\n"
            "const videoArgs = ['render', 'src/index.ts', 'ZodiacVideo', '../out/zodiac-story.mp4'];\n"
            "const coverArgs = ['still', 'src/index.ts', 'ZodiacCover', '../out/cover.png'];\n"
            "spawnSync(cli, videoArgs); spawnSync(cli, coverArgs);\n"
            "await copyFile('publish/publish-copy.txt', '../out/publish-copy.txt');\n"
            "await copyFile('publish/publish.json', '../out/publish.json');\n"
        ),
        "renderer/scripts/generate-sfx.mjs": "export const generateSfx = async () => {};\n",
        "renderer/scripts/style-token.mjs": "export const parseDesignToken = () => ({});\n",
        "renderer/scripts/compile-style-token.mjs": "export {};\n",
        "renderer/schemas/production.schema.json": "{}\n",
        "renderer/tests/pipeline-contract.test.mjs": "test('renderer contract', () => {});\n",
    }
    files.update(renderer_sources)
    return files


def write_package(root: Path) -> Path:
    job = root / "zodiac-test"
    for name, content in package_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def write_zip(path: Path, files, root="zodiac-test"):
    with zipfile.ZipFile(
        path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
    ) as archive:
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
                    {
                        "text": "Xin",
                        "startMs": 0,
                        "endMs": 180,
                        "timestampMs": 0,
                        "confidence": 0.99,
                    },
                    {
                        "text": "chào",
                        "startMs": 180,
                        "endMs": 380,
                        "timestampMs": 180,
                        "confidence": 0.99,
                    },
                    {
                        "text": "mọi",
                        "startMs": 380,
                        "endMs": 600,
                        "timestampMs": 380,
                        "confidence": 0.99,
                    },
                    {
                        "text": "người.",
                        "startMs": 600,
                        "endMs": 900,
                        "timestampMs": 600,
                        "confidence": 0.99,
                    },
                ],
            },
        ],
    }


def write_pcm(path: Path, seconds=1.0, rate=8000):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"\x00\x00" * int(seconds * rate))


class SafeExtractionTests(unittest.TestCase):
    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive_path = root / "bad.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../outside.txt", "no")
            with self.assertRaisesRegex(
                PipelineError,
                "unsafe ZIP path",
            ):
                safe_extract_zip(
                    archive_path,
                    root / "out",
                )
            self.assertFalse(
                (root / "outside.txt").exists()
            )

    def test_rejects_symbolic_link_members(self):
        with tempfile.TemporaryDirectory() as temp:
            archive_path = Path(temp) / "link.zip"
            entry = zipfile.ZipInfo("zodiac/link")
            entry.create_system = 3
            entry.external_attr = (
                stat.S_IFLNK | 0o777
            ) << 16
            with zipfile.ZipFile(
                archive_path,
                "w",
            ) as archive:
                archive.writestr(
                    entry,
                    "../../outside",
                )
            with self.assertRaisesRegex(
                PipelineError,
                "symbolic links",
            ):
                safe_extract_zip(
                    archive_path,
                    Path(temp) / "out",
                )

    def test_imports_and_validates_v2_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "video.zip"
            write_zip(
                archive,
                package_files(),
            )
            imported = import_package(
                archive,
                root / "jobs",
            )
            self.assertEqual(
                validate_package(imported)["version"],
                "2.0",
            )

    def test_rejects_missing_publish_copy_file(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "publish/publish-copy.txt").unlink()
            with self.assertRaisesRegex(
                PipelineError,
                "publish-copy.txt",
            ):
                validate_publish_contract(job)

    def test_creative_validation_allows_publish_pending(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            shutil.rmtree(job / "publish")
            self.assertEqual(
                validate_package(job)["version"],
                "2.0",
            )

    def test_rejects_missing_cover_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "publish/publish.json"
            publish = json.loads(path.read_text(encoding="utf-8"))
            publish["cover"]["identity"]["label"] = ""
            path.write_text(
                json.dumps(publish, ensure_ascii=False),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "COVER_IDENTITY_MISSING",
            ):
                validate_publish_contract(job)

    def test_canonical_narration_serializer_has_no_extra_scene_separator(self):
        production = {
            "scenes": [
                {"voice": "Đoạn A.\n\nNghỉ trong scene."},
                {"voice": "Đoạn B."},
            ]
        }
        self.assertEqual(
            canonical_narration_text(production),
            "Đoạn A.\n\nNghỉ trong scene.\nĐoạn B.",
        )

    def test_rejects_extra_blank_line_between_scene_voice_blocks(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            second = json.loads(json.dumps(production["scenes"][0]))
            second["id"] = "S02"
            second["voice"] = "Cảnh thứ hai."
            second["events"][0]["id"] = "S02-E01"
            production["scenes"].append(second)
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            (job / "narration.txt").write_text(
                "Xin chào mọi người.\n\nCảnh thứ hai.\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "narration.txt must exactly match",
            ):
                validate_package(job)

    def test_structured_handoff_manifest_replaces_legacy_readme_marker(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "README.md").write_text(
                "# Video package\n\nStructured handoff only.\n",
                encoding="utf-8",
            )
            self.assertEqual(validate_package(job)["version"], "2.0")

    def test_rejects_missing_handoff_boundary_when_legacy_marker_is_absent(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "handoff-manifest.json").unlink()
            (job / "README.md").write_text("# Video package\n", encoding="utf-8")
            with self.assertRaisesRegex(
                PipelineError,
                "handoff",
            ):
                validate_package(job)

    def test_rejects_caption_style_drift_from_design_token(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["caption_style"]["font_size_px"] = 58
            production["caption_style"]["background"] = "#FFFDF8"
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(
                PipelineError,
                "caption_style.*design.md",
            ):
                validate_package(job)

    def test_rejects_v1_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            production = json.loads(
                (job / "production.json").read_text(
                    encoding="utf-8"
                )
            )
            production["version"] = "1.0"
            (job / "production.json").write_text(
                json.dumps(production),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "version 2.0",
            ):
                validate_package(job)

    def test_rejects_missing_design(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "design.md").unlink()
            with self.assertRaisesRegex(
                PipelineError,
                "design.md",
            ):
                validate_package(job)

    def test_rejects_missing_asset(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (
                job
                / "assets/characters/lead-active.svg"
            ).unlink()
            with self.assertRaisesRegex(
                PipelineError,
                "lead-active.svg",
            ):
                validate_package(job)

    def test_rejects_full_artboard_background_in_production_svg(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "assets/characters/lead-neutral.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 720">'
                '<rect width="100%" height="100%" fill="#F6F0E6"/>'
                '<circle cx="260" cy="360" r="100"/>'
                '</svg>',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(PipelineError, "PRODUCTION_ASSET_DIRTY.*full-artboard"):
                validate_package(job)

    def test_rejects_asset_library_metadata_label_in_production_svg(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "assets/characters/lead-neutral.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 720">'
                '<text x="260" y="42">Virgo master</text>'
                '<circle cx="260" cy="360" r="100"/>'
                '</svg>',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(PipelineError, "PRODUCTION_ASSET_DIRTY.*metadata label"):
                validate_package(job)

    def test_rejects_oversized_caption_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["caption_style"]["font_size_px"] = 72
            production["caption_style"]["safe_area"]["height"] = 300
            path.write_text(json.dumps(production), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "caption_style.*compact"):
                validate_package(job)

    def test_rejects_sparse_visual_progression_proxy_before_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            long_voice = " ".join(f"tu{i}" for i in range(40))
            production["scenes"][0]["voice"] = long_voice
            path.write_text(json.dumps(production), encoding="utf-8")
            (job / "narration.txt").write_text(long_voice + "\n", encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "VISUAL_PROGRESSION_DENSITY.*15 words"):
                validate_package(job)

    def test_rejects_renderer_without_compact_caption_box(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            source = (job / "renderer/src/ZodiacComposition.tsx").read_text(encoding="utf-8")
            source = source.replace('width: "fit-content"', 'width: area.width')
            (job / "renderer/src/ZodiacComposition.tsx").write_text(source, encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "PACKAGE_RENDERER_STALE.*compact caption"):
                validate_package(job)

    def test_rejects_overlapping_content_and_caption_zones(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["visual_system"]["style_token"]["layout_zones"]["content"]["height"] = 1400
            path.write_text(json.dumps(production), encoding="utf-8")
            with self.assertRaisesRegex(
                PipelineError,
                "layout_zones.*overlap",
            ):
                validate_package(job)

    def test_rejects_v18_renderer_without_isolated_content_frame(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            source = (job / "renderer/src/ZodiacComposition.tsx").read_text(encoding="utf-8")
            source = source.replace("contentFrameStyle", "missingContentFrame")
            (job / "renderer/src/ZodiacComposition.tsx").write_text(source, encoding="utf-8")
            with self.assertRaisesRegex(
                PipelineError,
                "PACKAGE_RENDERER_STALE.*isolated content frame",
            ):
                validate_package(job)

    def test_rejects_static_check_only_render_script(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "renderer/scripts/render.mjs").write_text(
                'console.log("Static package checks passed; local voice/timing present.");\n',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "PACKAGE_RENDERER_STALE.*render.mjs",
            ):
                validate_package(job)

    def test_rejects_root_without_runtime_metadata_duration(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "renderer/src/Root.tsx").write_text(
                "export const RemotionRoot = () => <Composition durationInFrames={1} />;\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "PACKAGE_RENDERER_STALE.*Root.tsx",
            ):
                validate_package(job)

    def test_rejects_single_scene_composition_stub(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "renderer/src/ZodiacComposition.tsx").write_text(
                "export const ZodiacComposition = () => production.scenes[0];\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "PACKAGE_RENDERER_STALE.*ZodiacComposition.tsx",
            ):
                validate_package(job)

    def test_rejects_any_production_type_stub(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            (job / "renderer/src/types.ts").write_text(
                "export type Production = any;\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PipelineError,
                "PACKAGE_RENDERER_STALE.*types.ts",
            ):
                validate_package(job)

    def test_accepts_available_typescript_patch(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "renderer/package.json"
            package = json.loads(
                path.read_text(encoding="utf-8")
            )
            package["devDependencies"][
                "typescript"
            ] = "5.8.2"
            path.write_text(
                json.dumps(package),
                encoding="utf-8",
            )
            self.assertEqual(
                validate_package(job)["video"]["fps"],
                30,
            )


class RendererTypeCompatTests(unittest.TestCase):
    def test_patch_waits_for_font_before_caption_measurement(self):
        from tools.zodiac_local import _patch_renderer_font_readiness

        old_hook = '''const useVietnameseFont = () => {
  const [handle] = useState(() => delayRender("Load local Be Vietnam Pro font"));
  useEffect(() => {
    document.fonts.load(`500 ${production.caption_style.font_size_px}px "Be Vietnam Pro"`, fontText)
      .then((faces) => {
        if (!faces.length || !document.fonts.check(`500 ${production.caption_style.font_size_px}px "Be Vietnam Pro"`, fontText)) throw new Error("Required Vietnamese font face is unavailable.");
        continueRender(handle);
      })
      .catch((error) => cancelRender(new Error("Vietnamese font failed to load: " + String(error))));
  }, [handle]);
};
'''
        old_entry = '''export const ZodiacComposition: React.FC<RuntimeTiming> = (timing) => {
  useVietnameseFont();
  const sceneTiming = new Map(timing.scenes.map((item) => [item.scene_id, item]));
'''
        with tempfile.TemporaryDirectory() as temp:
            renderer = Path(temp) / "renderer"
            (renderer / "src").mkdir(parents=True)
            path = renderer / "src" / "ZodiacComposition.tsx"
            path.write_text(old_hook + "\n" + old_entry, encoding="utf-8")
            _patch_renderer_font_readiness(renderer)
            patched = path.read_text(encoding="utf-8")
            self.assertIn("const [fontReady, setFontReady] = useState(false);", patched)
            self.assertIn("await document.fonts.ready;", patched)
            self.assertIn("if (!fontReady)", patched)
            self.assertIn("requestAnimationFrame(() => continueRender(handle));", patched)

    def test_prepare_renderer_applies_font_patch_before_renderer_tests(self):
        import inspect

        from tools.zodiac_local import prepare_renderer

        source = inspect.getsource(prepare_renderer)
        self.assertIn("_patch_renderer_font_readiness(renderer)", source)
        patch_at = source.index("_patch_renderer_font_readiness(renderer)")
        self.assertLess(patch_at, source.index('["run", "test"]'))
        self.assertLess(patch_at, source.index('"typecheck"'))

    def test_patch_widens_the_production_json_cast(self):
        from tools.zodiac_local import _patch_renderer_typescript_compatibility

        with tempfile.TemporaryDirectory() as temp:
            renderer = Path(temp) / "renderer"
            (renderer / "src").mkdir(parents=True)
            for name in ("Root.tsx", "ZodiacComposition.tsx", "ZodiacCover.tsx"):
                (renderer / "src" / name).write_text(
                    "const production = productionJson as Production;\n", encoding="utf-8"
                )
            _patch_renderer_typescript_compatibility(renderer)
            for name in ("Root.tsx", "ZodiacComposition.tsx", "ZodiacCover.tsx"):
                patched = (renderer / "src" / name).read_text(encoding="utf-8")
                self.assertIn("as unknown as Production", patched, name)

    def test_patch_covers_zodiac_cover_json_cast(self):
        from tools.zodiac_local import _patch_renderer_typescript_compatibility

        with tempfile.TemporaryDirectory() as temp:
            renderer = Path(temp) / "renderer"
            (renderer / "src").mkdir(parents=True)
            (renderer / "src" / "Root.tsx").write_text(
                "const production = productionJson as unknown as Production;\n",
                encoding="utf-8",
            )
            (renderer / "src" / "ZodiacComposition.tsx").write_text(
                "const production = productionJson as unknown as Production;\n",
                encoding="utf-8",
            )
            (renderer / "src" / "ZodiacCover.tsx").write_text(
                "const production = productionJson as Production;\n",
                encoding="utf-8",
            )
            _patch_renderer_typescript_compatibility(renderer)
            patched = (renderer / "src" / "ZodiacCover.tsx").read_text(encoding="utf-8")
            self.assertIn("as unknown as Production", patched)

    def test_prepare_renderer_applies_the_cast_patch_before_typecheck(self):
        """The shipped renderer casts JSON directly, which fails TS2352."""
        import inspect

        from tools.zodiac_local import prepare_renderer

        source = inspect.getsource(prepare_renderer)
        self.assertIn("_patch_renderer_typescript_compatibility(renderer)", source)
        patch_at = source.index("_patch_renderer_typescript_compatibility(renderer)")
        self.assertLess(patch_at, source.index('"typecheck"'))

    def test_patch_is_idempotent(self):
        from tools.zodiac_local import _patch_renderer_typescript_compatibility

        with tempfile.TemporaryDirectory() as temp:
            renderer = Path(temp) / "renderer"
            (renderer / "src").mkdir(parents=True)
            for name in ("Root.tsx", "ZodiacComposition.tsx", "ZodiacCover.tsx"):
                (renderer / "src" / name).write_text(
                    "const production = productionJson as Production;\n", encoding="utf-8"
                )
            _patch_renderer_typescript_compatibility(renderer)
            _patch_renderer_typescript_compatibility(renderer)
            self.assertEqual(
                (renderer / "src" / "Root.tsx").read_text(encoding="utf-8").count(
                    "as unknown as Production"
                ),
                1,
            )


class RuntimeTimingTests(unittest.TestCase):
    def test_builds_word_level_timing(self):
        production = json.loads(
            package_files()["production.json"]
        )
        relative = [
            {
                "text": "Xin",
                "startMs": 0,
                "endMs": 180,
                "timestampMs": 0,
                "confidence": 0.9,
            },
            {
                "text": "chào",
                "startMs": 180,
                "endMs": 380,
                "timestampMs": 180,
                "confidence": 0.9,
            },
            {
                "text": "mọi",
                "startMs": 380,
                "endMs": 600,
                "timestampMs": 380,
                "confidence": 0.9,
            },
            {
                "text": "người.",
                "startMs": 600,
                "endMs": 900,
                "timestampMs": 600,
                "confidence": 0.9,
            },
        ]
        timing = build_timing_from_word_alignment(
            production,
            {"S01": 1.0},
            {"S01": relative},
        )
        self.assertEqual(
            timing["total_duration_frames"],
            30,
        )
        self.assertEqual(
            timing["scenes"][0]["captions"][1]["text"],
            "chào",
        )

    def test_clamps_small_whisper_end_overshoot_to_wav_boundary(self):
        production = json.loads(
            package_files()["production.json"]
        )
        relative = [
            {
                "text": "Xin",
                "startMs": 0,
                "endMs": 180,
                "timestampMs": 0,
                "confidence": 0.9,
            },
            {
                "text": "chào",
                "startMs": 180,
                "endMs": 380,
                "timestampMs": 180,
                "confidence": 0.9,
            },
            {
                "text": "mọi",
                "startMs": 380,
                "endMs": 700,
                "timestampMs": 380,
                "confidence": 0.9,
            },
            {
                "text": "người.",
                "startMs": 700,
                "endMs": 1120,
                "timestampMs": 700,
                "confidence": 0.9,
            },
        ]
        timing = build_timing_from_word_alignment(
            production,
            {"S01": 1.0},
            {"S01": relative},
        )
        last = timing["scenes"][0]["captions"][-1]
        self.assertEqual(last["endMs"], 1000.0)

    def test_rejects_large_whisper_end_overshoot(self):
        production = json.loads(
            package_files()["production.json"]
        )
        relative = [
            {
                "text": "Xin",
                "startMs": 0,
                "endMs": 180,
                "timestampMs": 0,
                "confidence": 0.9,
            },
            {
                "text": "chào",
                "startMs": 180,
                "endMs": 380,
                "timestampMs": 180,
                "confidence": 0.9,
            },
            {
                "text": "mọi",
                "startMs": 380,
                "endMs": 700,
                "timestampMs": 380,
                "confidence": 0.9,
            },
            {
                "text": "người.",
                "startMs": 700,
                "endMs": 1400,
                "timestampMs": 700,
                "confidence": 0.9,
            },
        ]
        with self.assertRaisesRegex(
            PipelineError,
            "outside measured WAV boundary",
        ):
            build_timing_from_word_alignment(
                production,
                {"S01": 1.0},
                {"S01": relative},
            )

    def test_accepts_measured_word_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            result = validate_timing(
                job,
                valid_timing(),
            )
            self.assertEqual(
                result["total_duration_frames"],
                30,
            )

    def test_rejects_measured_visual_gap_over_five_seconds(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            timing = valid_timing()
            timing["total_duration_frames"] = 240
            timing["scenes"][0]["duration_frames"] = 240
            timing["scenes"][0]["captions"] = [
                {"text": "Xin", "startMs": 0, "endMs": 180, "timestampMs": 0, "confidence": 0.99},
                {"text": "chào", "startMs": 180, "endMs": 2500, "timestampMs": 180, "confidence": 0.99},
                {"text": "mọi", "startMs": 2500, "endMs": 5200, "timestampMs": 2500, "confidence": 0.99},
                {"text": "người.", "startMs": 5200, "endMs": 7900, "timestampMs": 5200, "confidence": 0.99},
            ]
            with self.assertRaisesRegex(PipelineError, "VISUAL_PROGRESSION_TIMING.*5.0s"):
                validate_timing(job, timing)

    def test_rejects_phrase_level_caption(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            timing = valid_timing()
            timing["scenes"][0]["captions"] = [
                {
                    "text": "Xin chào mọi người.",
                    "startMs": 0,
                    "endMs": 900,
                },
            ]
            with self.assertRaisesRegex(
                PipelineError,
                "word-level",
            ):
                validate_timing(job, timing)

    def test_concatenates_pcm_wavs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first = root / "a.wav"
            second = root / "b.wav"
            write_pcm(first, 0.2, 10)
            write_pcm(second, 0.3, 10)
            output = root / "voice.wav"
            concatenate_wavs(
                [first, second],
                output,
            )
            with wave.open(str(output), "rb") as wav:
                self.assertEqual(
                    wav.getnframes(),
                    5,
                )


class TtsDurationGuardTests(unittest.TestCase):
    def test_flags_fast_vietnamese_speech_before_alignment(self):
        words = [f"tu{i}" for i in range(89)]
        production = {
            "scenes": [
                {
                    "id": "S01",
                    "voice": " ".join(words),
                },
            ],
        }
        diagnostics = build_tts_diagnostics(
            production,
            {"S01": 20.1},
            warning_wps=3.8,
            transport="local",
            backend="onnx",
            precision="int8",
            frame_cap=True,
            max_chars=256,
        )
        scene = diagnostics["scenes"][0]
        self.assertEqual(scene["word_count"], 89)
        self.assertAlmostEqual(scene["words_per_second"], 89 / 20.1, places=3)
        self.assertTrue(scene["speech_rate_warning"])
        self.assertTrue(diagnostics["summary"]["speech_rate_warning"])

    def test_natural_rate_does_not_warn(self):
        production = {
            "scenes": [
                {
                    "id": "S01",
                    "voice": " ".join(f"tu{i}" for i in range(89)),
                },
            ],
        }
        diagnostics = build_tts_diagnostics(
            production,
            {"S01": 27.0},
            warning_wps=3.8,
        )
        self.assertFalse(diagnostics["scenes"][0]["speech_rate_warning"])
        self.assertFalse(diagnostics["summary"]["speech_rate_warning"])

    def test_repairs_zero_duration_aligner_token_from_neighbor_boundaries(self):
        class Word:
            def __init__(self, word, start, end):
                self.word = word
                self.start = start
                self.end = end
                self.probability = 0.9

        class Segment:
            words = [
                Word("một", 0.00, 0.20),
                Word("hai", 0.20, 0.20),
                Word("ba", 0.34, 0.50),
            ]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        aligned = _align_scene_words(
            Model(),
            Path("S02.wav"),
            "một hai ba",
        )
        self.assertEqual(
            [item["text"] for item in aligned],
            ["một", "hai", "ba"],
        )
        self.assertGreater(aligned[1]["endMs"], aligned[1]["startMs"])
        self.assertLessEqual(aligned[1]["endMs"], aligned[2]["startMs"])

    def test_rejects_unrepairable_zero_duration_aligner_token(self):
        class Word:
            def __init__(self, word, start, end):
                self.word = word
                self.start = start
                self.end = end
                self.probability = 0.9

        class Segment:
            words = [
                Word("một", 0.00, 0.20),
                Word("hai", 0.20, 0.20),
                Word("ba", 1.20, 1.40),
            ]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        with self.assertRaisesRegex(
            PipelineError,
            "invalid word timestamp",
        ):
            _align_scene_words(
                Model(),
                Path("S02.wav"),
                "một hai ba",
            )

    def test_alignment_mismatch_has_stable_error_code(self):
        class Word:
            word = "một"
            start = 0.0
            end = 0.2
            probability = 0.99

        class Segment:
            words = [Word()]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        with self.assertRaisesRegex(PipelineError, "ALIGNMENT_MISMATCH"):
            _align_scene_words(
                Model(),
                Path("S01.wav"),
                "một hai",
            )

    def test_alignment_mismatch_can_use_scene_recovery_callback(self):
        production = {
            "video": {"fps": 30},
            "scenes": [{"id": "S01", "voice": "một hai"}],
        }

        class Word:
            word = "một"
            start = 0.0
            end = 0.2
            probability = 0.99

        class Segment:
            words = [Word()]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        recovered_words = [
            {
                "text": "một",
                "startMs": 0.0,
                "endMs": 300.0,
                "timestampMs": 0.0,
                "confidence": 0.99,
            },
            {
                "text": "hai",
                "startMs": 300.0,
                "endMs": 800.0,
                "timestampMs": 300.0,
                "confidence": 0.99,
            },
        ]
        seen = []

        def recover(scene, path, aligner, error):
            seen.append((scene["id"], path.name, str(error)))
            return recovered_words, 1.5

        timing = align_scene_timings(
            production,
            {"S01": 1.0},
            Model(),
            [Path("S01.wav")],
            mismatch_recovery=recover,
        )
        self.assertEqual(len(seen), 1)
        self.assertIn("ALIGNMENT_MISMATCH", seen[0][2])
        self.assertEqual(timing["scenes"][0]["duration_frames"], 45)

    def test_adaptive_frame_cap_restores_original_when_all_attempts_fail(self):
        production = {
            "scenes": [{"id": "S01", "voice": "một hai"}],
        }
        calls = []
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            scene = root / ".runtime" / "tts-scenes" / "S01.wav"
            write_pcm(scene, seconds=1.0, rate=8000)

            def fake_batch(runtime, rows, **kwargs):
                calls.append(kwargs["frame_cap_scale"])
                self.assertEqual(kwargs["backend"], "onnx")
                self.assertEqual(kwargs["precision"], "fp32")
                self.assertEqual(kwargs["frame_cap"], "on")
                write_pcm(
                    Path(runtime) / "tts-scenes" / "S01.wav",
                    seconds=1.0 + kwargs["frame_cap_scale"],
                    rate=8000,
                )

            gap = AlignmentMismatchError(
                "ALIGNMENT_MISMATCH: still missing",
                expected=["một", "hai"],
                heard=["một"],
                coverage_gap=True,
            )
            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch), patch(
                "tools.zodiac_local._align_scene_words",
                side_effect=gap,
            ):
                with self.assertRaisesRegex(
                    PipelineError,
                    "ADAPTIVE_FRAME_CAP_RETRY_FAILED",
                ):
                    recover_scene_alignment_with_adaptive_frame_cap(
                        root,
                        production,
                        "S01",
                        object(),
                    )

            self.assertEqual(calls, [1.25, 1.50])
            with wave.open(str(scene), "rb") as wav:
                self.assertAlmostEqual(
                    wav.getnframes() / wav.getframerate(),
                    1.0,
                    places=2,
                )
            evidence_dir = root / ".runtime" / "tts-diagnostics"
            self.assertTrue((evidence_dir / "S01.frame-cap-1.00.wav").is_file())
            self.assertTrue((evidence_dir / "S01.frame-cap-1.25.failed.wav").is_file())
            self.assertTrue((evidence_dir / "S01.frame-cap-1.50.failed.wav").is_file())

    def test_adaptive_frame_cap_escalates_until_alignment_passes(self):
        production = {
            "scenes": [{"id": "S01", "voice": "một hai"}],
        }
        aligned = [
            {
                "text": "một",
                "startMs": 0.0,
                "endMs": 300.0,
                "timestampMs": 0.0,
                "confidence": 0.99,
            },
            {
                "text": "hai",
                "startMs": 300.0,
                "endMs": 900.0,
                "timestampMs": 300.0,
                "confidence": 0.99,
            },
        ]
        calls = []
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            scene = root / ".runtime" / "tts-scenes" / "S01.wav"
            write_pcm(scene, seconds=1.0, rate=8000)

            def fake_batch(runtime, rows, **kwargs):
                scale = kwargs["frame_cap_scale"]
                calls.append(scale)
                write_pcm(
                    Path(runtime) / "tts-scenes" / "S01.wav",
                    seconds=scale,
                    rate=8000,
                )

            gap = AlignmentMismatchError(
                "ALIGNMENT_MISMATCH: still missing at 1.25",
                expected=["một", "hai"],
                heard=["một"],
                coverage_gap=True,
            )
            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch), patch(
                "tools.zodiac_local._align_scene_words",
                side_effect=[
                    gap,
                    aligned,
                ],
            ):
                words, duration = recover_scene_alignment_with_adaptive_frame_cap(
                    root,
                    production,
                    "S01",
                    object(),
                )

            self.assertEqual(calls, [1.25, 1.50])
            self.assertEqual(words, aligned)
            self.assertAlmostEqual(duration, 1.50, places=2)
            with wave.open(str(scene), "rb") as wav:
                self.assertAlmostEqual(
                    wav.getnframes() / wav.getframerate(),
                    1.50,
                    places=2,
                )
            evidence_dir = root / ".runtime" / "tts-diagnostics"
            self.assertTrue((evidence_dir / "S01.frame-cap-1.00.wav").is_file())
            self.assertTrue((evidence_dir / "S01.frame-cap-1.25.failed.wav").is_file())

    def test_voice_cli_exposes_turbo_diagnostic_controls(self):
        args = build_parser().parse_args(
            [
                "voice",
                "job",
                "--tts-backend",
                "onnx",
                "--tts-precision",
                "int8",
                "--tts-frame-cap",
                "off",
                "--tts-max-chars",
                "160",
                "--speech-rate-warning-wps",
                "3.9",
            ]
        )
        self.assertEqual(args.tts_backend, "onnx")
        self.assertEqual(args.tts_precision, "int8")
        self.assertEqual(args.tts_frame_cap, "off")
        self.assertEqual(args.tts_max_chars, 160)
        self.assertEqual(args.speech_rate_warning_wps, 3.9)
        self.assertTrue(args.tts_fp32_fallback)

        no_fallback = build_parser().parse_args(
            ["voice", "job", "--no-tts-fp32-fallback"]
        )
        self.assertFalse(no_fallback.tts_fp32_fallback)


class VieNeuGradioEndpointTests(unittest.TestCase):
    @staticmethod
    def _config(api_name="wrapper", text_label="Văn bản", output_type="audio"):
        return {
            "components": [
                {"id": 1, "type": "textbox", "props": {"label": text_label, "value": ""}},
                {"id": 2, "type": "dropdown", "props": {"label": "Giọng mẫu", "value": "Hải Đăng"}},
                {"id": 3, "type": output_type, "props": {"label": "Audio"}},
                {"id": 4, "type": "textbox", "props": {"label": "Khác"}},
            ],
            "dependencies": [
                {"api_name": api_name, "inputs": [1, 2], "outputs": [3]},
            ],
        }

    def test_selects_only_verified_single_speaker_synthesis_endpoint(self):
        config = self._config()
        config["dependencies"].insert(
            0,
            {"api_name": "load_model", "inputs": [1, 4], "outputs": [3]},
        )
        dep = _select_vieneu_gradio_dependency(config)
        self.assertEqual(dep["api_name"], "wrapper")

    def test_rejects_unrelated_endpoint_instead_of_falling_back(self):
        config = self._config(api_name="load_model")
        with self.assertRaisesRegex(PipelineError, "endpoint tạo giọng"):
            _select_vieneu_gradio_dependency(config)

    def test_rejects_semantically_wrong_wrapper(self):
        config = self._config(text_label="Kịch bản hội thoại")
        with self.assertRaisesRegex(PipelineError, "endpoint tạo giọng"):
            _select_vieneu_gradio_dependency(config)


class TtsDiagnosticsRegressionTests(unittest.TestCase):
    def test_rejects_non_finite_threshold(self):
        production = {"scenes": [{"id": "S01", "voice": "một hai"}]}
        for value in (float("nan"), float("inf"), float("-inf"), 0.0, -1.0):
            with self.subTest(value=value):
                with self.assertRaises(PipelineError):
                    build_tts_diagnostics(
                        production,
                        {"S01": 1.0},
                        warning_wps=value,
                    )

    def test_invalid_threshold_fails_before_tts_runs(self):
        production = {"scenes": [{"id": "S01", "voice": "một hai"}]}
        with tempfile.TemporaryDirectory() as temp, patch(
            "tools.zodiac_local.run_tts_batch"
        ) as run:
            with self.assertRaises(PipelineError):
                generate_scene_voices(
                    Path(temp),
                    production,
                    speech_rate_warning_wps=float("nan"),
                )
            run.assert_not_called()

    def test_partial_generation_writes_job_wide_diagnostics(self):
        production = {
            "scenes": [
                {"id": "S01", "voice": "một hai ba"},
                {"id": "S02", "voice": "bốn năm sáu"},
            ],
        }
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_pcm(root / ".runtime" / "tts-scenes" / "S01.wav", seconds=1.0)

            def fake_batch(runtime, rows, **_kwargs):
                scene_dir = Path(runtime) / "tts-scenes"
                scene_dir.mkdir(parents=True, exist_ok=True)
                for row in rows:
                    row["output"] = str(scene_dir / f"{row['scene_id']}.wav")
                    write_pcm(Path(row["output"]), seconds=2.0)

            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch):
                durations = generate_scene_voices(
                    root,
                    production,
                    ["S02"],
                    fp32_fallback_on_rate_warning=False,
                )

            self.assertEqual(set(durations), {"S01", "S02"})
            diagnostics = json.loads(
                (root / ".runtime" / "tts-diagnostics.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                [scene["scene_id"] for scene in diagnostics["scenes"]],
                ["S01", "S02"],
            )
            self.assertEqual(diagnostics["summary"]["word_count"], 6)

    def test_rate_warning_does_not_regenerate_full_batch(self):
        production = {
            "scenes": [
                {"id": "S01", "voice": " ".join(f"t{i}" for i in range(10))},
                {"id": "S02", "voice": " ".join(f"t{i}" for i in range(10))},
            ],
        }
        calls = []
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)

            def fake_batch(runtime, rows, **kwargs):
                calls.append(
                    {
                        "ids": [row["scene_id"] for row in rows],
                        "url": kwargs.get("vieneu_url"),
                    }
                )
                scene_dir = Path(runtime) / "tts-scenes"
                scene_dir.mkdir(parents=True, exist_ok=True)
                for row in rows:
                    row["output"] = str(scene_dir / f"{row['scene_id']}.wav")
                    write_pcm(Path(row["output"]), seconds=1.0)

            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch):
                generate_scene_voices(
                    root,
                    production,
                    vieneu_url="http://127.0.0.1:7860",
                )

            self.assertEqual(
                calls,
                [
                    {
                        "ids": ["S01", "S02"],
                        "url": "http://127.0.0.1:7860",
                    }
                ],
            )
            diagnostics = json.loads(
                (root / ".runtime" / "tts-diagnostics.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(
                diagnostics["rate_policy"]["action"],
                "warning_only",
            )

    def test_asr_spelling_variant_reuses_measured_timing(self):
        class Word:
            def __init__(self, word, start, end):
                self.word = word
                self.start = start
                self.end = end
                self.probability = 0.95

        class Segment:
            words = [
                Word("Sử", 0.0, 0.2),
                Word("Nữ", 0.2, 0.4),
            ]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        aligned = _align_scene_words(Model(), Path("S01.wav"), "Xử Nữ")
        self.assertEqual([item["text"] for item in aligned], ["Xử", "Nữ"])
        self.assertEqual(aligned[0]["alignment_source"], "asr_variant")
        self.assertAlmostEqual(aligned[0]["startMs"], 0.0)
        self.assertAlmostEqual(aligned[0]["endMs"], 200.0)

    def test_missing_expected_word_is_a_coverage_gap(self):
        class Word:
            def __init__(self, word, start, end):
                self.word = word
                self.start = start
                self.end = end
                self.probability = 0.95

        class Segment:
            words = [
                Word("một", 0.0, 0.2),
                Word("ba", 0.2, 0.4),
            ]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        try:
            _align_scene_words(Model(), Path("S01.wav"), "một hai ba")
        except PipelineError as exc:
            self.assertIn("ALIGNMENT_MISMATCH", str(exc))
            self.assertTrue(getattr(exc, "coverage_gap", False))
        else:
            self.fail("Expected alignment mismatch")

    def test_percent_number_compaction_is_split_across_approved_words(self):
        class Word:
            word = "8%"
            start = 0.0
            end = 0.6
            probability = 0.95

        class Segment:
            words = [Word()]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        aligned = _align_scene_words(
            Model(),
            Path("S01.wav"),
            "tám phần trăm",
        )
        self.assertEqual(
            [item["text"] for item in aligned],
            ["tám", "phần", "trăm"],
        )
        self.assertAlmostEqual(aligned[0]["startMs"], 0.0)
        self.assertAlmostEqual(aligned[-1]["endMs"], 600.0)

    def test_alignment_variant_never_calls_recovery_callback(self):
        production = {
            "video": {"fps": 30},
            "scenes": [{"id": "S01", "voice": "Xử Nữ"}],
        }
        mismatch = AlignmentMismatchError(
            "ALIGNMENT_MISMATCH: variant",
            expected=["xử", "nữ"],
            heard=["sử", "nữ"],
            coverage_gap=False,
        )
        calls = []

        def recover(*args):
            calls.append(args)
            return [], 1.0

        with patch("tools.zodiac_local._align_scene_words", side_effect=mismatch):
            with self.assertRaises(AlignmentMismatchError):
                align_scene_timings(
                    production,
                    {"S01": 1.0},
                    object(),
                    [Path("S01.wav")],
                    mismatch_recovery=recover,
                )
        self.assertEqual(calls, [])

    def test_retry_eligibility_does_not_require_rate_warning(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runtime = root / ".runtime"
            runtime.mkdir(parents=True)
            (runtime / "tts-diagnostics.json").write_text(
                json.dumps(
                    {
                        "scenes": [
                            {
                                "scene_id": "S01",
                                "speech_rate_warning": False,
                                "generation": {
                                    "transport": "gradio",
                                    "backend": "server-managed",
                                    "precision": "server-managed",
                                    "frame_cap": None,
                                },
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            self.assertTrue(
                tts_scene_frame_cap_retry_eligible(
                    root,
                    "S01",
                    selected_mode="v3turbo",
                    allow_fp32_fallback=True,
                )
            )

    def test_retry_eligibility_respects_fp32_opt_out(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runtime = root / ".runtime"
            runtime.mkdir(parents=True)
            (runtime / "tts-diagnostics.json").write_text(
                json.dumps(
                    {
                        "scenes": [
                            {
                                "scene_id": "S01",
                                "speech_rate_warning": True,
                                "generation": {
                                    "transport": "gradio",
                                    "backend": "server-managed",
                                    "precision": "server-managed",
                                    "frame_cap": None,
                                },
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            self.assertFalse(
                tts_scene_frame_cap_retry_eligible(
                    root,
                    "S01",
                    selected_mode="v3turbo",
                    allow_fp32_fallback=False,
                )
            )

    def test_retry_eligibility_rejects_non_turbo_mode(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runtime = root / ".runtime"
            runtime.mkdir(parents=True)
            (runtime / "tts-diagnostics.json").write_text(
                json.dumps(
                    {
                        "scenes": [
                            {
                                "scene_id": "S01",
                                "speech_rate_warning": True,
                                "generation": {
                                    "transport": "gradio",
                                    "backend": "server-managed",
                                    "precision": "server-managed",
                                    "frame_cap": None,
                                },
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            self.assertFalse(
                tts_scene_frame_cap_retry_eligible(
                    root,
                    "S01",
                    selected_mode="v3nano",
                    allow_fp32_fallback=True,
                )
            )

    def test_adaptive_retry_stops_when_next_mismatch_has_no_coverage_gap(self):
        production = {
            "scenes": [{"id": "S01", "voice": "một hai"}],
        }
        variant = AlignmentMismatchError(
            "ALIGNMENT_MISMATCH: variant after retry",
            expected=["một", "hai"],
            heard=["mốt", "hai"],
            coverage_gap=False,
        )
        calls = []
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runtime = root / ".runtime"
            scene = runtime / "tts-scenes" / "S01.wav"
            write_pcm(scene, seconds=1.0, rate=8000)
            runtime.mkdir(parents=True, exist_ok=True)
            (runtime / "tts-diagnostics.json").write_text(
                json.dumps(
                    {
                        "scenes": [
                            {
                                "scene_id": "S01",
                                "generation": {
                                    "transport": "gradio",
                                    "backend": "server-managed",
                                    "precision": "server-managed",
                                    "frame_cap": None,
                                },
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            def fake_batch(runtime_path, rows, **kwargs):
                calls.append(kwargs["frame_cap_scale"])
                write_pcm(
                    Path(runtime_path) / "tts-scenes" / "S01.wav",
                    seconds=2.0,
                    rate=8000,
                )

            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch), patch(
                "tools.zodiac_local._align_scene_words",
                side_effect=variant,
            ):
                with self.assertRaises(AlignmentMismatchError):
                    recover_scene_alignment_with_adaptive_frame_cap(
                        root,
                        production,
                        "S01",
                        object(),
                        selected_mode="v3turbo",
                        allow_fp32_fallback=True,
                    )

            self.assertEqual(calls, [1.0])
            with wave.open(str(scene), "rb") as wav:
                self.assertAlmostEqual(
                    wav.getnframes() / wav.getframerate(),
                    1.0,
                    places=2,
                )

    def test_recovery_function_rejects_fp32_opt_out(self):
        production = {"scenes": [{"id": "S01", "voice": "một hai"}]}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_pcm(
                root / ".runtime" / "tts-scenes" / "S01.wav",
                seconds=1.0,
                rate=8000,
            )
            with self.assertRaisesRegex(PipelineError, "TTS_RECOVERY_DISABLED"):
                recover_scene_alignment_with_adaptive_frame_cap(
                    root,
                    production,
                    "S01",
                    object(),
                    selected_mode="v3turbo",
                    allow_fp32_fallback=False,
                )

    def test_recovery_function_rejects_model_switch(self):
        production = {"scenes": [{"id": "S01", "voice": "một hai"}]}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_pcm(
                root / ".runtime" / "tts-scenes" / "S01.wav",
                seconds=1.0,
                rate=8000,
            )
            with self.assertRaisesRegex(
                PipelineError,
                "TTS_RECOVERY_UNSUPPORTED_MODE",
            ):
                recover_scene_alignment_with_adaptive_frame_cap(
                    root,
                    production,
                    "S01",
                    object(),
                    selected_mode="v3nano",
                    allow_fp32_fallback=True,
                )

    def test_asr_merged_words_do_not_trigger_coverage_retry(self):
        expected = ["mấy", "chuyện", "bé", "tí"]
        measured = [
            {"heard": "mới", "startMs": 0.0, "endMs": 150.0, "confidence": 0.9},
            {"heard": "chuyện", "startMs": 150.0, "endMs": 350.0, "confidence": 0.95},
            {"heard": "betty", "startMs": 350.0, "endMs": 650.0, "confidence": 0.85},
        ]
        self.assertFalse(_alignment_coverage_gap(expected, measured))

    def test_asr_merged_token_is_split_across_approved_words(self):
        class Word:
            def __init__(self, word, start, end):
                self.word = word
                self.start = start
                self.end = end
                self.probability = 0.9

        class Segment:
            words = [
                Word("mới", 0.0, 0.15),
                Word("chuyện", 0.15, 0.35),
                Word("betty", 0.35, 0.65),
            ]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        aligned = _align_scene_words(
            Model(),
            Path("S01.wav"),
            "mấy chuyện bé tí",
        )
        self.assertEqual(
            [item["text"] for item in aligned],
            ["mấy", "chuyện", "bé", "tí"],
        )
        self.assertEqual(
            [item["alignment_source"] for item in aligned[-2:]],
            ["asr_variant_split", "asr_variant_split"],
        )
        self.assertAlmostEqual(aligned[-2]["startMs"], 350.0)
        self.assertAlmostEqual(aligned[-1]["endMs"], 650.0)

    def test_multi_digit_number_compaction_matches_spelled_number(self):
        self.assertEqual(
            _alignment_units("12%"),
            ["mười", "hai", "phần", "trăm"],
        )
        measured = [
            {
                "heard": "12%",
                "startMs": 0.0,
                "endMs": 500.0,
                "confidence": 0.95,
            }
        ]
        self.assertFalse(
            _alignment_coverage_gap(
                ["mười", "hai", "phần", "trăm"],
                measured,
            )
        )

    def test_non_turbo_config_reports_only_applied_settings(self):
        config = effective_tts_generation_config(
            mode="v3nano",
            vieneu_url=None,
            backend="onnx",
            precision="fp32",
            frame_cap="on",
            max_chars=256,
        )
        self.assertEqual(config["transport"], "local")
        self.assertIsNone(config["backend"])
        self.assertIsNone(config["precision"])
        self.assertIsNone(config["frame_cap"])
        self.assertEqual(config["max_chars"], 256)


class PublishBundleTests(unittest.TestCase):
    def _rendered_job(self, root: Path) -> Path:
        job = write_package(root)
        out = job / "out"
        out.mkdir(parents=True, exist_ok=True)
        (out / "zodiac-story.mp4").write_bytes(b"video")
        (out / "cover.png").write_bytes(b"cover")
        (out / "publish-copy.txt").write_text(
            "COVER IDENTITY:\nXỬ NỮ ♍\n",
            encoding="utf-8",
        )
        (out / "publish.json").write_text(
            json.dumps({"version": "1.1"}),
            encoding="utf-8",
        )
        return job

    def test_publish_outputs_require_cover(self):
        with tempfile.TemporaryDirectory() as temp:
            job = self._rendered_job(Path(temp))
            (job / "out/cover.png").unlink()
            with self.assertRaisesRegex(PipelineError, "cover.png"):
                validate_publish_outputs(job)

    def test_publish_bundle_contains_video_cover_copy_and_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            job = self._rendered_job(Path(temp))
            mixed = job / "out/zodiac-story.with-music.mp4"
            mixed.write_bytes(b"mixed")
            bundle = package_publish_outputs(
                job,
                final_video=mixed,
            )
            self.assertTrue(bundle.is_file())
            with zipfile.ZipFile(bundle) as archive:
                self.assertEqual(
                    set(archive.namelist()),
                    {
                        "zodiac-story.mp4",
                        "cover.png",
                        "publish-copy.txt",
                        "publish.json",
                    },
                )
                self.assertEqual(
                    archive.read("zodiac-story.mp4"),
                    b"mixed",
                )


class RendererPrepareCacheTests(unittest.TestCase):
    def test_renderer_check_cache_invalidates_on_publish_metadata_change(self):
        from tools.zodiac_local import (
            mark_renderer_checks_cached,
            renderer_check_fingerprint,
            renderer_checks_cached,
        )

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            key = renderer_check_fingerprint(job)
            self.assertFalse(renderer_checks_cached(job, key))
            mark_renderer_checks_cached(job, key)
            self.assertTrue(renderer_checks_cached(job, key))

            publish_path = job / "publish" / "publish.json"
            publish = json.loads(publish_path.read_text(encoding="utf-8"))
            publish["cover"]["hook"] = "HOOK KHÁC"
            publish_path.write_text(
                json.dumps(publish, ensure_ascii=False),
                encoding="utf-8",
            )
            changed = renderer_check_fingerprint(job)
            self.assertNotEqual(key, changed)
            self.assertFalse(renderer_checks_cached(job, changed))

    def test_renderer_check_cache_ignores_publish_copy_only_change(self):
        from tools.zodiac_local import (
            mark_renderer_checks_cached,
            renderer_check_fingerprint,
            renderer_checks_cached,
        )

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            key = renderer_check_fingerprint(job)
            mark_renderer_checks_cached(job, key)

            copy_path = job / "publish" / "publish-copy.txt"
            copy_path.write_text(
                copy_path.read_text(encoding="utf-8") + "\nALT CAPTION\n",
                encoding="utf-8",
            )
            self.assertEqual(key, renderer_check_fingerprint(job))
            self.assertTrue(renderer_checks_cached(job, key))

    def test_prepare_renderer_reuses_successful_checks_when_inputs_are_identical(self):
        from tools.zodiac_local import prepare_renderer

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            bin_dir = job / "renderer" / "node_modules" / ".bin"
            bin_dir.mkdir(parents=True)
            for name in ("remotion", "remotion.cmd", "tsc", "tsc.cmd"):
                (bin_dir / name).write_text("", encoding="utf-8")

            calls = []

            def fake_npm(args, _cwd):
                calls.append(tuple(args))

            common = (
                patch("tools.zodiac_local.validate_runtime"),
                patch("tools.zodiac_local.validate_package"),
                patch("tools.zodiac_local.validate_publish_contract"),
                patch("tools.zodiac_local._patch_renderer_typescript_compatibility"),
                patch("tools.zodiac_local._patch_renderer_font_readiness"),
                patch("tools.zodiac_local._run_npm", side_effect=fake_npm),
                patch("tools.zodiac_local.shutil.which", return_value="/usr/bin/true"),
            )
            with common[0], common[1], common[2], common[3], common[4], common[5], common[6]:
                prepare_renderer(job)
                first = list(calls)
                calls.clear()
                prepare_renderer(job)
                second = list(calls)

            self.assertIn(("run", "test"), first)
            self.assertIn(("run", "typecheck"), first)
            self.assertIn(("run", "compile:style"), second)
            self.assertNotIn(("run", "test"), second)
            self.assertNotIn(("run", "typecheck"), second)


class ArtifactFingerprintTests(unittest.TestCase):
    def test_publish_copy_change_does_not_dirty_video_or_cover(self):
        from tools.zodiac_local import artifact_fingerprints

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            before = artifact_fingerprints(job)
            copy_path = job / "publish" / "publish-copy.txt"
            copy_path.write_text(
                copy_path.read_text(encoding="utf-8") + "\nALT CAPTION\n",
                encoding="utf-8",
            )
            after = artifact_fingerprints(job)

            self.assertEqual(before["video"], after["video"])
            self.assertEqual(before["cover"], after["cover"])
            self.assertNotEqual(before["publish_copy"], after["publish_copy"])
            self.assertNotEqual(before["publish"], after["publish"])
            self.assertNotEqual(before["bundle"], after["bundle"])

    def test_cover_hook_change_dirties_cover_not_video(self):
        from tools.zodiac_local import artifact_fingerprints

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            before = artifact_fingerprints(job)
            publish_path = job / "publish" / "publish.json"
            publish = json.loads(publish_path.read_text(encoding="utf-8"))
            publish["cover"]["hook"] = "HOOK MỚI"
            publish_path.write_text(
                json.dumps(publish, ensure_ascii=False),
                encoding="utf-8",
            )
            after = artifact_fingerprints(job)

            self.assertEqual(before["video"], after["video"])
            self.assertNotEqual(before["cover_spec"], after["cover_spec"])
            self.assertNotEqual(before["cover"], after["cover"])
            self.assertNotEqual(before["publish"], after["publish"])
            self.assertNotEqual(before["bundle"], after["bundle"])

    def test_runtime_timing_change_dirties_video_mix_but_not_cover(self):
        from tools.zodiac_local import artifact_fingerprints

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            runtime = job / ".runtime"
            runtime.mkdir(parents=True, exist_ok=True)
            timing = valid_timing()
            (runtime / "timing.json").write_text(
                json.dumps(timing),
                encoding="utf-8",
            )
            before = artifact_fingerprints(job)
            timing["scenes"][0]["duration_frames"] += 1
            timing["total_duration_frames"] += 1
            (runtime / "timing.json").write_text(
                json.dumps(timing),
                encoding="utf-8",
            )
            after = artifact_fingerprints(job)

            self.assertNotEqual(before["runtime"], after["runtime"])
            self.assertNotEqual(before["video"], after["video"])
            self.assertNotEqual(before["mix"], after["mix"])
            self.assertEqual(before["cover"], after["cover"])

    def test_music_change_dirties_mix_and_bundle_not_video_or_cover(self):
        from tools.zodiac_local import artifact_fingerprints

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            media = job / "media"
            media.mkdir(parents=True, exist_ok=True)
            music = media / "background-music.mp3"
            music.write_bytes(b"one")
            runtime = job / ".runtime"
            runtime.mkdir(parents=True, exist_ok=True)
            (runtime / "audio.json").write_text(
                json.dumps(
                    {
                        "background_music": "media/background-music.mp3",
                        "background_music_volume": 0.5,
                    }
                ),
                encoding="utf-8",
            )
            before = artifact_fingerprints(job)
            music.write_bytes(b"two")
            after = artifact_fingerprints(job)

            self.assertEqual(before["video"], after["video"])
            self.assertEqual(before["cover"], after["cover"])
            self.assertNotEqual(before["music"], after["music"])
            self.assertNotEqual(before["mix"], after["mix"])
            self.assertNotEqual(before["bundle"], after["bundle"])

    def test_stage_metrics_are_persisted_for_benchmarking(self):
        from tools.zodiac_local import measure_performance_stage

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            with patch(
                "tools.zodiac_local.time.perf_counter",
                side_effect=[10.0, 10.25],
            ):
                with measure_performance_stage(
                    job,
                    "renderer.typecheck",
                    input_fingerprint="abc123",
                    cache_hit=False,
                ):
                    pass

            payload = json.loads(
                (job / ".runtime" / "performance.json").read_text(
                    encoding="utf-8"
                )
            )
            row = payload["stages"]["renderer.typecheck"]
            self.assertEqual(row["elapsed_ms"], 250)
            self.assertEqual(row["status"], "PASS")
            self.assertFalse(row["cache_hit"])
            self.assertEqual(row["input_fingerprint"], "abc123")
            self.assertIn("video", payload["fingerprints"])
            self.assertIn("mix", payload["fingerprints"])


class BackgroundMusicTests(unittest.TestCase):
    def _job(self, root: Path) -> Path:
        job = root / "job"
        (job / ".runtime").mkdir(
            parents=True,
        )
        write_pcm(
            job / "voice.wav",
            seconds=1.0,
        )
        return job

    def test_accepts_100_percent_volume_in_runtime_config(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake")
            configure_background_music(
                job,
                music,
                1.0,
            )
            config = validate_background_music(job)
            self.assertIsNotNone(config)
            self.assertEqual(
                config["background_music_volume"],
                1.0,
            )
            self.assertEqual(
                config["background_music"],
                "media/background-music.mp3",
            )

    def test_rejects_volume_above_100_percent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake")
            with self.assertRaisesRegex(
                PipelineError,
                "between 0 and 1",
            ):
                configure_background_music(
                    job,
                    music,
                    1.01,
                )

    def test_audio_preview_pads_short_voice_to_requested_duration(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake")
            captured = {}

            def fake_ffmpeg(arguments):
                captured["arguments"] = arguments
                Path(arguments[-1]).write_bytes(
                    b"preview"
                )

            with patch(
                "tools.zodiac_local._run_ffmpeg",
                side_effect=fake_ffmpeg,
            ):
                output = build_audio_preview(
                    job,
                    music,
                    0.75,
                    10,
                )

            self.assertTrue(output.is_file())
            args = captured["arguments"]
            filter_complex = args[
                args.index("-filter_complex") + 1
            ]
            self.assertIn(
                "apad=pad_dur=10.000",
                filter_complex,
            )
            self.assertIn(
                "duration=longest",
                filter_complex,
            )
            self.assertIn(
                "atrim=0:10.000",
                filter_complex,
            )
            self.assertNotIn(
                "duration=first",
                filter_complex,
            )
            self.assertEqual(
                args[args.index("-t") + 1],
                "10.000",
            )

    def test_ffmpeg_runner_uses_the_managed_argv_boundary(self):
        with tempfile.TemporaryDirectory() as temp:
            fake = Path(temp) / "ffmpeg"
            fake.write_bytes(b"x")
            with patch(
                "tools.zodiac_local.shutil.which",
                return_value=str(fake),
            ), patch(
                "tools.zodiac_local.run_managed_subprocess",
            ) as run:
                _run_ffmpeg(
                    ["-i", "name;not-shell.mp3"]
                )
            args = run.call_args.args[0]
            self.assertEqual(Path(args[0]), fake.resolve())
            self.assertEqual(
                args[1:],
                ["-i", "name;not-shell.mp3"],
            )
            self.assertTrue(run.call_args.kwargs["check"])

    def test_final_render_postmix_uses_selected_volume(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._job(root)
            music = root / "music.mp3"
            music.write_bytes(b"fake")
            configure_background_music(
                job,
                music,
                0.65,
            )
            out = job / "out" / "zodiac-story.mp4"
            out.parent.mkdir(parents=True)
            out.write_bytes(b"video")
            captured = {}

            def fake_ffmpeg(arguments):
                captured["arguments"] = arguments
                Path(arguments[-1]).write_bytes(
                    b"mixed"
                )

            with patch(
                "tools.zodiac_local._run_ffmpeg",
                side_effect=fake_ffmpeg,
            ):
                result = mix_background_music_into_render(
                    job
                )

            mixed = job / "out" / "zodiac-story.with-music.mp4"
            self.assertEqual(result, mixed)
            self.assertEqual(
                mixed.read_bytes(),
                b"mixed",
            )
            self.assertEqual(
                out.read_bytes(),
                b"video",
                "the pristine render must survive so remixing cannot stack audio",
            )
            filter_complex = captured["arguments"][
                captured["arguments"].index(
                    "-filter_complex"
                )
                + 1
            ]
            self.assertIn(
                "volume=0.650",
                filter_complex,
            )


if __name__ == "__main__":
    unittest.main()
