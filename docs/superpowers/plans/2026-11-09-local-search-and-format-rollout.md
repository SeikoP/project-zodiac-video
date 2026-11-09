# Zodiac Local: scoped search and format rollout

Status: implementation in progress, 2026-11-09. Scoped to Local Phase 2/3 and shared runtime dependencies. Derived from the 2026-11-09 Superpowers plan and the 2026-11-07 Phase 2 optimization plan.

## Decisions

- Authoritative inputs: genuine approved Phase 1 capsule, XState next_task, selected task context, canonical JSON source, current receipts, existing semantic dirty graph.
- CLI search: exact known path first; scoped rg only for unknown implementation symbols/errors; git grep when rg is absent; no broad repository index in routine production.
- Storage: preserve JSON in state, Visual Intent, receipts, approvals and Job@5. Keep lossless token-measured JSON/TOON adaptive context.
- Source intelligence: remove CodeGraph unless a measured cross-module use case requires it; historical benchmarking from 2026-11-07 reports ~3.9 s cold index, ~88–93 ms queries vs ~72–76 ms whole-file scans (different semantics; not an E2E speed guarantee).
- Never change approved narration or synthesize review approvals.

## Implementation gates

A. Add local lookup contract and regression tests; verify bootstrap resumes, context carries exact scenes, approvals stay binding.
B. Remove CodeGraph runtime/package/benchmark references, regenerate lockfile and validate Node/npm installation. Keep manifest workflow graph intact.
C. Run baseline/no-change/single-scene/shared-cast/publish-only/Phase-3 handoff tests and measure wall-clock, lookup count, task context, and cache reuse before modifying caching internals.
D. Only change encoding or storage after an A/B test of task outcomes, round-trip equality and end-to-end wall time.

No benchmark may be presented as a measured CLI speedup without a matched real workload and environment.
