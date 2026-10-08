import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.studio_v2.controller import StudioV2Controller

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "control-plane-v2" / "minimal"


def make_source(root: Path) -> Path:
    source = root / "source"
    shutil.copytree(FIXTURE, source)
    (source / "narration.txt").write_text("xin chao\n", encoding="utf-8")
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


if __name__ == "__main__":
    unittest.main()
