# Studio Editing Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open an episode into a legible video editing workbench with a large preview, whole-episode timeline and contextual tools.

**Architecture:** Reuse the Tauri/React host and Python Project Core. Introduce one frontend selection/playback owner and a derived measured episode timeline; preserve canonical VisualWorkspace commands, asset catalog and export pipeline.

**Tech Stack:** Existing React/TypeScript, Tauri/Rust, Python, HyperFrames SDK, V4 catalog and FFmpeg.

**Spec:** [Design draft](../specs/2026-11-22-studio-editing-workbench-design.md).

## Global Constraints

- PLANNED / DESIGN REVIEW PENDING; no product implementation in this planning task.
- Editor-style direction is confirmed; trimming/reorder scope remains unresolved. Proposed first delivery supports scene navigation/editing, not a free-form NLE.
- Preserve narration, selected voice, measured timings, identities, last good outputs and human approval evidence.
- Fit 1366×768, 1060×650 and 1093×614 without document scrolling; bounded timeline panning is allowed.
- No new renderer/shadow catalog, release, installer, production merge or publication.
- Preserve pre-existing dirty work. Each completed task records actual evidence, updates roadmap, explicitly stages scoped files/hunks, commits and pushes current branch after fetching/checking remote divergence.

## Review Focus

1. Missing project/audio/timing/visuals: useful next action, no fake preview.
2. Scene boundaries/gaps/end: accurate global/local time and one audio owner.
3. Source/voice changes during proposal/export: reject stale writes, retain last good output.
4. Unknown/retired/no-fit assets: visible reasons, no random props or invented licensed media.
5. Small windows/project switch/restart: valid selection, no hidden playback/duplicate polling/automatic approval.

## Baseline

Read [readiness audit](../../audits/2026-11-22-studio-workbench-readiness.md) and unified P0–P7 roadmap. Existing native E2E does not accept today's dirty renderer/frontend. Resolve the design and trimming decision before Task 1. Set `PLAYWRIGHT_MODULE` and `STUDIO_BROWSER` to installed local tools for browser checks; fixtures are not native acceptance.

### Task 1: Shared selection and measured episode timeline

**Files:** Create `apps/zodiac-studio/src/workbench-state.ts`, `episode-timeline.ts`; modify `App.tsx`, `VisualEditor.tsx`, `studio-navigation.tsx` in that directory. Create `tests/studio_episode_timeline.test.mjs`, importing the TypeScript helper via the installed Node's supported TS handling.

**Interfaces:** Consume `BuiltScene` (`id`, `start_ms`, `end_ms`) from `backend.ts`. Produce `TimelineScene = {id: string; startMs: number; endMs: number}`, `makeEpisodeTimeline(scenes: BuiltScene[]): TimelineScene[]`, `locateEpisodeTime(scenes: TimelineScene[], timeMs: number): {sceneId: string; localMs: number} | null`, and `WorkbenchSelection = {projectId: string; sceneId: string | null; entityId: string | null; timeMs: number}`. App owns selection; backend remains authoritative.

- [ ] Add failing tests: `maps_boundaries` (1000 ms boundary selects second scene/local 0), `rejects_overlaps_and_invalid_intervals`, `returns_null_in_gaps_or_empty`; final endpoint maps to final scene/local duration.
- [ ] Run `node --test tests/studio_episode_timeline.test.mjs`; verify intended failures.
- [ ] Implement mapping and shared selection; reset invalid targets on project/source change.
- [ ] Run timeline tests and `pnpm.cmd -C apps/zodiac-studio exec tsc --noEmit`; require zero failures.
- [ ] Record evidence, commit and push only this task after remote-tip checks.

### Task 2: Editor-first shell and empty states

**Files:** Create `apps/zodiac-studio/src/EditingWorkbench.tsx`; modify `App.tsx`, `studio-navigation.tsx`, `VisualEditor.tsx`, `style.css`; extend `tests/studio_compact_layout.mjs`; create `tests/studio_workbench_browser.mjs`.

**Interfaces:** Consume Task 1 selection and existing project/voice/visual state. EditingWorkbench owns layout/docks, not mutation APIs; existing VoiceLab, AssetGallery and EpisodeExport supply contextual workflows.

- [ ] Add failing browser assertions for direct editor opening, single preview, selected-object inspector, export action, three viewport sizes and actionable no-project/missing-timing/missing-source states; include project switching.
- [ ] Run `node tests/studio_workbench_browser.mjs` against the fixture transport; inspect expected failures.
- [ ] Implement header/docks/large preview/timeline region. Replace Entity/State labels with contextual Vietnamese; put hashes/logs/JSON in details. Preserve Ideas/progress and project selection access.
- [ ] Run workbench and compact browser checks, then `pnpm.cmd -C apps/zodiac-studio build`; require no page errors/document overflow. This is frontend verification, not release packaging.
- [ ] Record viewport evidence, commit and push scoped changes.

