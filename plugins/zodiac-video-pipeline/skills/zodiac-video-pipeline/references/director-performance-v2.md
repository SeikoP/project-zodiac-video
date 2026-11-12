# Director v2 — performance + adaptive blocking contract

`zodiac-director-plan@1` belongs to Phase 02 Visual Compile/Semantic Assets, with no new phase, agent or Job@5 schema.

## Source of truth
- Preserve approved `narration.txt`; `.authoring/director-plan.json.narration_sha256` hashes its exact bytes.
- Every speaking scene needs Director beats, not new SVGs per beat. Bind real `performer`/optional `target`; two-person dialogue uses existing speaker/listener, never a third actor.
- Describe `action`, `reaction`, `semantic_purpose`, `shot_reason`, `visual_payoff`. Static beats use `hold` plus `static_reason`.
- Use exact scene voice anchors and `occurrence` for ambiguity. Events come from `contracts/motion-registry-v1.json`; never invent runner aliases.
- Before assets, justify reuse/new state through `asset_cost_reason`; retain cast identity, shirt palette and V4/Human Stroke v2.

## Blocking
Optional per-beat `blocking`: `{entity_id,anchor,side,relayout}`. Sides: above, below, left, right, between, above-left, above-right, below-left, below-right. `between` needs a distinct `secondary_anchor`; no fallback. Optional `offset_px` is 0..180.

After native assets/Scene Direction, adaptive placement only moves explicit non-character support when `relayout:true`. Preserve existing transforms otherwise. Never move heroes, change frame profile, randomize or override native contact/pen-slide `points_to`. Preserve aspect ratio and share the solved transform across states. Fail invalid placement; do not hide effects or invent props. Each supporting entity has one blocking owner per scene; conflicting and identical duplicate instructions fail.

## Director gate
After native core and selected meme/environment work, before preview pairs:
```bash
node features/visual-composition/run-director-v2-review.mjs <workspace>
```
`DIRECTOR_V2_GATE` and post-compile checks block on the first failure. The wrapper writes `.authoring/director-v2-review-receipt.json`, checking intent, narration hash, anchors, cast, motion, causal order, blocking, bounds and Job@5 visual-role footprints. On blocked post-compile QC it restores exact prior `production.json` bytes. Missing plan, blocked gate or stale previews block Visual Review; never use previews from a blocked review.

This is static QC. Anticipation/easing, motion-only amplitudes, frame-by-frame contact, measured voice timing and final video parity remain runner checks. Unsupported movement blocks export or needs supported state/event authoring. Native PASS, preview frames and ZIP readiness never create human approval or runtime PASS.

## Channel performance
Follow `TONE_RHYTHM_DEFAULT`: voice-led cause -> reaction -> payoff. Quiet close-ups may land a cutting joke. Avoid random motion, meaningless effects/memes/cuts, soothing imposed on the voice, gratuitous insults and asset quotas.

## Environment Frame Integration
Scene Direction applies the baseline shot then explicit `environment.frame` slots for cast, story fixture, hand prop and optional foreground. Preserve authored state position deltas. Character Design Intent/native V4 states own body geometry; background catalogs do not. Director cannot guess hero placement. Fresh acted environments require this frame; room-profile reuse is insufficient. `environment_frame_v1` checks slots, actual transforms, projected contacts, V4 styles and real occlusion.

## Renderer 2.0.1 actor slide parity
Changed-state `slide` requires a real `near` binding to another scene entity, finite on-canvas endpoints, unchanged width/height/scale/rotation and 24–360px travel. Runner interpolates translation and swaps SVG at event end. Legacy pen/notebook `points_to` remains a separate same-state contact gesture. Phase-02 motion QA and Phase-03 release reject unresolved slides; runner must also provide an animation clip for changed-state slides.
