import json
import subprocess
import tempfile
import unittest
import sys
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

from tools.studio.preflight import Job5PreflightChecker


class PinnedRendererPreflightTests(unittest.TestCase):
    def make_job(self, root: Path, version: str):
        job=root/"job"
        job.mkdir()
        (job/"package-manifest.json").write_text(
            json.dumps({"renderer":{"version":version}}),encoding="utf-8")
        return job

    def make_source(self, root: Path, version: str):
        renderer=root/"runtime"/"zodiac-renderer"/version/"renderer"
        (renderer/"scripts").mkdir(parents=True)
        (renderer/"src").mkdir(parents=True)
        for filename in ("scripts/prepare.mjs","scripts/local-remotion-cli.mjs","src/index.ts"):
            (renderer/filename).write_text("",encoding="utf-8")
        (renderer/"package.json").write_text(
            json.dumps({"dependencies":{"@remotion/cli":"4.0.530"}}),encoding="utf-8")
        return renderer

    def make_cli(self,renderer:Path,version="4.0.530"):
        d=renderer/"node_modules"/"@remotion"/"cli"
        (d/"dist").mkdir(parents=True,exist_ok=True)
        (d/"package.json").write_text(
            json.dumps({"version":version,"bin":{"remotion":"dist/cli.js"}}),encoding="utf-8")
        (d/"dist"/"cli.js").write_text("console.log('render')",encoding="utf-8")

    def test_selected_job_201_requires_201_not_200(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.1")
            self.make_source(root,"2.0.0")
            checker=Job5PreflightChecker(job)
            with patch("tools.studio.preflight.ROOT",root):
                self.assertEqual(checker.renderer_directory().parent.name,"2.0.1")
                result=checker.renderer_check()
                self.assertFalse(result.ok)
                self.assertEqual(result.error_code,"RENDERER_SOURCE_MISSING")

    def test_missing_cli_dependency_marks_environment_not_ready(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.1")
            renderer=self.make_source(root,"2.0.1")
            checker=Job5PreflightChecker(job)
            with patch("tools.studio.preflight.ROOT",root):
                result=checker.renderer_check()
                self.assertFalse(result.ok)
                self.assertEqual(result.error_code,"DEPENDENCY_MISSING")
                self.assertIn("npm install --prefix",result.details)
                self.assertIn(str(renderer),result.details)

    def test_version_mismatch_rejected_and_exact_bin_required(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.1")
            renderer=self.make_source(root,"2.0.1")
            self.make_cli(renderer,version="4.0.529")
            with patch("tools.studio.preflight.ROOT",root),\
                 patch("tools.studio.preflight.subprocess.run",return_value=SimpleNamespace(returncode=0,stdout="RENDERER_CLI_READY",stderr="")):
                checker=Job5PreflightChecker(job)
                self.assertFalse(checker.renderer_check().ok)
                self.make_cli(renderer,version="4.0.530")
                self.assertTrue(checker.renderer_check().ok)
                (renderer/"node_modules"/"@remotion"/"cli"/"dist"/"cli.js").unlink()
                self.assertFalse(checker.renderer_check().ok)

    def test_user_approved_install_commands_target_only_selected_renderer(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.1")
            self.make_source(root,"2.0.1")
            checker=Job5PreflightChecker(job)
            with patch("tools.studio.preflight.ROOT",root),\
                 patch("tools.studio.preflight.shutil.which",return_value="/usr/bin/npm"):
                checks=[checker.renderer_check()]
                commands=checker.install_commands(checks)
                self.assertEqual(len(commands),1)
                self.assertEqual(commands[0][0],sys.executable)
                self.assertEqual(commands[0][1:3],["-m","tools.studio.renderer_repair"])
                self.assertEqual(commands[0][3:],["--version","2.0.1"])

    def test_broken_transitive_isexe_does_not_pass_environment_check(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.1")
            renderer=self.make_source(root,"2.0.1")
            self.make_cli(renderer)
            failed=SimpleNamespace(returncode=2, stdout="",
                stderr='{"code":"RENDERER_DEPENDENCY_BROKEN","message":"Cannot find module isexe"}')
            with patch("tools.studio.preflight.ROOT",root),\
                 patch("tools.studio.preflight.shutil.which",return_value="/fake/node"),\
                 patch("tools.studio.preflight.subprocess.run",return_value=failed) as invoke:
                status=Job5PreflightChecker(job).renderer_check()
                self.assertFalse(status.ok)
                self.assertEqual(status.error_code,"DEPENDENCY_MISSING")
                self.assertIn("isexe",status.message)
                self.assertIn("npm install --prefix",status.details)
                self.assertEqual(invoke.call_args.args[0][-1],"--check")

    def test_renderer_200_remains_backward_compatible(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.0")
            renderer=self.make_source(root,"2.0.0")
            (renderer/"scripts"/"local-remotion-cli.mjs").unlink()
            self.make_cli(renderer)
            with patch("tools.studio.preflight.ROOT",root):
                self.assertTrue(Job5PreflightChecker(job).renderer_check().ok)

    def test_cli_timeout_is_not_a_missing_dependency_or_install_action(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.1")
            renderer=self.make_source(root,"2.0.1")
            self.make_cli(renderer)
            failed=SimpleNamespace(returncode=2,stdout="",stderr=json.dumps({
                "code":"RENDERER_CLI_TIMEOUT","message":"CLI help probe timed out after 60000ms"}))
            for outcome in (failed,subprocess.TimeoutExpired("node",75)):
                with self.subTest(outcome=outcome), \
                     patch("tools.studio.preflight.ROOT",root), \
                     patch("tools.studio.preflight.shutil.which",return_value="/fake/node"), \
                     patch("tools.studio.preflight.subprocess.run") as invoke:
                    if isinstance(outcome,Exception):
                        invoke.side_effect=outcome
                    else:
                        invoke.return_value=outcome
                    checker=Job5PreflightChecker(job)
                    status=checker.renderer_check()
                    self.assertFalse(status.ok)
                    self.assertEqual(status.error_code,"RENDERER_CLI_TIMEOUT")
                    self.assertNotIn("npm install",status.details)
                    self.assertEqual(checker.install_commands([status]),[])
                    self.assertGreater(invoke.call_args.kwargs["timeout"],60)


if __name__=="__main__":
    unittest.main()
