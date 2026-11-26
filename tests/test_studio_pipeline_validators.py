import json
import tempfile
import unittest
from pathlib import Path

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import validators
from tools.studio_project.pipeline.receipts import read_receipt
from tools.studio_project.pipeline.runner import run_node, register_executor
from tools.studio_project.pipeline.receipts import write_receipt
from tools.studio_project.pipeline.validators import checks_executor, run_validators


def stub(results):
    seen = []

    def runner(workspace, names):
        seen.append((Path(workspace), tuple(names)))
        return results
    runner.seen = seen
    return runner


PASS = {"name": "x", "status": "PASS", "issues": []}


class ValidatorTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-validators-")
        self.addCleanup(context.cleanup)
        self.workspace = Path(context.name)
        self.service = FakeService(self.workspace, visual=visual_state(), voice=voice_state())

    def test_all_pass_returns_ok_with_receipt(self):
        runner = stub([{**PASS, "name": "a"}, {**PASS, "name": "b"}])
        report = run_validators(self.service, "p", ["progressive-preflight", "scene-experience"], runner=runner)
        self.assertTrue(report.ok)
        self.assertEqual(len(report.receipt_sha256), 64)
        self.assertEqual(runner.seen, [(self.workspace, ("progressive-preflight", "scene-experience"))])

    def test_issues_grouped_by_repair_group(self):
        runner = stub([{"name": "scene-experience", "status": "REVIEW", "issues": [
            {"code": "EXPERIENCE_PROFILE_MISSING", "scene_id": "s01"}, {"code": "PASSIVE_STORYTELLING", "scene_id": "s02"}]},
            {"name": "authoring-completeness", "status": "BLOCKED", "issues": [{"code": "ART_DIRECTION_INCOMPLETE"}]}])
        report = run_validators(self.service, "p", ["scene-experience", "authoring-completeness"], runner=runner)
        self.assertFalse(report.ok)
        self.assertEqual({i.repair_group for i in report.issues}, {"visual-intent:s01", "visual-intent:s02", "visual-intent"})

    def test_skipped_validator_does_not_fail_the_report(self):
        runner = stub([{"name": "progressive-preflight", "status": "SKIPPED", "issues": []}, {**PASS, "name": "b"}])
        self.assertTrue(run_validators(self.service, "p", ["progressive-preflight", "scene-experience"], runner=runner).ok)

    def test_review_status_is_not_ok(self):
        runner = stub([{"name": "scene-experience", "status": "REVIEW", "issues": []}])
        self.assertFalse(run_validators(self.service, "p", ["scene-experience"], runner=runner).ok)

    def test_unknown_validator_name_rejected(self):
        with self.assertRaises(StudioError) as ctx:
            run_validators(self.service, "p", ["rm -rf"], runner=stub([]))
        self.assertEqual(ctx.exception.code, "VALIDATOR_UNKNOWN")

    def test_missing_story_visual_decision_is_upstream_block(self):
        runner = stub([{"name": "story-visual-presence", "status": "BLOCKED", "issues": [{"code": "STORY_VISUAL_DECISION"}]}])
        issue = run_validators(self.service, "p", ["story-visual-presence"], runner=runner).issues[0]
        self.assertEqual(issue.owner, "phase1")

    def test_missing_prerequisites_are_studio_owned_not_agent_repairable(self):
        runner = stub([{"name": "progressive-preflight", "status": "BLOCKED",
                        "issues": [{"code": "VALIDATOR_PREREQUISITE_MISSING", "missing": ["production.json"]}]}])
        issue = run_validators(self.service, "p", ["progressive-preflight"], runner=runner).issues[0]
        self.assertEqual(issue.owner, "studio")
        self.assertIn("production.json", issue.message)

    def test_result_count_mismatch_is_not_ok(self):
        self.assertFalse(run_validators(self.service, "p", ["scene-experience", "progressive-preflight"],
                                        runner=stub([{**PASS}])).ok)

    def test_checks_executor_writes_receipt_only_when_ok(self):
        class Ctx:
            service, project_id = self.service, "p"
        original = validators.node_runner
        try:
            validators.node_runner = stub([{"name": "scene-experience", "status": "REVIEW",
                                            "issues": [{"code": "EXPERIENCE_PROFILE_MISSING", "scene_id": "s01"}]}])
            result = checks_executor(["scene-experience"])(Ctx)
            self.assertFalse(result["ok"])
            self.assertIsNone(read_receipt(self.workspace, "checks"))
            self.assertEqual(json.loads((self.workspace / validators.LAST_REPORT).read_text("utf-8"))["issues"][0]["code"], "EXPERIENCE_PROFILE_MISSING")
            validators.node_runner = stub([{**PASS, "name": "scene-experience"}])
            self.assertTrue(checks_executor(["scene-experience"])(Ctx)["ok"])
            self.assertEqual(read_receipt(self.workspace, "checks")["source_hash"], "h1")
        finally:
            validators.node_runner = original

    def test_quality_findings_alone_do_not_block_and_are_carried_as_notes(self):
        runner = stub([{"name": "scene-experience", "status": "REVIEW", "issues": [
            {"code": "PASSIVE_STORYTELLING", "scene_id": "s02"}, {"code": "FRAME_OCCUPANCY_LOW", "scene_id": "s03"}]}])
        report = run_validators(self.service, "p", ["scene-experience"], runner=runner)
        self.assertTrue(report.ok)
        self.assertEqual([n.code for n in report.notes], ["PASSIVE_STORYTELLING", "FRAME_OCCUPANCY_LOW"])
        self.assertEqual(len(report.issues), 2)
        self.assertEqual(len(report.to_dict()["notes"]), 2)

    def test_a_structural_failure_still_blocks_even_beside_quality_notes(self):
        runner = stub([{"name": "scene-experience", "status": "REVIEW", "issues": [
            {"code": "PASSIVE_STORYTELLING", "scene_id": "s02"}, {"code": "EXPERIENCE_PROFILE_MISSING", "scene_id": "s01"}]}])
        report = run_validators(self.service, "p", ["scene-experience"], runner=runner)
        self.assertFalse(report.ok)
        self.assertEqual([n.code for n in report.notes], ["PASSIVE_STORYTELLING"])

    def test_the_checks_node_writes_its_receipt_with_notes(self):
        class Ctx:
            service, project_id = self.service, "p"
        original = validators.node_runner
        try:
            validators.node_runner = stub([{"name": "scene-experience", "status": "REVIEW",
                                            "issues": [{"code": "PASSIVE_STORYTELLING", "scene_id": "s01"}]}])
            self.assertTrue(checks_executor(["scene-experience"])(Ctx)["ok"])
            self.assertEqual(read_receipt(self.workspace, "checks")["source_hash"], "h1")
            self.assertEqual(len(validators.last_report(self.workspace)["notes"]), 1)
        finally:
            validators.node_runner = original

    def test_runner_uses_argv_without_shell(self):
        calls = []
        real = validators.subprocess.run

        def fake_run(argv, **kw):
            calls.append((argv, kw))
            return type("R", (), {"returncode": 0, "stdout": b'{"results": []}', "stderr": b""})()
        validators.subprocess.run = fake_run
        try:
            validators.node_runner(self.workspace, ["scene-experience"])
        finally:
            validators.subprocess.run = real
        argv, kw = calls[0]
        self.assertIsInstance(argv, list)
        self.assertIs(kw["shell"], False)


