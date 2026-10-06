# Render Pipeline Audit — preparation for correctness and performance work

Baseline reviewed: `main@b75ca2e504ef999d114c5fd4ac02c23c2a4208e6`

Purpose: establish one source-of-truth map before changing FPS, cache strategy, renderer lifecycle, or Studio invalidation. This document intentionally separates **correctness blockers** from **performance work** so optimization does not hide broken contracts.

## Executive summary

The repository is not ready for a production-FPS change yet.

Current priorities:

- **P0 correctness**
  - main still lacks the post-merge renderer font-readiness fix proven by a real frame-0 Remotion failure;
  - main's TypeScript compatibility repair only targets `Root.tsx` and `ZodiacComposition.tsx`, while `ZodiacCover.tsx` is also a `production.json` consumer;
  - CI is permanently red because three baseline tests are environment/stale-contract failures;
  - there is still no real renderer smoke test in CI, so static/package tests can pass while Remotion fails at frame 0.
- **P1 architecture/performance**
  - FPS is part of the creative/runtime contract instead of a render profile;
  - motion and transitions are frame-count based, so changing 30→24 changes animation duration unless values are migrated;
  - there is no artifact-level render fingerprint/cache graph;
  - importing/replacing a job deletes job-local `renderer/node_modules`, causing repeated install cost on otherwise compatible renderer packages;
  - prepare work is coarse-grained: style compile + package validation + renderer tests + TypeScript are rerun together.
- **P2 UX/observability**
  - Studio can resume by pipeline step, but does not explain which artifacts are reusable and why;
  - no per-stage elapsed-time metrics exist, making render optimization guesswork;
  - README still documents a pre-`PACKAGE_PUBLISH` pipeline and no longer matches main.

The recommended production target remains **1080×1920 @ 24 fps**, but only after time semantics and runtime retiming are made FPS-safe and benchmarked against 30 fps.

---

## 1. Source-of-truth map

| Contract / artifact | Current owner | Derived / runtime consumer | Audit result |
| --- | --- | --- | --- |
| narration text | `production.json scenes[].voice` | `narration.txt`, TTS, alignment | canonical serializer exists |
| style token | `design.md` | compiled `production.visual_system.style_token` | hash + caption lock validated |
| visual states/events | `production.json` | editor + Remotion | validated, but real render lifecycle is under-tested |
| FPS | `production.video.fps` | `.runtime/timing.json`, Remotion metadata | **too tightly coupled** |
| word timing | measured alignment | `.runtime/timing.json` | milliseconds + frame boundaries mixed in one file |
| renderer source | package `renderer/` | Studio local runtime | source can still require compatibility repair |
| cover | `publish.json` + production scene states | `ZodiacCover` | publish contract present |
| final publishing | Studio | video + cover + publish files | `PACKAGE_PUBLISH` exists in code, README stale |
| background music | local runtime | FFmpeg post-mix | optional in code, stale test expects bundled binary |

Rule for future work: **the plugin must ship canonical renderer code that already passes; Studio compatibility patches are legacy recovery only, never the primary implementation.**

---

## 2. P0 correctness findings

### P0-1 — font readiness race is absent from main

Observed real runtime failure:

`measureText(... validateFontIsLoaded: true)` is called while Be Vietnam Pro is not yet available.

`delayRender()` alone does not prevent React from executing `SceneView` / caption pagination before the font-loading effect completes.

Required fix:

1. renderer exposes a `fontReady` state;
2. await `document.fonts.load(...)`;
3. await `document.fonts.ready`;
4. verify `document.fonts.check(...)`;
5. do not mount scene/caption layout until `fontReady`;
6. only then `continueRender()`.

A post-merge branch contains this repair, but `main` does not.

### P0-2 — TypeScript compatibility coverage is incomplete on main

`_patch_renderer_typescript_compatibility()` on main scans only:

- `src/Root.tsx`
- `src/ZodiacComposition.tsx`

`ZodiacCover.tsx` also imports `production.json as Production` and has already produced TS2352 in a real job.

Required rule: every current/future `production.json` consumer must either ship `as unknown as Production` canonically or be detected generically. A filename whitelist is fragile.

### P0-3 — no real Remotion smoke test

Current GitHub Actions only runs:

- Python compile;
- Python unittest discovery.

It does not install/run a minimal current renderer package. This allowed all package/static tests to pass while rendering failed at frame 0.

Required smoke-test target:

- minimal fixture package;
- `npm ci/install`;
- `npm run typecheck`;
- renderer package tests;
- render **at least frame 0 or a tiny 2–3 frame composition** using the actual font/caption path;
- cover still render.

This test should not run TTS or Whisper.

### P0-4 — CI main is permanently red

Current main run #54: **224 tests, 3 failures/errors**.

