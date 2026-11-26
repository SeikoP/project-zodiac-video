# Zodiac Studio V5 Phase 0: independent AI code review

**Target:** `experiment/main-2`, implementation commit `25e49338` (2026-11-14).
**Reviewer:** Codex CLI v0.167.1, GPT-6.1 Sol; **AI technical review, not human sign-off**.
**Source scope:** `tools/studio_project` P0.1–P0.4, reviewed against `origin/docs/studio-agent-native-refactor-spec-20261114`; correction commit independently reviewed.

## Review round 1: 3 concrete P2 findings

- **Import capsule TOCTOU:** caller-owned ZIP could be replaced after inspection, before materialization, causing a source-identity mismatch. Fixed with private temporary capsule snapshot covering all bridge operations and test `test_archive_swapped_after_inspect_uses_stable_snapshot`. TDD RED confirmed the bug; GREEN confirmed the correction.
- **Canonical narration precedence:** Python `resolve_episode_status` previously ignored `.authoring/narration.txt` when present, while the Node authority gives it priority. Replaced static source paths with the same ordered candidate resolution, plus a drift regression test.
- **Run identity drift:** `pipeline-state.json` and `studio-import-receipt.json` could change `run_id` while the read-only status still returned `APPROVED`. Both must now match the source-bound review receipt. Added two negative tests.

No imported narration, source approval, asset, or user review was changed by these corrections.

## Review round 2: correction commit

**Command:** `codex review --commit 25e49338`

**Verdict:** No actionable regressions found; snapshot pins bridge operations to one archive; status rejects source/run identity drift; independent reviewer ran **31 focused import and evidence tests PASS**.

## Integration verification (after correction)

- 21 regression groups / 176 tests PASS; full commands, exit codes and raw-log hashes recorded in `studio-p0-main2-regressions.json`.
- Existing approved Phase 1 v2 sources: two separate, source-bound handoffs exported without modifying original workspaces; importer reopened same project identity; injected crash recovered; Node Local bootstrap resumed Phase 2. See `studio-p0-real-source-smoke.json`.
- A historical real Job@5 package reopened through Studio V2 using source-audited fingerprint `d6af8a599324fcf68dd43fb1627a0dc23f9b3db07ba0874eeb8a86e5df1a43c0`, found at Git commit `9996ff30`. Current schema validation remains active and rejects the retired `story_symbol` role or arbitrary contract hashes.
- **Not tested:** end-to-end TTS, human voice listening approval, visual approval, complete MP4 render, publishing or V5 compiler. Those are not Phase 0 implementation claims.

The review confirms **Phase 0 technical readiness for experimental Phase 1 architecture work** only. It does not approve creative content or authorize a production release. The `main` branch and user-owned uncommitted files remain untouched.
