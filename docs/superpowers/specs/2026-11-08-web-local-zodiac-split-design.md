# Web/Local Zodiac split design

## Intent

Split the current Zodiac producer experience into two separately installable plugin distributions while keeping one canonical implementation and one contract set.

- **Web plugin** owns Phase 01 only: evidence, concept, narration, Video Lab/Humanizer review, Content Review, and export of an immutable Phase-01 handoff capsule.
- **Local plugin** owns import/verification of that capsule, Phase 02, Visual Review, Phase 03, and delivery of the final Job@5 ZIP into the repository `ready/` directory consumed by the existing LocalRunner/Studio.
- The user experience on local is: copy one Phase-01 ZIP into `phase1-done/`, invoke the local plugin, and the agent determines whether to resume an existing processing workspace or claim/import a new capsule.

## Goals

1. No dependency on Web chat history after Phase 01.
2. Preserve genuine Content Review and exact source hashes across the host boundary.
3. No duplicate schema implementations between Web and Local.
4. Local invocation is zero-configuration when run from the repository root.
5. Local crashes/restarts resume from persisted state without importing the same capsule twice.
6. `ready/` receives only a validated Job@5 ZIP via atomic publication.
7. Existing Studio/LocalRunner continues reading `ready/` without a new package format.

## Non-goals

- Do not split the development repository.
- Do not duplicate the canonical Zodiac implementation into two forks.
- Do not move TTS, timing, Remotion, MP4, or LocalRunner responsibilities into the producer plugin.
- Do not use Git branches or GitHub commits as episode transport.
- Do not auto-start a background watcher/daemon.
- Do not permit Local Phase 02/03 to rewrite approved Phase-01 narration.

## Distribution model

Canonical source remains under `plugins/zodiac-video-pipeline/`.

Two release profiles are built from that source:

- `zodiac-video-web`: entry skill exposes Phase 01 and handoff export.
- `zodiac-video-local`: entry skill exposes local bootstrap, Phase 02 and Phase 03.

Both archives carry the same shared contracts and implementation bytes required for validation. Initial split optimizes authority and entrypoints, not archive size; source filtering can be tightened later without changing the episode contract.

## Queue layout

When the local plugin is invoked from the project root, its default queue root is that directory:

```text
phase1-done/              # immutable inbox ZIPs
processing/<run-id>/      # claimed episode + live authoring workspace
blocked/<run-id>/         # failed import receipts and rejected capsule copy
ready/                    # validated Job@5 ZIPs, already consumed by Studio
```

`ZODIAC_QUEUE_ROOT` may override the root for another machine layout.

No background service is required. Each local-plugin invocation performs bootstrap.

## Phase-01 handoff capsule

Format: `zodiac-phase1-handoff@1`.

Root entries:

```text
HANDOFF.json
narration.txt
narrative-plan.json
episode-scope.json
writer-brief.json
pipeline-state.json
content-review-receipt.json
plugin-use-decisions.json
validator-receipts/*.json
SHA256SUMS
```

The exporter is allowed only when:
- Phase 01 is PASS.
- Content Review is APPROVED with genuine `user_message` proof.
- source-bound approval hashes match current narration/plan/scope/brief.
- Phase-02 entry gate returns `ENTRY_READY`.
- Phase 02 has not been activated.

`HANDOFF.json` contains run ID, contract version, plugin version, sign/concept metadata when available, source hashes, file inventory and hashes, and `not_an_approval: true`. The approval itself remains the source-bound review receipt.

The ZIP contains no Phase-02 assets, visual intent, renderer source, node_modules, timing, audio, or chat transcript.

## Local bootstrap and claim

Invocation order:

1. If one `processing/*` workspace is unfinished, resume it.
2. If multiple unfinished processing workspaces exist, pick the most recently touched one only when exactly one is marked active; otherwise report `LOCAL_MULTIPLE_ACTIVE_EPISODES` and list candidates.
3. If no active processing workspace exists, scan regular non-symlink `*.zip` files directly under `phase1-done/`, oldest mtime first.
4. Verify the selected capsule fully before mutation.
5. Claim by atomic rename into a temporary processing directory on the same filesystem.
6. Materialize the authoring workspace and map capsule files back to canonical locations.
7. Validate imported Phase-01 state and source-bound approval.
8. Run Phase-02 entry gate and `activate-phase02.mjs`.
9. Return the same bounded `resume-brief --context` task used by the existing pipeline.

A failed capsule is never edited. It is moved into `blocked/<run-id>/` with `import-receipt.json` and the original ZIP.

## Compatibility

The handoff contract has its own major version. Web and Local plugin versions may differ if both declare support for handoff major 1.

Local rejects:
- unsafe ZIP paths or duplicate/case-colliding entries;
- unknown required entries;
- missing/changed SHA inventory;
- invalid JSON;
- a non-PASS Phase 01;
- missing/generic/fabricated Content Review proof;
- approval source drift;
- an already activated Phase 02 handoff;
- unsupported handoff major.

No silent fallback to repository `main` or another episode.

## Phase 03 delivery

The existing `run-phase03-production.mjs` remains the single producer export path.

The local wrapper supplies a private staging output directory. Only after the Phase-03 runner reports `PRODUCTION_READY_ZIP` and the produced archive passes the existing Job@5 validator is the ZIP atomically renamed into repository `ready/`.

Existing ZIPs are never overwritten. A name collision is a hard error.

LocalRunner/Studio is unchanged.

## Backup and rollback

Baseline 2.7.16 is preserved on branch `backup/zodiac-2.7.16`. The installed release lineage remains recorded in `docs/zodiac-plugin-release.json`; release archives are reproducible from the pinned source.

## Approaches considered

1. **Two independent codebases/plugins.** Rejected: duplicates schemas and creates version drift.
2. **Shared monorepo with two distribution entrypoints.** Selected: clear host authority while preserving one implementation.
3. **One plugin plus mode switch.** Rejected for UX: the user explicitly wants separate Web and Local installs, and host capabilities differ materially.

## Success criteria

- Web exporter produces a deterministic valid handoff from a real Phase-01 PASS fixture.
- Tampered capsule is rejected before workspace activation.
- Local bootstrap imports a capsule from `phase1-done/`, moves it to `processing/`, activates Phase 02 exactly once, and resumes on a second invocation.
- A successful Phase-03 fixture publishes exactly one Job@5 ZIP into `ready/`.
- Both plugin distribution archives build deterministically and contain the correct entry skill.
- Full repository CI passes.