class RealBridgeTests(unittest.TestCase):
    """Runs the Node bridge against the real plugin code (read-only)."""

    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-validators-real-")
        self.addCleanup(context.cleanup)
        self.root = Path(context.name)
        (self.root / ".authoring").mkdir()

    def test_scene_experience_reports_missing_profile_from_real_plugin(self):
        intent = {"format": "zodiac-visual-intent@1", "scenes": [
            {"id": "s01", "semantic_goal": "g", "narration_range": [0, 5], "entities": [], "events": []}]}
        (self.root / ".authoring/visual-intent.json").write_text(json.dumps(intent), encoding="utf-8")
        results = validators.node_runner(self.root, ["scene-experience"])
        self.assertEqual(results[0]["name"], "scene-experience")
        self.assertEqual(results[0]["status"], "REVIEW")
        self.assertIn("EXPERIENCE_PROFILE_MISSING", [i["code"] for i in results[0]["issues"]])

    def test_missing_prerequisites_are_reported_not_passed(self):
        (self.root / ".authoring/visual-intent.json").write_text("{}", encoding="utf-8")
        results = validators.node_runner(self.root, ["progressive-preflight", "story-visual-presence"])
        self.assertTrue(all(r["status"] == "BLOCKED" for r in results))
        self.assertEqual(results[0]["issues"][0]["code"], "VALIDATOR_PREREQUISITE_MISSING")

    def test_studio_workspace_skips_validators_that_need_only_remotion_files(self):
        (self.root / ".authoring/visual-intent.json").write_text("{}", encoding="utf-8")
        (self.root / "studio-import-receipt.json").write_text("{}", encoding="utf-8")
        results = validators.node_runner(self.root, ["progressive-preflight", "authoring-completeness"])
        self.assertEqual([(r["status"], r["issues"]) for r in results], [("SKIPPED", [])] * 2)

    def test_studio_workspace_still_blocks_on_a_genuinely_missing_input(self):
        (self.root / "studio-import-receipt.json").write_text("{}", encoding="utf-8")  # no visual-intent.json
        results = validators.node_runner(self.root, ["authoring-completeness"])
        self.assertEqual(results[0]["status"], "BLOCKED")

    def test_bridge_does_not_write_into_the_workspace(self):
        (self.root / ".authoring/visual-intent.json").write_text(json.dumps({"scenes": []}), encoding="utf-8")
        before = sorted(p.name for p in self.root.rglob("*"))
        validators.node_runner(self.root, ["scene-experience"])
        self.assertEqual(sorted(p.name for p in self.root.rglob("*")), before)


class RpcWiringTests(unittest.TestCase):
    def test_rpc_rejects_non_list_names_and_unknown_validator(self):
        from tools.studio_project.rpc_stdio import dispatch
        service = FakeService(Path(tempfile.gettempdir()), visual=visual_state(), voice=voice_state())
        with self.assertRaises(StudioError) as ctx:
            dispatch(service, "validators.run", {"project_id": "p", "names": "scene-experience"})
        self.assertEqual(ctx.exception.code, "RPC_PARAMS_INVALID")
        with self.assertRaises(StudioError) as ctx:
            dispatch(service, "validators.run", {"project_id": "p", "names": ["rm -rf"]})
        self.assertEqual(ctx.exception.code, "VALIDATOR_UNKNOWN")

    def test_checks_node_is_backed_by_a_real_executor(self):
        from tools.studio_project.pipeline import runner
        self.assertIn("validators.run", runner._EXECUTORS)


if __name__ == "__main__":
    unittest.main()
