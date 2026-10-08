import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.render_plan import target_overlap_count
from tools.studio_v2.controller import StudioV2Controller
from tools.studio_v2.pipeline import DONE, PACKAGE, PLAN

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "control-plane-v2" / "minimal"


def make_job(root: Path) -> Path:
    source = root / "source"
    shutil.copytree(FIXTURE, source)
    shutil.rmtree(source / ".runtime", ignore_errors=True)
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
    publish = source / "publish"
    publish.mkdir()
    (publish / "publish.json").write_text(
        json.dumps({"format": "zodiac-publish@1", "source": {"narration": "narration.txt", "production": "production.ir.json"}}),
        encoding="utf-8",
    )
    (publish / "publish-copy.txt").write_text("xin chao\n", encoding="utf-8")
    return source


def add_fixture_timing(controller: StudioV2Controller) -> None:
    runtime = controller.workspace / ".runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(FIXTURE / ".runtime" / "timing.json", runtime / "timing.json")


class StudioV2ControllerTests(unittest.TestCase):
    def test_import_validates_handshake_and_copies_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = make_job(root)
            controller = StudioV2Controller(root / "workspace")
            controller.import_package(source)
            self.assertEqual(controller.state.steps[PACKAGE].status, DONE)
            self.assertTrue((controller.workspace / "production.ir.json").is_file())
            self.assertEqual(controller.state.package.package_version, "2.0.0")

    def test_bad_contract_hash_fails_at_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = make_job(root)
            manifest_path = source / "package-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["contract"]["sha256"] = "0" * 64
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            controller = StudioV2Controller(root / "workspace")
            with self.assertRaises(ControlPlaneError) as caught:
                controller.import_package(source)
            self.assertEqual(caught.exception.stage, "PACKAGE")
            self.assertEqual(caught.exception.code, "PACKAGE_CONTRACT_MISMATCH")

    def test_build_plan_uses_measured_timing_and_writes_runtime_artifact(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            controller = StudioV2Controller(root / "workspace")
            controller.import_package(make_job(root))
            add_fixture_timing(controller)
            plan_path = controller.build_plan()
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            self.assertEqual(controller.state.steps[PLAN].status, DONE)
            self.assertEqual(target_overlap_count(plan), 0)
            self.assertTrue(plan_path.samefile(controller.workspace / ".runtime" / "render-plan.json"))

    def test_prepare_renderer_uses_renderer_2_and_writes_props(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            controller = StudioV2Controller(root / "workspace")
            controller.import_package(make_job(root))
            add_fixture_timing(controller)
            controller.build_plan()
            props = controller.prepare_renderer()
            self.assertTrue(props.is_file())
            payload = json.loads(props.read_text(encoding="utf-8"))
            self.assertEqual(payload["contract"], "zodiac-render-plan@1")

    def test_controller_source_does_not_use_legacy_string_classifier(self):
        source = (ROOT / "tools" / "studio_v2" / "controller.py").read_text(encoding="utf-8")
        self.assertNotIn("_classify", source)
        self.assertNotIn("NODE_MISSING", source)
        self.assertNotIn("ALIGNMENT_MISMATCH", source)


if __name__ == "__main__":
    unittest.main()

