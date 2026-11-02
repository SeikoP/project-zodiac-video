---
name: zodiac-video-pipeline
description: Produce or resume Vietnamese Zodiac videos in single-sign, element-group, ranked-shortlist and comparison formats. Use whenever the user mentions a zodiac or cung hoàng đạo episode, a Studio prompt or workspace to resume, Content Review or Visual Review, Job@5 or the ZIP for the local runner, or a failure the local runner reported (voice, timing, caption, render, cover), even if they do not name the pipeline.
---
# Zodiac Video Pipeline

Follow orchestration/router.md: 01-content → 02-visual-production → 03-handoff. Do not use account memory as unapproved episode evidence. The installed plugin router/manifests and genuine user approvals govern workflow; GitHub is execution-byte transport only.

## Resume from Studio checklist

A copied Studio prompt is a snapshot of the selected workspace, episode scope, tracker ledger and current step contract. It is not a creative brief, approval receipt or source of truth. Re-read that workspace's pipeline state, scope, approval receipts and durable outputs before writing. A missing, malformed or version-mismatched source blocks the next write.

Use the installed `defaultPrompt`, router, current phase manifest and `plan-step-context.mjs`. Derive the first incomplete step from the current state and manifest; do not blindly repeat the copied step pointer. Honor that step's active capabilities, required inputs/outputs, context boundaries and gates; validate durable outputs and receipts before committing the step. The linked series tracker reports progress only; it does not approve narration, visuals, cover or a phase transition.

## Execution source after refactor
Before native execution, read orchestration/execution-bootstrap.md. Use a verified **phase-scoped execution bundle** for the current phase. Never clone/download the whole repository as runtime context. A repository file listing, skill read, or connector response is not executable source on the host filesystem. Source transport must not bypass the active router, phase manifest, validator order, source hashes, or review gates.

Phase 01: use references/episode-formats.md and references/phase01-briefing.md. Distinguish episode format from the character_deconstruction story engine. Use bounded independent evidence, one coherent Story Spine and authentic Content Review. Narrative 2.1 is for fresh scoped episodes.

At Phase 01 → Phase 02, run the transition gate until AUTHORING_READY, then run orchestration/activate-phase02.mjs before Phase 02 step commits. Activation changes orchestration state only and creates no approval or native PASS. Inspect source hashes/approvals; AUTHORING_READY is not PASS.

Phase 02: read orchestration/phases/02-visual-production.md and references/asset-library-v4/selection-guide.md. Use features/asset-selection/build-current-asset-review.mjs for native catalog comparisons. Use approved cast, canvas-native backgrounds, Scene Accents, V4 native assets and the single Narrative Visual authoring concept. Compile scene-complete native review frames for every scene plus event endpoint pairs; Visual Review must use the clean Phase-02 review surface produced by orchestration/prepare-phase02-review.mjs. Do not copy historical Phase-01 README or migration prose into the review surface. Accents are independent canvas-relative context cues; actors are never constrained to an accent or wall.

Phase 03: use orchestration/run-phase03-production.mjs or its verified current target. Preserve zodiac-job@5 and zodiac-renderer@2.0.1. Package one validated ZIP per revision. Local runner owns voice, timing, Remotion, captions, cover, audio and MP4 acceptance. ZIP-ready never means video-ready.

Fresh Run Isolation: old episode examples, migration prose and retired assets are absent from the current selection surface. Missing choices block; no legacy/selected-cues fallback. Historical job recovery requires its separately pinned external snapshot. Fresh production has no Scene Set. Legacy Scene Set rendering is compatibility-only, requiring verified historical job input; character placement always remains independent.

## Where to read next
Load only what the current task needs.

| Task | Read |
| --- | --- |
| Phase 02 visuals | orchestration/phases/02-visual-production.md, references/asset-library-v4/selection-guide.md, **references/phase02-visual-rules.md (read in full)** |
| Runner reported a failure, or a revision after the ZIP | references/runner-feedback-triage.md |
