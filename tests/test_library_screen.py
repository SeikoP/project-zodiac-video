import os
import tempfile
import time
import unittest
from pathlib import Path

try:
    from PySide6.QtWidgets import QApplication
except ImportError:  # sandbox without Qt
    QApplication = None


@unittest.skipIf(QApplication is None, "PySide6 not installed")
class LibraryScreenTests(unittest.TestCase):
    def test_scan_does_not_block_qt_event_loop(self):
        import threading
        from unittest.mock import patch
        from PySide6.QtCore import QTimer
        from tools.studio_qt.screens.library import LibraryScreen
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        app = QApplication.instance() or QApplication([])
        release = threading.Event()
        with tempfile.TemporaryDirectory() as temp:
            screen = LibraryScreen(Path(temp), Path(temp))
            with patch("tools.studio_qt.screens.library.library.scan", side_effect=lambda *_: (release.wait(2), [])[1]):
                screen.refresh()
                fired = []
                QTimer.singleShot(0, lambda: fired.append(True))
                app.processEvents()
                self.assertEqual(fired, [True])
                self.assertTrue(screen._scanning)
                release.set()
                deadline = time.monotonic() + 3
                while screen._scanning and time.monotonic() < deadline:
                    app.processEvents();time.sleep(0.005)
                self.assertFalse(screen._scanning)
            screen.close()

    def test_filters_preserve_selection_and_clear_unavailable_actions(self):
        from tools.application.library import Entry
        from tools.studio_qt.screens.library import LibraryScreen
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        app = QApplication.instance() or QApplication([])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            job = root / "episode"
            job.mkdir()
            (job / "package-manifest.json").write_text("{}")
            screen = LibraryScreen(root, root)
            screen._entries = [Entry("job", job, "episode", videos=[job / "out.mp4"]),
                               Entry("package", root / "old.zip", "old.zip", verdict="archive")]
            screen._fill()
            screen.table.selectRow(0)
            self.assertTrue(screen.open_job_button.isEnabled())
            screen._fill()
            self.assertEqual(screen._selected_path(), job)
            screen.scope.setCurrentIndex(screen.scope.findData("archive"))
            self.assertEqual(screen.table.rowCount(), 1)
            self.assertFalse(screen.open_job_button.isEnabled())
            self.assertFalse(screen.folder_button.isEnabled())
            screen.filter.setText("missing")
            self.assertEqual(screen.table.rowCount(), 0)
            self.assertFalse(screen.empty_label.isHidden())
            screen.close()

    def test_screen_lists_and_enables_cleanup_only_when_there_is_something_to_clean(self):
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        app = QApplication.instance() or QApplication([])
        from tools.studio_qt.screens.library import LibraryScreen
        from tests.test_library import make_zip
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "ready").mkdir()
            ws = root / ".zodiac-work"
            ws.mkdir()
            screen = LibraryScreen(root, ws)
            screen.refresh()
            deadline = time.monotonic() + 5
            while screen._scanning and time.monotonic() < deadline:
                app.processEvents()
                time.sleep(0.005)
            self.assertFalse(screen._scanning)
            self.assertEqual(screen.table.rowCount(), 0)
            self.assertFalse(screen.clean_button.isEnabled())
            make_zip(root / "ready" / "old.zip", "j", "1", 1000)
            make_zip(root / "ready" / "new.zip", "j", "2", 2000)
            screen.refresh()
            deadline = time.monotonic() + 5
            while screen._scanning and time.monotonic() < deadline:
                app.processEvents()
                time.sleep(0.005)
            self.assertFalse(screen._scanning)
            self.assertEqual(screen.table.rowCount(), 2)
            self.assertTrue(screen.clean_button.isEnabled())
            app.processEvents()


if __name__ == "__main__":
    unittest.main()
