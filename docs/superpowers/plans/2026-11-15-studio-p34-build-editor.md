# P3 + P4 — Episode build and embedded visual editor

> **For agentic workers:** Use superpowers:executing-plans. Implement inline; one independent whole-branch review after implementation.

**Goal:** One native Studio workflow from canonical Visual Intent through incremental episode build to an editable HyperFrames preview, integrated into `experiment/main-2`.

**Architecture:** Keep Python Project Core as the command authority, existing Node V4 compilers/cache as the build owner, and pinned HyperFrames SDK as the embedded editing/preview surface. A canonical source transaction commits semantic changes; the generated DOM is disposable. Immutable build revisions preserve the last good output.

**Tech Stack:** Existing Python 3.11, Node, Tauri 2, React, pnpm, HyperFrames 0.9.45, V4 compiler and Remotion compatibility.

**Spec:** `../specs/2026-11-14-agent-native-creative-studio-design.md` and P3/P4 of `2026-11-14-unified-zodiac-studio-roadmap.md`.

## Global constraints and rulings

- The user's explicit instruction combines P3 and P4 into one delivery and supersedes the roadmap's separate phase PRs. Code the full workflow before the integrated test/fix cycle.
- Production main, approved narration/content evidence and selected voice bytes are immutable. No creative approval is inferred from compilation, preview or model output.
- One canonical Visual Intent source. Stable semantic scene/entity/state/event IDs and UTF-8 source ranges survive SDK round-trips.
- Reuse V4 compilers, semantic dependency graph, content-addressed objects and exact cache validation. Remotion remains available; HyperFrames preview does not certify renderer parity or production export.
- Native UI uses existing titlebar and transport. No release packaging, second app, duplicate asset library or new dependencies.

## Review focus

- Stale/replayed commands and interruption during source commit must not overwrite newer source or lose undo history.
- Asset URLs/SVG/scripts and imported paths cannot escape project/library roots or execute arbitrary user HTML in the native shell.
- Scene edits must retain acting states, actor identity, physical bindings, narration bytes and measured voice anchors; unsupported edits fail explicitly.
- Deep Windows paths, interrupted builds and tampered cache outputs must recover without replacing the last good preview.
- Theme-only edits must reuse geometry and voice/timing; incomplete episode inventories or missing exact anchors must be explicitly blocked.

### Task 1: canonical source and command owner

Files: `tools/studio_project/visual_workspace.py`, `service.py`, `rpc_stdio.py`, Rust allowlist, `backend.ts`.

Interfaces: `visual.open`, revisioned/idempotent `visual.command`, `episode.build`, `scene.compile`, `visual.cancel`, bounded `visual.preview`, `assets.describe`, `assets.find_candidates`, `validation.get`. Source replacement is explicit authoring, never approval. Commands share scene scope and events for human and agent callers.

- [x] Implement crash-recoverable canonical source transactions, immutable history, undo/redo, structural validation and conflict errors.
- [x] Connect managed asynchronous build/cancel lifecycle, stale source rejection, progress/events and latest verified artifact pointer.

### Task 2: shared compiler and constrained candidate resolver

Files: `tools/studio_project/visual_compiler.mjs`, `visual_candidates.mjs`, `visual_preview.mjs`.

Interfaces: source-bound Node manifest -> complete verified scene/asset inventory, measured anchors, source map, performance graph, resource/cache receipts and HyperFrames composition HTML. Separate geometry/appearance nodes; `scene.compile` uses the same engine/owner as `episode.build`.

- [x] Adapt existing Visual Intent/V4 character and prop compilers and semantic graph; verify source hashes and full inventory.
- [x] Implement bounded ready-node scheduling, cache verification and immutable atomic build publication; preserve old outputs on failure/cancel.
- [x] Add versioned theme/performance contracts and V4→V5 prop identity compatibility (phone pilot), role/contact constraints and source-backed prior-use profile.
- [x] Return up to three feasible scene bundles with fit/rejection reasons; missing art returns `NO_FIT_ASSET`, never an unrelated substitute.
- [x] Emit source-mapped HyperFrames preview from actual SVG/state/event/timing inputs; light/dark theme prototypes and technical readability/occlusion diagnostics.

### Task 3: complete embedded editor

Files: `apps/zodiac-studio/src/HyperframesWorkspace.tsx`, `backend.ts`, `App.tsx`, `style.css`, native CSP.

- [x] Replace skeleton with scene list, actual embedded HyperFrames SDK composition, SDK selection/edit bridge, state/entity inspector and measured timeline.
- [x] Support canonical source import, build/stop, validated move/resize/state/asset/theme changes, candidate inspector, undo/redo and last-good preview with revision/fidelity labels.
- [x] Use bounded native transport and sandboxed generated compositions; never persist arbitrary SDK HTML as canonical source.

### Task 4: integrated verification and delivery

Files: `tests/test_studio_p34_visual.py`, `tests/studio_p34_visual.test.mjs`, reproducible fixture/benchmark and phase evidence; Studio workflow/README.

- [x] Run all new P3/P4 tests together after implementation, then relevant P0/P1/P2/V4 compatibility regressions, frontend/native checks. Fix concrete failures.
- [x] Freeze a 6–10-scene fixture; measure cold/warm/scoped/shared-character/theme builds, resource use, tamper recovery and unchanged audio/source hashes.
- [x] Verify real Libra/Gemini/Scorpio states/props/reaction and native scene edit/voice reveal/theme/undo/reopen. Label synthetic data and human visual/listening acceptance honestly.
- [x] One fresh-context whole-branch review, fix important findings, focused PR merged into `experiment/main-2`, launch one app from merged source. Record reproducible evidence and remaining creative review separately.

## Final implementation rulings

The actual SDK T3 API and generated GSAP composition run on a private read-only origin. The Studio Player wrapper requires its own server and strips the origin from directUrl, so it is not embedded. This preserves canonical semantic ownership and native isolation.

Historical V4 source/assets are read-only compatibility fixtures; current synthetic fixtures use explicit current catalog IDs. Unsupported historical motion retains endpoint-only fidelity. Tests never grant creative approval.

The 8-scene service benchmark and the additional 48.56-second/244-word source benchmark measure visual build/cache behavior. The latter reuses exact existing ASR times after sequential source-token equality checks and uses a labeled synthetic visual fixture. Neither measures production authoring, TTS, ASR generation or final encoding. See the [acceptance receipt](../../audits/2026-11-15-studio-p34-acceptance.md).

Integration: PR #225 merged as `28e4f3f86160accd4db1201de0bb404f67ca60d6`. One app opened from the fast-forwarded `main-2` checkout; native edit/theme/undo/images passed again and the voice dropdown exposed `cuongdepzai` and `cuongdepzaiver2`, preferring `cuongdepzai`. Initial remote CI exposed missing Studio dependencies in Linux full discovery and Windows checkout line-ending conversion in byte-frozen fixtures; a focused follow-up installs locked dependencies and preserves exact fixture bytes. The unrelated plugin-native job retains its 40 baseline failures.
