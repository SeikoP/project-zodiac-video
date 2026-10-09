import json
import tempfile
import unittest
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
            with patch("tools.studio.preflight.ROOT",root):
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
                self.assertEqual(commands[0][0],"/usr/bin/npm")
                self.assertEqual(commands[0][1:3],["install","--prefix"])
                self.assertIn("2.0.1",commands[0][3])
                self.assertNotIn("2.0.0",commands[0][3])

    def test_renderer_200_remains_backward_compatible(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            job=self.make_job(root,"2.0.0")
            renderer=self.make_source(root,"2.0.0")
            (renderer/"scripts"/"local-remotion-cli.mjs").unlink()
            self.make_cli(renderer)
            with patch("tools.studio.preflight.ROOT",root):
                self.assertTrue(Job5PreflightChecker(job).renderer_check().ok)


if __name__=="__main__":
    unittest.main()
