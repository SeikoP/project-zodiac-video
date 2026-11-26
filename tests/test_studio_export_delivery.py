import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from tools.studio_project.service import StudioProjectService
from tools.studio_project.settings import StudioSettings
from tools.studio_project.visual_workspace import VisualWorkspace


class SettingsMigrationTests(unittest.TestCase):
    def test_a_settings_file_saved_before_export_dir_existed_still_loads_with_the_default(self):
        with tempfile.TemporaryDirectory() as temp:
            settings = StudioSettings(Path(temp))
            values = settings.defaults()
            del values["libraries"]["export_dir"]
            (Path(temp) / "studio-settings.json").write_text(json.dumps({"revision": 3, "values": values}), encoding="utf-8")
            read = settings.read()
            self.assertEqual(read["revision"], 3)
            self.assertTrue(Path(read["values"]["libraries"]["export_dir"]).is_absolute())


class DeliveryTests(unittest.TestCase):
    def test_package_goes_to_export_dir_named_by_sign_and_concept(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            workspace = root / "episodes" / "p"
            (workspace / ".authoring").mkdir(parents=True)
            (workspace / ".authoring/episode-scope.json").write_text(json.dumps({"sign": "Nhân Mã", "concept_code": "love-sincere"}), "utf-8")
            exports = root / "out"
            service = StudioProjectService(root)
            values = service.settings.read()["values"]
            values["libraries"]["export_dir"] = str(exports)
            service.settings.update(0, values)
            visual = VisualWorkspace(service)
            handle = SimpleNamespace(workspace=workspace, project_id="p")
            run = workspace / ".runtime/visual-workspace/exports/abc"
            run.mkdir(parents=True)
            for name in ("episode.mp4", "cover.png", "captions.srt", "receipt.json"):
                (run / name).write_bytes(b"x" * 8)
            (workspace / ".runtime/pipeline/receipts").mkdir(parents=True)
            (workspace / ".runtime/pipeline/receipts/publish.json").write_text(
                json.dumps({"payload": {"title": "T", "description": "D", "hashtags": ["#a", "#b"]}}), "utf-8")
            visual._deliver(handle, {"path": ".runtime/visual-workspace/exports/abc/episode.mp4"})
            folder = exports / "Nhân-Mã-love-sincere"
            self.assertEqual(sorted(p.name for p in folder.iterdir()),
                             ["Nhân-Mã-love-sincere.mp4", "captions.srt", "cover.png", "publish.txt", "receipt.json"])
            self.assertEqual((folder / "publish.txt").read_text("utf-8").strip(), "T\n\nD\n\n#a #b")


class ReadScopeTests(unittest.TestCase):
    def test_a_snapshot_is_computed_once_inside_a_scope_and_fresh_outside(self):
        with tempfile.TemporaryDirectory() as temp:
            service = StudioProjectService(Path(temp))
            calls = []
            with service.read_scope():
                for _ in range(3):
                    service.scoped(("k",), lambda: calls.append(1) or {"v": len(calls)})
            self.assertEqual(len(calls), 1)
            service.scoped(("k",), lambda: calls.append(1) or {})
            service.scoped(("k",), lambda: calls.append(1) or {})
            self.assertEqual(len(calls), 3)


if __name__ == "__main__":
    unittest.main()