1. GUI test creates `tk.Tk()` on headless Linux → no `$DISPLAY`.
2. POSIX subprocess-tree cancellation test leaves the child alive and times out.
3. test requires `assets/music/background.mp3`, while runtime explicitly treats bundled music as optional if absent.

These failures hide regressions because red CI is normalized.

Recommended fixes:

- separate GUI tests and run them under Xvfb, or keep pure UI-state tests headless;
- fix POSIX test/process-group ownership rather than extending timeout;
- make the test match product behavior: bundled music is optional unless the repository intentionally commits a licensed track.

### P0-5 — README/code drift

README currently shows:

`... PREPARE_RENDERER → RENDER_VIDEO → MIX_MUSIC`

but code has:

`... PREPARE_RENDERER → RENDER_VIDEO → MIX_MUSIC → PACKAGE_PUBLISH`

README also says the local runner no longer patches `ZodiacComposition.tsx`, while main still applies renderer compatibility patching.

Documentation must be updated only after P0 code is settled.

---

## 3. Current performance model

Real cold-run evidence from the current Virgo job:

| stage | observed |
| --- | ---: |
| Chrome Headless Shell download | ~15.9 s |
| Remotion bundle | ~60.8 s |
| public dir copy | ~28.2 s |
| requested video | 3552 frames |
| render result | failed at frame 0 due font race |

The failure occurred before useful frame throughput could be measured, so **there is not yet enough evidence to claim the exact speedup from 24 fps**.

At equal duration:

- 30 fps → 3552 frames;
- 24 fps → about 2842 frames;
- theoretical frame-count reduction ≈ 20%.

This will only translate cleanly to runtime reduction after fixed costs (bundle/copy/encode) are measured separately.

---

## 4. FPS / timing audit

### Current behavior

`build_timing_from_word_alignment()` reads:

`fps = production["video"]["fps"]`

and writes:

- scene `start_frame`;
- scene `duration_frames`;
- `total_duration_frames`;
- word timestamps remain in milliseconds.

`validate_timing()` requires:

`timing.fps == production.video.fps`.

Therefore FPS is currently both a creative contract and a runtime/rendering property.

### Why a direct 30→24 edit is unsafe

Many motion values are authored as `duration_frames`.

Example:

- 12 frames @ 30 fps = 400 ms;
- 12 frames @ 24 fps = 500 ms.

So changing FPS without migration changes animation pacing by 25%.

### Target architecture

Semantic timing should be time-based:

- voice / word timing → milliseconds;
- motion duration → milliseconds;
- transition duration → milliseconds;
- render profile converts milliseconds to frames.

Formula:

`frames = round(duration_ms × fps / 1000)`.

Recommended render profiles:

- production: 1080×1920, 24 fps;
- preview: same composition geometry with render scale, optionally 18–20 fps after FPS-safe timing exists.

Do **not** implement a preview FPS override before timing/motion migration.

---

## 5. Cache / invalidation audit

### What already works

Studio has useful coarse pipeline resumability:

- scene-level TTS checkpoints;
- voice/timing retained across transform/anchor edits;
- music only invalidates mix/publish;
- final publish is a separate step.

This is worth preserving.

### Missing layer: artifact fingerprints

Current state is step-status based. It does not record enough hashes to prove that an expensive artifact is reusable.

Needed fingerprints:

- creative package / production hash;
- renderer source hash;
- renderer dependency hash;
- design token hash;
- asset tree hash;
- voice hash;
- measured timing/alignment hash;
- render-profile hash;
- cover/publish hash;
- music configuration hash.

Target behavior:

| change | expected work |
| --- | --- |
| publish caption/hashtags only | publish copy/bundle only |
| cover hook only | cover + publish bundle |
| background music only | FFmpeg mix + publish bundle |
| one asset / transform | render video + cover as needed |
| renderer source | prepare + render, keep voice/timing |
| FPS profile | retime frames + render, keep TTS/ASR |
| narration scene S03 | TTS/alignment from S03 + downstream |
| unchanged retry | no prepare/install work; render only failed output |

### Job replacement currently destroys reusable dependency state

Package conflict import validates a scratch job and then removes/replaces the existing job directory. Since renderer dependencies are job-local, `renderer/node_modules` is lost.

Optimization options, in preferred order:

1. shared dependency cache keyed by renderer package/dependency hash;
2. preserve/relink compatible node_modules across package replacement;
3. at minimum use a shared npm cache and a lockfile.

Do not copy stale `node_modules` blindly between different renderer hashes.

---

## 6. Prepare/render audit

Current `prepare_renderer()` performs:

1. runtime validation;
2. dependency presence/install;
3. style compile;
4. package + publish validation;
5. compatibility source patch;
6. renderer tests;
7. TypeScript typecheck.

This is correct for safety but coarse for repeat runs.

Target split:

