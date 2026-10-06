# Shared Renderer Source Contract

Current semantic runtime:
- id: `zodiac-remotion`
- version: `1.15.0`
- SHA-256: `4d52e6ca766649546482a5cdfbf879f4f19c4d3c41c07c7743cccec1a7100ffa`
- contract: `shared-job-props-v2-semantic`

Runtime 1.14 remains immutable for packages already pinned to it. Never auto-migrate or fall back.

## Data boundary
The shared renderer MUST NOT import package-relative production/publish JSON. Studio supplies timing/resolved events/production/publish through render props, sets `ZODIAC_PACKAGE_ROOT`, and uses the job root as `--public-dir`.

## Semantic contract
Runtime 1.15 schema includes asset `lineage` and optional event `mechanism`. `scripts/render.mjs` MUST execute `validateSemanticAnimation(scene)` for every scene. Required files include `src/semantic-animation.mjs` and a standalone `tests/semantic-animation-gate.test.mjs` that does not read job-local production data.

Strong articulation cannot use `whole_asset`; child mechanisms reference real scene entity IDs.

## Caption/font
Patrick Hand 400 Vietnamese font readiness completes before measured caption layout. Story visuals retain the full canvas.

## Runtime testing
Runtime tests and TypeScript are cached by exact runtime hash. Job-specific package/timing/publish validation remains in Zodiac Studio.
