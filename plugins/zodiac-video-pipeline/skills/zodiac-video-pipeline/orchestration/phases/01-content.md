# Phase 1 — Content

Finish Evidence → Concept → Narration autonomously, then enter `IN_REVIEW` for CONTENT REVIEW.

## Fail-closed execution rule
Phase 1 is simple in shape but strict in evidence. Do not infer completion from a polished script or from a manual checklist. Before each step, use `resume-brief.mjs` / the active manifest to determine required references, context, capabilities, outputs and gates. The step may advance only after its durable outputs exist and required compiler/validator receipts are real.

If the host cannot run a required compiler/validator, or verified execution source is unavailable, the step is `BLOCKED`. Do not label manually reviewed content as native `PASS` or `IN_REVIEW`. A user-facing Content Review opens only after the Narration step has satisfied the active manifest.

## Interaction policy
Phase 1 is an autopilot authoring phase, not a sequence of approval prompts. Once the user has supplied enough scope to identify the episode/sign/topic, continue through Evidence → Concept → Narration → QC without stopping to ask permission between steps.

Do **not** ask the user to:
- approve research queries or individual evidence sources;
- choose among concept candidates unless they explicitly asked to choose;
- approve Story Spine, hook, narration outline, QC repairs, or validator retries separately;
- confirm deterministic compiler/validator work.

The Content Engine must compare candidates and select the strongest valid concept itself. If a candidate fails evidence/sign-swap/story-quality gates, repair or replace it and continue.

Pause only when:
1. the requested episode scope is materially ambiguous and cannot be resolved from the current request;
2. a genuine creative fork would change the user's stated goal and there is no defensible default;
3. the final Narration + compact QC is ready for the required Content Review.

Technical failures are `BLOCKED`, not questions. Report the blocker with the concrete missing input or failed contract.

1. **Evidence** — run fresh discovery/verification, write `evidence-ledger.json` + `evidence-summary.md`, then run `validate-evidence-contract.mjs <workspace>`. Evidence needs at least two independent source identities and their supported interpretation.
2. **Concept + Story Engine (Zodiac-first)** — for fresh runs, create the required concept competition/selection artifacts using `references/content-quality-engine.md`, link the selected concept into the current Narrative Plan, decide `flags.viral_support_needed` before entering the concept step, compile reference mechanics and writer brief, and run `validate-content-contract.mjs <workspace>` with exact lineage and resolvable evidence refs. The compiled writer brief must contain **both** a nonempty `rhythm_direction` and a nonempty `narrator_vibe`; missing storytelling tone is a Concept-step compiler failure, not a Narration polish task.
3. **Narration** — draft only from the minimized compiled writer brief + minimal evidence/reference mechanics allowed by the narration `draft` context. Do not expose full `narrative_plan`, full research, old packages, prior chat or full QC to the writer. Apply `TONE_RHYTHM_DEFAULT`: `narrator_vibe` sets the storytelling stance and `rhythm_direction` sets the movement of delivery across semantic changes. After the full draft, switch to the manifest's `review` context; bind actual voice anchors, audit Story Spine realization against actual decisions/state changes/semantic deltas, run Narrative QC, independent Story Quality/Zodiac identity review when required, and TTS/duration readiness. Any missing/rephrased-only beat or unresolved material weakness is `REVIEW`, never auto-PASS.

The required post-write artifacts/validators remain authoritative. A chat table saying “PASS” is not a receipt and cannot open Content Review.

After all steps pass, set phase `IN_REVIEW`. Content `PASS` and Phase 02 require explicit user approval with actual `user_message` receipt. Do not re-open previously approved parts unless their source or semantics changed. No assets, rendering, packaging or ZIP creation belong here.

## Mandatory identity-first preflight
Before writing candidates or a setting, read `references/zodiac-identity-first.md`, identify the sign mechanism and distinct facets, and run the sign replacement thought experiment. A candidate that remains coherent after changing the sign must be rejected regardless of hook/storytelling score. The independent review must assess Zodiac identity criteria as required by the active version. User approval remains required.

Fresh runs use native evidence/writer brief compilation, source lineage and plugin-use decisions; see `phase01-briefing.md`. Video Lab does not replace this phase. Use draft scope for writing and review scope for actual narration/QC. Commit genuine step receipts with `commit-phase01-step.mjs` before progressing; no automatic Content Review approval.

After an explicit user Content Review, record the existing `user_message` proof via `buildSourceBoundReviewReceipt` in `approval-source-hashes.mjs`; commit source hashes with that receipt. This helper binds evidence and cannot replace user approval. Existing legacy approvals are retained as legacy, never silently migrated.
