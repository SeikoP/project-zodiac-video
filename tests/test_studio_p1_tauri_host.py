"""P1 Tauri host source contract and live Python stdio integration tests.

All writes occur only in TemporaryDirectory; fixture approvals are test-only.
"""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "apps/zodiac-studio"
FIXTURE = ROOT / "tests/studio_phase1_synthetic_fixture.mjs"


class TauriHostIntegrationTests(unittest.TestCase):
    def test_frontend_host_packages_and_security_boundaries(self):
        manifest = json.loads((APP / "src-tauri/tauri.conf.json").read_text("utf8"))
        capability = json.loads((APP / "src-tauri/capabilities/default.json").read_text("utf8"))
        self.assertEqual(manifest["build"]["frontendDist"], "../dist")
        self.assertEqual(manifest["app"]["windows"][0]["minWidth"], 1060)
        self.assertEqual(capability["windows"], ["main"])
        self.assertIn("dialog:allow-open", capability["permissions"])
        self.assertNotIn("shell:allow-execute", capability["permissions"])
        self.assertFalse(manifest["bundle"]["active"])  # avoid claiming distributable Python app
        src = (APP / "src-tauri/src/lib.rs").read_text("utf8")
        self.assertIn("studio_request", src)
        self.assertIn("RPC_METHOD_FORBIDDEN", src)
        self.assertIn("ZODIAC_STUDIO_SOURCE_ROOT", src)
        self.assertIn("source_root: Option<PathBuf>", src)  # missing repo must not crash GUI
        workflow = (ROOT / ".github/workflows/studio-v5-tauri-p1.yml").read_text("utf8")
        self.assertIn("actions/upload-artifact@v4", workflow)
        self.assertTrue((APP / "scripts/launch-preview.ps1").is_file())
        self.assertIn("apps", str(APP))  # correct repo-level pilot

    def test_end_to_end_approved_v2_import_note_and_restart(self):
        with tempfile.TemporaryDirectory(prefix="zodiac-p1-desktop-") as temp:
            tmp = Path(temp)
            capsule = tmp / "fixture.zip"
            subprocess.run(["node", str(FIXTURE), str(capsule), "valid"],
                           cwd=ROOT, capture_output=True, check=True)
            original_sha = hashlib.sha256(capsule.read_bytes()).hexdigest()
            projects_root = tmp / "isolated-studio-projects"
            commands = [
                ("health", {}),
                ("projects.list", {}),
                ("projects.import", {"path": str(capsule)}),
            ]
            with subprocess.Popen([
                sys.executable, "-u", "-m", "tools.studio_project.rpc_stdio",
                "--projects-root", str(projects_root)
            ], cwd=ROOT, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE) as process:
                def send(name, params, count):
                    process.stdin.write((json.dumps({
                        "id": str(count), "method": name, "params": params
                    }) + "\n").encode())
                    process.stdin.flush()
                    reply = json.loads(process.stdout.readline())
                    self.assertEqual(reply["id"], str(count))
                    self.assertTrue(reply["ok"], reply.get("error"))
                    return reply["result"]
                res = [send(name, params, count) for count, (name, params) in enumerate(commands)]
                self.assertEqual(res[0]["status"], "READY")
                self.assertEqual(res[1], [])
                project = res[2]
                self.assertEqual(project["status"]["content"], "APPROVED")
                self.assertEqual(project["status"]["voice"], "UNKNOWN")
                ident = project["project_id"]
                event = send("projects.command", {"request": {
                    "project_id": ident,
                    "command_id": "tauri-metadata-1",
                    "base_revision": 0,
                    "kind": "project.note",
                    "payload": {"text": "Studio P1 isolated integration"},
                }}, 3)
                self.assertEqual(event["revision"], 1)
                events = send("events.list", {"project_id": ident, "after_seq": 0}, 4)
                self.assertEqual([entry["kind"] for entry in events], ["project.note"])
                process.stdin.close()
                self.assertEqual(process.wait(timeout=10), 0)
                self.assertFalse(process.stderr.read())
            with subprocess.Popen([
                sys.executable, "-u", "-m", "tools.studio_project.rpc_stdio",
                "--projects-root", str(projects_root)
            ], cwd=ROOT, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE) as reopened:
                req = {"id": "restart", "method": "projects.open", "params": {"project_id": ident}}
                reopened.stdin.write((json.dumps(req) + "\n").encode())
                reopened.stdin.flush()
                data = json.loads(reopened.stdout.readline())
                self.assertTrue(data["ok"], data.get("error"))
                self.assertEqual(data["result"]["revision"], 1)
                self.assertEqual(data["result"]["status"]["content"], "APPROVED")
                reopened.stdin.close()
                self.assertEqual(reopened.wait(timeout=10), 0)
                self.assertFalse(reopened.stderr.read())
            self.assertEqual(original_sha, hashlib.sha256(capsule.read_bytes()).hexdigest())
            self.assertEqual(len(list((projects_root / "episodes").glob("studio-*"))), 1)


if __name__ == "__main__":
    unittest.main()
