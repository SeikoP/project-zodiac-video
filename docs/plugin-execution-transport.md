# Runtime source transport and plugin release alignment

## Current invariant
The installed ChatGPT plugin is the workflow authority. GitHub `SeikoP/project-zodiac-video` is the implementation mirror; a ZIP of an episode is never an executable-source archive. Never claim Phase 01 E2E PASS from contract drafts.

## Required provenance checks
1. Read current installed plugin metadata/version/release ID, not just repository plugin.json.
2. Inspect `docs/zodiac-plugin-release.json` and `plugins/zodiac-video-pipeline/plugin.json`, `.codex-plugin/plugin.json`, `skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`.
3. If versions or release IDs diverge, stop with `SOURCE_INTEGRITY_MISMATCH`. Do not execute code from a different release, and do not automatically downgrade the installed plugin.
4. Find the exact source commit for the installed release; `main` alone is not pinned source.

## Transport (when matching release has been published)
- GitHub Actions workflow: `.github/workflows/zodiac-source-bundle.yml`.
- Builder: `tools/build_source_bundle.py`.
- Artifact: `zodiac-execution-source-<commit SHA>`; archive contains source, contracts, assets and `SOURCE-PROVENANCE.json`.
- Download via an authorized GitHub Actions artifact transport, stage an actual ZIP on the host filesystem, verify every declared sha256, safe paths and release identity, then extract into a new isolated directory.
- Reading a skill URL, GitHub API text response, or an artifact URL is *not* staging a ZIP on the execution filesystem.
- On missing transport: `SOURCE_TRANSPORT_UNAVAILABLE` (not validation PASS).

## Run order
```sh
node plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/execution-preflight.mjs <episode-workspace> 01-content
```
Follow the installed phase-01 manifest to execute Evidence, Concept, Narration compilers and validators, use `run-validator-with-receipt.mjs`, persist operations and run `commit-phase01-step.mjs` for each step. A new episode needs explicit Content Review before Phase 02. Never synthesize validator or user approval receipts.

## Publishing protocol
Update implementation and mirrored guidance in one reviewed commit, sync both plugin manifests and pipeline-state template to the same new version, publish the ChatGPT plugin, then record *actual* new release ID and source commit in `docs/zodiac-plugin-release.json`. Regenerate and verify the exact artifact. Re-run a clean Phase 01 smoke test. GitHub changes do not auto-update the installed plugin.

## Failure mode found 2026-10-13
A previous episode prep produced content contracts but could not run native validators because the required source bundle was not staged. Investigation must distinguish `unavailable local source`, `unavailable artifact` and `plugin/repository release mismatch`. None of these means the episode text is invalid.
