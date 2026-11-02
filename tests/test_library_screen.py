import os
import tempfile
import unittest
from pathlib import Path

try:
    from PySide6.QtWidgets import QApplication
except ImportError:  # sandbox without Qt
    QApplication = None


@unittest.skipIf(QApplication is None, "PySide6 not installed")
class LibraryScreenTests(unittest.TestCase):
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
            self.assertEqual(screen.table.rowCount(), 0)
            self.assertFalse(screen.clean_button.isEnabled())
            make_zip(root / "ready" / "old.zip", "j", "1", 1000)
            make_zip(root / "ready" / "new.zip", "j", "2", 2000)
            screen.refresh()
            self.assertEqual(screen.table.rowCount(), 2)
            self.assertTrue(screen.clean_button.isEnabled())
            app.processEvents()


if __name__ == "__main__":
    unittest.main()
