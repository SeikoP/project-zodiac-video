"""VisualWorkspace.review_frames: photographs the current build through the export composition, writes only under review/."""
import unittest
from pathlib import Path
from unittest.mock import patch

import tests.test_studio_p34_visual as base
from tools.studio_project import agent_frame_review as fr
from tools.studio_project.models import StudioError


class ReviewFramesTests(unittest.TestCase):
    setUp = base.VisualWorkspaceTests.setUp
    state = base.VisualWorkspaceTests.state
    command = base.VisualWorkspaceTests.command
    authored = base.VisualWorkspaceTests.authored
    wait = base.VisualWorkspaceTests.wait
    built = base.VisualWorkspaceTests.built

    def capture(self, make_files=True):
        calls = []

        def fake_snapshot(command, cwd=None, **_):
            calls.append(command)
            if make_files:
                frames = Path(command[command.index("--output") + 1])
                frames.mkdir(parents=True, exist_ok=True)
                for moment in command[command.index("--at") + 1].split(","):
                    (frames / fr.frame_name(float(moment))).write_bytes(b"\x89PNG")
        state = self.built()
        times = fr.plan_times(state["build"])
        inputs = {"action": "export_prepare"}
        with patch.object(self.visual, "_export_inputs", return_value=inputs), \
                patch.object(self.visual, "_node", return_value={}) as node, \
                patch("tools.studio_project.visual_workspace.run_managed_subprocess", side_effect=fake_snapshot):
            try:
                return state, times, self.visual.review_frames(self.project, times), calls, node
            except StudioError as error:
                return state, times, error, calls, node

    def test_one_snapshot_call_returns_a_png_per_planned_moment_under_review(self):
        state, times, frames, calls, node = self.capture()
        self.assertEqual(len(calls), 1)  # one browser start for the whole episode
        self.assertEqual(set(frames), set(times))
        build_id = state["build"]["id"]
        for scene_id, paths in frames.items():
            self.assertEqual(len(paths), len(times[scene_id]))
            for path in paths:
                self.assertTrue(Path(path).is_file())
                self.assertIn("review", Path(path).parts)
                self.assertIn(build_id, Path(path).parts)
        self.assertIn("output", node.call_args.args[1])

    def test_missing_frames_are_an_error_not_a_partial_review(self):
        _, _, result, _, _ = self.capture(make_files=False)
        self.assertIsInstance(result, StudioError)
        self.assertEqual(result.code, "REVIEW_FRAME_MISSING")


if __name__ == "__main__":
    unittest.main()