- `PREPARE_DEPS` / dependency fingerprint;
- `COMPILE_STYLE` / design+production fingerprint;
- `CHECK_RENDERER` / renderer source fingerprint;
- `RENDER_VIDEO` / production+assets+timing+renderer+profile fingerprint;
- `RENDER_COVER` / cover+reused visual+renderer fingerprint;
- `MIX_MUSIC`;
- `PACKAGE_PUBLISH`.

The GUI does not necessarily need to expose every internal cache substep as a row. They can remain internal cached operations with logs.

---

## 7. CI audit and proposed matrix

### Fast Python job

- compile Python;
- pure package/runtime/editor/studio unit tests;
- no Tk root creation;
- no network;
- no media binary requirement.

### GUI job

- Linux Xvfb;
- Tk construction/layout tests.

### Renderer smoke job

- Node version pinned;
- minimal real v2 package fixture;
- npm dependency cache;
- renderer tests;
- TypeScript;
- frame-0/tiny render;
- cover still.

### Platform cancellation job

Process-tree behavior is platform specific.

At minimum:
- Linux POSIX process-group test;
- Windows taskkill behavior tested separately if GitHub Windows runner cost is acceptable.

A test that does not launch the child in the same process-group arrangement used by production is not meaningful.

---

## 8. Observability required before performance claims

Add structured stage timings around:

- dependency check/install;
- style compile;
- contract tests;
- TypeScript;
- Remotion bundle;
- public copy;
- video frame render;
- encoding;
- cover render;
- audio mix;
- publish zip.

Persist e.g. `.runtime/performance.json`.

Each row should include:

- stage;
- elapsed_ms;
- cache_hit;
- input_fingerprint;
- output path;
- relevant profile.

Without this, FPS/cache tuning cannot be compared objectively.

---

## 9. Benchmark protocol

Use one fixed real package and run:

### Cold
- clean Remotion/browser/cache state;
- 30 fps production;
- 24 fps production.

### Warm
- second unchanged render at 30;
- second unchanged render at 24.

### Change scenarios
- publish text only;
- cover hook only;
- music only;
- one visual transform;
- renderer source only;
- FPS profile only.

Collect:

- total elapsed;
- per-stage elapsed;
- frames rendered;
- average ms/frame;
- peak memory if practical;
- output size;
- visual QA.

A 24-fps default is accepted only if motion QA remains acceptable and timing semantics are unchanged.

---

## 10. Priority backlog

### P0 — correctness / green baseline

- [ ] port post-merge `ZodiacCover` TypeScript compatibility coverage to main;
- [ ] port font-readiness guard to main;
- [ ] add font lifecycle regression test;
- [ ] add real renderer frame-0/cover smoke test;
- [ ] make CI green: Xvfb GUI / process-group cancellation / optional bundled music;
- [ ] sync README with actual 10-stage pipeline.

### P1 — measurable optimization

- [ ] add stage performance instrumentation;
- [ ] add artifact fingerprint model;
- [ ] shared renderer dependency/npm cache;
- [ ] cache prepare checks by renderer/design hash;
- [ ] separate video vs cover invalidation;
- [ ] support retiming from measured alignment without rerunning TTS/ASR;
- [ ] migrate semantic motion/transition durations away from raw frame counts;
- [ ] benchmark 30 vs 24 and then choose production default.

### P2 — UX

- [ ] show REUSED / DIRTY / NEEDS_RENDER per artifact;
- [ ] display cache hit/miss reason;
- [ ] expose current render profile;
- [ ] show last render elapsed time and output bundle readiness.

---

## 11. Proposed PR sequence

Do not mix correctness and FPS work.

1. **PR A — renderer correctness + CI baseline**
   - cover TS compatibility;
   - font readiness;
   - CI baseline fixes;
   - renderer smoke fixture.
2. **PR B — observability + artifact fingerprints**
   - no FPS behavior change.
3. **PR C — dependency/prepare cache**
   - shared dependency cache;
   - skip unchanged compile/test/typecheck safely.
4. **PR D — time-based motion + retiming**
   - introduce FPS-safe timing conversion;
   - preserve backward compatibility with frame-authored packages.
5. **PR E — render profiles**
   - benchmark-backed 24 fps production default;
   - low-cost preview profile.
6. **PR F — incremental video/cover/publish rendering**
   - cover-only / music-only / publish-only fast paths.

Each PR must add failing regression tests first and must not weaken package validation.

---

## 12. Exit criteria for optimization phase

Do not declare optimization complete until:

- main CI is green;
- a real renderer smoke test catches the font failure class;
- unchanged retry records cache hits instead of repeating prepare work;
- changing FPS does not change semantic animation duration;
- 24 vs 30 benchmark is recorded;
- Studio can explain why each expensive step is reused or rerun;
- plugin canonical renderer is synced **after** repo behavior is verified, not before.
