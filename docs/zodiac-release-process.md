# Zodiac Plugin Release Process

The normal release flow is **main-native**.

## Canonical version

Keep one version aligned across:
- `plugins/zodiac-video-pipeline/plugin.json`
- `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`

The normal installables are:
1. `zodiac-video-web` — creative Phase 1.
2. `zodiac-video-local` — native Phase 2–3.
3. monolithic candidate — rollback/transition only.

## Web release

Web is intentionally lightweight. It packages the Web skill, creative Phase-1 guidance and the handoff contract only.

Web does **not** need:
- a phase-scoped execution source bundle;
- npm/runtime dependencies;
- native validators or compiler receipts;
- cache/performance modules;
- pipeline-state during authoring.

After Content Review, Web exports `zodiac-phase1-handoff@2` using host file tooling.

## Local release and execution source

Local remains the native producer. After publishing Web and Local, record the installed release IDs in `docs/zodiac-plugin-release.json`.

The release record maps native execution provenance only for:
- `02-visual-production` → Local release.
- `03-handoff` → Local release.

`.github/workflows/zodiac-source-bundle.yml` builds only those two native execution bundles. Legacy tooling may still understand a Phase-1 source bundle for rollback/recovery, but it is not part of the normal Web path.

## Episode transport

Web exports `zodiac-phase1-handoff@2` with:
- narration;
- Narrative Plan;
- Episode Scope;
- Writer Brief;
- Voice Profile;
- genuine Content Review proof;
- SHA-256 inventory.

Local verifies the capsule, reconstructs native pipeline state, activates Phase 2, and never rewrites approved narration unless content is explicitly reopened.

Legacy `zodiac-phase1-handoff@1` remains import-compatible.

## Invariants

- Web owns creative Phase 1 and never activates Phase 2.
- One explicit Content Review is the Phase-1 human boundary.
- Local owns native Phase 2–3 validation and production.
- Source transport never creates approval.
- `ready/` contains only validated Job@5 producer packages; LocalRunner owns media runtime.
- Existing released ZIPs are never overwritten.
