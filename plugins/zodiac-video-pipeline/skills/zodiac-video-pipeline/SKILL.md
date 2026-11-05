---
name: zodiac-video-pipeline
description: Produce or resume Vietnamese Zodiac videos in single-sign, element-group, ranked-shortlist and comparison formats. Use whenever the user mentions a zodiac or cung hoàng đạo episode, a Studio prompt or workspace to resume, Content Review or Visual Review, Job@5 or the ZIP for the local runner, or a failure the local runner reported (voice, timing, caption, render, cover), even if they do not name the pipeline.
---
# Zodiac Video Pipeline

Follow orchestration/router.md: 01-content → 02-visual-production → 03-handoff. Do not use account memory as unapproved episode evidence. The installed plugin router/manifests and genuine user approvals govern workflow; GitHub is execution-byte transport only.

## Step authority — fail closed
Before **every** step, derive the first incomplete step from persisted state with `orchestration/resume-brief.mjs`, read the active manifest and every `read_now` reference, then act only inside that bounded context. Never replace this with remembered instructions, a prose checklist, a prior assistant summary, or a previously generated package.

A user-facing `PASS`, `IN_REVIEW`, `APPROVED`, phase transition, or statement that a gate "passed" requires the durable outputs and actual receipts required by the active manifest. Editorial inspection in chat may be described as editorial review, but it is never a substitute for native compiler/validator evidence. If execution source or a required validator is unavailable, report `BLOCKED`; do not synthesize a PASS from manual reasoning.

## Revoked-source quarantine
A source becomes **revoked** when the user says to delete it, forget it, discard it, stop using it, replace it, or explicitly excludes it from the current workflow. A revoked source is forbidden context for all later steps and runs in the same conversation/project unless the user explicitly re-attaches or re-authorizes that exact source.

Runtime remount, filesystem persistence, Project attachment resurfacing, tool search results, old chat availability, or a copied path do **not** restore authorization. Do not open, read, summarize, transform, compare, or derive creative/technical decisions from a revoked source merely because it appears available again. When a new official source is named, prefer it and quarantine conflicting retired sources.

## Resume from Studio checklist
A copied Studio prompt is a snapshot of the selected workspace, episode scope, tracker ledger and current step contract. It is not a creative brief, approval receipt or source of truth. Re-read that workspace's pipeline state, scope, approval receipts and durable outputs before writing. A missing, malformed or version-mismatched source blocks the next write.

Use the installed `defaultPrompt`, router, current phase manifest and `plan-step-context.mjs`. Derive the first incomplete step from the current state and manifest; do not blindly repeat the copied step pointer. Honor that step's active capabilities, required inputs/outputs, context boundaries and gates; validate durable outputs and receipts before committing the step. The linked series tracker reports progress only; it does not approve narration, visuals, cover or a phase transition.

## Execution source in the repository
When operating from this repository checkout, read orchestration/execution-bootstrap.md and run the verified scripts directly from this checkout. Pin every execution to the current Git commit and verify SHA-256 inputs before native compilation. Load only the bounded references returned by plan-step-context.mjs; the full repository is not episode context. Repository execution does not waive the active router, phase manifest, validator order, source hashes, review gates or genuine user approvals. The ChatGPT-installed variant instead uses a verified phase-scoped execution bundle; do not apply repository-checkout transport instructions inside ChatGPT.

## Phase 01: no user-facing ZIP Default to autonomous Evidence → Concept → Narration → QC execution after scope is known; the only normal user pause is final Content Review. Do not ask the user to approve searches, select a concept, approve an outline, or confirm validator/compiler steps unless they explicitly requested a choice or the scope is materially ambiguous.

Use references/episode-formats.md and references/phase01-briefing.md. Distinguish episode format from the `character_deconstruction` story engine. Use bounded independent evidence, one coherent Story Spine and authentic Content Review. Narrative 2.1 is for fresh scoped episodes.

### Narration readiness lock
Narration may not begin from a remembered concept or from the full planner context. It must be drafted only from the compiled minimized writer brief plus the manifest-permitted minimal evidence/reference mechanics.

Before drafting, the compiled writer brief must exist with valid lineage and must contain:
- a nonempty `rhythm_direction`;
- a nonempty `narrator_vibe` with concrete storytelling qualities, not a generic placeholder;
- identity tension, progression intent and payoff target;
- evidence-safe behaviors and forbidden claims;
- Zodiac-first identity fields required by the active format/version.

