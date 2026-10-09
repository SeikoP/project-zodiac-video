"""Regression coverage for the PySide6 operator usability upgrades."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from PySide6.QtWidgets import QApplication
from tools.studio_qt.publish_copy import publish_text_for_job


class WorkbenchUsabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def tearDown(self):
        """Flush queued Qt multimedia deletion before QApplication teardown."""
        from PySide6.QtCore import QCoreApplication, QEvent
        for widget in list(self.app.topLevelWidgets()):
            widget.close()
            widget.deleteLater()
        QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        self.app.processEvents()

    def test_ready_dropdown_emits_selected_zip(self):
        from tools.studio_qt.screens.home import HomeScreen
        home = HomeScreen()
        picked = []
        home.ready_import_requested.connect(picked.append)
        self.assertFalse(home.ready_import_button.isEnabled())
        home.set_ready_packages(["/workspace/ready/b.zip", "/workspace/ready/a.zip"])
        home.ready_picker.setCurrentIndex(1)
        home.ready_import_button.click()
        self.assertEqual(picked, ["/workspace/ready/a.zip"])
        home.set_ready_packages([])
        self.assertFalse(home.ready_import_button.isEnabled())
        home.close()

    def test_ready_scanner_is_workspace_scoped_and_ignores_non_zip(self):
        from tools.studio_qt.app import ZodiacQtApp
        with tempfile.TemporaryDirectory() as temp:
            ws = Path(temp)
            ready = ws / "ready"
            ready.mkdir()
            (ready / "a.zip").write_bytes(b"zip-marker")
            (ready / "B.ZIP").write_bytes(b"zip-marker")
            (ready / "ignore.txt").write_text("no")
            app = ZodiacQtApp(workspace=ws)
            self.assertEqual({Path(p).name for p in app._ready_archives()}, {"a.zip", "B.ZIP"})
            self.assertEqual(app.home.ready_picker.count(), 2)
            app.close()

    def test_log_is_visible_inside_overview_and_preserved_per_job(self):
        from tools.studio_qt.screens.workbench import WorkbenchScreen
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / ".runtime" / "studio-gui.log"
            workbench = WorkbenchScreen()
            workbench.set_log_file(path)
            self.assertTrue(workbench.log_view.isVisibleTo(workbench) or not workbench.log_view.isHidden())
            workbench.append_activity("[stdout] Một dòng log")
            workbench.append_activity("[stderr] Không bỏ dòng lỗi")
            self.assertIn("Không bỏ dòng lỗi", path.read_text(encoding="utf-8"))
            workbench._copy_log()
            self.assertIn("[stdout] Một dòng log", QApplication.clipboard().text())
            workbench.set_log_file(Path(temp) / "other" / "studio-gui.log")
            self.assertNotIn("Không bỏ dòng", workbench.log_view.toPlainText())
            workbench.close()

    def test_media_previews_text_and_json_instead_of_metadata_only(self):
        from tools.studio_qt.screens.media import MediaWorkspace
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp) / "nhanma"
            out = job / "out"
            out.mkdir(parents=True)
            (out / "publish-copy.txt").write_text("TIKTOK CAPTION: Nội dung mẫu\nHASHTAGS: #NhanMa", encoding="utf-8")
            (out / "trace.json").write_text('{"event":"giơ bản đồ"}', encoding="utf-8")
            media = MediaWorkspace()
            media.set_jobs([{"group": "Job@5", "name": job.name, "path": str(job), "out_path": str(out)}])
            media.open_media(out / "trace.json")
            self.assertIs(media.preview_stack.currentWidget(), media.text_preview)
            self.assertIn("giơ bản đồ", media.text_preview.toPlainText())
            media.open_media(out / "publish-copy.txt")
            self.assertIn("#NhanMa", media.text_preview.toPlainText())
            self.assertTrue(media.copy_publish_button.isEnabled())
            media._copy_publish()
            self.assertEqual(QApplication.clipboard().text(), "Nội dung mẫu\n\n#NhanMa")
            media.player.stop()
            media.close()

    def test_single_publish_source_preferred_over_legacy_copy(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "out").mkdir()
            (root / "publish").mkdir()
            (root / "out" / "publish.json").write_text(json.dumps({
                "caption": "Bản chính", "hashtags": ["#Bungmoto", "#NhanMa"]
            }), encoding="utf-8")
            (root / "publish" / "publish-copy.txt").write_text("TIKTOK CAPTION: Cũ\nHASHTAGS: #cu", encoding="utf-8")
            self.assertEqual(publish_text_for_job(root), "Bản chính\n\n#Bungmoto #NhanMa")


if __name__ == "__main__":
    unittest.main()
