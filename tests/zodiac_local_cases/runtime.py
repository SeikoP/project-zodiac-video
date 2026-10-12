from .support import *

class PerformanceRuntimeV316Tests(unittest.TestCase):
    def test_v316_performance_package_validates_and_resolves_exact_runtime(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_performance_v316_package(Path(temp))
            production = validate_package(job)
            self.assertEqual(production["scenes"][0]["captions"]["segmentation"], "semantic")
            self.assertIn("performance", production["scenes"][0]["events"][0])
            renderer = resolve_renderer_root(job, materialize=False)
            self.assertIn("1.16.0", renderer.parts)

    def test_v316_requires_performance_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_performance_v316_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["events"][0].pop("performance")
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "PERFORMANCE_ANIMATION_GATE"):
                validate_package(job)

    def test_v316_reaction_requires_an_earlier_cause(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_performance_v316_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            performance = production["scenes"][0]["events"][0]["performance"]
            performance["phase"] = "reaction"
            performance["cause_event_id"] = "MISSING"
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "cause_event_id"):
                validate_package(job)

    def test_v316_requires_semantic_caption_policy(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_performance_v316_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["captions"] = {
                "source": "voice",
                "page_target_words": 4,
                "max_words": 7,
                "max_lines": 2,
            }
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "caption policy"):
                validate_package(job)

    @unittest.skipUnless(
        os.environ.get("ZODIAC_E2E_RUNTIME") == "1",
        "golden runtime prepare runs only in the dedicated shared-runtime CI job",
    )
    def test_v316_runtime_prepare_accepts_local_first_v4_without_handoff_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_performance_v316_package(Path(temp))
            self.assertFalse((job / "handoff-manifest.json").exists())
            write_pcm(job / "voice.wav", seconds=1.0)
            runtime_state = job / ".runtime"
            runtime_state.mkdir(parents=True, exist_ok=True)
            (runtime_state / "timing.json").write_text(
                json.dumps(valid_timing(), ensure_ascii=False),
                encoding="utf-8",
            )
            runtime_dir = (
                REPO_ROOT
                / "runtime"
                / "zodiac-remotion"
                / "1.16.0"
                / "renderer"
            )
            env = dict(os.environ)
            env["ZODIAC_PACKAGE_ROOT"] = str(job)
            result = subprocess.run(
                ["node", "scripts/render.mjs", "--prepare-only"],
                cwd=runtime_dir,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                result.returncode,
                0,
                msg=result.stdout + "\n" + result.stderr,
            )
            props = json.loads(
                (runtime_state / "render-props.json").read_text(encoding="utf-8")
            )
            self.assertIn("performance", props["production"]["scenes"][0]["events"][0])
            self.assertEqual(
                props["production"]["scenes"][0]["captions"]["segmentation"],
                "semantic",
            )


