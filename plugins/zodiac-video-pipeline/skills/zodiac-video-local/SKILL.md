---
name: zodiac-video-local
description: Resume Zodiac production locally from phase1-done/, run Phase 2 and Phase 3, and publish the validated Job@5 ZIP into ready/ for LocalRunner.
---

# Zodiac Video Local

This distribution owns Phase 1 handoff import plus **Phase 2 and Phase 3**. It never performs new Evidence/Concept/Narration work.

## Execution source

Use this installed plugin root, resolved from this skill path, for all local production. The canonical editable source is `plugins/zodiac-video-pipeline` in the project checkout. Rebuild and reinstall after source changes; do not execute stale marketplace snapshots or cache copies from other distributions. This unified local development distribution retains version 2.10.0 for existing episode compatibility and incorporates the former P2 NEXT native execution improvements. Preserve genuine approvals and rerun affected source-bound native gates after updates.

## Invocation bootstrap

For episode production, immediately on invocation, before asking the user for an episode name or ZIP path, run:

`node skills/zodiac-video-pipeline/phases/local/local-bootstrap.mjs <queue-root> [--run-id <run-id>]`

The default queue root is `ZODIAC_QUEUE_ROOT` when set, otherwise the current working directory. The bootstrap atomically claims the oldest valid handoff in `phase1-done/` before resuming existing work, preserving every active workspace. When no handoff is waiting it resumes the sole active workspace; if several are active, select the intended one with `--run-id <run-id>`.

For pipeline review, audit or performance work, inspect existing sources and receipts without claiming a handoff or starting an episode.

When status is `PHASE2_LOCAL_READY`, use the returned `workspace`, source-bound `context`, and `next_task`. Do not import the same capsule again, re-discover the repository, or call an optional code index just to understand the current task.

## Local CLI task loop and bounded source lookup

1. Treat the current XState `next_task`, revision ID, allowed writes, active phase manifest, source hashes, receipts, and selected reference blocks as the task contract. Fetch any `pending_references` before using their capability; never infer missing source from old history.
2. Execute only the work unit owned by that task. For visual authoring, preserve narration verbatim, all meaningful director beats, actors, physical props/story-objects, events, continuity and asset bindings. The canonical visual authoring source is `.authoring/visual-intent.json`; never hand-edit its generated projections.
3. Run cheap authoring/precompile checks before expensive native asset work. For native repair, use current source-bound receipt issues, group related defects, revise the canonical source once, and rerun only valid dirty scene/asset closures under the existing exact hash/cache rules.
4. After a canonical source write, commit or phase transition, run `node skills/zodiac-video-pipeline/orchestration/resume-brief.mjs <workspace> --context` and follow the new `next_task`. Run the prescribed checks for the same task as one bounded batch; refresh once after that batch, rather than after each validator. Stop on an upstream failure before dependent checks. For unchanged tasks, retain the already delivered context; do not poll or reload it needlessly. Task IDs, source hashes and pending required references still apply to every write and capability use.
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

Fresh visual readiness requires a visible narration-grounded background/context Scene Accent component in every scene and at least one Narrative Visual per video. A palette-only canvas or episode-wide Narrative Visual omission must fail before native compilation. Narrative Visual is authored as `narrative_visual` and transported as `story_object`. Run the current authoring-completeness and narrative-visual-presence gates; do not accept old PASS receipts after source changes.

Author director beats for the actual narrative changes and cover every event in `event_ids`; there is no four-beat minimum. For meme moments, read the performance guidance in `references/visual-direction.md`: preserve the channel's cast identity, establish a normal setup, and bind native meme acting to the visible reaction state with `grammar.meme_composition.state_bindings` at the approved voice anchor. Do not start every scene already at its punchline or synthesize retired effect assets. Obtain genuine Visual Review of the contrast and later check measured runtime timing.

