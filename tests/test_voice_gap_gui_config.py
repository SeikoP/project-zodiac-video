"""Scene pause must be identical for WAV assembly and measured timing."""
import os
import unittest
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")


class VoiceGapGuiTests(unittest.TestCase):
    def test_ui_roundtrip_keeps_scene_gap(self):
        from PySide6.QtWidgets import QApplication
        from tools.studio_qt.dialogs.settings import SettingsDialog
        app=QApplication.instance() or QApplication([])
        dlg=SettingsDialog({"voice":"test", "scene_gap_ms": 240.0}, vieneu_url=None, tts_root=None)
        try:
            self.assertEqual(dlg.values()["scene_gap_ms"], 240.0)
            dlg.scene_gap_ms.setValue(0)
            self.assertEqual(dlg.values()["scene_gap_ms"], 0.0)
        finally:
            dlg.close()
            dlg.deleteLater()

    def test_gui_config_never_separates_wav_and_timing_gaps(self):
        import tempfile
        from tools.application.service import ApplicationRunRequest, ApplicationService

        with tempfile.TemporaryDirectory() as temp:
            service=ApplicationService(Path(temp))
            config=service._current_config(ApplicationRunRequest(scene_gap_ms=240.0))
        self.assertEqual(config.tts_settings["scene_gap_ms"],240.0)
        self.assertEqual(config.aligner_settings["scene_gap_ms"],240.0)


if __name__=="__main__":
    unittest.main()