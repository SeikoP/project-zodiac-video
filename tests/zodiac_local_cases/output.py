from .support import *

class FinalOutputTests(unittest.TestCase):
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

    def test_finalize_keeps_loose_outputs_and_creates_no_publish_zip(self):
        with tempfile.TemporaryDirectory() as temp:
            job = self._rendered_job(Path(temp))
            out = job / "out"
            stale_bundle = out / "zodiac-publish-bundle.zip"
            stale_mixed = out / "zodiac-story.with-music.mp4"
            stale_bundle.write_bytes(b"old")
            stale_mixed.write_bytes(b"old")
            outputs = finalize_publish_outputs(
                job,
                final_video=out / "zodiac-story.mp4",
            )
            self.assertEqual(outputs["video"], out / "zodiac-story.mp4")
            self.assertTrue((out / "cover.png").is_file())
            self.assertTrue((out / "publish-copy.txt").is_file())
            self.assertTrue((out / "publish.json").is_file())
            self.assertFalse(stale_bundle.exists())
            self.assertFalse(stale_mixed.exists())


class RendererPrepareCacheTests(unittest.TestCase):
    def _prepare_twice(self, job):
        from tools.zodiac_local import prepare_renderer

        calls = []
        installs = []

        def fake_npm(args, _cwd):
            calls.append(tuple(args))

        def fake_install(_renderer):
            installs.append("install")

        common = (
            patch("tools.zodiac_local.validate_runtime"),
            patch("tools.zodiac_local.validate_package"),
            patch("tools.zodiac_local.validate_publish_contract"),
            patch("tools.zodiac_local._patch_renderer_typescript_compatibility"),
            patch("tools.zodiac_local._patch_renderer_font_readiness"),
            patch("tools.zodiac_local._renderer_dependencies_installed", return_value=True),
            patch("tools.zodiac_local._install_renderer", side_effect=fake_install),
            patch("tools.zodiac_local._run_npm", side_effect=fake_npm),
            patch("tools.zodiac_local.shutil.which", return_value="/usr/bin/true"),
        )
        with (
            common[0],
            common[1],
            common[2],
            common[3],
            common[4],
            common[5],
            common[6],
            common[7],
            common[8],
        ):
            prepare_renderer(job)
            first = list(calls)
            calls.clear()
            prepare_renderer(job)
            second = list(calls)
        return first, second, installs

    def test_renderer_dependency_fingerprint_changes_with_dependency_spec(self):
        from tools.zodiac_local import renderer_dependency_fingerprint

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            before = renderer_dependency_fingerprint(job)
            package_path = job / "renderer" / "package.json"
            package = json.loads(package_path.read_text(encoding="utf-8"))
            package["dependencies"]["react"] = "19.0.1"
            package_path.write_text(json.dumps(package), encoding="utf-8")
            after = renderer_dependency_fingerprint(job)
            self.assertNotEqual(before, after)

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

    def test_identical_second_prepare_skips_install_compile_tests_and_typecheck(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            first, second, installs = self._prepare_twice(job)

            self.assertIn(("run", "test"), first)
            self.assertIn(("run", "typecheck"), first)
            self.assertNotIn(("run", "compile:style"), first)
            self.assertEqual(installs, [])
            self.assertEqual(second, [])

            metrics = json.loads(
                (job / ".runtime" / "performance.json").read_text(encoding="utf-8")
            )
            self.assertTrue(metrics["stages"]["renderer.dependencies"]["cache_hit"])
            self.assertTrue(metrics["stages"]["renderer.compile_style"]["cache_hit"])
            self.assertTrue(metrics["stages"]["renderer.contract_tests"]["cache_hit"])
            self.assertTrue(metrics["stages"]["renderer.typecheck"]["cache_hit"])

    def test_renderer_source_change_reruns_checks_without_compile_or_install(self):
        from tools.zodiac_local import prepare_renderer

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            calls = []

            def fake_npm(args, _cwd):
                calls.append(tuple(args))

            common = (
                patch("tools.zodiac_local.validate_runtime"),
                patch("tools.zodiac_local.validate_package"),
                patch("tools.zodiac_local.validate_publish_contract"),
                patch("tools.zodiac_local._patch_renderer_typescript_compatibility"),
                patch("tools.zodiac_local._patch_renderer_font_readiness"),
                patch("tools.zodiac_local._renderer_dependencies_installed", return_value=True),
                patch("tools.zodiac_local._install_renderer"),
                patch("tools.zodiac_local._run_npm", side_effect=fake_npm),
                patch("tools.zodiac_local.shutil.which", return_value="/usr/bin/true"),
            )
            with (
                common[0],
                common[1],
                common[2],
                common[3],
                common[4],
                common[5],
                common[6],
                common[7],
                common[8],
            ):
                prepare_renderer(job)
                calls.clear()
                source = job / "renderer" / "src" / "PrimitiveSvg.tsx"
                source.write_text(
                    source.read_text(encoding="utf-8") + "\n// changed\n",
                    encoding="utf-8",
                )
                prepare_renderer(job)

            self.assertIn(("run", "test"), calls)
            self.assertIn(("run", "typecheck"), calls)
            self.assertNotIn(("run", "compile:style"), calls)

    def test_publish_copy_change_does_not_rerun_renderer_checks(self):
        from tools.zodiac_local import prepare_renderer

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            calls = []

            def fake_npm(args, _cwd):
                calls.append(tuple(args))

            common = (
                patch("tools.zodiac_local.validate_runtime"),
                patch("tools.zodiac_local.validate_package"),
                patch("tools.zodiac_local.validate_publish_contract"),
                patch("tools.zodiac_local._patch_renderer_typescript_compatibility"),
                patch("tools.zodiac_local._patch_renderer_font_readiness"),
                patch("tools.zodiac_local._renderer_dependencies_installed", return_value=True),
                patch("tools.zodiac_local._install_renderer"),
                patch("tools.zodiac_local._run_npm", side_effect=fake_npm),
                patch("tools.zodiac_local.shutil.which", return_value="/usr/bin/true"),
            )
            with (
                common[0],
                common[1],
                common[2],
                common[3],
                common[4],
                common[5],
                common[6],
                common[7],
                common[8],
            ):
                prepare_renderer(job)
                calls.clear()
                copy_path = job / "publish" / "publish-copy.txt"
                copy_path.write_text(
                    copy_path.read_text(encoding="utf-8") + "\nALT CAPTION\n",
                    encoding="utf-8",
                )
                prepare_renderer(job)

            self.assertEqual(calls, [])

    def test_typecheck_failure_is_never_cached(self):
        from tools.zodiac_local import (
            prepare_renderer,
            renderer_check_fingerprint,
            renderer_checks_cached,
        )

        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))

            def fake_npm(args, _cwd):
                if tuple(args) == ("run", "typecheck"):
                    raise subprocess.CalledProcessError(2, args)

            with (
                patch("tools.zodiac_local.validate_runtime"),
                patch("tools.zodiac_local.validate_package"),
                patch("tools.zodiac_local.validate_publish_contract"),
                patch("tools.zodiac_local._patch_renderer_typescript_compatibility"),
                patch("tools.zodiac_local._patch_renderer_font_readiness"),
                patch("tools.zodiac_local._renderer_dependencies_installed", return_value=True),
                patch("tools.zodiac_local._install_renderer"),
                patch("tools.zodiac_local._run_npm", side_effect=fake_npm),
                patch("tools.zodiac_local.shutil.which", return_value="/usr/bin/true"),
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    prepare_renderer(job)

            key = renderer_check_fingerprint(job)
            self.assertFalse(renderer_checks_cached(job, key))


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
            self.assertNotEqual(before["final"], after["final"])

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
            self.assertNotEqual(before["final"], after["final"])

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

    def test_music_change_dirties_mix_and_final_not_video_or_cover(self):
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
            self.assertNotEqual(before["final"], after["final"])

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

    def test_audio_preview_falls_back_to_music_when_voice_is_invalid(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = self._job(root)
            (job / "voice.wav").write_bytes(b"broken")
            music = root / "music.mp3"
            music.write_bytes(b"fake")
            captured = {}

            def fake_ffmpeg(arguments):
                captured["arguments"] = arguments
                Path(arguments[-1]).write_bytes(b"preview")

            with patch("tools.zodiac_local._run_ffmpeg", side_effect=fake_ffmpeg):
                output = build_audio_preview(job, music, 0.5, 10)

            self.assertTrue(output.is_file())
            args = captured["arguments"]
            loop = args.index("-stream_loop")
            self.assertEqual(args[loop:loop + 3], ["-stream_loop", "-1", "-i"])
            self.assertNotIn(str(job / "voice.wav"), args)

    def test_managed_subprocess_output_observer_receives_stdout_and_stderr(self):
        seen = []
        with observe_subprocess_output(
            lambda line, channel=None: seen.append((channel, line))
        ):
            result = run_managed_subprocess(
                [
                    sys.executable,
                    "-c",
                    "import sys; print('hello-out'); print('hello-err', file=sys.stderr)",
                ],
                check=True,
                capture_output=True,
                text=True,
            )

        self.assertIn("hello-out", result.stdout)
        self.assertIn("hello-err", result.stderr)
        self.assertIn(("stdout", "hello-out"), seen)
        self.assertIn(("stderr", "hello-err"), seen)

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

            pristine = job / ".runtime" / "pristine" / "zodiac-story.mp4"
            self.assertEqual(result, out)
            self.assertEqual(
                out.read_bytes(),
                b"mixed",
            )
            self.assertEqual(
                pristine.read_bytes(),
                b"video",
                "the pristine render must survive in hidden runtime cache for idempotent remixing",
            )
            self.assertFalse((job / "out" / "zodiac-story.with-music.mp4").exists())
            self.assertIn("-b:a", captured["arguments"])
            self.assertEqual(
                captured["arguments"][captured["arguments"].index("-b:a") + 1],
                "192k",
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


class PlaybackRateTests(unittest.TestCase):
    def test_095_playback_slows_video_and_audio_before_music(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pristine = root / ".runtime" / "pristine" / "zodiac-story.mp4"
            pristine.parent.mkdir(parents=True)
            pristine.write_bytes(b"render")
            out = root / "out"
            out.mkdir()
            captured = []

            def fake_ffmpeg(arguments):
                captured.append(arguments)
                Path(arguments[-1]).write_bytes(b"slowed")

            with patch("tools.zodiac_local.validate_background_music", return_value=None), patch(
                "tools.zodiac_local._run_ffmpeg",
                side_effect=fake_ffmpeg,
            ), patch(
                "tools.zodiac_local.artifact_fingerprints",
                return_value={"mix": "mix-fingerprint"},
            ):
                result = mix_background_music_into_render(root, playback_rate=0.95)

            self.assertEqual(result, out / "zodiac-story.mp4")
            self.assertEqual((out / "zodiac-story.mp4").read_bytes(), b"slowed")
            self.assertEqual(len(captured), 1)
            filter_complex = captured[0][captured[0].index("-filter_complex") + 1]
            self.assertIn("setpts=PTS/0.950000", filter_complex)
            self.assertIn("atempo=0.950000", filter_complex)


