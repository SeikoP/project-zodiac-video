from .support import *

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

    def test_alignment_writer_can_persist_timing_before_visual_runtime_gate(self):
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
            build_and_write_timing(job, timing, check_visual_progression=False)
            saved = job / ".runtime" / "timing.json"
            self.assertTrue(saved.is_file())
            with self.assertRaisesRegex(PipelineError, "VISUAL_PROGRESSION_TIMING.*5.0s"):
                validate_timing(job, saved)

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

    def test_concatenates_pcm_wavs_with_scene_gap(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first = root / "a.wav"
            second = root / "b.wav"
            write_pcm(first, 0.2, 10)
            write_pcm(second, 0.3, 10)
            output = root / "voice.wav"
            concatenate_wavs([first, second], output, gap_ms=300)
            with wave.open(str(output), "rb") as wav:
                self.assertEqual(wav.getnframes(), 8)

    def test_sentence_pause_shifts_following_words_and_extends_scene(self):
        production = {
            "video": {"fps": 30},
            "scenes": [{"id": "S01", "voice": "một. hai"}],
        }
        timing = build_timing_from_word_alignment(
            production,
            {"S01": 1.0},
            {
                "S01": [
                    {"text": "một.", "startMs": 0, "endMs": 300, "timestampMs": 0},
                    {"text": "hai", "startMs": 400, "endMs": 900, "timestampMs": 400},
                ],
            },
            sentence_pause_ms=300,
        )
        row = timing["scenes"][0]
        self.assertEqual(row["duration_frames"], 39)
        self.assertAlmostEqual(row["captions"][0]["endMs"], 300.0)
        self.assertAlmostEqual(row["captions"][1]["startMs"], 700.0)
        self.assertAlmostEqual(row["captions"][1]["endMs"], 1200.0)

    def test_final_voice_inserts_sentence_silence_without_regenerating_scene_wav(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            scene_dir = root / ".runtime" / "tts-scenes"
            scene_dir.mkdir(parents=True)
            source = scene_dir / "S01.wav"
            write_pcm(source, 1.0, 10)
            production = {
                "video": {"fps": 30},
                "scenes": [{"id": "S01", "voice": "một. hai"}],
            }
            timing = build_timing_from_word_alignment(
                production,
                {"S01": 1.0},
                {
                    "S01": [
                        {"text": "một.", "startMs": 0, "endMs": 300, "timestampMs": 0},
                        {"text": "hai", "startMs": 400, "endMs": 900, "timestampMs": 400},
                    ],
                },
                sentence_pause_ms=300,
            )
            output = concatenate_scene_voices(
                root,
                production,
                sentence_pause_ms=300,
                timing=timing,
            )
            with wave.open(str(source), "rb") as original:
                self.assertEqual(original.getnframes(), 10)
            with wave.open(str(output), "rb") as final:
                self.assertEqual(final.getnframes(), 13)


    def test_word_timing_can_hold_scene_for_breathing_gap(self):
        production = {
            "video": {"fps": 30},
            "scenes": [
                {"id": "S01", "voice": "một"},
                {"id": "S02", "voice": "hai"},
            ],
        }
        timing = build_timing_from_word_alignment(
            production,
            {"S01": 1.0, "S02": 1.0},
            {
                "S01": [{"text": "một", "startMs": 0, "endMs": 900, "timestampMs": 0}],
                "S02": [{"text": "hai", "startMs": 0, "endMs": 900, "timestampMs": 0}],
            },
            scene_gap_ms=350,
        )
        self.assertEqual(timing["scenes"][0]["duration_frames"], 40)
        self.assertEqual(timing["scenes"][1]["start_frame"], 40)
        self.assertAlmostEqual(timing["scenes"][1]["captions"][0]["startMs"], 1350.0)


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

    def test_repairs_zero_duration_token_sharing_neighbor_boundary(self):
        class Word:
            def __init__(self, word, start, end):
                self.word = word
                self.start = start
                self.end = end
                self.probability = 0.9

        class Segment:
            words = [
                Word("cũ", 6.58, 6.90),
                Word("có", 6.90, 6.90),
                Word("vấn", 6.90, 7.04),
            ]

        class Model:
            def transcribe(self, *args, **kwargs):
                return [Segment()], object()

        aligned = _align_scene_words(Model(), Path("S03.wav"), "cũ có vấn")
        self.assertEqual([item["text"] for item in aligned], ["cũ", "có", "vấn"])
        self.assertAlmostEqual(aligned[1]["startMs"], 6900.0)
        self.assertAlmostEqual(aligned[1]["endMs"], 6956.0)
        self.assertAlmostEqual(aligned[2]["startMs"], 6956.0)
        self.assertAlmostEqual(aligned[2]["endMs"], 7040.0)

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


