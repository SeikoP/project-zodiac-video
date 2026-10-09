import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.studio.renderer_repair import repair_renderer_201


class TransactionalRendererRepairTests(unittest.TestCase):
    def setup_renderer(self, root):
        renderer=Path(root)/"renderer"
        (renderer/"scripts").mkdir(parents=True)
        (renderer/"scripts"/"local-remotion-cli.mjs").write_text("console.log('check')")
        (renderer/"package.json").write_text(
            json.dumps({"dependencies":{"@remotion/cli":"4.0.530"}}))
        return renderer

    def which(self, cmd):
        return "/fake/npm" if cmd.startswith("npm") else "/fake/node"

    def test_broken_old_modules_are_rebuilt_and_smoke_checked(self):
        with tempfile.TemporaryDirectory() as temp:
            renderer=self.setup_renderer(temp)
            old=renderer/"node_modules"
            old.mkdir()
            (old/"broken-marker.txt").write_text("old isexe missing")
            calls=[]
            def run(cmd,**kwargs):
                calls.append(cmd)
                if cmd[0]=="/fake/npm":
                    (renderer/"node_modules").mkdir()
                    (renderer/"node_modules"/"repaired.txt").write_text("complete")
                    return subprocess.CompletedProcess(cmd,0,stdout="npm installed",stderr="")
                return subprocess.CompletedProcess(cmd,0,stdout="RENDERER_CLI_READY",stderr="")
            result=repair_renderer_201(renderer,run=run,which=self.which)
            self.assertIn("RENDERER_DEPENDENCY_REPAIRED",result)
            self.assertTrue((renderer/"node_modules"/"repaired.txt").exists())
            self.assertFalse((renderer/"node_modules"/"broken-marker.txt").exists())
            self.assertFalse(any(renderer.glob(".zodiac-node_modules-backup-*")))
            self.assertEqual(calls[0][1],"install")
            self.assertIn("--prefix",calls[0])
            self.assertEqual(calls[1][-1],"--check")

    def test_failed_install_rolls_back_existing_modules(self):
        with tempfile.TemporaryDirectory() as temp:
            renderer=self.setup_renderer(temp)
            old=renderer/"node_modules"
            old.mkdir()
            (old/"broken-marker.txt").write_text("recover me")
            def run(cmd,**kwargs):
                (renderer/"node_modules").mkdir()
                (renderer/"node_modules"/"partial.txt").write_text("partial")
                return subprocess.CompletedProcess(cmd,1,stdout="",stderr="network error")
            with self.assertRaisesRegex(RuntimeError,"npm install failed"):
                repair_renderer_201(renderer,run=run,which=self.which)
            self.assertTrue((renderer/"node_modules"/"broken-marker.txt").exists())
            self.assertFalse((renderer/"node_modules"/"partial.txt").exists())
            self.assertFalse(any(renderer.glob(".zodiac-node_modules-backup-*")))

    def test_failed_smoke_check_rolls_back_existing_modules(self):
        with tempfile.TemporaryDirectory() as temp:
            renderer=self.setup_renderer(temp)
            (renderer/"node_modules").mkdir()
            (renderer/"node_modules"/"old.txt").write_text("old")
            def run(cmd,**kwargs):
                if cmd[0]=="/fake/npm":
                    (renderer/"node_modules").mkdir()
                    return subprocess.CompletedProcess(cmd,0,stdout="",stderr="")
                return subprocess.CompletedProcess(cmd,2,stdout="",stderr="Cannot find module 'isexe'")
            with self.assertRaisesRegex(RuntimeError,"STILL_BROKEN"):
                repair_renderer_201(renderer,run=run,which=self.which)
            self.assertTrue((renderer/"node_modules"/"old.txt").exists())
            self.assertFalse(any(renderer.glob(".zodiac-node_modules-backup-*")))

    def test_missing_npm_never_moves_node_modules(self):
        with tempfile.TemporaryDirectory() as temp:
            renderer=self.setup_renderer(temp)
            old=renderer/"node_modules"
            old.mkdir()
            (old/"marker.txt").write_text("untouched")
            with self.assertRaisesRegex(RuntimeError,"TOOLS_MISSING"):
                repair_renderer_201(renderer,which=lambda name:None)
            self.assertTrue((old/"marker.txt").is_file())

    def test_repair_does_not_touch_job_workspace(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            renderer=self.setup_renderer(root)
            job=root/".zodiac-work"/"v2"/"jobs"/"songtu-bi-tuong-doi-phe"/".runtime"
            job.mkdir(parents=True)
            (job/"voice.wav").write_bytes(b"voice-cache")
            (job/"render-plan.json").write_bytes(b"plan-cache")
            def run(cmd,**kwargs):
                if cmd[0]=="/fake/npm":
                    (renderer/"node_modules").mkdir()
                return subprocess.CompletedProcess(cmd,0,stdout="RENDERER_CLI_READY",stderr="")
            repair_renderer_201(renderer,run=run,which=self.which)
            self.assertEqual((job/"voice.wav").read_bytes(),b"voice-cache")
            self.assertEqual((job/"render-plan.json").read_bytes(),b"plan-cache")


if __name__=="__main__":
    unittest.main()
