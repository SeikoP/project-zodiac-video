import unittest

from tools.control_plane.cache import (
    audio_key,
    plan_key,
    render_key,
    timing_key,
    voice_key,
)
from tools.studio_v2.pipeline import (
    AUDIO,
    DONE,
    OUTPUT,
    PACKAGE,
    PLAN,
    PENDING,
    RENDER,
    TIMING,
    VOICE,
    PipelineStateV2,
)


class StudioV2CacheScenarioTests(unittest.TestCase):
    def setUp(self):
        self.state = PipelineStateV2(workspace_id="scorpio")
        self.voice = voice_key("narration", "voice-a", {}, "tts-1")
        self.timing = timing_key(self.voice, "narration", {}, "align-1")
        self.plan = plan_key("ir-a", self.timing, "design", "compiler-1")
        self.render = render_key(self.plan, "assets-a", "2.0.0", "renderer-a")
        self.audio = audio_key(self.render, self.voice, "music-a", {"volume": 0.2})
        inputs = {
            PACKAGE: "package-a",
            VOICE: self.voice,
            TIMING: self.timing,
            PLAN: self.plan,
            RENDER: self.render,
            AUDIO: self.audio,
            OUTPUT: self.audio,
        }
        for step, value in inputs.items():
            self.state.mark_done(
                step,
                input_hash=value,
                output_hash=f"artifact-{step}",
                reused=False,
            )

    def test_visual_only_patch_reuses_voice_timing_and_rebuilds_plan_downstream(self):
        next_plan = plan_key("ir-b", self.timing, "design", "compiler-1")
        self.assertTrue(self.state.reuse_if_input_matches(VOICE, self.voice))
        self.assertTrue(self.state.reuse_if_input_matches(TIMING, self.timing))
        self.assertFalse(self.state.reuse_if_input_matches(PLAN, next_plan))
        self.assertEqual(self.state.steps[VOICE].status, DONE)
        self.assertEqual(self.state.steps[TIMING].status, DONE)
        for step in (PLAN, RENDER, AUDIO, OUTPUT):
            self.assertEqual(self.state.steps[step].status, PENDING)

    def test_renderer_only_patch_reuses_through_plan(self):
        next_render = render_key(self.plan, "assets-a", "2.0.1", "renderer-b")
        for step, value in ((VOICE, self.voice), (TIMING, self.timing), (PLAN, self.plan)):
            self.assertTrue(self.state.reuse_if_input_matches(step, value))
        self.assertFalse(self.state.reuse_if_input_matches(RENDER, next_render))
        self.assertEqual(self.state.steps[PLAN].status, DONE)
        for step in (RENDER, AUDIO, OUTPUT):
            self.assertEqual(self.state.steps[step].status, PENDING)

    def test_music_only_patch_reuses_through_render(self):
        next_audio = audio_key(self.render, self.voice, "music-b", {"volume": 0.2})
        for step, value in (
            (VOICE, self.voice),
            (TIMING, self.timing),
            (PLAN, self.plan),
            (RENDER, self.render),
        ):
            self.assertTrue(self.state.reuse_if_input_matches(step, value))
        self.assertFalse(self.state.reuse_if_input_matches(AUDIO, next_audio))
        self.assertEqual(self.state.steps[RENDER].status, DONE)
        self.assertEqual(self.state.steps[AUDIO].status, PENDING)
        self.assertEqual(self.state.steps[OUTPUT].status, PENDING)

    def test_reused_step_is_marked_reused_without_changing_artifact_hash(self):
        before = self.state.steps[VOICE].output_hash
        self.assertTrue(self.state.reuse_if_input_matches(VOICE, self.voice))
        self.assertTrue(self.state.steps[VOICE].reused)
        self.assertEqual(self.state.steps[VOICE].output_hash, before)


if __name__ == "__main__":
    unittest.main()
