# Zodiac Plugin Release Process

The normal Zodiac release flow is **main-native**. Do not create temporary `release/zodiac-*` branches to trigger GitHub Actions.

## Plugin archive

1. Change the plugin version in:
   - `plugins/zodiac-video-pipeline/plugin.json`
   - `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
   - `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`
2. Merge that version bump into `main`.
3. `.github/workflows/zodiac-plugin-release.yml` runs automatically from the merged `main` commit and uploads the plugin archive.
4. Install/update the ChatGPT plugin from that archive and record the resulting release ID.

## Phase-scoped execution bundles

1. Update `docs/zodiac-plugin-release.json` with the installed plugin version, release ID and plugin source commit.
2. Merge the release-record update into `main`.
3. `.github/workflows/zodiac-source-bundle.yml` runs automatically on `main`.
4. The push-triggered workflow matrix builds exactly:
   - `01-content`
   - `02-visual-production`
   - `03-handoff`
5. Verify provenance, SHA-256 inventory and execution preflight for all three artifacts.

## Manual recovery

Both workflows keep `workflow_dispatch`.

- Plugin archive manual dispatch rebuilds the archive from the selected commit/ref in GitHub Actions.
- Phase bundle manual dispatch accepts one phase and builds only that phase.

Manual dispatch is for recovery/diagnostics. It is not a reason to create a release transport branch.

## Branch hygiene

Release transport branches are not part of the release contract. A normal release must not leave a branch whose only purpose is to trigger Actions.

If a historical transport branch exists, preserve release evidence in GitHub Actions artifacts and `docs/zodiac-plugin-release.json`, then make the obsolete branch identical to current `main` (or delete it through normal repository maintenance tooling when available). Never rewrite `main` to clean a release branch.

## Invariants

- Installed plugin release ID must match `docs/zodiac-plugin-release.json`.
- Bundle provenance must identify the source commit recorded for the installed plugin.
- Plugin archive and phase bundle creation do not imply creative approval.
- Phase 1/2 review artifacts remain non-ZIP user surfaces; Phase 3 owns the final Job@5 ZIP.
