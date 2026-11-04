# Fast Pipeline — performance-only execution overlay

This is **not** a fourth phase, second source of truth or approval shortcut.
The canonical router, phase manifests, review receipts, transactional leases and Job@5 schema remain authoritative.

## Measurement
Use `core/performance/critical-path.mjs` to record full Phase 2 wall time, native step duration, orchestration overhead, retry counts and cache hit/miss reasons. Do not call producer ZIP-ready a rendered MP4. A baseline must separate agent time, native time, transport waiting, human review waiting and local runner.

## Context capsule
For each step use `orchestration/core/performance/compile-step-capsule.mjs` to prepare a validated content manifest with hashes. This may make references economical for agents. It cannot mark any required reference read as completed without actually supplying the current content. No implicit reuse of an earlier agent's context is permitted; delta mode requires a matching caller-held capsule ID and all current hashes reverified.

## Authoring and validation
Fresh Phase 2 remains single-source `.authoring/visual-intent.json`. Complete all Scene Plan, cast, props, Narrative Visual, director beats, art-direction coverage and events BEFORE native SVG compilation. The existing completeness/precompile validators are mandatory.

## Parallel execution
Only independent tasks with explicitly enumerated input and output ownership may run concurrently. `core/performance/safe-parallel-scheduler.mjs` rejects missing dependencies, cycles, conflicting writes and read/write races. Steps not proven safe remain sequential through the existing Phase 2 executor. No parallel writer may touch production.json, pipeline-state.json or shared receipt paths.

## Batch repair
Collect independent static failures when their inputs are already valid; group by source owner and fix canonical sources once. Never suppress a failed validator or reclassify a creative review as computational PASS.

## Benchmark and rollout
Compare `phase02-execute.mjs --run --no-cache` with verified warm runs for the same episode and current source commit. Measure repeated cold, warm and single-scene edits, recording wall clock, nodes reused/rebuilt, output equivalence and tests. Use local runner separately for media E2E.

Acceptance: no reduced validation coverage, no fabricated approval, no cross-episode creative reuse, no changed Job@5 contract. Latency targets are hypotheses until measured.
