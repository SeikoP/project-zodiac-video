# Zodiac router

The workflow has three ownership zones:

1. **01-content / Web** — creative microphases and Content Review.
2. **02-visual-production / Local** — native visual authoring, compilation and Visual Review.
3. **03-handoff / Local** — validated Job@5 handoff.

Current user direction and genuine approvals govern the episode.

## Phase 01 — creative-first Web

Run:

**Evidence → Voice → Concept → Narrative Design → Narration → CONTENT REVIEW**

Phase 1 intentionally does not use native execution bootstrap, npm/runtime dependencies, compiler receipts, validator receipts, cache/reuse infrastructure or performance overlays. Splitting the work into smaller creative phases is the optimization.

After scope is known, continue autonomously. Do not ask for routine approval between microphases. The Content Engine selects the strongest concept unless the user explicitly requests options.

Evidence should be sufficient, not exhaustive. Concept generation should remain broad until a sign-specific premise wins. Narrative Design owns Story Spine and creative direction. Narration owns the exact spoken text.

There is one required human boundary: Content Review.

After explicit approval, export one `zodiac-phase1-handoff@2` capsule with the approved creative artifacts. Web never activates Phase 2.

## Phase 02 — native Local production

Local imports the Phase-1 capsule, verifies its inventory and genuine Content Review, reconstructs native pipeline state, and activates Phase 2.

Author the canonical Visual Intent from the approved narration and Narrative Plan. Preserve sign identity, Story Spine, Voice Profile and any Phase-1 narrative-visual direction. Phase 2 may invent visual execution but must not rewrite the approved story.

Use the current native asset/scene/preview validators and require genuine Visual Review before sealing production.

## Phase 03 — handoff

Use the approved Phase-2 source and review lock to assemble and validate one Job@5 ZIP. LocalRunner owns TTS, measured timing, captions, Remotion, audio and MP4 acceptance.

## Review semantics

Content Review and Visual Review are user decisions. Technical checks can verify structure and production readiness but never create approval.

A content revision after approval reopens Phase 1 only when narration or its story meaning changes. Pure visual changes stay in Phase 2.
