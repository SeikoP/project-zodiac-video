from .support import *

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
            with self.assertRaisesRegex(PipelineError, "VISUAL_PROGRESSION_DENSITY.*10 words"):
                validate_package(job)

    def test_rejects_visual_gap_that_is_acceptable_by_old_15_word_proxy(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            voice = "mot hai ba bon nam sau bay tam chin muoi muoi-mot muoi-hai muoi-ba"
            production["scenes"][0]["voice"] = voice
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            (job / "narration.txt").write_text(voice + "\n", encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "VISUAL_PROGRESSION_DENSITY.*10 words"):
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


class ThinPackageV3Tests(unittest.TestCase):
    def test_v3_validates_without_package_local_renderer(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v3_package(Path(temp))
            self.assertFalse((job / "renderer").exists())
            self.assertEqual(validate_package(job)["version"], "2.0")

    def test_v3_rejects_bundled_renderer_library_and_references(self):
        for forbidden in ("renderer", "library", "references"):
            with self.subTest(forbidden=forbidden), tempfile.TemporaryDirectory() as temp:
                job = write_v3_package(Path(temp))
                path = job / forbidden / "unexpected.txt"
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("duplicate", encoding="utf-8")
                with self.assertRaisesRegex(PipelineError, "PACKAGE_V3_BLOAT"):
                    validate_package(job)

    def test_v3_rejects_runtime_hash_mismatch_without_latest_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v3_package(Path(temp))
            path = job / "package-manifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            manifest["runtime"]["sha256"] = "0" * 64
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "RUNTIME_HASH_MISMATCH"):
                validate_package(job)

    def test_v3_rejects_unreferenced_asset_bloat(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v3_package(Path(temp))
            extra = job / "assets" / "unused.svg"
            extra.write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(PipelineError, "PACKAGE_V3_BLOAT.*not referenced"):
                validate_package(job)

    def test_v3_materializes_one_shared_runtime_outside_job(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v3_package(Path(temp))
            first = resolve_renderer_root(job, materialize=True)
            second = resolve_renderer_root(job, materialize=True)
            self.assertEqual(first, second)
            self.assertTrue(first.is_dir())
            self.assertFalse((job / "renderer").exists())
            self.assertIn("runtimes", first.parts)
            self.assertIn("zodiac-remotion", first.parts)
            self.assertIn("1.14.0", first.parts)


class ThinPackageV4Tests(unittest.TestCase):
    def test_v4_validates_without_plugin_final_receipt_handoff_or_runtime_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            self.assertFalse((job / "FINAL_VALIDATION.json").exists())
            self.assertFalse((job / "handoff-manifest.json").exists())
            manifest = json.loads((job / "package-manifest.json").read_text(encoding="utf-8"))
            self.assertNotIn("sha256", manifest["runtime"])
            self.assertNotIn("design", manifest)
            self.assertEqual(validate_package(job)["version"], "2.0")

    def test_v4_fingerprints_resolve_bundled_runtime_hash_without_manifest_sha(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_performance_v316_package(Path(temp))
            manifest = json.loads(
                (job / "package-manifest.json").read_text(encoding="utf-8")
            )
            self.assertNotIn("sha256", manifest["runtime"])
            self.assertEqual(renderer_check_fingerprint(job), RUNTIME_V316_HASH)
            self.assertRegex(style_compile_fingerprint(job), r"^[0-9a-f]{64}$")

    def test_v4_rejects_plugin_owned_receipts_in_thin_package(self):
        for forbidden in ("FINAL_VALIDATION.json", "handoff-manifest.json"):
            with self.subTest(forbidden=forbidden), tempfile.TemporaryDirectory() as temp:
                job = write_v4_package(Path(temp))
                (job / forbidden).write_text("{}", encoding="utf-8")
                with self.assertRaisesRegex(PipelineError, "PACKAGE_V4_BLOAT"):
                    validate_package(job)

    def test_v4_rejects_runtime_outputs_only_at_import_boundary(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = v4_package_files()
            files["voice.wav"] = b"runtime"
            archive = root / "bad-v4.zip"
            write_zip(archive, files, root="zodiac-v4-test")
            with self.assertRaisesRegex(PipelineError, "PACKAGE_V4_BLOAT.*voice.wav"):
                import_package(archive, root / "jobs")

            job = write_v4_package(root / "local")
            (job / "voice.wav").write_bytes(b"runtime")
            (job / ".runtime").mkdir()
            (job / "out").mkdir()
            self.assertEqual(validate_package(job)["version"], "2.0")

    def test_v4_rejects_missing_publish_files(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            (job / "publish" / "publish.json").unlink()
            with self.assertRaisesRegex(PipelineError, "PACKAGE_MANIFEST_INVALID.*publish/publish.json"):
                validate_package(job)

    def test_v4_malformed_runtime_reference_fails_as_manifest_error(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "package-manifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            manifest["runtime"] = None
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "PACKAGE_MANIFEST_INVALID"):
                validate_package(job)

    def test_v4_still_validates_asset_lineage_and_semantic_mechanism(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["assets"]["safe.body"].pop("lineage")
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "ASSET_LINEAGE_INVALID"):
                validate_package(job)

        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["events"][0].pop("mechanism")
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "SEMANTIC_ANIMATION_GATE"):
                validate_package(job)

    def test_v4_accepts_native_visual_grammar_v4_lineage(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            lineage = production["assets"]["safe.body"]["lineage"]
            lineage["mode"] = "composite"
            lineage["source_library"] = "zodiac-visual-grammar-v4"
            lineage["source_master"] = [
                "body:standard_compact",
                "hair:asym_bang",
                "outfit:scorpio",
            ]
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            validate_package(job)

    def test_v4_rejects_unknown_asset_lineage_library(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["assets"]["safe.body"]["lineage"]["source_library"] = "unknown-library"
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "ASSET_LINEAGE_INVALID"):
                validate_package(job)

    def test_v4_semantic_close_phrase_does_not_require_mechanism(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            event = production["scenes"][0]["events"][0]
            event["action"] = "knows_you_are_close"
            event.pop("mechanism", None)
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            validate_package(job)

    def test_v4_real_close_action_still_requires_mechanism(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            event = production["scenes"][0]["events"][0]
            event["action"] = "close_safe"
            event.pop("mechanism", None)
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "SEMANTIC_ANIMATION_GATE"):
                validate_package(job)

    def test_v4_rejects_narration_mismatch_without_receipt_indirection(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            (job / "narration.txt").write_text("Khác lời thoại.", encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "narration.txt"):
                validate_package(job)

    def test_runtime_tree_hash_normalizes_lf_and_crlf(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            lf = root / "lf"
            crlf = root / "crlf"
            (lf / "src").mkdir(parents=True)
            (crlf / "src").mkdir(parents=True)
            (lf / "src" / "sample.ts").write_bytes(b"const a = 1;\nconst b = 2;\n")
            (crlf / "src" / "sample.ts").write_bytes(b"const a = 1;\r\nconst b = 2;\r\n")
            self.assertEqual(_renderer_tree_sha256(lf), _renderer_tree_sha256(crlf))

    def test_v4_local_publish_writes_final_runtime_receipt(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v4_package(Path(temp))
            write_pcm(job / "voice.wav", seconds=1.0)
            runtime = job / ".runtime"
            runtime.mkdir(parents=True)
            (runtime / "timing.json").write_text(
                json.dumps(valid_timing(), ensure_ascii=False),
                encoding="utf-8",
            )
            out = job / "out"
            out.mkdir()
            (out / "zodiac-story.mp4").write_bytes(b"video")
            (out / "cover.png").write_bytes(b"cover")
            shutil.copy2(job / "publish" / "publish-copy.txt", out / "publish-copy.txt")
            shutil.copy2(job / "publish" / "publish.json", out / "publish.json")

            outputs = finalize_publish_outputs(job, final_video=out / "zodiac-story.mp4")
            receipt_path = out / "FINAL_VALIDATION.json"
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            self.assertEqual(receipt["status"], "PASS")
            self.assertEqual(receipt["voice"], "PASS")
            self.assertEqual(receipt["measured_timing"], "PASS")
            self.assertEqual(receipt["runtime"]["version"], "1.15.0")
            self.assertEqual(outputs["video"], out / "zodiac-story.mp4")
            self.assertFalse((out / "zodiac-publish-bundle.zip").exists())


