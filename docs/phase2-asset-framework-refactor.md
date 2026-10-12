# Phase 2 asset framework — implementation and acceptance

Source baseline: `main@d3c004d`, installed plugin `2.4.59`. Candidate version: `2.4.61`.

The earlier `codex/phase2-asset-framework-refactor` branch changed tracked files but omitted all new modules/registries from its patch. This revision retains those changes and supplies the missing executable source, canonical masters and regression fixtures.

## Implemented behavior

- Canonical scene-set registry promotes the two exact approved Gemini frame/wall/floor SVGs, with hashes, viewBoxes, transforms and wall/floor bounds. No redrawing. Fresh selection uses scene_set_id; scene accents are explicit and wall-contained. Character staging may overlap the frame. Compiler registration is late-bound after Character Assembly.
- Shot-layouts and actions have canonical taxonomy aliases; old frames/mechanics/profile paths remain readable. Room cues are compatibility-only and do not auto-decorate a selected scene-set. V3 migration is provenance-only.
- Story Object has one canonical authoring contract. Symbolic authoring kind/category/role project to existing native/Job@5 transport. Thought metaphors require an actor relation, without floor/contact; physical interaction uses a physical prop/contact. Object-only @2 progression remains valid. Structural checks cannot approve aesthetics.
- Selected dependency graphs include selected master bytes and used executable imports/contracts. Per-step lineage excludes environment masters from character compiler receipts. Legacy source retains the conservative full fingerprint.
- Preview receipts bind exact production, selected SVGs, Visual Intent and projection receipt hashes. Stale previews fail validation and the workspace finalizer supersedes them, preserving bytes. Approval state is never synthesized or silently rewritten.
- state_swap uses 12 authored frames by default. Explicit state_swap duration overrides use existing duration-named IDs; the current Python timeline lowers them to canonical state_swap and preserves exact start/end intervals. No renderer or Job@5 schema migration.
- Role-specific visual_identity_intent scopes reference_entity_id, silhouette_priority, reference_notes and component identity_lock. Preferred hair is a default tier; approved compatibility hair remains selectable. Native Character Assembly produces a same-canvas identity preview.

## Acceptance evidence

`gemini-clean-repro.test.mjs` starts without native character/scene-set SVGs or old receipts. It compiles Visual Intent, grammar, character assembly, canonical scene-set/accents, exact frame staging, symbolic progression, native endpoint preview and Job@5. Every entity state/transform matches the approved Gemini fixture; all native character bytes match its hashes. The fixture includes authored phone/metaphor source art, not generated package-local patches or forged approvals.

The unchanged canonical Job@5 schema and old ZIP fixture remain regression inputs. The Python timeline's existing alias test verifies 8/10/12-frame state-swap intervals. These are structural/import/interval tests, not actual video, voice or temporal-render approval.

## Cleanup decision

`phase2-asset-dependency-audit.json` reverse-scans plugin/runtime/tests/docs. All 24 compatibility environment assets remain referenced. No asset bytes were deleted. Runtime version pruning belongs to a separate repository-size change. Old classroom/window runtime fixtures are contract fixtures, not fresh visual references.

## Review and release boundary

Structural validation, human creative review and runtime media QA remain separate. A source release does not approve an episode or seal Phase 3. The regenerated Gemini acceptance fixture proves reproducibility; revised episode receipts must still satisfy the existing genuine Visual Review and Phase 3 seal gates.

## Plan closeout audit — 2026-10-12

| Plan area | Result and evidence |
| --- | --- |
| A taxonomy | Canonical scene-set/shot-layout/action manifests and compatibility aliases exist; no disruptive physical moves. |
| B fresh compilation | Clean Gemini reproduction matches entity transforms and native character hashes, compiles preview and Job@5 without local patches. |
| C Story Object | Canonical symbolic contract; thought metaphor stays distinct from prop/effect/accent; old plan@1 documentation explicitly compatibility-only. |
| D compiler hardening | Selected/per-step lineage, late registration, typed furniture matching, duration authority, stale preview binding/finalizer and scene-set-specific geometry checks covered by regressions. |
| E character identity | Role-specific reference locks, authored hair and silhouette, body diversity and same-canvas identity preview retained. |
| F cleanup | Reverse dependency audit: 24 referenced compatibility cues retained. Historical guidance indexed in docs/historical/index.md. Runtime-version deletion remains outside this change. |
| G distribution | PR #102 merged; plugin 2.4.61 and its source-bundle CI verified. Closeout 2.4.62 repairs the missing packaged scene-set entrypoint; selected-context regression catches missing mandatory guidance. |

The nine structural acceptance gates are covered by the clean Gemini regression, compatibility importer/renderer CI, selection/lineage tests, preview mutation tests and separate structural/creative/runtime receipt fields. Repeated approved scene-set geometry is exempt from legacy wallpaper diagnostics. Unselected extensions are omitted from selected authoring context and dependencies; compilation materializes selected masters only.

Episode creative review, real voice and temporal/media QA are not source-refactor completion gates that can be granted by tests. They remain real episode gates; no approval receipts or Phase 3 episode seal were fabricated. The source change preserves the existing handoff/seal/import regressions.

Ruling: keep referenced compatibility assets and old runtime versions; deleting them would break retained consumers. Cost: repository-size reduction is deferred. Explicit state_swap overrides retain the existing interval-preserving Job@5 alias transport; outdated runners must use the pinned supported runtime. No other outstanding source changes were identified by this closeout audit.
