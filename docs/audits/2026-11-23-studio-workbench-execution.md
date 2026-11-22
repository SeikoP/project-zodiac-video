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
