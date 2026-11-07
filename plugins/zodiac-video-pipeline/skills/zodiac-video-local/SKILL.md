---
name: zodiac-video-local
description: Resume Zodiac production locally from phase1-done/, run Phase 2 and Phase 3, and publish the validated Job@5 ZIP into ready/ for LocalRunner.
---

# Zodiac Video Local

This distribution owns Phase 1 handoff import plus **Phase 2 and Phase 3**. It never performs new Evidence/Concept/Narration work.

## Invocation bootstrap

Immediately on invocation, before asking the user for an episode name or ZIP path, run:

`node skills/zodiac-video-pipeline/phases/local/local-bootstrap.mjs <queue-root>`

The default queue root is `ZODIAC_QUEUE_ROOT` when set, otherwise the current working directory. The bootstrap discovers `phase1-done/`, resumes an existing `processing/<run-id>/` workspace, or atomically claims the oldest valid handoff.

When status is `PHASE2_LOCAL_READY`, use the returned source-bound context and next task. Do not import the same capsule again.

## Phase 2

Run the canonical Phase 2 manifest, author Visual Intent, compile assets/scenes/previews, fix native failures, and stop for genuine Visual Review. The Local distribution **must not rewrite approved narration** or replace Content Review.

## Phase 3

After genuine Visual Review and Phase 2 PASS, run the canonical Phase 3 production path through the local delivery wrapper. Only a validated Job@5 archive may be atomically published into `ready/`.

LocalRunner continues to own TTS, measured timing, Remotion rendering, audio, cover/runtime QA, and MP4 production.

## Queue statuses

- `PHASE2_LOCAL_READY`: continue the returned Phase 2 task.
- `NO_PHASE1_HANDOFF_AVAILABLE`: no new capsule exists in `phase1-done/`.
- `PHASE1_HANDOFF_BLOCKED`: inspect `blocked/<run-id>/import-receipt.json`; never repair the capsule in place.
- `LOCAL_MULTIPLE_ACTIVE_EPISODES`: list the processing candidates; never guess which episode owns the session.
