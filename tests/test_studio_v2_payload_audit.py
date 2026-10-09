"""Payload parity: detailed failures and safe one-time cached PLAN recovery."""
import json
import sys
import unittest
from unittest.mock import patch

from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.runner import (
    run_payload_audit_with_cache_recovery,
    run_structured_command,
)


def mismatch():
    return ControlPlaneError(
        code="RENDER_PLAN_PAYLOAD_MISMATCH", stage="PLAN",
        message="Entity S04.story_effect missing",
    )


class PlanPayloadAuditTests(unittest.TestCase):
    def test_stderr_structured_error_is_preserved(self):
        script = ("import sys,json;"
                  "print(json.dumps({'ok':False,'code':'RENDER_PLAN_PAYLOAD_MISMATCH',"
                  "'stage':'PLAN','message':'ASSET_CHANGED s07 notebook.marked',"
                  "'detail':{'errors':['ASSET_CHANGED s07 notebook.marked']}}),file=sys.stderr);"
                  "sys.exit(2)")
        with self.assertRaises(ControlPlaneError) as caught:
            run_structured_command([sys.executable, "-c", script],
                                   stage="PLAN",fallback_code="GENERIC_ERROR")
        error = caught.exception
        self.assertEqual(error.code, "RENDER_PLAN_PAYLOAD_MISMATCH")
        self.assertIn("s07", error.message)
        self.assertEqual(len(error.detail["errors"]), 1)

    def test_stdout_error_and_plain_text_failure_are_not_hidden(self):
        script = ("import sys,json;"
                  "print(json.dumps({'ok':False,'code':'PROBE_FAILURE','message':'detail visible'}));"
                  "sys.exit(3)")
        with self.assertRaises(ControlPlaneError) as caught:
            run_structured_command([sys.executable,"-c",script],
                                   stage="PLAN",fallback_code="FALLBACK")
        self.assertEqual(caught.exception.code,"PROBE_FAILURE")
        with self.assertRaises(ControlPlaneError) as other:
            run_structured_command(
                [sys.executable,"-c","print('audit output failed');raise SystemExit(2)"],
                stage="PLAN",fallback_code="FALLBACK")
        self.assertIn("audit output failed",other.exception.detail["stdout"])

    def test_valid_parity_never_rebuilds(self):
        with patch("tools.studio_v2.runner.run_structured_command") as command:
            rebuilt = []
            self.assertFalse(run_payload_audit_with_cache_recovery(
                ["audit"],cached_plan=True,rebuild_plan=lambda:rebuilt.append("called")))
        self.assertEqual(command.call_count,1)
        self.assertEqual(rebuilt,[])

    def test_stale_cached_parity_rebuilds_once(self):
        with patch("tools.studio_v2.runner.run_structured_command",
                   side_effect=[mismatch(),None]) as command:
            rebuilt = []
            result = run_payload_audit_with_cache_recovery(
                ["audit"],cached_plan=True,rebuild_plan=lambda:rebuilt.append("rebuilt"))
        self.assertTrue(result)
        self.assertEqual(rebuilt,["rebuilt"])
        self.assertEqual(command.call_count,2)

    def test_fresh_plan_mismatch_fails_without_rebuild(self):
        with patch("tools.studio_v2.runner.run_structured_command",
                   side_effect=mismatch()) as command:
            rebuilt=[]
            with self.assertRaises(ControlPlaneError):
                run_payload_audit_with_cache_recovery(
                    ["audit"],cached_plan=False,rebuild_plan=lambda:rebuilt.append("rebuilt"))
        self.assertEqual(command.call_count,1)
        self.assertEqual(rebuilt,[])

    def test_repeated_mismatch_does_not_retry_forever(self):
        with patch("tools.studio_v2.runner.run_structured_command",
                   side_effect=mismatch()) as command:
            rebuilt=[]
            with self.assertRaises(ControlPlaneError):
                run_payload_audit_with_cache_recovery(
                    ["audit"],cached_plan=True,rebuild_plan=lambda:rebuilt.append("rebuilt"))
        self.assertEqual(command.call_count,2)
        self.assertEqual(rebuilt,["rebuilt"])

    def test_unrelated_error_is_not_masked_by_cache_recovery(self):
        unrelated=ControlPlaneError(code="RENDERER_EXECUTABLE_MISSING",stage="PLAN",
                                   message="node is unavailable")
        with patch("tools.studio_v2.runner.run_structured_command",
                   side_effect=unrelated):
            rebuilt=[]
            with self.assertRaises(ControlPlaneError) as caught:
                run_payload_audit_with_cache_recovery(
                    ["audit"],cached_plan=True,rebuild_plan=lambda:rebuilt.append("rebuilt"))
        self.assertEqual(caught.exception.code,"RENDERER_EXECUTABLE_MISSING")
        self.assertEqual(rebuilt,[])


if __name__=="__main__":
    unittest.main()