For Narrative 2.1, narrator tone is still mandatory even though the episode compiler is separate. Missing `narrator_vibe` is a compiler failure, not an optional style omission.

Fresh 2.6.8+ Narration is progressively validated: run entry preflight before prose, then a cheap draft checkpoint immediately after the draft. Basic contract/duration/TTS/identity defects must be repaired at the checkpoint before Story Spine/QC/Engagement/Story Quality artifacts are authored. Final validators confirm a stable draft rather than acting as the first defect detector.

Fresh 2.6.8+ Concept also requires a validated `engagement-design.json` before writer-brief compilation. The writer receives only its compact `engagement_direction`; the beat-level pull map remains out of draft context. Narration review requires grounded `engagement-review.json`; unresolved hook/early-value/curiosity/recognition/reframe/payoff or consecutive-explanation REVIEW blocks Content Review.

After drafting, switch to review context and complete the active manifest's narration outputs and gates: actual voice anchors, Story Spine realization, Narrative QC, Story Quality/Zodiac identity review when required, TTS text readiness and duration estimate. A manual table in chat is not a validator receipt. Any material `REVIEW` returns to the owning step; do not present the narration as complete until the gate is resolved.

Show the selected concept, final Narration and compact QC/status directly in chat; keep workspace artifacts internal unless debugging requires a specific file.

At Phase 01 → Phase 02, run the transition gate until AUTHORING_READY, then run phases/phase02/activate-phase02.mjs before Phase 02 step commits. Activation changes orchestration state only and creates no approval or native PASS. Inspect source hashes/approvals; AUTHORING_READY is not PASS.

## Phase 02: no user-facing ZIP Treat `.authoring/visual-intent.json` as the only agent-authored visual source of truth; use `write-phase02-authoring.mjs` / `compile-visual-intent.mjs` to generate production, Character Assembly, Visual Grammar, Asset Plan, Director Plan, Art Direction and Episode Cast projections. Do not manually edit those derived files. Read orchestration/phases/02-visual-production.md and references/asset-library-v4/selection-guide.md. Use features/asset-selection/build-current-asset-review.mjs for native catalog comparisons. Use approved cast, canvas-native backgrounds, Scene Accents, V4 native assets and the single Narrative Visual authoring concept. Every Episode Cast `role=member` character must carry the intrinsic `zodiac-glyph-shirt` with `zodiac_sign_id=member_id`; non-member actors may use `plain-shirt`. Compile scene-complete native review frames for every scene plus event endpoint pairs; Visual Review must use the clean Phase-02 review surface produced by features/visual-composition/prepare-phase02-review.mjs. Do not copy historical Phase-01 README or migration prose into the review surface. Accents are independent canvas-relative context cues; actors are never constrained to an accent or wall.

## Phase 03
Exactly one validated Job@5 ZIP per revision. Use phases/phase03/run-phase03-production.mjs or its verified current target. Preserve zodiac-job@5 and zodiac-renderer@2.0.1. Package one validated ZIP per revision. Local runner owns voice, timing, Remotion, captions, cover, audio and MP4 acceptance. ZIP-ready never means video-ready.

## User-facing status vocabulary
Use only DRAFT, IN_REVIEW, APPROVED, PASS or BLOCKED in normal user updates. Keep transport/preflight/compiler receipt states diagnostic unless a failure requires explanation.

Fresh Run Isolation: old episode examples, migration prose and retired assets are absent from the current selection surface. Missing choices block; no legacy/selected-cues fallback. Historical job recovery requires its separately pinned external snapshot. Fresh production has no Scene Set. Legacy Scene Set rendering is compatibility-only, requiring verified historical job input; character placement always remains independent.

## Never rely on remembered guidance
Context is lost between steps and sessions. Before **every** step, and whenever unsure where the run stands, run `node orchestration/resume-brief.mjs <workspace>` (read-only). It derives the first incomplete step from `.authoring/pipeline-state.json` and lists exactly which reference files to read now, the capabilities with the current host-tool guidance, the required outputs and the forbidden context. Read those files in full, then act. It creates no approval and replaces neither the phase manifest nor the validators.

## Where to read next
Load only what the current task needs.

| Task | Read |
| --- | --- |
| Phase 02 visuals | orchestration/phases/02-visual-production.md, references/asset-library-v4/selection-guide.md, **references/phase02-visual-rules.md (read in full)** |
| Runner reported a failure, or a revision after the ZIP | references/runner-feedback-triage.md |
| Repository execution and capability providers | references/repository-runtime.md |
