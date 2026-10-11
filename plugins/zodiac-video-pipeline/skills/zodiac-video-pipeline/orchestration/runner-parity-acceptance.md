# Runner parity acceptance — Job@5 producer / runner boundary

This document is an external acceptance handshake, not a new phase or an attempt to sync plugin sources to GitHub.

## Integration with SeikoP/project-zodiac-video
- The runner on GitHub is a separate repository; **never sync this plugin to GitHub** unless explicitly asked.
- Phase 03 produces exactly one source-locked Job@5 ZIP and calls it `LOCAL_RUNNER_IMPORT_READY`, not `PRODUCTION_READY_VIDEO`.
- A local runner may execute `python -m tools.control_plane.cli build <workspace>` after real, measured `.runtime/timing.json` exists. Its IR → render-plan lineage guard must detect lost scenes, entities, states, asset IDs and events and fail with `PLAN_LINEAGE_DRIFT`. This command is runner-owned and MUST NOT be invoked as a Phase 03 prerequisite.
- Renderer 2.0.1 CI (including actual font/typecheck and Remotion smoke) is a repository CI condition, not plugin native-preview approval.
- Regression baseline: `SeikoP/project-zodiac-video` PR #89 renderer CI green; PR #90 lineage audit requires its own CI. Do not claim it has passed merely because the PR exists.
- Native visual reviews require story object, scene semantic effects and meaningful positions. The runner cannot fabricate missing authoring states or props to pass visuals.
- Runner final acceptance requires actual voice.wav, measured word timing, render-plan validation, temporal frame checks across all events, caption/cover stills, final MP4 + audio ending inspection, and real runner receipt. Human creative approval cannot be replaced by deterministic tests.
- Changes to rendered assets or narration demand revision-impact assessment and revalidation. Existing approvals may only be reused with matching source hashes.
- Keep Job@5 contract unchanged until an explicit versioned migration is approved.

## Release evidence ledger
Required evidence: pinned plugin release and runner commit; Job@5 artifact hash; runner plan lineage report; CI URL/status; runtime font and still-frame checks; actual audio/video/cover paths and hashes. A missing artifact is `NOT_VERIFIED`, not `PASS`.

## Runner production handoff checklist (2026-10-10)
The following are **post-ZIP local runner steps**. These commands MUST NOT be run by the plugin as native approvals or required before Phase 03 ZIP export.

1. Import Job@5 and produce genuine `voice.wav` and `.runtime/timing.json`. The GUI supports `scene_gap_ms` 0–600 milliseconds, default 180 milliseconds, and passes the same setting to WAV assembly and measured timing. Do not confuse this with TTS speech rate or inject a synthetic sentence pause into timing only.
2. Run `python -m tools.control_plane.cli build <imported-job-workspace>` with the real timing, and require `LINEAGE_VERIFIED_EVENTS` from IR→plan validation. A missing event or state is a P1 release blocker.
3. On renderer 2.0.1 use `node scripts/preview.mjs <job-workspace> <preview-dir>` (inside its pinned renderer directory). Inspect native Remotion BEFORE / PEAK / AFTER frames for every authored event, plus any animation clip. A static still never proves an easing curve is visually smooth.
4. Verify final artifacts with `python -m tools.media_acceptance <workspace> --video <final.mp4> --cover <cover.png>`. The resulting report must show `PASS_TECHNICAL_ONLY` with actual SHA-256 evidence, no missing publish files or malformed cover, and duration at least as long as voice.wav. This result is not human visual or spoken-last-syllable acceptance.
5. The Job@5 PySide6 UI may open pinned Remotion Studio after PLAN. Studio opens the **real** render props, not an independently authored HTML mock. Missing Node, props, binaries or runtime integrity are blockers.
6. Real user review still needs full video playback, Vietnamese glyph coverage, spatial/actor semantic check, last-word listening, cover crop, dialogue pace and handoff artifact provenance. Do not claim all of these PASS from static tests or CI.

Known repository implementation PRs: #89 (typecheck), #90 (IR lineage), #91 (three temporal snapshots), #92 (media acceptance), #93 (Job@5 Remotion Studio), #94 (voice scene-gap control). Verify their release status and current runner version at execution time; this listing is an implementation pointer, not a live compatibility certificate.