class RuntimeOwnedAnimationV3191Tests(unittest.TestCase):
    def test_v3191_accepts_omitted_motion_and_performance(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3191_package(Path(temp))
            production = validate_package(job)
            event = production["scenes"][0]["events"][0]
            self.assertNotIn("motion", event)
            self.assertNotIn("performance", event)
            renderer = resolve_renderer_root(job, materialize=False)
            self.assertIn("1.19.1", renderer.parts)

    def test_v3191_still_rejects_invalid_partial_performance_override(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3191_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["events"][0]["performance"] = {"energy": 2}
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "energy must be within"):
                validate_package(job)

    def test_v3191_publish_contract_accepts_canonical_cover_runtime(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3191_package(Path(temp))
            publish = validate_publish_contract(job)
            self.assertEqual(publish["cover"]["layout"], "tilted_top_hook")

    @unittest.skipUnless(
        os.environ.get("ZODIAC_E2E_RUNTIME") == "1",
        "golden runtime prepare runs only in the dedicated shared-runtime CI job",
    )
    def test_v3191_runtime_prepare_materializes_animation_defaults(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3191_package(Path(temp))
            write_pcm(job / "voice.wav", seconds=1.0)
            runtime_state = job / ".runtime"
            runtime_state.mkdir(parents=True, exist_ok=True)
            (runtime_state / "timing.json").write_text(
                json.dumps(valid_timing(), ensure_ascii=False),
                encoding="utf-8",
            )
            runtime_dir = (
                REPO_ROOT
                / "runtime"
                / "zodiac-remotion"
                / "1.19.1"
                / "renderer"
            )
            env = dict(os.environ)
            env["ZODIAC_PACKAGE_ROOT"] = str(job)
            result = subprocess.run(
                ["node", "scripts/render.mjs", "--prepare-only"],
                cwd=runtime_dir,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                result.returncode,
                0,
                msg=result.stdout + "\n" + result.stderr,
            )
            props = json.loads(
                (runtime_state / "render-props.json").read_text(encoding="utf-8")
            )
            event = props["production"]["scenes"][0]["events"][0]
            self.assertIn("motion", event)
            self.assertIn("performance", event)
            self.assertGreaterEqual(event["motion"]["duration_frames"], 8)


class SharedRuntimeCacheRepairTests(unittest.TestCase):
    def test_stale_cached_runtime_is_rebuilt_from_exact_local_reference(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            job = write_runtime_owned_v3200_package(root / "ws" / "jobs")
            first = resolve_renderer_root(job, materialize=True)
            cache_root = first.parent
            target = first / "package.json"
            original = target.read_text(encoding="utf-8")
            target.write_text(original + "\n// stale cache\n", encoding="utf-8")

            repaired = resolve_renderer_root(job, materialize=True)

            self.assertEqual(repaired, first)
            self.assertNotIn(
                "// stale cache",
                (repaired / "package.json").read_text(encoding="utf-8"),
            )
            self.assertEqual(
                _renderer_tree_sha256(repaired),
                _renderer_tree_sha256(
                    REPO_ROOT
                    / "runtime"
                    / "zodiac-remotion"
                    / "1.20.0"
                    / "renderer"
                ),
            )
            self.assertTrue((cache_root / "runtime-manifest.json").is_file())


class RuntimeManifestIntegrityTests(unittest.TestCase):
    def test_runtime_121_manifest_hash_matches_renderer_tree(self):
        runtime_root = (
            REPO_ROOT
            / "runtime"
            / "zodiac-remotion"
            / "1.21.0"
        )
        manifest = json.loads(
            (runtime_root / "runtime-manifest.json").read_text(encoding="utf-8")
        )
        actual = _renderer_tree_sha256(runtime_root / "renderer")
        self.assertEqual(
            manifest["sha256"],
            actual,
            f"runtime 1.21 manifest hash must be {actual}",
        )

    def test_runtime_120_manifest_hash_matches_renderer_tree(self):
        runtime_root = (
            REPO_ROOT
            / "runtime"
            / "zodiac-remotion"
            / "1.20.0"
        )
        manifest = json.loads(
            (runtime_root / "runtime-manifest.json").read_text(encoding="utf-8")
        )
        actual = _renderer_tree_sha256(runtime_root / "renderer")
        self.assertEqual(
            manifest["sha256"],
            actual,
            f"runtime 1.20 manifest hash must be {actual}",
        )


class RuntimeV3210StyleContractTests(unittest.TestCase):
    def test_v3210_accepts_native_v4_style_and_lineage(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3210_package(Path(temp))
            production = validate_package(job)
            self.assertEqual(
                production["visual_system"]["style_token"]["id"],
                "zodiac-paper-doodle-meme-v4",
            )
            self.assertTrue(
                all(
                    asset.get("lineage", {}).get("source_library")
                    == "zodiac-visual-grammar-v4"
                    for asset in production["assets"].values()
                )
            )
            renderer = resolve_renderer_root(job, materialize=False)
            self.assertIn("1.21.0", renderer.parts)

    @unittest.skipUnless(
        os.environ.get("ZODIAC_E2E_RUNTIME") == "1",
        "golden runtime prepare runs only in the dedicated shared-runtime CI job",
    )
    def test_v3210_runtime_prepare_golden_v4_package(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3210_package(Path(temp))
            write_pcm(job / "voice.wav", seconds=1.0)
            runtime_state = job / ".runtime"
            runtime_state.mkdir(parents=True, exist_ok=True)
            (runtime_state / "timing.json").write_text(
                json.dumps(valid_timing(), ensure_ascii=False),
                encoding="utf-8",
            )
            runtime_dir = (
                REPO_ROOT
                / "runtime"
                / "zodiac-remotion"
                / "1.21.0"
                / "renderer"
            )
            env = dict(os.environ)
            env["ZODIAC_PACKAGE_ROOT"] = str(job)
            result = subprocess.run(
                ["node", "scripts/render.mjs", "--prepare-only"],
                cwd=runtime_dir,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                result.returncode,
                0,
                msg=result.stdout + "\n" + result.stderr,
            )
            props = json.loads(
                (runtime_state / "render-props.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                props["production"]["visual_system"]["style_token"]["id"],
                "zodiac-paper-doodle-meme-v4",
            )
            event = props["production"]["scenes"][0]["events"][0]
            self.assertIn("motion", event)
            self.assertIn("performance", event)


class RuntimeLayerSafetyV3200Tests(unittest.TestCase):
    def test_v3200_accepts_runtime_owned_animation_package(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3200_package(Path(temp))
            production = validate_package(job)
            event = production["scenes"][0]["events"][0]
            self.assertNotIn("motion", event)
            self.assertNotIn("performance", event)
            renderer = resolve_renderer_root(job, materialize=False)
            self.assertIn("1.20.0", renderer.parts)

    @unittest.skipUnless(
        os.environ.get("ZODIAC_E2E_RUNTIME") == "1",
        "golden runtime prepare runs only in the dedicated shared-runtime CI job",
    )
    def test_v3200_runtime_prepare_with_layer_safety(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_runtime_owned_v3200_package(Path(temp))
            write_pcm(job / "voice.wav", seconds=1.0)
            runtime_state = job / ".runtime"
            runtime_state.mkdir(parents=True, exist_ok=True)
            (runtime_state / "timing.json").write_text(
                json.dumps(valid_timing(), ensure_ascii=False),
                encoding="utf-8",
            )
            runtime_dir = (
                REPO_ROOT
                / "runtime"
                / "zodiac-remotion"
                / "1.20.0"
                / "renderer"
            )
            env = dict(os.environ)
            env["ZODIAC_PACKAGE_ROOT"] = str(job)
            result = subprocess.run(
                ["node", "scripts/render.mjs", "--prepare-only"],
                cwd=runtime_dir,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                result.returncode,
                0,
                msg=result.stdout + "\n" + result.stderr,
            )
            props = json.loads(
                (runtime_state / "render-props.json").read_text(encoding="utf-8")
            )
            event = props["production"]["scenes"][0]["events"][0]
            self.assertIn("motion", event)
            self.assertIn("performance", event)


class SemanticRuntimeV315Tests(unittest.TestCase):
    def test_v315_thief_child_entity_mechanism_validates(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            production = validate_package(job)
            self.assertEqual(production["version"], "2.0")
            renderer = resolve_renderer_root(job, materialize=False)
            self.assertIn("1.15.0", renderer.parts)

    def test_v315_requires_asset_lineage(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["assets"]["safe.body"].pop("lineage")
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "ASSET_LINEAGE_INVALID"):
                validate_package(job)

    def test_v315_requires_mechanism_for_mechanical_action(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["events"][0].pop("mechanism")
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "SEMANTIC_ANIMATION_GATE"):
                validate_package(job)

    def test_v315_rejects_whole_asset_strong_articulation(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["events"][0]["mechanism"] = {
                "mode": "whole_asset",
                "justification": "Replace the whole object even though the door should articulate.",
            }
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "strong articulation"):
                validate_package(job)

    def test_v315_rejects_stale_final_validation_receipt(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            path = job / "production.json"
            production = json.loads(path.read_text(encoding="utf-8"))
            production["scenes"][0]["voice"] = "Xin chào mọi người nhé."
            path.write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
            (job / "narration.txt").write_text("Xin chào mọi người nhé.", encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "FINAL_VALIDATION_STALE"):
                validate_package(job)

    @unittest.skipUnless(
        os.environ.get("ZODIAC_E2E_RUNTIME") == "1",
        "golden runtime prepare runs only in the dedicated shared-runtime CI job",
    )
    def test_v315_runtime_prepare_golden_thief(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            write_pcm(job / "voice.wav", seconds=1.0)
            runtime_dir = (
                REPO_ROOT
                / "runtime"
                / "zodiac-remotion"
                / "1.15.0"
                / "renderer"
            )
            runtime_state = job / ".runtime"
            runtime_state.mkdir(parents=True, exist_ok=True)
            (runtime_state / "timing.json").write_text(
                json.dumps(valid_timing(), ensure_ascii=False),
                encoding="utf-8",
            )
            env = dict(os.environ)
            env["ZODIAC_PACKAGE_ROOT"] = str(job)
            result = subprocess.run(
                ["node", "scripts/render.mjs", "--prepare-only"],
                cwd=runtime_dir,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                result.returncode,
                0,
                msg=result.stdout + "\n" + result.stderr,
            )
            props = json.loads(
                (runtime_state / "render-props.json").read_text(encoding="utf-8")
            )
            self.assertEqual(props["production"]["scenes"][0]["events"][0]["mechanism"]["mode"], "child_entities")
            self.assertEqual(props["production"]["assets"]["safe.door.open"]["lineage"]["source_master"], "compact-safe")

    def test_v315_rejects_authoring_directory_in_thin_zip(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_semantic_thief_v315_package(Path(temp))
            authoring = job / ".authoring" / "interaction-plan.json"
            authoring.parent.mkdir(parents=True)
            authoring.write_text('{"version":"1.0","scenes":[]}', encoding="utf-8")
            with self.assertRaisesRegex(PipelineError, "PACKAGE_V3_BLOAT.*authoring"):
                validate_package(job)

    def test_v114_package_remains_backward_compatible_without_semantic_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_v3_package(Path(temp))
            production = validate_package(job)
            self.assertEqual(production["version"], "2.0")
            self.assertFalse((job / "FINAL_VALIDATION.json").exists())


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


