# Editing workbench execution

Plan: `docs/superpowers/plans/2026-11-22-studio-editing-workbench.md`.
User authorized implementation after review; first delivery is scene-based editing with measured duration/order preserved. Existing dirty source was snapshotted in the ignored plan workspace.

## Task 1 — measured timeline model

New pure timeline mapping rejects invalid/overlapping/duplicate intervals, respects unequal scene lengths and real gaps, and maps final endpoint correctly. `WorkbenchSelection` defines shared project/scene/object/time state.

Verification: test first failed because timeline module was absent, then `node --test tests/studio_episode_timeline.test.mjs` passed 3/3; `pnpm.cmd -C apps/zodiac-studio exec tsc --noEmit` passed.

Ruling: wire App/editor selection in Task 2 alongside the shell, keeping this task a self-contained pure model; old App/VisualEditor contain pre-existing dirty changes and are preserved until that integration.

Human listening/visual/video gates remain PENDING. Full native E2E has not yet been rerun.

## Task 2 — editor-first shell

Default opening/import now enters the editing workbench, with large preview, contextual object/state labels, voice/export actions and shared selection owned by App. Ideas/project overview/resources stay reachable. Existing dirty navigation extraction and QA type/UI improvements are required compatible dependencies and are included without discarding them.

RED: new workbench browser test timed out on absent editing-workbench. GREEN: workbench shell/context/3 viewport checks passed; existing compact suite passed six views, all inspector/voice/source/log/pagination checks at three sizes; frontend TypeScript/Vite build passed (existing large-chunk/externalized-os warnings). Fixture catalog was completed for export navigation, rather than suppressing a real page error. No release/package generated.

## Task 3 — whole-episode navigation/playback

Added measured scene blocks, global ruler/scrubber, zoom, selected-assembly waveform when available, and measured spoken-word display (not fabricated SRT captions). One assembly audio/clock owner drives scene-local SDK seeks. Scene changes wait for the next preview and retain playing intent; failed loads clear old frames and stop. Rebuild/stale/hidden workspace stops playback. App persists project/scene/time in optional local storage, and scene pagination follows timeline selection.

RED: missing whole-episode timeline and duplicate-navigation assertion failed before implementation. GREEN: workbench browser test covers global seek, scene 6 page reveal, reload restoration, continuous silent fixture playback over a scene boundary, pause and failed-preview clearing; 3 viewport layouts pass. Compact suite passed all six views/panels at three sizes; pure timeline tests3/3 and TypeScript passed. Fixture playback is not real audio acceptance. Native real audio/video remains Task5.

Ruling: show measured words as `Lời đọc`; no separate exported-caption track is invented from word timing. Reading existing measured voice/peaks is reused; missing matching audio is explicit. Collapse redundant editor navigation and completed job banner to enlarge the canvas. Timeline uses original measured order/durations.

## Task 4 — contextual agent/resources

Health now accurately lists inspection/initial/scene proposals, credential-file detection, tools-disabled and live-readiness-not-checked. GUI explains that finding Codex is not a successful live model connection. Initial authoring guides missing voice/timing first; scene proposals appear only beside their own selected scene, with completed/unapplied vs applied states distinct. Candidate inspector uses actual gallery previews when available, fit/rejection/no-fit context and canonical apply.

RED: new health capability test failed with missing capabilities. GREEN: 23 Python agent/authoring/gallery-transport checks passed in26.180s; six Node asset/candidate/source-history tests passed; workbench browser context/restoration/playback/error/3size test and TypeScript passed. No live inference claim yet.

Only the health hunk of pre-existing dirty agent_bridge.py is staged for this task; unrelated prompt/art changes remain local. No duplicate resource catalog or arbitrary tool-calling loop added.

## Task 5 hardening checkpoint — native/media acceptance still in progress

Fresh independent read-only review identified stale pre-build voice reads, boundary pauses/gap display, SDK recovery, selection persistence and insufficient native assertions. Repairs include active voice refresh, bounded adjacent preview/iframe preload, independent audio clock with ended/replay behavior, explicit gap view, retry control, actual paused-frame seek on preload promotion, non-first entity restoration, source/time reconciliation and outgoing project selection flush. Candidate responses are scoped to their request context; hidden proposal polling stops. A completed proposal can be locally discarded; its durable receipt stays intact.

Real native import and generation produced32 new speech units in114.584s. ASR then exposed subtraction noise (-3.637978807091713e-12ms at true zero). New worker relative-time conversion rounds only to1e-6ms and retains invalid true negative/reversed timestamps; three regression tests pass. GUI retry reused the real measurement cache and completed all32 units. No narration or WAV edit was made. A first live proposal failed on transient Windows receipt replacement denial; bounded retries preserve the last good file and propagate sustained denial. Its regression verifies both paths. Failed/interrupted attempts are retained locally; a replacement real proposal is running. No new MP4/native-completion claim yet.

Verification after hardening: workbench browser regression PASS at3sizes, including real synthetic WAV boundary playback with zero pause events, paused iframe seek, end, gap, same-scene retry, reload/non-first object and project switching; compact6view suite PASS at3sizes; TypeScript/Vite frontend build PASS. Broad Python335 tests PASS in318.421s after installing the existing2.0.1 renderer lockfile dependencies (initial10missing-module errors; targeted21test retry PASS). Legacy Qt teardown emitted non-fatal deleted-QNetworkAccessManager tracebacks; suite exit was0. Fresh affected backend27tests PASS in30.913s after receipt/worker repairs. Node42tests and Rust2tests PASS. Build retains large-chunk/externalized-os warnings. Remote CI and actual human quality remain unverified.

Native tests now require actual audio boundary/end/replay, a changed immutable MP4 path plus COMPLETED/current status, and automatic startup scene/entity/time restoration; they no longer select the expected project before checking restoration. Native file-dialog automation targets the exact Studio PID.