Every fresh coverage beat must explicitly decide `story_text` and `meme` use/omit with an editorial reason before projection. Read `references/story-text.md` alongside `references/visual-direction.md`; plan lettering and cast reactions at the actual reversals, demonstrations and callbacks. Missing decisions and unperformed selections block authoring completeness. Deliberate quiet omissions remain valid; no text or meme quota replaces judgment.

Review-only visual-quality and retention guidance may be deferred during draft planning; fetch it before the corresponding validation/review. Mandatory entry catalogs remain available in the full step context, and selected work units still fetch current entries before use. Deferral never waives a capability or validator. Use `core/audit/episode-utilization-report.mjs <workspace>` to inspect recorded per-phase intervals; native-only observations do not measure agent authoring time.

Keep visual scenes economical. Preserve separate audio scene boundaries when performance semantics differ. Treat full-room backgrounds as scene anchors: use them for essential setting reveals, major location changes and callbacks, and avoid repeating one full-room background across a run of separate scenes. In connecting scenes, use one sparse, narration-grounded Scene Accent cue (such as a lamp, window or clock) behind the action instead of another full-room backdrop. Keep accents clear of actors, props and captions. Reuse framing and character positions across continuous beats; let pose, prop state and event carry progression. Every fictional advertisement must read clearly as an ad, foreground its product/story-object, show one product-specific demo, and land on a visual punchline. Keep the ad brief and stylistically consistent, and leave faces and captions readable.

## Phase 3

After genuine Visual Review and Phase 2 PASS, run the canonical local delivery wrapper:

`node skills/zodiac-video-pipeline/phases/local/run-local-phase03.mjs --queue-root <queue-root> --source-workspace <workspace> --concept <concept> [--episode-scope <scope.json> | --sign <sign>]`

Only a validated Job@5 archive may be atomically published into `ready/`.

LocalRunner continues to own TTS, measured timing, Remotion rendering, audio, cover/runtime QA, and MP4 production.

## Runtime performance reviews

Do not treat generated WAV/timing or a technically valid MP4 as proof that the intended performance survived.

After TTS + measured timing exist:
1. Run `python -m tools.performance_review <workspace> init-tts`.
2. Listen to the exact generated take(s) and complete `.runtime/tts-performance-review.json` against pronunciation, pause/breath, pace, emphasis, internal voice, punchline landing and ending cadence.
3. Run `python -m tools.performance_review <workspace> validate-tts`. A REVIEW/BLOCKED result routes to the affected voice take/performance input. Do not rewrite approved narration unless the defect is textual and Content Review is reopened.

After `out/zodiac-story.mp4` exists:
1. Run `python -m tools.performance_review <workspace> init-rendered`.
2. Watch the exact final MP4 and complete `.runtime/rendered-performance-review.json` against voice-in-mix, caption reveal timing, visual pre-emption, cut/pause alignment, attention competition, payoff sync and ending energy.
3. Run `python -m tools.performance_review <workspace> validate-rendered`.
4. Only then run `python -m tools.media_acceptance <workspace> --video <workspace>/out/zodiac-story.mp4 --cover <workspace>/out/cover.png`.

`media_acceptance` is now blocked unless both performance reviews PASS on exact source hashes. Rebuilt WAV/timing/MP4 bytes invalidate the corresponding review; never carry an old PASS across regeneration.

## Queue statuses

- `PHASE2_LOCAL_READY`: continue the returned Phase 2 task.
- `NO_PHASE1_HANDOFF_AVAILABLE`: no new capsule exists in `phase1-done/`.
- `PHASE1_HANDOFF_BLOCKED`: inspect `blocked/<run-id>/import-receipt.json`; never repair the capsule in place.
- `LOCAL_BLOCKED_HANDOFFS_PRESENT`: inspect the blocked receipts before resuming another episode; select an existing workspace explicitly with `--run-id` if it should continue.
- `LOCAL_MULTIPLE_ACTIVE_EPISODES`: use the current task's `run_id` with `--run-id`; never guess which episode owns the session.
