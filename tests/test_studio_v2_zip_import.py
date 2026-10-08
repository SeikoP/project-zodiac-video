import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.controller import StudioV2Controller

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "control-plane-v2" / "minimal"


def make_source(root: Path) -> Path:
    source = root / "source"
    shutil.copytree(FIXTURE, source)
    shutil.rmtree(source / ".runtime", ignore_errors=True)
    (source / "narration.txt").write_text("xin chao\n", encoding="utf-8")
    publish = source / "publish"
    publish.mkdir()
    (publish / "publish.json").write_text(
        json.dumps({
            "format": "zodiac-publish@1",
            "source": {"narration": "narration.txt", "production": "production.ir.json"},
        }),
        encoding="utf-8",
    )
    (publish / "publish-copy.txt").write_text("TikTok caption: xin chao\n", encoding="utf-8")
    manifest = {
        "format": "zodiac-job@5",
        "job": {"id": "scorpio-two-versions", "revision": "1.0.0"},
        "contract": {
            "id": "zodiac-authoring-ir",
            "version": "1.0.0",
            "sha256": canonical_contract_hash("authoring-ir-v1"),
        },
        "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
        "producer": {"plugin": "test-fixture", "version": "2.0.0"},
    }
    (source / "package-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    return source


def zip_source(source: Path, archive: Path, wrapper: str | None = None) -> None:
    with zipfile.ZipFile(archive, "w") as handle:
        for path in sorted(source.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(source).as_posix()
            name = f"{wrapper}/{relative}" if wrapper else relative
            handle.write(path, name)


class StudioV2ZipImportTests(unittest.TestCase):
    def test_import_accepts_no_assets_when_ir_has_no_asset_references(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = make_source(root)
            ir_path = source / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            ir["assets"] = {}
            ir["scenes"][0]["entities"] = []
            ir["scenes"][0]["events"] = []
            ir_path.write_text(json.dumps(ir), encoding="utf-8")
            shutil.rmtree(source / "assets")

            controller = StudioV2Controller(root / "workspace")
            controller.import_package(source)
            self.assertTrue((controller.workspace / "publish" / "publish.json").is_file())
            self.assertFalse((controller.workspace / "assets").exists())

    def test_imports_job5_zip_and_records_zip_display_name(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = make_source(root)
            archive = root / "zodiac-bocap-hai-phien-ban-v2.0.zip"
            zip_source(source, archive, wrapper="zodiac-bocap")
            controller = StudioV2Controller(root / "workspace")
            controller.import_package(archive)
            self.assertEqual(controller.state.package.display_name, archive.name)
            self.assertTrue((controller.workspace / "production.ir.json").is_file())
            self.assertTrue((controller.workspace / "design-token.json").is_file())
            self.assertTrue((controller.workspace / "publish" / "publish.json").is_file())
            self.assertTrue((controller.workspace / "publish" / "publish-copy.txt").is_file())

    def test_zip_filename_does_not_change_package_content_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = make_source(root)
            first = root / "zodiac-bocap-v2.0.zip"
            second = root / "anything-else-v99.zip"
            zip_source(source, first)
            zip_source(source, second)

            a = StudioV2Controller(root / "workspace-a")
            b = StudioV2Controller(root / "workspace-b")
            a.import_package(first)
            b.import_package(second)

            self.assertEqual(
                a.state.package.package_hash,
                b.state.package.package_hash,
            )
            self.assertNotEqual(
                a.state.package.display_name,
                b.state.package.display_name,
            )

    def _assert_rejected_before_workspace_write(self, source: Path) -> None:
        archive = source.parent / "invalid-package.zip"
        zip_source(source, archive)
        controller = StudioV2Controller(source.parent / "workspace-invalid")
        with self.assertRaises(ControlPlaneError) as caught:
            controller.import_package(archive)
        self.assertEqual(caught.exception.code, "PACKAGE_CONTENT_INVALID")
        self.assertFalse((controller.workspace / "production.ir.json").exists())

    def test_rejects_unexpected_root_timing_file(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            (source / "timing.json").write_text("{}", encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_narration_that_differs_from_ordered_ir_scene_voice(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            (source / "narration.txt").write_text("xin chao, extra words\n", encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_ir_asset_path_that_does_not_exist(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            ir_path = source / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            ir["assets"]["char.scorpio"]["path"] = "assets/missing.svg"
            ir_path.write_text(json.dumps(ir), encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_ir_asset_path_that_escapes_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            ir_path = source / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            ir["assets"]["char.scorpio"]["path"] = "assets/../narration.txt"
            ir_path.write_text(json.dumps(ir), encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_unreferenced_asset_files(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            (source / "assets" / "unused.svg").write_text("<svg/>", encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_missing_publish_contract_file(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            (source / "publish" / "publish-copy.txt").unlink()
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_publish_metadata_that_points_to_a_different_narration(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            publish_path = source / "publish" / "publish.json"
            publish = json.loads(publish_path.read_text(encoding="utf-8"))
            publish["source"]["narration"] = "old-narration.txt"
            publish_path.write_text(json.dumps(publish), encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)

    def test_rejects_unexpected_nested_runtime_state(self):
        with tempfile.TemporaryDirectory() as temp:
            source = make_source(Path(temp))
            runtime = source / ".runtime"
            runtime.mkdir()
            (runtime / "timing.json").write_text("{}", encoding="utf-8")
            self._assert_rejected_before_workspace_write(source)


if __name__ == "__main__":
    unittest.main()
