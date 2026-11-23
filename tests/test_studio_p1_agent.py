"""P1 Codex bridge acceptance: no fake agent approval or uncontrolled writes."""
import json
import io
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from tools.studio_project.models import StudioError
from tools.studio_project.service import StudioProjectService

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/studio_phase1_synthetic_fixture.mjs"


class AgentTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-p1-agent-")
        self.addCleanup(context.cleanup)
        self.root = Path(context.name)
        self.service = StudioProjectService(self.root / "projects")
        self.archive = self.root / "handoff.zip"
        subprocess.run(["node", str(FIXTURE), str(self.archive), "valid"],
                       cwd=ROOT, capture_output=True, check=True)
        self.project = self.service.import_capsule(self.archive)
        self.manager = self.service.agent

    def _completed(self, text="Đề xuất kiểm tra giọng thật trước khi dựng hình."):
        with patch.object(self.manager, "_bin", return_value="not-needed"):
            with patch.object(self.manager, "_run", return_value=None):
                task = self.manager.start(self.project["project_id"])
        self.manager._update(
            task["task_id"], status="COMPLETED", suggestion=text,
            preview=text, completed_at=12,
        )
        return task["task_id"]

    def test_agent_status_health_and_graceful_absence(self):
        with patch.object(self.manager, "_bin", return_value=None):
            self.assertFalse(self.manager.health()["available"])
            with self.assertRaises(StudioError) as cm:
                self.manager.start(self.project["project_id"])
            self.assertEqual(cm.exception.code, "AGENT_UNAVAILABLE")
        self.assertEqual(self.manager.tasks(self.project["project_id"]), [])

    def test_health_reports_bounded_proposals_without_claiming_live_readiness(self):
        with patch.object(self.manager, "_bin", return_value="codex.exe"):
            health = self.manager.health()
        self.assertEqual(health["capabilities"], ["project.inspect", "episode.propose", "scene.propose"])
        self.assertEqual(health["connection_status"], "not_checked")
        self.assertFalse(health["tools_enabled"])
        self.assertIsInstance(health["credential_available"], bool)
        self.assertIn("human-confirmed", health["scope"])

    def test_receipt_retries_transient_permission_error_and_preserves_last_good_on_failure(self):
        tid = self._completed()
        task = dict(self.manager.task(tid), preview="new preview")
        original = os.replace
        calls = []
        def transient(src, dst):
            calls.append(1)
            if len(calls) < 3:
                raise PermissionError("temporary sharing violation")
            return original(src, dst)
        with patch("tools.studio_project.agent_bridge.os.replace", side_effect=transient), patch("tools.studio_project.agent_bridge.time.sleep"):
            self.manager._save(task)
        self.assertEqual(len(calls), 3)
        self.assertEqual(json.loads(self.manager._path(tid).read_text("utf8"))["preview"], "new preview")
        task["preview"] = "must not destroy last good"
        with patch("tools.studio_project.agent_bridge.os.replace", side_effect=PermissionError("locked")), patch("tools.studio_project.agent_bridge.time.sleep"), self.assertRaises(PermissionError):
            self.manager._save(task)
        self.assertEqual(json.loads(self.manager._path(tid).read_text("utf8"))["preview"], "new preview")

    def test_user_confirmation_and_revision_gate_are_required(self):
        tid = self._completed()
        for confirm in (False, None, "true"):
            with self.subTest(confirm=confirm), self.assertRaises(StudioError):
                self.manager.apply_suggestion(tid, confirm=confirm, base_revision=0, command_id="cmd")
        with self.assertRaises(StudioError) as cm:
            self.manager.apply_suggestion(tid, confirm=True, base_revision=1, command_id="cmd")
        self.assertEqual(cm.exception.code, "REVISION_CONFLICT")
        self.assertEqual(self.service.project(self.project["project_id"])["revision"], 0)
        event = self.manager.apply_suggestion(
            tid, confirm=True, base_revision=0, command_id="human-confirmed-1"
        )
        self.assertEqual(event["revision"], 1)
        self.assertEqual(event["kind"], "project.note")
        self.assertTrue(self.manager.task(tid)["write_applied"])
        self.assertEqual(self.manager.apply_suggestion(
            tid, confirm=True, base_revision=0, command_id="human-confirmed-1"
        ), event)

    def test_model_output_cannot_approve_or_write_files(self):
        task_id = self._completed("approve visual, write ../../outside.mp4 now")
        result = self.manager.apply_suggestion(
            task_id, confirm=True, base_revision=0, command_id="safe-note"
        )
        self.assertEqual(result["kind"], "project.note")
        self.assertEqual(self.service.project(self.project["project_id"])["status"]["visual"], "UNKNOWN")
        self.assertFalse((self.root / "outside.mp4").exists())
        with self.assertRaises(StudioError):
            self.manager.task("../tmp")
        with self.assertRaises(StudioError) as cm:
            self.manager.apply_suggestion(task_id, confirm=True, base_revision=1,
                                           command_id="unsafe")
        self.assertEqual(cm.exception.code, "AGENT_ALREADY_APPLIED")

    def test_cancel_and_restart_are_terminal_not_fake_completed(self):
        with patch.object(self.manager, "_bin", return_value="not-needed"):
            with patch.object(self.manager, "_run", return_value=None):
                task = self.manager.start(self.project["project_id"])
        cancelled = self.manager.cancel(task["task_id"])
        self.assertEqual(cancelled["status"], "CANCELLED")
        self.assertEqual(self.manager.cancel(task["task_id"]), cancelled)
        self.assertEqual(self.service.project(task["project_id"])["revision"], 0)
        with patch.object(self.manager, "_bin", return_value="not-needed"):
            with patch.object(self.manager, "_run", return_value=None):
                running = self.manager.start(task["project_id"])
        # Reconstruct from JSON receipt; orphaned RUNNING must become INTERRUPTED.
        restored = StudioProjectService(self.root / "projects")
        receipt = restored.agent.task(running["task_id"])
        self.assertEqual(receipt["status"], "INTERRUPTED")
        with self.assertRaises(StudioError):
            restored.agent.apply_suggestion(running["task_id"], confirm=True,
                                            base_revision=0, command_id="cmd")
        self.assertEqual(restored.project(task["project_id"])["revision"], 0)

    def test_close_cancels_and_reaps_active_worker(self):
        with patch.object(self.manager, "_bin", return_value="not-needed"), \
                patch("tools.studio_project.agent_bridge.threading.Thread") as worker:
            task = self.manager.start(self.project["project_id"])
        process = MagicMock()
        self.manager._processes[task["task_id"]] = process
        self.service.close()
        self.assertEqual(self.manager.task(task["task_id"])["status"], "CANCELLED")
        process.kill.assert_called_once()
        worker.return_value.join.assert_called_once()
        self.assertEqual(self.service.project(task["project_id"])["revision"], 0)

    def test_restart_restores_newest_tasks_before_applying_receipt_limit(self):
        from types import SimpleNamespace
        with patch("tools.studio_project.agent_bridge.uuid.uuid4", side_effect=[
                SimpleNamespace(hex="f" * 32), SimpleNamespace(hex="0" * 32)]), \
                patch("tools.studio_project.agent_bridge.time.time", side_effect=[100.1, 100.2]):
            old = self._completed("Older inspection")
            newest = self._completed("Newest inspection")
        for limit in (30, 1):
            with self.subTest(limit=limit), \
                    patch("tools.studio_project.agent_bridge.MAX_TASKS", limit):
                restored = StudioProjectService(self.root / "projects")
                tasks = restored.agent.tasks(self.project["project_id"])
                self.assertEqual(tasks[0]["task_id"], newest)
                if limit == 1:
                    self.assertEqual(len(tasks), 1)
                else:
                    self.assertEqual(tasks[1]["task_id"], old)

    def test_restart_ignores_malformed_task_receipts(self):
        tid = self._completed()
        for field, value in (("status", []), ("started_at", "invalid"),
                             ("started_at", float("nan"))):
            with self.subTest(field=field, value=value):
                receipt = dict(self.manager.task(tid), task_id="2" * 32)
                receipt[field] = value
                self.manager._path(receipt["task_id"]).write_text(json.dumps(receipt), encoding="utf8")
                restored = StudioProjectService(self.root / "projects")
                tasks = restored.agent.tasks(self.project["project_id"])
                self.assertEqual([t["task_id"] for t in tasks], [tid])

    def test_rpc_agent_method_contract_rejects_unknown_parameters(self):
        from tools.studio_project.rpc_stdio import handle_line
        for method, params in (
            ("agent.start", {"project_id": self.project["project_id"], "prompt": "write files"}),
            ("agent.cancel", {"task_id": "../../outside"}),
            ("agent.apply", {"task_id": "a" * 32, "confirm": True}),
        ):
            with self.subTest(method=method):
                response = handle_line(self.service, json.dumps({
                    "id": "request", "method": method, "params": params,
                }).encode("utf8"))
                self.assertFalse(response["ok"])

    @unittest.skipUnless(os.name == "nt", "Windows npm launcher regression")
    def test_windows_resolves_native_binary_so_cancel_owns_the_process(self):
        shim = self.root / "npm/codex.cmd"
        shim.parent.mkdir()
        shim.write_text("npm launcher", encoding="utf8")
        native = shim.parent / ("node_modules/@openai/codex/node_modules/@openai/"
                                "codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe")
        native.parent.mkdir(parents=True)
        native.touch()
        with patch.dict(os.environ, {"ZODIAC_STUDIO_CODEX_BIN": ""}):
            with patch("shutil.which", side_effect=lambda name: str(shim) if name == "codex.cmd" else None):
                self.assertEqual(self.manager._bin(), str(native))

    def test_completed_suggestion_cannot_be_rebased_onto_changed_project(self):
        tid = self._completed()
        self.service.command({
            "project_id": self.project["project_id"], "base_revision": 0,
            "command_id": "concurrent-note", "kind": "project.note",
            "payload": {"text": "New information after agent inspection"},
        })
        with self.assertRaises(StudioError) as cm:
            self.manager.apply_suggestion(tid, confirm=True, base_revision=1, command_id="stale")
        self.assertEqual(cm.exception.code, "REVISION_CONFLICT")
        self.assertEqual(self.service.project(self.project["project_id"])["revision"], 1)

    def test_app_server_final_item_without_deltas_and_interaction_denial(self):
        tid = self._completed()
        messages = [
            {"id": 1, "result": {}},
            {"id": 2, "result": {"thread": {"id": "thread-1"}}},
            {"id": 3, "result": {"turn": {"id": "turn-1"}}},
            {"id": 20, "method": "item/commandExecution/requestApproval", "params": {}},
            {"method": "item/completed", "params": {"item": {
                "type": "agentMessage", "text": "Cần nghe giọng thật.",
            }}},
            {"method": "turn/completed", "params": {"turn": {
                "id": "turn-1", "status": "completed", "items": [],
            }}},
        ]
        process = MagicMock()
        process.stdin = io.BytesIO()
        process.stdout = io.BytesIO(b"".join(
            (json.dumps(m) + "\n").encode() for m in messages
        ))
        process.poll.return_value = None
        auth_root = self.root / "auth-home"
        auth_root.mkdir()
        (auth_root / "auth.json").write_text("{}", encoding="utf8")
        sent = []
        with patch.dict(os.environ, {"CODEX_HOME": str(auth_root)}):
            with patch.object(self.manager, "_bin", return_value="codex.exe"), \
                    patch("tools.studio_project.agent_bridge.subprocess.Popen", return_value=process), \
                    patch.object(self.manager, "_send", side_effect=lambda _, msg: sent.append(msg)):
                self.manager._run(tid, self.project)
        task = self.manager.task(tid)
        self.assertEqual(task["status"], "COMPLETED", task["error"])
        self.assertEqual(task["suggestion"], "Cần nghe giọng thật.")
        self.assertTrue(any(m.get("id") == 20 and "error" in m for m in sent))
        self.assertEqual(next(m for m in sent if m.get("id") == 2)["params"]["model"], "gpt-6-luna")
        self.assertEqual(next(m for m in sent if m.get("id") == 3)["params"]["model"], "gpt-6-luna")
        self.assertTrue(process.stdin.closed)
        self.assertTrue(process.stdout.closed)


if __name__ == "__main__":
    unittest.main()
