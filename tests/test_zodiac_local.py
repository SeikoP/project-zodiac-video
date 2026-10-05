import hashlib
import json
import stat
import tempfile
import unittest
from unittest.mock import patch
import wave
import zipfile
from pathlib import Path

from tools.zodiac_local import (
    PipelineError,
    _align_scene_words,
    _run_ffmpeg,
    _select_vieneu_gradio_dependency,
    align_scene_timings,
    build_audio_preview,
    build_parser,
    build_timing_from_word_alignment,
    build_tts_diagnostics,
    effective_tts_generation_config,
    generate_scene_voices,
    recover_scene_alignment_with_adaptive_frame_cap,
    concatenate_wavs,
    configure_background_music,
    import_package,
    mix_background_music_into_render,
    safe_extract_zip,
    validate_background_music,
    validate_package,
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
            "font_size_px": 72,
            "min_font_size_px": 48,
            "max_lines": 2,
            "color_role": "ink",
            "highlight_role": "coral",
            "background_role": "sticker_edge",
        },
        "safe_zone": {
            "x": 72,
            "y": 1190,
            "width": 840,
            "height": 300,
        },
        "motion_grammar": {
            "state_swap": "voice-anchored-character-pose-change",
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
            "font_size_px": 72,
            "min_font_size_px": 48,
            "font_weight": 500,
            "color": "#252A2E",
            "highlight_color": "#E36C54",
            "background": "#FFFDF8",
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
        "assets/characters/lead-neutral.svg": svg,
        "assets/characters/lead-active.svg": svg,
        "renderer/package.json": json.dumps(renderer_package),
    }
    for path in (
        "renderer/src/index.ts",
        "renderer/src/Root.tsx",
        "renderer/src/ZodiacComposition.tsx",
        "renderer/src/PrimitiveSvg.tsx",
        "renderer/src/types.ts",
        "renderer/src/runtime-contract.mjs",
        "renderer/scripts/render.mjs",
        "renderer/scripts/generate-sfx.mjs",
        "renderer/scripts/style-token.mjs",
        "renderer/scripts/compile-style-token.mjs",
        "renderer/schemas/production.schema.json",
        "renderer/tests/pipeline-contract.test.mjs",
    ):
        files[path] = "test fixture\n"
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

            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch), patch(
                "tools.zodiac_local._align_scene_words",
                side_effect=PipelineError("ALIGNMENT_MISMATCH: still missing"),
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

            with patch("tools.zodiac_local.run_tts_batch", side_effect=fake_batch), patch(
                "tools.zodiac_local._align_scene_words",
                side_effect=[
                    PipelineError("ALIGNMENT_MISMATCH: still missing at 1.25"),
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

    def test_percent_number_compaction_does_not_look_like_missing_words(self):
        class Word:
            word = "8%"
            start = 0.0
            end = 0.4
            probability = 0.95

        class Segment:
            words = [Word()]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        try:
            _align_scene_words(
                Model(),
                Path("S01.wav"),
                "tám phần trăm",
            )
        except PipelineError as exc:
            self.assertFalse(getattr(exc, "coverage_gap", True))
        else:
            self.fail("Expected exact-token mismatch before timing reconciliation")

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

    def test_ffmpeg_runner_never_uses_shell(self):
        with tempfile.TemporaryDirectory() as temp:
            fake = Path(temp) / "ffmpeg"
            fake.write_bytes(b"x")
            with patch(
                "tools.zodiac_local.shutil.which",
                return_value=str(fake),
            ), patch(
                "tools.zodiac_local.subprocess.run",
            ) as run:
                _run_ffmpeg(
                    ["-i", "name;not-shell.mp3"]
                )
            self.assertFalse(
                run.call_args.kwargs["shell"]
            )
            self.assertEqual(
                Path(
                    run.call_args.args[0][0]
                ),
                fake.resolve(),
            )

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

            self.assertEqual(result, out)
            self.assertEqual(
                out.read_bytes(),
                b"mixed",
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
