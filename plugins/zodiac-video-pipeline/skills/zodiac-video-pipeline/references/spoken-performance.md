# Spoken Performance Plan and TTS Review

## Before synthesis

Create `.authoring/spoken-performance-plan.json` from the final narration and Voice Profile. This is not SSML and does not pretend the current TTS adapter has controls it does not expose.

Each ordered unit carries:
- an exact narration `excerpt`;
- `role`: setup, run, hit, reframe, internal_voice, recovery or payoff;
- `pace`: slow, medium or fast;
- `energy` in 0..1;
- `pause_before` and `pause_after`: none, micro, short or full;
- exact `emphasis` substrings;
- a plain-language `delivery` intent.

Also record pronunciation-sensitive tokens with an explicit reviewed `reading`, and one `ending_strategy`.

Run:
- `features/narration-performance/validate-spoken-performance-plan.mjs <workspace>`
- `references/validate-tts-text-preflight.mjs <workspace> --write`

The text preflight checks only text readiness. It never sets `prosody_verified=true`.

## After synthesis

Once `voice.wav` and measured `.runtime/timing.json` exist, initialize a real audio review:

`python -m tools.performance_review <workspace> init-tts`

Listen to the actual generated audio and fill all criteria in `.runtime/tts-performance-review.json`:
- pronunciation
- pause_and_breath
- pace_realization
- emphasis_realization
- internal_voice_distinction
- punchline_landing
- ending_cadence

Then run:

`python -m tools.performance_review <workspace> validate-tts`

If it returns REVIEW/BLOCKED, regenerate or repair the affected audio/performance input. Do not rewrite approved narration unless the defect is truly textual and Content Review is reopened.
