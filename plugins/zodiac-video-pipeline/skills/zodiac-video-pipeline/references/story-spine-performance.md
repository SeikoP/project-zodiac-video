# Story Spine → Narration performance gate — v2.2.18

Narration must implement the agreed Story Spine **in the spoken text**, not merely mention an identity trait in the plan. Run the local semantic review after composing a full draft and before `narrative_qc` is accepted. This is an existing Narration exit gate, **not** a new phase or tool request.

## Required artifact
Write `.authoring/story-spine-performance.json` as `zodiac-story-spine-performance@1` with:

- `source.plan_sha256` and `source.narration_sha256` from exact UTF-8 bytes; stale reviews are invalid.
- `spine.identity_tension`, `starting_read`, `progression_intent`, `payoff_target`, each with `assessment: PASS|REVIEW`, `reason` and a real 3–35-word `evidence_excerpt` from narration.
- `beats`: exactly one entry per ordered narrative-plan beat. Fields: `beat_id`, `assessment`, `evidence_excerpt`, `character_action`, `response_or_state_change`, `semantic_delta_realized`, `spine_effect`, `review_note`.
- `decision: PASS|REVIEW` and `revision_targets`.

The validator checks provenance, ordered beat coverage, excerpt grounding and explicit review decisions. **It cannot prove semantic quality from keyword matches.** The reviewer must specifically ask whether the character's decision elicits a response, changes the scene's stakes or changes the viewer's interpretation. If an authored beat is absent from narration, overlaps another beat without its own delta, or merely repeats the theme, mark `REVIEW` and revise before PASS. Do not fabricate a supporting excerpt.

## Context isolation
The Narration writer still receives only the minimal brief and evidence. The full plan and review contract are read by the **post-write QC reviewer**, not injected into the writer prompt. Existing user-approved narration remains locked unless explicitly re-approved for changes. The gate is applied to a new/revised text only after its own editorial review.

## Run
`node references/validate-story-spine-performance.mjs <narrative-plan.json> <narration.txt> <story-spine-performance.json>`.
Run with `orchestration/run-validator-with-receipt.mjs` for official pipeline receipts. This validation must finish before setting Narration PASS or opening Content Review.
