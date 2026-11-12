import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from PySide6.QtWidgets import QApplication
from tools.studio_qt.screens.concepts import ConceptsScreen


class PlannedConceptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def test_create_edit_reload_and_copy_brief(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "concepts.json"
            screen = ConceptsScreen(path)
            screen.title.setText("Song Tử giữ lời")
            screen.sign.setCurrentIndex(screen.sign.findData("gemini"))
            screen.premise.setPlainText("Một lời hứa, hai cách hiểu.")
            screen._save()
            self.assertEqual(len(screen.rows), 1)
            screen.title.setText("Một lời hứa")
            screen._save()
            self.assertEqual(len(screen.rows), 1)
            again = ConceptsScreen(path)
            self.assertEqual(again.rows[0]["title"], "Một lời hứa")
            again.list.setCurrentRow(0)
            again._copy()
            self.assertIn("chưa phải creative approval", self.app.clipboard().text())
            self.assertIn("Một lời hứa", self.app.clipboard().text())
            screen.close(); again.close()

    def test_invalid_source_and_external_change_are_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "concepts.json"
            path.write_text("broken")
            screen = ConceptsScreen(path)
            self.assertFalse(screen.save_button.isEnabled())
            self.assertEqual(path.read_text(), "broken")
            path.unlink()
            screen = ConceptsScreen(path)
            screen.title.setText("Title");screen.premise.setPlainText("Premise")
            path.write_text("external")
            screen._save()
            self.assertEqual(path.read_text(), "external")
            self.assertIn("đã đổi", screen.notice.text())
            screen.close()

    def test_empty_fields_and_failed_replace_do_not_commit(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "concepts.json"
            screen = ConceptsScreen(path)
            screen._save()
            self.assertFalse(path.exists())
            screen.title.setText("Title");screen.premise.setPlainText("Premise")
            with patch("tools.studio_qt.screens.concepts.os.replace", side_effect=OSError("busy")):
                screen._save()
            self.assertFalse(path.exists())
            self.assertEqual(list(path.parent.iterdir()), [])
            self.assertEqual(screen.rows, [])
            screen.close()
