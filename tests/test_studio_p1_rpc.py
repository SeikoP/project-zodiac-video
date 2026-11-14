"""P1 transport tests: one process, exact contracts, recovery and no fake review."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.studio_project.rpc_stdio import dispatch, handle_line
from tools.studio_project.service import StudioProjectService

ROOT = Path(__file__).resolve().parents[1]


class TransportTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-p1-rpc-")
        self.addCleanup(context.cleanup)
        self.root = Path(context.name)
        self.service = StudioProjectService(self.root / "projects")

    def message(self, id, method, params):
        return handle_line(self.service, json.dumps({
            "id": id, "method": method, "params": params
        }, ensure_ascii=False).encode("utf8"))

    def test_health_real_protocol_and_no_approval(self):
        r = self.message("ping", "health", {})
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"]["protocol"], "zodiac-studio-rpc@1")
        self.assertEqual(r["result"]["approvals"], "NOT_GRANTED")

    def test_whitelist_and_unexpected_arguments_blocked(self):
        for method, params in (
            ("os.exec", {"command": "del C:\\"}),
            ("phase.approve", {"status": "APPROVED"}),
            ("scene.compile", {"scene_id": "S01"}),
            ("projects.import", {"path": "../../README.md"}),
            ("projects.list", {"root": "C:\\"}),
            ("assets.list", {"limit": 1, "query": "", "hidden": True}),
        ):
            with self.subTest(method=method):
                out = self.message("t", method, params)
                self.assertFalse(out["ok"])
        self.assertEqual(self.service.registry.project_count(), 0)

    def test_large_or_invalid_line_emits_typed_error(self):
        for raw in (b"", b"malformed", b"{", b"x" * 65537,
                    b'{"id":"a","method":"health","params":{},"admin":true}'):
            with self.subTest(raw=raw[:12]):
                out = handle_line(self.service, raw)
                self.assertFalse(out["ok"])
                self.assertTrue(out["error"]["code"].startswith("RPC_"))

    def test_live_subprocess_round_trip_and_exit(self):
        cmd = [sys.executable, "-u", "-m", "tools.studio_project.rpc_stdio",
               "--projects-root", str(self.root / "projects")]
        with subprocess.Popen(cmd, cwd=ROOT, stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE) as process:
            requests = [
                {"id": "1", "method": "health", "params": {}},
                {"id": "2", "method": "projects.list", "params": {}},
                {"id": "3", "method": "assets.list", "params": {"query": "phone", "limit": 3}},
            ]
            for request in requests:
                process.stdin.write((json.dumps(request) + "\n").encode())
                process.stdin.flush()
                result = json.loads(process.stdout.readline().decode("utf8"))
                self.assertEqual(result["id"], request["id"])
                self.assertTrue(result["ok"], result.get("error"))
            self.assertEqual(result["result"]["ranked"], False)
            self.assertGreaterEqual(len(result["result"]["items"]), 1)
            process.stdin.close()
            self.assertEqual(process.wait(timeout=10), 0)
            self.assertFalse(process.stderr.read())


if __name__ == "__main__":
    unittest.main()
