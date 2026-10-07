"""Tests for the prepare -> Studio review -> final render workflow."""

from __future__ import annotations

from test_studio_pipeline import WorkerHarness
from tools.studio.controller import StudioController
from tools.studio.pipeline import DONE, MIX_MUSIC, PREPARE_RENDERER, RENDER_VIDEO


class StudioReviewBoundaryTests(WorkerHarness):
    def test_worker_can_stop_after_renderer_preparation(self):
        worker = self.make_worker()
        plan = worker.run_to_completion(stop_after=PREPARE_RENDERER)

        self.assertEqual(plan.status(PREPARE_RENDERER), DONE)
        self.assertNotEqual(plan.status(RENDER_VIDEO), DONE)
        self.assertNotEqual(plan.status(MIX_MUSIC), DONE)
        self.assertNotIn("render", self.render_calls)

    def test_controller_prepare_boundary_does_not_render_video(self):
        controller = StudioController(workspace=self.root / "ws")
        controller.use_job(self.job)
        self.stub_pipeline()

        self.assertTrue(controller.start_pipeline(stop_after=PREPARE_RENDERER, voice="test-voice"))
        controller.worker.join(timeout=60)

        self.assertEqual(controller.plan.status(PREPARE_RENDERER), DONE)
        self.assertNotEqual(controller.plan.status(RENDER_VIDEO), DONE)
        self.assertEqual(self.render_calls, [])
        self.assertIn("Chuẩn bị renderer", controller.status_text)

    def test_final_resume_after_prepare_only_runs_render_chain(self):
        worker = self.make_worker()
        worker.run_to_completion(stop_after=PREPARE_RENDERER)
        self.render_calls.clear()
        self.tts_calls.clear()
        self.align_calls.clear()

        worker = self.reopened_worker()
        worker.run_from(worker.plan.continue_from())

        self.assertEqual(self.tts_calls, [])
        self.assertEqual(self.align_calls, [])
        self.assertIn("render", self.render_calls)
        self.assertEqual(worker.plan.status(RENDER_VIDEO), DONE)


if __name__ == "__main__":
    import unittest
    unittest.main()
