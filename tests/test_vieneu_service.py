import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import QProcess
from tools.studio_qt.vieneu_service import VieNeuControl

class VieNeuServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([])

    def control(self, root, url="http://127.0.0.1:7860"):
        c=VieNeuControl(root,url,root/"service.log")
        c.timer.stop()
        c.process=Mock()
        c.process.state.return_value=QProcess.ProcessState.NotRunning
        self.addCleanup(c.deleteLater)
        return c

    def test_external_and_remote_services_are_never_stopped_or_spawned(self):
        with tempfile.TemporaryDirectory() as temp:
            c=self.control(Path(temp));c.ready=True
            c.start();c.stop();c.shutdown()
            c.process.start.assert_not_called();c.process.kill.assert_not_called();c.process.terminate.assert_not_called()
            c=self.control(Path(temp),"https://tts.example.test");c.start();c.process.start.assert_not_called()

    def test_starts_local_gradio_with_the_existing_environment(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/".venv/Scripts").mkdir(parents=True);(root/"apps").mkdir()
            (root/".venv/Scripts/python.exe").touch();(root/"apps/gradio_main.py").touch()
            c=self.control(root);c.start()
            c.process.setProgram.assert_called_once_with(str(root/".venv/Scripts/python.exe"))
            c.process.setArguments.assert_called_once_with(["-u","-m","apps.gradio_main"])
            c.process.start.assert_called_once()
            env=c.process.setProcessEnvironment.call_args.args[0]
            self.assertEqual(env.value("GRADIO_SHARE"),"false")

    def test_active_voice_blocks_stop_and_old_pid_cannot_kill_a_restart(self):
        with tempfile.TemporaryDirectory() as temp:
            c=self.control(Path(temp));c.process.state.return_value=QProcess.ProcessState.Running
            c.process.processId.return_value=22
            c.set_in_use(True);c.stop();c.process.terminate.assert_not_called()
            c._kill_owned(22);c.process.kill.assert_not_called()
            c.set_in_use(False);c._kill_owned(21);c.process.kill.assert_not_called()
            c._kill_owned(22);c.process.kill.assert_called_once()

    def test_missing_installation_is_reported_without_running_another_python(self):
        with tempfile.TemporaryDirectory() as temp:
            c=self.control(Path(temp));c.start();c.process.start.assert_not_called()
            self.assertIn("thiếu cài đặt",c.status.text())
