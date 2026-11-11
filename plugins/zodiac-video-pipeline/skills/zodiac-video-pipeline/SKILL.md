---
name: zodiac-video-pipeline
description: Produce or resume Vietnamese Zodiac videos, Content Review, Visual Review and Job@5 handoff. Diagnose producer or runner failures using the current phase contract.
---
# Zodiac Video Pipeline

Follow `orchestration/router.md`: 01-content → 02-visual-production → 03-handoff.
Do not use account memory as unapproved episode evidence.

## Current step
Run `node orchestration/resume-brief.mjs <workspace> --context` before each step. It delivers the current task, source-bound handoff, policy and budgeted references. Fetch pending required references before using their capability; see `references/chatgpt-runtime.md`. A Studio pointer or prior chat summary is only a hint.
Use its XState `next_task`, scoped writes and revision ID. Keep the full supplied scene context; see `references/chatgpt-runtime.md` for context transport and runtime requirements.
Read only selected capsule blocks (or `read_now` from plain resume). Load review guidance when switching to review; do not load every phase or catalog into the writer's context. Required gates remain blocking.
Run real validators through `run-validator-with-receipt.mjs`, then commit the step. Missing state, verified execution bytes or required capability means BLOCKED. A file listing, prose checklist or tool invocation is never compiler PASS or user approval.

## Sources
Read `orchestration/execution-bootstrap.md` once to establish the current execution source. Repository runs use this checkout; ChatGPT uses a verified phase-scoped execution bundle. Pin commit/version and verify SHA-256. Transport never changes editorial authority.
User-revoked, deleted, discarded, replaced or excluded sources stay forbidden even if remounted, resurfaced or copied. Only explicit user re-authorization restores that exact source.
Fresh Run Isolation: old episode examples, migration prose and retired assets are absent from the current selection surface. Prior packages and raw trackers are not fresh creative context. Missing choices block; no implicit legacy fallback.

## Phase 01: no user-facing ZIP
Use `references/phase01-briefing.md` in the owning step. Complete Evidence → Voice → Concept → Narrative Design → Narration autonomously after scope is known. Use real evidence and one Story Spine; pause at final Content Review. Voice ownership lives in `voice-profile.json`; beat delivery ownership lives in `narrative-design.json`. Draft from the bounded writer context plus those first-class voice artifacts, never from generic prose with slang painted on afterward.
Run entry preflight and draft checkpoint, then review the exact final narration on separate surfaces: Story Quality, Silent Read, Voice Fidelity, Spoken Performance Plan and TTS Text Preflight. Follow `references/performance-surfaces.md`. Content Review approves text/content only; it does not certify synthesized prosody or final audiovisual effect. IN_REVIEW requires actual outputs/receipts; APPROVED requires the genuine user message bound to source hashes.
Fresh runs include one story-triggered fictional product parody without spoken or on-screen disclaimer using `references/affiliate-commerce.md`. Keep `mock_ad` inside the canonical Narrative Plan; do not create commerce files or invoke real affiliate discovery.

## Phase 02: no user-facing ZIP
Preserve approved narration. Activate after the entry-only gate; create visual plans inside Phase 02. Author `.authoring/visual-intent.json`; use `write-phase02-authoring.mjs` to generate derived plans. Never hand-edit projections. Load selected asset guidance only when needed.
Compile native scene-complete review frames and event endpoints, inspect them, then request genuine Visual Review. Native receipts never substitute for that approval.

## Revisions and files
Use `core/audit/assess-revision-impact.mjs --before <approved-snapshot> --after <workspace>` to find the owning step, required revalidation and affected approvals; stdout is sufficient unless a report file is needed. Correct the canonical source once, then recompile projections. Preserve unrelated scenes with semantic cache guidance.
For an unapproved Phase 02 in review, reopen with `reopen-phase02-for-source-update.mjs <workspace> --amend --reason=<reason>`, then use `write-phase02-authoring.mjs --workspace <workspace> --payload <visual-intent.json> --revise`. Never overwrite approved phases without reopening the applicable review.
Keep only canonical authoring inputs, machine-required projections, genuine receipts and review outputs. Do not create extra prose summaries, copied checklists, alternate plans or diagnostic snapshots by default. Existing approvals and source data are never deleted merely to reduce file count.

## Phase 03: exactly one validated Job@5 ZIP per revision
Use the router's Phase 03 runner and preserve the active Job@5/renderer contract. Local runner owns TTS, measured timing, Remotion, captions, cover rasterization, audio and persistent MP4 acceptance. After synthesis, require evidence-bound TTS Performance Review; after final MP4, require Rendered Performance Review. Follow `references/spoken-performance.md` and `references/rendered-performance.md`. ZIP-ready never means video-ready.
Normal user statuses: DRAFT, IN_REVIEW, APPROVED, PASS, BLOCKED.
