# Phase 1 — Content

Finish Evidence → Voice → Concept → Narrative Design → Narration autonomously, then enter `IN_REVIEW` for CONTENT REVIEW.

## Fail-closed execution rule
Phase 1 is simple in shape but strict in evidence. Do not infer completion from a polished script or from a manual checklist. Before each step, use `resume-brief.mjs` / the active manifest to determine required references, context, capabilities, outputs and gates. The step may advance only after its durable outputs exist and required compiler/validator receipts are real.

If the host cannot run a required compiler/validator, or verified execution source is unavailable, the step is `BLOCKED`. Do not label manually reviewed content as native `PASS` or `IN_REVIEW`. A user-facing Content Review opens only after the Narration step has satisfied the active manifest.

## Interaction policy
Phase 1 is an autopilot authoring phase, not a sequence of approval prompts. Once the user has supplied enough scope to identify the episode/sign/topic, continue through Evidence → Voice → Concept → Narrative Design → Narration → QC without stopping to ask permission between steps.

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
2. **Concept + Story Engine (Zodiac-first)** — for fresh runs, create the required concept competition/selection artifacts using `references/content-quality-engine.md`, link the selected concept into the current Narrative Plan, and author optional `narrative_visuals[]` only when a central story point is clearer as one concrete visible subject/action than as actor performance, a physical prop or short Story Text. Author one `visual_idea`, not variants. Validate it with `validate-narrative-visual-direction.mjs`; this is the semantic source Phase 2 must execute. Decide `flags.viral_support_needed` before entering the concept step, compile reference mechanics, author and validate `engagement-design.json`, compile the minimized writer brief from that validated design, and run `validate-content-contract.mjs <workspace>` with exact lineage and resolvable evidence refs. The compiled writer brief must contain **both** a nonempty `rhythm_direction` and a nonempty `narrator_vibe`; missing storytelling tone is a Concept-step compiler failure, not a Narration polish task.
3. **Narration** — use progressive validation, not one large end-of-step surprise:
   - **ENTRY PREFLIGHT:** run `narration-progressive-validation.mjs <workspace> preflight` before drafting. It verifies selected-concept lineage, Narrative Plan, compiled writer brief, narrator vibe, rhythm and Engagement Design. Missing upstream inputs return to Concept before prose is written.
   - **DRAFT:** write narration only from the minimized writer brief + permitted draft context.
   - **FICTIONAL AD:** when `mock_ad_enabled`, switch to review context after the base draft, author `mock_ad` in the canonical Narrative Plan and insert its exact disclosed copy using `references/affiliate-commerce.md`. For fresh episodes, `flags.mock_ad_story_hijack_required=true` blocks generic problem-solution ads: the approved creative must hijack a preceding story detail, pitch a tangible object with quick demo/wordplay/CTA, then hard-cut to the unresolved Zodiac story. Keep older reviewed workspaces compatible. Recompile writer-brief lineage from the updated plan; all following checkpoints and reviews use the final narration including the interlude. No commerce files or provider calls.
   - **DRAFT CHECKPOINT:** immediately run `narration-progressive-validation.mjs <workspace> draft`. Fix planner-language leaks, spoken identity, Narrative 2.1 structural failures, TTS text blockers and the 90–120s editorial duration band now. Do **not** create Story Spine/QC/Engagement Review artifacts while this checkpoint is REVIEW.
   - **SEMANTIC REVIEW:** only after the draft checkpoint passes, bind actual voice anchors, create Story Spine performance, Narrative QC, Engagement Review and Story Quality/Zodiac identity review. Repair narration locally when the premise is unchanged; return to Concept only for premise/Story Spine defects.
   - **FINAL COMMIT:** run the official receipt-wrapped validators and commit the Narration step. Final validators confirm the already-checked text; they must not be used as the first place to discover basic draft defects.

Apply `TONE_RHYTHM_DEFAULT` from `references/character-viral-performance.md` and `references/narration-rhythm.md`: vary delivery by semantic job, not a timer/quota. With a NORMAL ↔ SHARP direction, NORMAL shows behavior/context and SHARP lands a catch, contrast, reframe or payoff.

After all steps pass, set phase `IN_REVIEW`. Content `PASS` and Phase 02 require explicit user approval with actual `user_message` receipt. Do not re-open previously approved parts unless their source or semantics changed. No assets, rendering, packaging or ZIP creation belong here.

## Mandatory identity-first preflight
Before writing candidates or a setting, read `references/zodiac-identity-first.md`, identify the sign mechanism and distinct facets, and run the sign replacement thought experiment. A candidate that remains coherent after changing the sign must be rejected regardless of hook/storytelling score. The independent review must assess Zodiac identity criteria as required by the active version. User approval remains required.

Fresh runs use native evidence/writer brief compilation, source lineage and plugin-use decisions; see `phase01-briefing.md`. Video Lab does not replace this phase. Use draft scope for writing and review scope for actual narration/QC. Commit genuine step receipts with `commit-phase01-step.mjs` before progressing; no automatic Content Review approval.

After an explicit user Content Review, record the existing `user_message` proof via `buildSourceBoundReviewReceipt` in `approval-source-hashes.mjs`; commit source hashes with that receipt. This helper binds evidence and cannot replace user approval. Existing legacy approvals are retained as legacy, never silently migrated.
