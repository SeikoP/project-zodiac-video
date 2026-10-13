# Phase 2 cleanup — final production-source verification

Plugin version: 2.5.5. Historical source baseline: 254f6b96d3e88631de6615b9af8f77cfc3eb179a. Current release/source lineage lives in docs/zodiac-plugin-release.json.

## Current behavior

Retired masters, room profiles/cues and compatibility hair are physically absent from the active plugin. Fresh selectors reject retired IDs and implicit compatibility. The fixed face remains expressive; shirts are plain and colored; accessories and separate effects are removed. Scene sets supply supporting rear depth and cannot physically support actors. Story figures retain narrative states and the balance scale has intrinsic accents.

Phase bundles retain shared refactored executable/data dependencies, with SVG/catalogue HTML only in Phase 2. Builder checks relative imports/forwarded CLIs and exact release-source bytes; staging checks scope, release, commit, paths and payload hashes. Meme compilation copies native props, binds actual object states and records ownership. Missing backdrop SVGs are rebuilt by Environment Compile instead of blocking the earlier prop compiler. Composition/QC cache inputs now include the workspace plans those validators read.

## Executed checks

- Producer orchestration and reference suite: 643/643 Node tests PASS, zero skipped. Includes compiler/preview/Job@5, source/review locks, tampered/missing assets, resume, races and context isolation.
- Python full pytest suite: 674 passed, 11 environment-gated skipped, 23 subtests passed. unittest: 644 tests, 11 skipped. Python compileall and diff whitespace checks PASS.
- Renderer 2.0.1: 90/90 tests PASS and TypeScript typecheck PASS. Eight-scene fixture uses real Patrick Hand font metrics and checks 1,189 spatial frames. Default browser download is blocked in this host; QA used explicitly supplied local Chromium 153.0.8010.0 through a test-environment browser override. Renderer source, dependency pins and contract remain unchanged.
- Native library validation PASS: six sets, six layouts, twenty mechanics, eleven meme templates, twenty-two props, no accessories, fixed face/plain shirt, twenty-five poses.
- Current catalogue browser QA PASS: 98 native items, six story figures, filtering/selection/download work, no script errors, selection remains approval:false. Internal screenshot inspected; no screenshot shipped.
- Art-direction cache regression was exercised RED before fix and GREEN after fix. Historical retired-feature tests were migrated per test-migration.md, not skipped or supported by resurrecting assets.

## Boundary

These checks establish production source/transport readiness. They do not supply real episode Content/Visual Review, measured TTS, audio or final MP4 acceptance. Real episode approvals and runner media QA remain required. GitHub CI status is distinct from the locally executed evidence above.

The initial failure-inventory.json is retained as a historical diagnostic of the pre-migration suite, not the current release status. Recovery sources remain outside the active plugin.
