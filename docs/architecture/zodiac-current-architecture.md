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
- `LegacyCompatibilityAdapter` owns pre-Job@5 routing and stage translation.
- `tools.runner` owns focused reusable primitives such as process control, package safety and PCM WAV handling.
- `tools/zodiac_local.py` retains compatibility entrypoints and re-exports moved primitives; it is no longer the owner of those helpers.

The Qt shell does not directly coordinate `StudioController` and `StudioV2Session` as parallel pipelines.

## Runtime versions

Runtime selection is owned by `runtime/releases/*.json` and `tools.runtime.registry`.

- `zodiac-renderer` current: `2.0.1`; imported Job@5 package pins remain authoritative when supported.
- `zodiac-remotion` current: `1.21.0`; legacy default remains `1.20.0` through registry metadata.
- Unknown runtime IDs or versions fail closed.
- Historical runtime source is not deleted while reverse-dependency audit reports active consumers.

Run `tools.runtime.audit.audit_runtime_references()` before any runtime source pruning.

## Contracts

Root `contracts/` schemas are canonical. `contracts/manifest.json` records ownership. Public schemas needed by the plugin are generated into the plugin bundle with `tools/contracts/generate_plugin_bundle.py`; `generated-manifest.json` records canonical hashes and CI rejects drift.

## Tests and CI

The former `tests/test_zodiac_local.py` monolith is a compatibility aggregator. Domain cases live under `tests/zodiac_local_cases/` and preserve historical unittest import paths.

CI jobs are grouped by responsibility:

- `smoke-renderer`
- `unit-python`
- `contract-control-plane`
- `integration-*`
- `compatibility-runtime` matrix
- `release-plugin`

The compatibility matrix keeps all registered Remotion versions and version-specific golden fixtures without duplicating whole workflow jobs.

## Historical material

Older audit/spec/refactor documents remain useful provenance but do not override this document, the current skill, runtime registries or canonical contracts. See `docs/historical-guidance-index.md` and `docs/historical/index.md`.
