# Editing workbench execution

Plan: `docs/superpowers/plans/2026-11-22-studio-editing-workbench.md`.
User authorized implementation after review; first delivery is scene-based editing with measured duration/order preserved. Existing dirty source was snapshotted in the ignored plan workspace.

## Task 1 — measured timeline model

New pure timeline mapping rejects invalid/overlapping/duplicate intervals, respects unequal scene lengths and real gaps, and maps final endpoint correctly. `WorkbenchSelection` defines shared project/scene/object/time state.

Verification: test first failed because timeline module was absent, then `node --test tests/studio_episode_timeline.test.mjs` passed 3/3; `pnpm.cmd -C apps/zodiac-studio exec tsc --noEmit` passed.

Ruling: wire App/editor selection in Task 2 alongside the shell, keeping this task a self-contained pure model; old App/VisualEditor contain pre-existing dirty changes and are preserved until that integration.

Human listening/visual/video gates remain PENDING. Full native E2E has not yet been rerun.
