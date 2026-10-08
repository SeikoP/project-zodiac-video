import unittest

from tools.studio_v2.pipeline import (
    AUDIO,
    OUTPUT,
    PACKAGE,
    PLAN,
    RENDER,
    TIMING,
    VOICE,
    DONE,
    PENDING,
    PipelineStateV2,
)


class StudioV2StateTests(unittest.TestCase):
    def setUp(self):
        self.state = PipelineStateV2(workspace_id="stable-workspace")

    def _complete_all(self):
        for step in (PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
            self.state.mark_done(
                step,
                input_hash=f"in-{step}",
                output_hash=f"out-{step}",
                reused=False,
            )

    def test_new_pipeline_has_v2_stage_order(self):
        self.assertEqual(
            list(self.state.steps),
            [PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT],
        )
        self.assertTrue(all(step.status == PENDING for step in self.state.steps.values()))

    def test_step_records_hashes_and_reuse(self):
        self.state.mark_done(
            VOICE,
            input_hash="voice-key",
            output_hash="voice-artifact",
            reused=True,
        )
        step = self.state.steps[VOICE]
        self.assertEqual(step.status, DONE)
        self.assertEqual(step.input_hash, "voice-key")
        self.assertEqual(step.output_hash, "voice-artifact")
        self.assertTrue(step.reused)

    def test_visual_change_reuses_voice_and_timing(self):
        self._complete_all()
        self.state.invalidate_for("visual")
        self.assertEqual(self.state.steps[VOICE].status, DONE)
        self.assertEqual(self.state.steps[TIMING].status, DONE)
        for step in (PLAN, RENDER, AUDIO, OUTPUT):
            self.assertEqual(self.state.steps[step].status, PENDING)

    def test_narration_change_invalidates_voice_and_downstream(self):
        self._complete_all()
        self.state.invalidate_for("narration")
        self.assertEqual(self.state.steps[PACKAGE].status, DONE)
        for step in (VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
            self.assertEqual(self.state.steps[step].status, PENDING)

    def test_renderer_change_only_invalidates_render_and_downstream(self):
        self._complete_all()
        self.state.invalidate_for("renderer")
        for step in (PACKAGE, VOICE, TIMING, PLAN):
            self.assertEqual(self.state.steps[step].status, DONE)
        for step in (RENDER, AUDIO, OUTPUT):
            self.assertEqual(self.state.steps[step].status, PENDING)

    def test_music_change_only_invalidates_audio_and_output(self):
        self._complete_all()
        self.state.invalidate_for("music")
        for step in (PACKAGE, VOICE, TIMING, PLAN, RENDER):
            self.assertEqual(self.state.steps[step].status, DONE)
        self.assertEqual(self.state.steps[AUDIO].status, PENDING)
        self.assertEqual(self.state.steps[OUTPUT].status, PENDING)

    def test_package_revision_is_independent_from_workspace_id(self):
        self.state.set_package_revision(
            display_name="zodiac-bocap-hai-phien-ban-v2.0.zip",
            package_hash="pkg-2",
            package_version="2.0",
        )
        self.assertEqual(self.state.workspace_id, "stable-workspace")
        self.assertEqual(self.state.package.display_name, "zodiac-bocap-hai-phien-ban-v2.0.zip")
        self.assertEqual(self.state.package.package_hash, "pkg-2")


if __name__ == "__main__":
    unittest.main()
