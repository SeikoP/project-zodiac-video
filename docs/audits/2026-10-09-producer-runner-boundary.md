# Producer / Runner Boundary Audit — 2026-10-09

Source of truth for producer: SeikoP/video-pipelines v2.3.1 + S0/S1/S3 cleanup PR #17.
Runner baseline: main at 39d8932849463f01fe8d6ba8f3ef0dbd27bc520b.
No Plugin Creator sync before completed E2E release criteria.

## Verified source-level ownership
- Producer Phase 01: evidence, Character-only Story Spine, Narration, Content Review.
- Producer Phase 02: Visual Grammar V4, native assets, semantic events, Publish Prep.
- Producer Phase 03: Job@5 Assemble, schema/semantic QC and canonical ZIP.
- Runner: ZIP import/preflight, measured voice/timing and audio mix, Remotion renderer, video/cover export, GUI clipboard.
- Runner tests can verify publish.json/title/cover-hook/hashtags survive output copying, but do not establish that the rendered cover is visually readable.

## New regression fixture
tests/test_publish_v231_producer_runner_parity.py checks:
1. Existing approved SEO title, cover hook, caption, layered hashtags and copy file survive the OUTPUT step unchanged.
2. GUI clipboard presents caption + hashtags without technical key/value labels.
3. Legacy packages without optional SEO title remain supported.
The cover and MP4 used in tests are intentionally synthetic placeholders. This is NOT a visual or audio E2E pass.

## Pending L3/L4
- Import producer-generated Golden Bọ Cạp and Song Ngư Job@5 archives.
- Run real TTS, Remotion, cover PNG, subtitle and audio QA at actual timestamps.
- Check identity continuity, banter-only environment suppression, event releases, spatial/contact semantics, captions, title/metadata and audio ending.
- Record artifact hashes and frame/audio sample references in an E2E receipt. No manual or fabricated PASS.
