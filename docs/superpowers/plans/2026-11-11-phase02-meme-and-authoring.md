# Phase 2 meme and authoring Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Preserve the existing dirty worktree; no automatic commit, release or plugin-cache mutation.

**Goal:** Finish the Phase 2 audit fixes and make native meme acting deliver an anchored setup/reaction in the channel's existing doodle style.

**Architecture:** Reuse native Visual Grammar, Character Assembly, event transitions and previews. Remove the router's beat-count heuristic in favor of actual event coverage. Extend the existing meme request with optional role-to-state bindings; legacy requests retain initial-state acting. Reuse profiler spans for phase-local observed timing.

**Tech Stack:** Node ESM, node:test, existing native SVG/HTML previews; no new dependency.

**Spec:** The user's request to finish the audit and strengthen meme/channel fit; `docs/audits/2026-11-11-phase02-performance.md`.

## Design and constraints

Meme humor comes from the same character in a normal setup, a narration-grounded reversal and an exaggerated reaction at the right state. Preserve hair, silhouette, shirt/sign glyph, paper/ink palette and readable captions. Use existing event fields and voice anchors; do not rewrite approved narration or manufacture approval. No quota of memes per video and no decorative event/asset quota.

Alternatives: adding effects does not fix reaction timing and conflicts with the current effect-free compiler; adding templates does not repair the broken adapter/compiler boundary. Fix that boundary and state-specific acting first. The user has authorized completion of the prior audit/refactor; implement this focused path without another approval round.

## Tasks

- [x] Router: replace the four-beat minimum with nonempty director beats covering actual event IDs; keep native coverage/quality/review gates. Update coordinator tests and benchmark fixture. Check one-beat complete scenes, uncovered events even with many beats, empty beats and scope restrictions.
- [x] Meme compiler: stop materializing retired effects; keep legacy semantic registry metadata. Test all 11 adapters through the prop compiler, retaining explicit-effect rejection.
- [x] Meme acting: add optional `meme_composition.state_bindings` keyed by character role. Validate role/state existence, visible state and anchored reachability. Project `state_id` into acting requirements and enforce it in Character Assembly; legacy absence targets the initial state. Test normal setup, punchline acting, invalid bindings, unreachable/hidden states and wrong pose.
- [x] Profiler: expose phase-local observed interval union/wall/gaps without requiring Phase 1. Missing intervals/identity and mixed runs remain unknown; never claim captured native spans measure agent time.
- [x] Guidance and review artifact: document native setup/reversal/reaction and a short suitability guide for existing memes. Generate an isolated native before/after showcase using the actual compilers; inspect it. It is a demonstration, not a production PASS or timed render.
- [x] Verification: run meaningful regressions first RED then GREEN, then the plugin's full Node suite and diff checks. Update audit with exact results and residual evidence limits.

## Review focus

- Native meme selection must not recreate forbidden effects.
- Old initial-state acting requests must behave as before.
- A payoff state must exist and be reached by an authored voice-anchored transition.
- Removing the beat quota must not remove source, event coverage or native quality checks.
- Observed Phase 2 intervals must not be mislabeled total agent execution time.

## Execution ledger

- Baseline: main at `79f58ce3`; prior-turn changes and unrelated user edits present. Use current source; do not migrate existing production workspaces.
- Ruling: narrow quality refactor to event coverage, leaving full visual coverage and director semantics at their existing native gates; avoids duplicating those validators inside routing.
- Ruling: the historical registry `effect` field remains reference metadata; new production does not synthesize it because the native prop compiler rejects effects.
- Visual inspection: native facepalm read as poking an eye. Updated only its palm contour and matching sticker edge; body profiles and pose validators remain green.
- Context review: entry catalogs must remain genuinely loaded. Default draft defers only review-oriented visual-quality/retention guides, restored for review. Unsupported `preparedPlan` test argument replaced with the documented flags/options call; no trust shortcut added.
- Independent review found demo output could overwrite an episode. Added own-receipt/nonempty-directory guard and unconditional pipeline-state refusal; observed both tests RED then GREEN. Reviewer rechecked the fix and reported clean.
- Final verification: 1126/1126 Node plugin tests PASS, no skip; diff check PASS; orchestration benchmark PASS after Windows path-prefix normalization. Native endpoint showcase generated and visually inspected in an isolated headless browser.
- Evidence still absent: production session agent-time baseline, genuine user review of meme timing, audio/rendered MP4 and installed plugin-cache update. No speed-up claim, release or fabricated approval.
