# Zodiac Plugin Release Process

The normal release flow is **main-native**. Do not create temporary release transport branches.

## Canonical version

One canonical version is maintained in:
- `plugins/zodiac-video-pipeline/plugin.json`
- `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`

The repository builds three archives from that source:
1. `zodiac-video-web` — the installable ChatGPT Web Phase-1 distribution.
2. `zodiac-video-local` — the installable ChatGPT CLI/local Phase-2/3 distribution.
3. the monolithic candidate — transition/rollback only, not the normal user entrypoint.

`.github/workflows/zodiac-plugin-release.yml` builds all three deterministically after the canonical version/source changes.

## Split plugin release lineage

After installing/publishing the Web and Local archives, record their release identities in `docs/zodiac-plugin-release.json` using `zodiac-plugin-release@2`:

```json
{
  "format": "zodiac-plugin-release@2",
  "plugin_version": "2.8.0",
  "source_commit": "<implementation commit>",
  "web_plugin": {"plugin_id": "<id>", "release_id": "<release>"},
  "local_plugin": {"plugin_id": "<id>", "release_id": "<release>"}
}
```

Phase-scoped source provenance resolves ownership as:
- `01-content` → Web plugin release.
- `02-visual-production` and `03-handoff` → Local plugin release.

Legacy `zodiac-plugin-release@1` remains supported for the 2.7.16 rollback baseline.

## Phase-scoped execution bundles

1. Merge the implementation/plugin archive commit to `main`.
2. Install/publish both split archives and obtain release IDs.
3. Commit the v2 release record to `main`, with `source_commit` pointing at the implementation commit.
4. `.github/workflows/zodiac-source-bundle.yml` builds exactly `01-content`, `02-visual-production`, and `03-handoff`.
5. Verify each artifact's distribution, release ID, source commit, SHA-256 inventory, and execution preflight.

Plugin archives and source bundles never imply Content Review or Visual Review approval.

## Episode transport

Web Phase 1 exports `zodiac-phase1-handoff@1`. The user copies the ZIP to local `phase1-done/`, then invokes `zodiac-video-local`. The local bootstrap verifies and claims it into `processing/`. After Phase 2 approval and Phase 3 validation, only the canonical Job@5 ZIP is atomically published into `ready/`.

Git is not episode transport.

## Manual recovery

Plugin and source workflows retain `workflow_dispatch`. Manual dispatch is for recovery/diagnostics only.

Rollback baseline 2.7.16 is pinned by `backup/zodiac-2.7.16` and `docs/backups/zodiac-2.7.16.json`.

## Invariants

- Web owns Phase 1 and never activates Phase 2.
- Local owns imported handoff + Phase 2–3 and never rewrites approved narration.
- Phase source bundles must match the release ID of the distribution that owns that phase.
- `ready/` contains only validated Job@5 producer packages; LocalRunner still owns media runtime.
- Existing released ZIPs are never overwritten.
