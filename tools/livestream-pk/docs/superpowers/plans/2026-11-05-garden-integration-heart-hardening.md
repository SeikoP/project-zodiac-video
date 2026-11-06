# Garden Integration, Heart Events and Performance Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Checkboxes track actual verification, not assumptions.

**Goal:** Make native Garden events, camera, overlay, audio, control, documentation and LIVE readiness agree; give non-boss hearts a visible, bounded gameplay effect.

**Architecture:** Keep Node ESM Garden engine authoritative. Propagate stable event IDs/results to the server camera director and browser presentation, and use shared pure policies for cross-boundary choices. Preserve the isolated simulator and LIVE save. No OBS, no new game engine, no new dependencies.

**Tech Stack:** Node ESM, Canvas/SVG, SSE/poll, Web Audio, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-05-garden-complete-experience-design.md`; override obsolete 48-seat text with the later 42-seat rack spec and `garden/config.mjs`.

## Global Constraints

- One Garden listener on 4858; simulator uses its own save; never reset the LIVE save.
- 42 active seats in a 2-wing x 7-shelf x 3-pot rack; stable logical seat IDs.
- Native gameplay applies a reward exactly once; display or reconnect never applies rewards.
- Boss likes are damage, not garden heart progress; awards ignore likes.
- No autonomous restart of LIVE, TikTok connection or OBS.
- Existing locally modified Garden files remain intact; no unrelated cleanup.

## Review Focus

- Tim bursts arriving simultaneously with gifts/round changes: correct attribution and no double reward.
- No growing plots or only sleeping plots: honest milestone copy, no false boost.
- Empty/no-seat gift targets and room-wide gifts: camera scope agrees with visual effects.
- Stale preview or live source: diagnostics should not report readiness prematurely.
- Long Unicode names and reduced-motion: labels fit and milestone effects do not block game.

## Confirmed mismatches

1. **Build identity:** server startup hash previously ignored `camera.mjs` / `hearts.mjs` / browser `view.js`. Unit changes could retain the same build ID. Corrected by centralized fingerprint.
2. **Gift scope:** camera used affected count/target while overlay relied only on `tier === rain`; both now use `isGardenWideGift` in `public/garden/view.js`.
3. **Hearts not noticeable:** 100/500/1000 cumulative milestones previously granted +2% single, +1% community, +2 gold without identifying care targets. New implementation reports actual recipients, +5% / +2.5% (under existing 10% cap), and bounded visual markers.
4. **Documentation conflicts:** historical plan says 48 pots and all gifts use overview; actual authoritative rack is 42 pots and single-target gift close-ups are enabled.
5. **Evidence mismatch:** Node tests prove state, not browser screenshot, audio mixing, or LIVE Studio capture.

## Task 1: Shared camera/presentation gift scope — implemented

**Files:** `public/garden/view.js`, `garden/camera.mjs`, `public/garden/garden.js`, `garden/view.test.mjs`, `garden/camera.test.mjs`.

- [x] RED: test single, multi-target, destructive and missing-target scopes.
- [x] GREEN: one `isGardenWideGift({tier,plotId,affected})` pure function used by both sides.
- [x] Check Node tests for unchanged boss / event priority.
- [ ] Browser evidence: camera and projected effects coincide at 540x960 for all gift tiers.

## Task 2: Visible heart milestones — implemented in source and Node tests

**Files:** `garden/hearts.mjs`, `garden/hearts.test.mjs`, `public/garden/view.js`, `public/garden/garden.js`, `public/garden/garden.css`, `garden/view.test.mjs`.

- [x] RED: tests for care target, affected community count, bounded targets, meaningful copy and next reward.
- [x] GREEN: care +5% one crop; community +2.5% per growing crop; lucky seat +2 gold, preserving existing 10% bonus ceiling and boss arbitration.
- [x] Emit `heart-milestone` containing `kind`, `plotId`, `plotIds` (up to 6), `affected`, `gain`, `nickname`, and existing identifiers.
- [x] HUD shows upcoming reward, existing notification announces actual result; visible pot floaters use bounded IDs; pulse is reduced-motion safe.
- [ ] Browser matrix for 1/4/42 players, no-growing-crop, boss, reconnect, and reduced-motion; **1-player 100/500/1000 milestone browser smoke is done**.

## Task 3: Build fingerprint of executable Garden dependencies — implemented in source and Node tests

**Files:** `garden/build-id.mjs`, `garden/build-id.test.mjs`, `garden/server.mjs`.

- [x] RED: changes to camera, hearts and browser view must change build fingerprint.
- [x] GREEN: fingerprint hashes named engine, renderer, scene, audio and stylesheet dependencies.
- [x] Monitor check: server exposes runtime source modification flag, and Control warns when code on disk changed or display build differs.
- [x] `buildRuntimeFiles` discovers transitive local ESM imports and tracks their changed bytes; covered by a regression test.

## Task 4: One scene lifecycle and diagnostics — pending

**Files:** `garden/camera.mjs`, `garden/server.mjs`, `garden/displays.mjs`, `public/garden/presentation.js`, `public/garden/garden.js`, `public/garden/control.js`.

- [x] RED/GREEN: shared `eventId`/`sceneId` survives gift receipt, camera shot, presentation queue, heartbeat, reconnect and scene audio cue.
- [x] RED/GREEN: stale or mismatched LIVE build cannot authorize a secondary camera scene; native game rewards are applied on input independently.
- [x] Camera emits absolute `startedAt/stableAt/until` and reports `travel/hold/result/done`. Browser checkpoint resumes elapsed time, while its separate presentation queue handles roulette, impact and gifts. No fake assertion that independent queue order is identical.
- [x] Control compares native camera scene ID and phase with the actual LIVE/Preview heartbeat. LIVE server publishes `diagnosticsVersion:2` (no false old-server warning).
- [x] Node reconnect/receipt regression tests; earlier isolated browser rehearsal covered burst30, bossinterrupt and two display roles. Final browser rehearsal evidence appears in handoff.

## Task 5: Measured bottlenecks, not guessed optimizations — pending

**Files:** `garden/load.test.mjs`, `garden/sim.mjs`, `public/garden/garden.js`, `garden/server.mjs`, `scripts/garden-rehearsal.mjs`.

- [ ] Captured server tick p95, frame payload p95, camera queue age and browser scene/phase; quantitative event-to-paint latency and notice-drop instrumentation are still pending.
- [x] `scripts/garden-performance.mjs` benchmarks 1/4/12/24/42 at 540x960 and 360x640 with Chrome/Playwright, reporting Canvas FPS, p95 interval, full-canvas commands, DOM mutations, heap and screenshot artifacts.
- [ ] 90-second 42-seat soak with likes/gifts completed; **15-minute Studio encode / browser soak** not completed and cannot be inferred from short benchmark.
- [x] CPU profiler identified Canvas raster/drawImage/label overhead. Reduced redundant DOM writes and scaled backing pixels to actual preview output; measured modest improvement at 42 seats. Tried bounded label sprite cache, rejected and removed after measured regression. **30 FPS target remains unmet in this headless benchmark.**

## Task 6: Instructions, simulator and LIVE acceptance — pending

**Files:** `garden/README.md`, `ops/live-studio-garden/README.md`, historical `docs/superpowers/*`, simulator acceptance scripts.

- [x] Canonical `garden/INTEGRATION.md` indexes gameplay, events, camera, audio, simulator, source diagnostics, preflight and LIVE manual checks.
- [x] Historical 48-seat/OBS-era plans/specs are marked superseded, preserved for traceability.
- [x] Isolated Playwright browser tested hearts 100/500/1000, gift zoom, source heartbeat, Control actions, and prior 15-scenario rehearsal including wheel-reload and boss priority.
- [ ] **External manual gate:** actual TikTok LIVE Studio one-audio-source mix and capture, physical phone safe-area, and authentic LIVE input cannot be certified by isolated browser tests. Added read-only `scripts/garden-preflight.mjs`, which never asserts `studioVerified:true`.

## Acceptance and deployment

The task is fully ready only after Node tests, browser visual evidence, audio check and LIVE Studio capture are all recorded separately. `npm test` and load tests alone cannot certify phone readability or Studio capture. After code changes, restart **simulator only** when safe; avoid mixing processes on port 4858. No production restart or save reset is implied by this plan.
## Recorded evidence — 2026-11-05

- `node --test garden/*.test.mjs`: Garden regression suite, rerun after edits (report exact final result in handoff).
- Playwright Chrome isolated rehearsal: 15 simulator scenarios passed with no page errors, checkpoint restored, boss visible, LIVE and Preview distinct, 390px control no overflow; screenshots and JSON in `logs/garden-integration-20261105/`.
- Playwright standalone: 100→400→500 likes advanced care/community/luck HUD; notice contained +5%; a five-coin gift produced camera `gift`, active LIVE display FPS 30 with `stale:false`, screenshots `heart-*.png`, `gift-zoom-longname.png`.
- Playwright mobile Control at 390×844: press +100 tim yielded `0/400 · +2,5% cả vườn`, no page exceptions and no horizontal overflow; `control-heart-mobile.png`.
- Simulated load 48 arrivals/42 seats for 180 sec: tick p95 0.20ms, frame p95 29114 bytes, 5 shots/min; this is synthetic server-side evidence, not a GPU frame time.
- `npm test` full default parallel run failed only `game.test.mjs` legacy `handlers stay fast with a large saved audience` (2044–2321ms actual vs <1500ms assertion) under suite contention; same legacy file in isolation passed 66/66. This bottleneck is outside Garden and must be profiled independently; do not loosen threshold without root-cause evidence.
- Not verified: actual Studio encoding/capture, audio listening/mixer, visual quality assessment of screenshots by a human, sustained 15-minute GPU/heap profiling, full source lifecycle synchronization. These remain pending tasks.
## Follow-up implementation and measured bottlenecks — 2026-11-05

- `node --test garden/*.test.mjs` after integration changes: **247/247 pass**, `git -c core.whitespace=cr-at-eol diff --check` pass before final browser rehearsal. Re-verify after any further changes.
- Native gift `eventId/sceneId` flows into camera `travel/hold/result/done`, `startedAt/stableAt/until`, browser presentation dedupe and display heartbeat; camera state is visible in server `/api/status` and can be compared against current source. Distinct browser modal scene timeline remains intentionally separate.
- Chrome headless performance **42 seats**: before backing adjustment and after DOM changes, 540x960 17.2 FPS (p95 82.4ms), 360x640 17.75 FPS (p95 79.7ms). With backing adjustment: 540x960 19.39 FPS (p95 67.9ms), 360x640 20.28 FPS (p95 66.6ms); these short browser runs do not qualify as 30 FPS Studio readiness. 90s pre-backing soak: median 10.72 FPS, p95 112.7ms, heap ~4.82MB to ~4.54MB. Visual label cache was measured then reverted (slower).
- Chrome DevTools 8-second CPU sample mostly idle (10,567 / 11,884 samples), with `drawImage`, `drawPlot`, `drawPlotLabel` as hottest active work. GPU raster/compositing and 15–20 minute encode test remain to be measured in real Studio.
- Added `garden/preflight.mjs`, `scripts/garden-preflight.mjs` and tests. Offline status checks cannot certify LIVE audio, capture or authentic TikTok event delivery. No LIVE save or Studio setting has been modified.
## Final verification — 2026-11-05

- Garden regression: `node --test garden/*.test.mjs` **247 passed, 0 failed**, diff whitespace check passed.
- Chrome/Playwright final rehearsal: **15/15 isolated scenarios**, no page errors; reload wheel checkpoint intact; boss and source role checks passed; responsive Control no horizontal overflow. Evidence: `logs/garden-integration-20261105/final-rehearsal/report.json` with contact sheets/screenshots.
- Simulator running locally on port 4858, `simulator:true`, `diagnosticsVersion:2`, `runtimeSourceChanged:false`, build `cda24794412b`. Offline preflight result `offlineReady:true` in `logs/garden-integration-20261105/preflight-sim.json`; `studioVerified:false`, `fullyReady:false` by design.
- Full repository `npm test`: **655 pass, 1 fail**. Existing non-Garden test `game.test.mjs:295 handlers stay fast with a large saved audience`: measured 2793ms vs 1500ms threshold under parallel suite load; isolated game file previously passed. Do not report all-repo green.
- Performance target remains open: Chrome 42-seat 540x960 ~19.39FPS / p95 67.9ms, 360x640 ~20.28FPS / p95 66.6ms after backing-store adjustment. This is below 30 FPS target and requires device-specific capture/GPU profiling and potentially rendering architecture optimization. Do not declare LIVE readiness.
- Manual acceptance still required: TikTok LIVE Studio audio mix, 15-20 minute encode/capture, real device safe-area, and genuine TikTok comment/like/gift/reconnect. No production LIVE system or user save was modified.