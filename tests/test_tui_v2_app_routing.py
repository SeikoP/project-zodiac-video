import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.tui.app import ZodiacTui


def job5_manifest():
    return {
        "format": "zodiac-job@5",
        "job": {"id": "scorpio-two-versions", "revision": "1.0.0"},
        "contract": {
            "id": "zodiac-authoring-ir",
            "version": "1.0.0",
            "sha256": canonical_contract_hash("authoring-ir-v1"),
        },
        "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
        "producer": {"plugin": "test", "version": "2.0.0"},
    }


def make_job5_zip(root: Path) -> Path:
    archive = root / "zodiac-bocap-hai-phien-ban.zip"
    production = {
        "format": "zodiac-authoring-ir@1",
        "fps": 24,
        "video": {"width": 1080, "height": 1920},
        "assets": {},
        "scenes": [{
            "id": "S01",
            "voice": "xin chao",
            "duration_hint_frames": 48,
            "entities": [],
            "events": [],
        }],
    }
    design = {
        "id": "zodiac-paper-doodle-meme-v4",
        "version": "4.0",
        "style_family": "paper-doodle-chibi-meme",
        "handmade_profile": "human-stroke-v2",
        "motion_defaults": {},
    }
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr("package-manifest.json", json.dumps(job5_manifest()))
        handle.writestr("production.ir.json", json.dumps(production))
        handle.writestr("design-token.json", json.dumps(design))
        handle.writestr("narration.txt", "xin chao\n")
    return archive


def make_job4_zip(root: Path) -> Path:
    archive = root / "legacy.zip"
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr(
            "package-manifest.json",
            json.dumps({"format": "zodiac-job@4"}),
        )
    return archive


class TuiV2AppRoutingTests(unittest.TestCase):
    def test_constructor_uses_injected_workspace_and_starts_legacy(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app = ZodiacTui(workspace_root=root)
            self.assertEqual(app.workspace_root, root.resolve())
            self.assertEqual(app._pipeline_mode, "legacy")
            self.assertEqual(app.v2_session.workspace_root, root.resolve())

    def test_job5_archive_routes_to_v2_stable_workspace(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app = ZodiacTui(workspace_root=root / "workspace")
            mode = app._select_package_backend(make_job5_zip(root))
            self.assertEqual(mode, "v2")
            self.assertEqual(app._pipeline_mode, "v2")
            self.assertEqual(app.v2_session.job.name, "scorpio-two-versions")
            self.assertEqual(len(app._active_pipeline_rows()), 7)

    def test_job4_archive_stays_on_legacy_backend(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app = ZodiacTui(workspace_root=root / "workspace")
            mode = app._select_package_backend(make_job4_zip(root))
            self.assertEqual(mode, "legacy")
            self.assertEqual(app._pipeline_mode, "legacy")

    def test_run_full_dispatches_to_v2_when_job5_is_active(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app = ZodiacTui(workspace_root=root / "workspace")
            app._select_package_backend(make_job5_zip(root))
            calls = []
            app._run_v2_full = lambda: calls.append("v2")  # type: ignore[method-assign]
            app._start_pipeline = lambda **kwargs: calls.append(("legacy", kwargs))  # type: ignore[method-assign]
            app.action_run_full()
            self.assertEqual(calls, ["v2"])


if __name__ == "__main__":
    unittest.main()