### Task 3: Whole-episode transport, voice and captions

**Files:** Create `apps/zodiac-studio/src/EpisodeTimeline.tsx`; modify `VisualEditor.tsx`, `EditingWorkbench.tsx`, `episode-timeline.ts`, `style.css`; extend Task 1/2 tests.

**Interfaces:** Consume global `timeMs`, measured intervals, real selected assembly and available caption/timing data. Produce `onSeek(timeMs: number)` and `onSelectScene(sceneId: string)` callbacks. One assembly audio/clock owner drives scene-local SDK seeks.

- [ ] Add failing tests for three unequal scene lengths, boundary advancement, pause/end/replay, preview failure, revision invalidation and hidden workspace; missing tracks remain explicitly absent.
- [ ] Run timeline/browser checks and verify intended failures.
- [ ] Implement ruler, scene blocks, measured voice/caption displays, bounded adjacent-scene preload and recoverable preview loading/error. Clamp seeking to episode duration; preserve real gaps. No competing per-scene audio. No trim/reorder without approved timing/source design.
- [ ] Rerun timeline/browser/TypeScript checks; verify no hidden or deselected-project audio continues.
- [ ] Record evidence, commit and push scoped task.

### Task 4: Contextual agent and explainable assets

**Files:** Modify `apps/zodiac-studio/src/AgentProposal.tsx`, `AssetGallery.tsx`, `VisualEditor.tsx`, `EditingWorkbench.tsx`; update health reporting in `tools/studio_project/agent_bridge.py`; extend `tests/test_studio_p1_agent.py`, `test_studio_agent_authoring.py`, `test_studio_p5_transport.py` and workbench browser checks.

**Interfaces:** Reuse `agent.author.start`, `agent.visual.start`, `agent.task(s)`, `agent.cancel`, `agent.apply`, `assets.describe`, `assets.gallery`, `assets.find_candidates` and existing edit/undo commands. Health distinguishes executable detection from authenticated live readiness and reports actual proposal kinds, without claiming a tool loop.

- [ ] Add failing assertions for accurate capability labels, catalog/no-fit reasons, source/voice drift, completed-vs-applied state, cancellation/reopen and rejected unsupported edits; no automatic approval.
- [ ] Run `python -m unittest tests.test_studio_p1_agent tests.test_studio_agent_authoring tests.test_studio_p5_transport -q` and browser test; verify intended failures.
- [ ] Place requests/proposals/apply beside selection; show actual resource previews/reasons and distinguish initial authoring from scene editing. Fix outdated health scope; retain bounded proposal architecture.
- [ ] Rerun focused checks and `node --test tests/studio_p5_assets.test.mjs`; verify unaffected scene/source/voice invariants after scoped edit.
- [ ] Record evidence, commit and push scoped task.

### Task 5: Native acceptance, media and restart

**Files:** Update `tests/studio_workflow_native.mjs`, `tests/studio_workflow_native_reopen.mjs`; register new checks in `.github/workflows/studio-v5-tauri-p1.yml` if needed; create execution-dated audit/phase-evidence JSON and update unified roadmap.

**Interfaces:** Visible controls and real native transport only. Keep media/runtime stores ignored; checked-in evidence records exact commands, versions, revisions, hashes and timings.

- [ ] Adapt native tests to new layout without API bypasses or approval clicks.
- [ ] Run approved import → real fresh TTS/ASR → initial agent/apply → scene edit/undo → episode playback → HyperFrames MP4 export/playback. Separately measure and label a reused-voice iteration; retain failed/cancelled receipts.
- [ ] Restart/reopen; verify project, selection, applied edit history and exact MP4. Probe/decode full video, compare voice/sidecar/cover hashes and inspect caption/boundary frames. Genuine user listening/visual review stays PENDING until received.
- [ ] Run affected final Python/Node/browser/native checks; report local results separately from remote CI and production acceptance.
- [ ] Record reproducible evidence, commit/push scoped work; do not close P5/P6/P7 independently unmet gates.

## Separate follow-ups

- P5: reviewed palettes/phone geometry/contact, complete meme compositions, reviewed model-level usage and incremental gallery index.
- P6: licensed playable BGM/SFX, complete media/package library and safe archive/restore.
- P7: Audio Mix V2/ducking/SFX/rights, audio-only remux invalidation, latest native E2E, genuine final review and explicit legacy-cover compatibility limits.
- Dynamic tool-using agent: separate installed App Server protocol spike; then define bounded read-only search/preview/validation calls and audit trail. Preserve confirmed canonical writes; no invented protocol or implicit plugin inheritance.

## Self-review and handoff

All five review-focus conditions map to Tasks 1–5. Shared signatures/ownership are explicit; no execution step is pre-marked complete. User review and trim/reorder choice remain required. Recommend native task-by-task implementation for these coupled UI changes, with independent final review when authorized.
