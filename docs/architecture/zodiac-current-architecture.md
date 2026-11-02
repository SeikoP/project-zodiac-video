# Zodiac current architecture

Status: current architecture reference after the 2026-10-12 maintainability refactor.

## Production boundary

The system keeps one producer/runner boundary: `zodiac-job@5`.

- The plugin owns content, visual authoring, selected assets, structural validation, review evidence and Phase 3 package sealing.
- The local runner owns measured TTS, timing, audio, Remotion execution, MP4 output and media QA.
- Structural validation never implies creative, visual, audio or media approval.

## Plugin control plane

Fresh execution starts from `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/SKILL.md` and `bootstrap/current-policy.json`.
Release-history notes are provenance, not active prompt policy. `bootstrap/capabilities.json` is the fail-closed capability registry; phase manifests remain the execution contract and `plan-step-context.mjs` selects bounded context for the current step.

Compatibility guidance is loaded only when explicitly selected. Fresh Phase 2 does not auto-load legacy room/window/furniture cues.


## Plugin executable ownership

Executable plugin code has explicit semantic owners:

```text
skills/zodiac-video-pipeline/
├─ bootstrap/        current policy + capability registry
├─ core/             policy, state, evidence, schema, release, audit, model
├─ features/         episode, narration-performance, story-object, scene-set,
│                    visual-composition, cover, ending, meme, publish
├─ phases/
│  ├─ phase01/       current content execution/commit implementation
│  ├─ phase02/       current visual execution/seal implementation
│  └─ phase03/       current Job@5 compile/export/handoff implementation
├─ compat/           pre-Job5 production and true migration compatibility
└─ orchestration/    public routers, context planners and thin forwarding wrappers
```

Internal current-path imports resolve to owner modules rather than depending on the flat orchestration root. Active phase manifests use canonical owner paths. Old orchestration CLI paths remain thin forwarding wrappers only where compatibility is still required.

Fresh phase and feature modules are statically prohibited from importing `compat/`. Current Job@5 modules whose names contain `v2` remain under the current Phase 3 owner and are not treated as legacy merely because of the suffix.


## Asset framework

Asset V4 is capability-driven and compile-on-use.

- `capability-index.json` maps scene, cast, interaction and semantic-effect capabilities.
- `coverage-matrix.json` shows which narrative needs are currently supported.
- Fresh scene sets are registered in `scene-set/index.json`; scene accents are optional and wall-contained.
- Story Objects remain episode-authored semantic mechanisms, not a canned one-object-per-sign library.
- Character identity stays stable; new state SVGs are created only for performed actions that require them.

## Local application and runner

`tools.application.service.ApplicationService` is the application boundary used by the Qt shell.

- Job@5 is the primary current path.
- Packages that are not `zodiac-job@5` are rejected with a clear message; the v1/v3/v4 path (Remotion 1.x, `StudioController`, the compatibility adapter) was removed.
- `tools.runner` owns focused reusable primitives such as process control, package safety and PCM WAV handling.
- `tools/zodiac_local.py` now only holds shared voice/alignment/music helpers used by `tools.studio_v2`; it has no CLI.

The Qt shell drives a single pipeline (`StudioV2Session`).

## Runtime versions

Runtime selection is owned by `runtime/releases/*.json` and `tools.runtime.registry`.

- `zodiac-renderer` current: `2.0.1`; imported Job@5 package pins remain authoritative when supported.
- `zodiac-renderer` versions: `2.0.1` (current) and `2.0.2` (stepped-motion candidate). `zodiac-remotion` 1.x was removed.
- Unknown runtime IDs or versions fail closed.
- Historical runtime source is not deleted while reverse-dependency audit reports active consumers.

Run `tools.runtime.audit.audit_runtime_references()` before any runtime source pruning.

## Contracts

Root `contracts/` schemas are canonical. `contracts/manifest.json` records ownership. Public schemas needed by the plugin are generated into the plugin bundle with `tools/contracts/generate_plugin_bundle.py`; `generated-manifest.json` records canonical hashes and CI rejects drift.

## Tests and CI

CI jobs are grouped by responsibility:

- `smoke-renderer`
- `unit-python`
- `contract-control-plane`
- `integration-*`
- `release-plugin`

## Historical material

Older audit/spec/refactor documents remain useful provenance but do not override this document, the current skill, runtime registries or canonical contracts. See `docs/historical-guidance-index.md` and `docs/historical/index.md`.