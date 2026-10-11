# Narration rhythm — fresh 2.4.47+

Use TONE_RHYTHM_DEFAULT. Keep an everyday Vietnamese narrator with a point of view, recognition and wit; intensity follows meaning. Sharpness, dry humor, curiosity, quiet clarity or warmth are choices, not a required sequence. No obligatory shouting, soothing ending, emotion quota or forced return to a sharp beat. Keep approved narration byte-locked.

## Authoring and handoff

1. Concept authors `narrative-plan.json` version `2.1` for fresh scoped runs; use reviewed `2.0` only for legacy single-sign continuation. Preserve Story Spine, evidence and devices; add `performance` to each beat: `delivery` (spoken direction), `energy` (0..1), `emotion`, `pace` (slow/medium/fast), `emphasis` (exact spoken substrings, can be empty), `reason` (why this direction fits semantic delta). Intent belongs to the topic, not the sign name alone.
2. Keep writer context minimized. Compile a brief `rhythm_direction` into the existing writer brief; do not send whole beat plans. Draft phrasing/punctuation for natural speech; never put performance tags in narration.txt.
3. Post-write QC binds every beat's `voice_anchor` to actual narration, with `occurrence` for repeated anchors and optional `scene_id` for disambiguation. Validate via `references/validate-narrative.mjs <plan> <narration>`. This verifies structure/anchors, not emotional quality. Preserve narration paragraph boundaries when assigning scenes. Do not silently split approved paragraphs to force voice changes.
4. Phase02 runs `orchestration/compile-narration-performance.mjs <workspace> --write` before native assets/resolved composition. It maps exact anchors to scene.performance_context. Different direction within one scene blocks; resolve the visual mapping at authored paragraph seams in Phase2, or keep a coherent scene direction without rewriting approved speech. No per-word SVG, automatic scene splitting or fake runtime timestamps.
5. Existing Job@5 performance_context carries only delivery/energy/emotion/pace/emphasis; visual context fields remain. After direction changes, regenerate resolved report, preview/review proofs and seal. Legacy Plan1.1 is readable for continuation, not a fresh >=47 default.

## Runner and honest capability status

Voice cache hashes only speech fields. Changed direction invalidates that scene's voice identity; unchanged scenes and visual duration edits reuse voice. The actual VieNeu text/voice adapter currently has no verified pitch/emotion/prosody control. It preserves requested directions to TTS rows and emits `.runtime/voice-performance.json` with REVIEW_REQUIRED and prosody_verified=false. No SSML/emotion argument is invented; no automatic DSP pitch trick is claimed as emotional acting.

Cadence in text and performance metadata are separate from certified audio. Listen to actual takes. If the selected backend ignores a requested direction, choose a supported adapter or explicitly reviewed take; never mark a metadata-only output as emotional delivery PASS. Measured audio, word timing, pauses and final MP4 remain runner-owned.

Narrative 2.1 runs the same performance gates as 2.0. Direct changes at insight/member transitions and shared payoff, not a default tone copied across scenes. Members need not receive equal duration. Compiler rejects incompatible directions sharing one scene; split scenes at authored paragraph seams before mapping performance. No measured prosody claim without runner audio QA.

## Spoken readiness before Content Review
Run references/short-form-duration.mjs against narration before approval. Review acronym, number, ellipsis and known foreign-word spans; keep performance tags outside approved narration. Estimate uses explicit token rate + pause + tail and is never measured TTS duration. Above 120 seconds requires editorial review or a documented exception, never automatic rewriting to a sentence/scene quota. Fresh scoped plans use Narrative 2.1; reviewed 2.0 single-sign readers remain supported. Review evidence, sign/member identity, motif repetition, specific premise and whole-episode payoff; return NEEDS_REVISION on editorial failures. Do not mutate narration after approval. Actual pronunciation, word timing and prosody remain runner checks.
