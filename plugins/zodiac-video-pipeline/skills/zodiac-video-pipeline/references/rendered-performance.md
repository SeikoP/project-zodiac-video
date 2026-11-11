# Rendered Performance Review

Final audiovisual effect is a separate review surface from text and TTS.

After `out/zodiac-story.mp4` exists and TTS Performance Review is PASS:

`python -m tools.performance_review <workspace> init-rendered`

Watch the exact final MP4 and fill `.runtime/rendered-performance-review.json` against these criteria:
- `voice_delivery_survives_mix`
- `caption_reveal_timing`
- `visual_preemption`
- `cut_and_pause_alignment`
- `attention_competition`
- `payoff_sync`
- `ending_energy_after_render`

Examples of real failures:
- caption reveals a punchline before the narrator lands it;
- visual metaphor explains the reframe before the spoken turn;
- a cut happens inside the setup-to-hit interval;
- animation/music competes with a line that needs listening attention;
- final shot keeps running after the last roast and drains ending energy.

Validate with:

`python -m tools.performance_review <workspace> validate-rendered`

The review is bound to the exact MP4 SHA, timing SHA and TTS-review SHA. Any rebuild that changes those bytes invalidates the review.

Only after both runtime reviews PASS should `tools.media_acceptance` return media PASS.
