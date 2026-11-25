# Production readiness check (2026-11-25)

Branch `experiment/main-2`. Evidence from this run:

| Check | Result |
|---|---|
| `pytest tests/test_studio_*.py` | 608 passed, 121 subtests |
| `node --test tests/studio_*.test.mjs` (15 files) | all pass (after fixing stale phone-contrast test) |
| `tsc --noEmit` (apps/zodiac-studio) | clean |
| `vite build` | built in ~1.6 s (one chunk >500 kB warning, `@hyperframes` bundle) |
| `cargo check` (src-tauri) | pass after installing Windows SDK 10.0.22621 |
| Playwright browser suites (8 files, local Chromium) | all PASS; 4 were stale after the UI refactor and were updated |

## Changed in this pass
- Visual review gate now refuses confirmation sooner than 10 s after the preview was opened
  (`PIPELINE_PLAYBACK_TOO_SHORT`, `review.py`; tests set `ZODIAC_REVIEW_MIN_SECONDS=0`).
- GUI: card-in-card removed from Quy trình, Kế hoạch, episode bar, timeline.
- GUI: export step is two-column; a vertical MP4 no longer pushes the copy/approval controls off screen.

## Still open before release
- Autopilot has an agent only for `visual`; assets/cover/publish/inspect are deterministic drafts (publish copy needs editing).
- Only the scene-experience validator runs for real; others are SKIPPED/BLOCKED in Studio workspaces.
- TTS is sequential (~3 s/unit).
- Human gates (voice listening, visual review, export approval) remain PENDING; release build, installer and publication need explicit authorization.
