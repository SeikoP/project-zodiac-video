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
