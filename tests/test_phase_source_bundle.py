"""Phase-scoped bundle policy smoke tests (stdlib; no GitHub Actions needed)."""
import importlib.util
import pathlib
import unittest
import tempfile
import json
import zipfile
import hashlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("builder", ROOT / "tools/build_source_bundle.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
spec = importlib.util.spec_from_file_location("stager", ROOT / "tools/stage_source_bundle.py")
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class BundleSelectionTests(unittest.TestCase):
    def test_runner_never_bundled(self):
        for phase in builder.PHASES:
            self.assertFalse(builder.include("runtime/remotion/index.ts", phase))
            self.assertFalse(builder.include("tools/zodiac_local.py", phase))

    def test_phase_one_excludes_visual_library(self):
        path = "plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/props/book.svg"
        self.assertFalse(builder.include(path, "01-content"))
        self.assertTrue(builder.include(path, "02-visual-production"))

    def test_shared_v4_execution_dependencies_survive_every_phase(self):
        for phase in builder.PHASES:
            for rel in ("characters/compile-character-assembly.mjs", "characters/components/catalog.json"):
                self.assertTrue(builder.include("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/" + rel, phase))

    def test_handoff_excludes_visual_masters_and_catalog_ui(self):
        for rel in ("references/asset-library-v4/props/book.svg", "orchestration/asset-catalog.html"):
            self.assertFalse(builder.include("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/" + rel, "03-handoff"))

    def test_missing_refactored_import_is_rejected(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            module = root / (builder.PLUGIN + "entry.mjs")
            module.parent.mkdir(parents=True)
            module.write_text("export * from './core/missing.mjs';")
            with self.assertRaisesRegex(ValueError, "missing executable dependency"):
                builder.validate_dependencies(root, [builder.PLUGIN + "entry.mjs"])

    def test_staging_verifies_commit_and_payload_before_writing(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            archive = root / "source.zip"
            name = builder.PLUGIN + "plugin.json"
            data = b'{"version":"2.5.4"}'
            provenance = {"format":"zodiac-execution-source@2", "scope":"02-visual-production",
                "plugin_version":"2.5.4", "plugin_release_id":"test-release", "commit":"a"*40,
                "files":[{"path":name,"size":len(data),"sha256":hashlib.sha256(data).hexdigest()}]}
            def write(payload):
                with zipfile.ZipFile(archive, "w") as out:
                    out.writestr(name, payload)
                    out.writestr("SOURCE-PROVENANCE.json", json.dumps(provenance))
            write(data)
            with self.assertRaisesRegex(ValueError, "commit mismatch"):
                stager.stage(archive, root/"staged", "02-visual-production", "2.5.4", "test-release", "b"*40)
            self.assertFalse((root/"staged").exists())
            write(b'corrupted')
            with self.assertRaisesRegex(ValueError, "payload checksum"):
                stager.stage(archive, root/"staged", "02-visual-production", "2.5.4", "test-release", "a"*40)
            self.assertFalse((root/"staged").exists())
            write(data)
            self.assertEqual(stager.stage(archive, root/"staged", "02-visual-production", "2.5.4", "test-release", "a"*40)["status"], "SOURCE_STAGED")

    def test_router_and_preflight_survive(self):
        for phase in builder.PHASES:
            self.assertTrue(builder.include("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/router.md", phase))
            self.assertTrue(builder.include("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/execution-preflight.mjs", phase))

    def test_tests_excluded(self):
        path = "plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/audit.test.mjs"
        for phase in builder.PHASES:
            self.assertFalse(builder.include(path, phase))


if __name__ == "__main__":
    unittest.main()
