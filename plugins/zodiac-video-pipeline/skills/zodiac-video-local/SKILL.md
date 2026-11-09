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

When status is `PHASE2_LOCAL_READY`, use the returned `workspace`, source-bound `context`, and `next_task`. Do not import the same capsule again, re-discover the repository, or call an optional code index just to understand the current task.

## Local CLI task loop and bounded source lookup

1. Treat the current XState `next_task`, revision ID, allowed writes, active phase manifest, source hashes, receipts, and selected reference blocks as the task contract. Fetch any `pending_references` before using their capability; never infer missing source from old history.
2. Execute only the work unit owned by that task. For visual authoring, preserve narration verbatim, all meaningful director beats, actors, physical props/story-objects, events, continuity and asset bindings. The canonical visual authoring source is `.authoring/visual-intent.json`; never hand-edit its generated projections.
3. Run cheap authoring/precompile checks before expensive native asset work. For native repair, use current source-bound receipt issues, group related defects, revise the canonical source once, and rerun only valid dirty scene/asset closures under the existing exact hash/cache rules.
4. After a successful write, validator, commit or phase transition, run `node skills/zodiac-video-pipeline/orchestration/resume-brief.mjs <workspace> --context` and follow the new `next_task`. For unchanged tasks, retain the already delivered context; do not poll or reload it needlessly.
5. Request genuine Visual Review at its boundary; Phase 3 cannot publish to `ready/` before explicit review approval and Phase 2 PASS.

Source lookup is **exceptional**, not a mandatory production step. Prefer, in order: (a) known manifest/receipt/source path; (b) exact-file read; (c) scoped ripgrep `rg` for an unknown symbol, filename or error; (d) existing manifest/workflow and semantic dependency graphs. Do not index the repository before ordinary scene/asset/validation tasks.

When code search is needed from repository root:

```sh
rg --files plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline -g '*.mjs'
rg -l -F -g '*.mjs' -g '!**/tests/**' 'TARGET_SYMBOL' plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline
rg -n -F --max-count 20 -g '*.mjs' 'ERROR_CODE' plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases
```

Scope searches to owning folders and bound results; exclude `.git`, `node_modules`, `.runtime`, generated previews, ZIPs and unrelated SVG/catalog masters by default. If `rg --version` is unavailable, use scoped `git grep -n -F` in a checkout; without Git use exact reads or a narrowly scoped Node scan. Never install a search package during a production task. A textual hit is not evidence of a runtime dependency or validator PASS.

Persistent pipeline contracts, receipts, approvals and Job@5 stay JSON. The context compiler already selects lossless compact JSON or TOON only when measured token count decreases; do not migrate canonical files for prompt compression.

## Phase 2

Run the canonical Phase 2 manifest, author Visual Intent, compile assets/scenes/previews, fix native failures, and stop for genuine Visual Review. The Local distribution **must not rewrite approved narration** or replace Content Review.

## Phase 3

After genuine Visual Review and Phase 2 PASS, run the canonical local delivery wrapper:

`node skills/zodiac-video-pipeline/phases/local/run-local-phase03.mjs --queue-root <queue-root> --source-workspace <workspace> --concept <concept> [--episode-scope <scope.json> | --sign <sign>]`

Only a validated Job@5 archive may be atomically published into `ready/`.

LocalRunner continues to own TTS, measured timing, Remotion rendering, audio, cover/runtime QA, and MP4 production.

## Queue statuses

- `PHASE2_LOCAL_READY`: continue the returned Phase 2 task.
- `NO_PHASE1_HANDOFF_AVAILABLE`: no new capsule exists in `phase1-done/`.
- `PHASE1_HANDOFF_BLOCKED`: inspect `blocked/<run-id>/import-receipt.json`; never repair the capsule in place.
- `LOCAL_MULTIPLE_ACTIVE_EPISODES`: list the processing candidates; never guess which episode owns the session.
