# Phase 02 native scene-direction — isolated compilation (2.6.12)

This is the existing `scene_direction` step in `phases/phase02/phase02-execute.mjs` and does **not** add another phase or change approvals. The `references/asset-library-v4/scene-direction/compile-scene-direction.mjs` entrypoint retains the existing `compileProduction(production, options)` API and existing `zodiac-scene-direction-compile-receipt@1` contract.

## Execution

`node references/asset-library-v4/scene-direction/compile-scene-direction.mjs <workspace> --write [--max-concurrency 1..8]`

Default concurrency is **3**. The script snapshots `production.json`, validates safe unique scene IDs, records each referenced SVG's hash and compiler source fingerprint, and executes separate native compiler processes per scene with immutable per-scene JSON inputs. No worker modifies `production.json` or shared receipts. The coordinator validates outputs and shared source integrity, merges scenes in the original order, and is the **only writer** of `production.json`, `.authoring/scene-direction-compile-receipt.json`, and `.authoring/scene-native-cache.json`, and `.authoring/scene-native-receipt.json`. It uses a dedicated `.authoring/.scene-native.lock`; the existing Phase 02 execution coordinator retains its global native lease.

`--write` fails closed: unsafe referenced asset paths, missing assets, compiler changes, modified shared inputs during execution, invalid child receipts or any child failure block aggregate publishing. Previous shared outputs remain unchanged on child failure. All four outputs use individually atomic file replacement with rollback when publication fails. A stale lock after a terminated process must be investigated and removed manually; never bypass it automatically.

## Cache and review

Per-scene cache includes source scene fingerprint, referenced asset source hashes, native compiler code/profile fingerprint, compiled output digest, and original native scene receipt. Only exact matches reuse compiled scenes. A scene edit invalidates that scene; another scene is reused when all dependencies match. A compiler/profile or source asset edit invalidates affected entries. Build/reuse is computational only and never preserves human approval automatically.

This module parallelizes **scene-direction native geometry compilation**, not shared character SVG generation, environment compilation, semantic preview generation, final Remotion rendering or Job@5 execution. Other Phase 02 steps retain their existing dependencies and receipts. Full producer-side phase acceptance still requires authoring gates, later native validators, scene-complete previews, Visual Review, and Phase 3 gates. The existing `phase02-execute.mjs` continues calling the same `scene_direction` script and therefore picks up isolated compilation without changing the step manifest.

## Regression

`node --test orchestration/tests/scene-native-v2612.test.mjs` tests rollback, cache hit/miss, compiler fingerprint invalidation, scene isolation, unsafe IDs and duplicate IDs. Native CLI E2E additionally needs the installed source tree and a valid SVG-backed production fixture.

The separate `.authoring/scene-native-receipt.json` records native compilation of each scene only (`native_compiled=true`, `preview_verified=false`, `not_an_approval=true`). It does not mutate human review receipts.
