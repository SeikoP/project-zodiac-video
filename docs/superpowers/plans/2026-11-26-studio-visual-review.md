# Studio visual review implementation plan

> Execute inline using superpowers:executing-plans. User approved implementation.

**Goal:** Make visual review visible and playable, and quiet the editor toolbar.

**Architecture:** Existing EpisodeShell selects a dedicated ReviewInspector stage.
Reuse EpisodePlayer and the guarded pipeline review RPCs. No backend gate changes.

**Tech Stack:** React, TypeScript, CSS, existing Playwright fixture and pytest.

**Spec:** ../specs/2026-11-26-studio-visual-review-design.md

## Constraints and review focus

- Preserve dirty work; stage only this task and required playback dependencies.
- Review must remain visible with technical details closed and on small windows.
- A failed player/audio load must never enable approval.
- A new project, build, revision or gate status must discard the prior session.
- Review controls must survive whole-video playback; hidden editor must stop playback.
- Actual human visual/video approval stays PENDING.

## Task 1: Review and simplify the current GUI

- [x] Add browser regression: gate outside details, dedicated review stage, no token
  on opening, actual playback before token, changed build resets review.
- [x] Observe regression fail on current source.
- [x] Update StepList, EpisodeShell, ReviewInspector and EpisodePlayer. Move technical
  editor metadata/controls under the existing technical toggle. Update fixtures.
- [x] Run browser checks at 1366x768, 1060x650, 1093x614 and 800x960; build TypeScript;
  run pipeline store/layout unit tests and backend review tests.
- [x] Inspect real native GUI and current package without confirming approval.
- [x] Record actual evidence and limitations; fetch/check branch tip, scoped commit
  and push to experiment/main-2. Preserve all unrelated dirty work.

## Execution notes

Use a focused self-review; no implementation delegation is needed for this bounded
change. Existing local player/cache work may be a required dependency; inspect it
before including it. Native app is currently serving this checkout's Vite source.

Validation: 24 Node tests, 32 Python tests, three browser suites and native preview
passed. Full results and artifact hashes: docs/audits/2026-11-26-studio-visual-review.md.
