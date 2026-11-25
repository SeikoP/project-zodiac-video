# Studio production graph — verification audit (2026-11-25)

Plan: `docs/superpowers/plans/2026-11-25-studio-production-graph.md`. Nothing is committed (git unusable in the VM).

## Commands and results
- Python (device VM): `tests/test_studio_pipeline_*.py`, `test_studio_p1_rpc.py`, `test_studio_project_evidence.py` → 158 passed, 18 subtests passed.
- Node (device VM, `node --test`): studio_pipeline_layout 18/18; studio_episode_timeline 3/3; studio_ideas_prompt 3/3; studio_p5_assets 6/6; studio_visual_migration 4/4; studio_hyperframes_caption_contract 2/2; studio_p34_visual first two tests pass, the rest (real builds) timed out at the 40–170s limit — NOT COMPLETED; studio_hyperframes_export timed out at 40s — NOT COMPLETED. Neither touches pipeline code.
- TypeScript 5 typecheck: clean (device VM).
- Browser tests (`studio_pipeline_browser`, workbench, compact layout): ran only in the cloud scratch copy with Chromium/Playwright.
- NOT RUN: `pnpm build`, Rust/cargo compile of `lib.rs` allowlist, Tauri smoke, `git diff --check`.

## Known failures not caused by this work
`test_studio_ci::test_windows_checkout_preserves_hash_bound_library_art` (git in VM); `test_studio_p1_tauri_host` minWidth 800 vs 1060; `studio_ideas_browser` MP4-approval checkbox (fails on original code too).

## Gaps
Task 12 (VisualEditor split) deferred. Autopilot agent exists only for the `visual` node; checks repair/assets/cover/publish/inspect return blocked NeedsYou. Only scene-experience validator runs for real; others report BLOCKED `VALIDATOR_PREREQUISITE_MISSING`. Visual review playback proof has no minimum watch time. CSS consolidation skipped.

## Human gates
Content, voice listening and visual/video review remain PENDING. No code path creates an approval.

Final review: self-review (no subagent tool).
