import contextlib
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.control_plane.cli import main

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "control-plane-v2" / "minimal"
ROOT = Path(__file__).resolve().parents[1]


def copy_package(root: Path) -> Path:
    package = root / "package"
    shutil.copytree(FIXTURE, package)
    return package


class ControlPlaneCliTests(unittest.TestCase):
    def test_build_writes_validated_render_plan(self):
        with tempfile.TemporaryDirectory() as temp:
            package = copy_package(Path(temp))
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                code = main(["build", str(package)])
            self.assertEqual(code, 0)
            output = stdout.getvalue()
            self.assertIn("PACKAGE_VALID", output)
            self.assertIn("PLAN_COMPILED", output)
            self.assertIn("PLAN_VALID", output)
            self.assertIn("TARGET_OVERLAP_COUNT=0", output)
            plan_path = package / ".runtime" / "render-plan.json"
            self.assertTrue(plan_path.is_file())
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            self.assertEqual(plan["format"], "zodiac-render-plan@1")

    def test_build_can_write_explicit_output_path(self):
        with tempfile.TemporaryDirectory() as temp:
            package = copy_package(Path(temp))
            output = Path(temp) / "compiled.json"
            code = main(["build", str(package), "--output", str(output)])
            self.assertEqual(code, 0)
            self.assertTrue(output.is_file())

    def test_conflict_emits_one_structured_error_and_nonzero_exit(self):
        with tempfile.TemporaryDirectory() as temp:
            package = copy_package(Path(temp))
            ir_path = package / "production.ir.json"
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
            second = json.loads(json.dumps(ir["scenes"][0]["events"][0]))
            second["id"] = "E02"
            second["scheduling"]["max_drift_frames"] = 0
            ir["scenes"][0]["events"].append(second)
            ir_path.write_text(json.dumps(ir, ensure_ascii=False, indent=2), encoding="utf-8")

            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                code = main(["build", str(package)])
            self.assertNotEqual(code, 0)
            lines = [line for line in stderr.getvalue().splitlines() if line.strip()]
            self.assertEqual(len(lines), 1)
            payload = json.loads(lines[0])
            self.assertEqual(payload["code"], "TIMELINE_TARGET_CONFLICT")
            self.assertEqual(payload["stage"], "PLAN")

    def test_root_level_timing_is_not_a_runtime_input(self):
        with tempfile.TemporaryDirectory() as temp:
            package = copy_package(Path(temp))
            runtime_timing = package / ".runtime" / "timing.json"
            root_timing = package / "timing.json"
            shutil.move(str(runtime_timing), root_timing)
            runtime_timing.parent.rmdir()
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                code = main(["build", str(package)])
            self.assertEqual(code, 2)
            payload = json.loads(stderr.getvalue())
            self.assertEqual(payload["code"], "TIMING_INVALID")
            self.assertIn(".runtime", payload["detail"]["path"])

    def test_pyproject_exposes_zodiac_control_entrypoint(self):
        text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
        self.assertIn('zodiac-control = "tools.control_plane.cli:main"', text)


if __name__ == "__main__":
    unittest.main()
