# Phase 2 performance: profile before optimizing (2.6.13)

Phase 2 output visual complexity is not a proxy for work performed. The native pipeline includes character identity/state authoring, environment binding, art direction, motion/event validation, native previews, scene continuity, and user visual approval. A visually sparse scene may require nontrivial semantic validation; conversely, no scene should create redundant assets or decorative effects solely to fill perceived density.

## Native scene compiler fast path

`compile-scene-direction.mjs <workspace> --write` retains the original entrypoint and `zodiac-scene-direction-compile-receipt@1` aggregate format. Its scene-native executor now chooses in-process isolated compilation when **1–3 scenes** exist, avoiding child-process startup overhead. For **4+ scenes**, it keeps bounded subprocess isolation and parallelism. The in-process path still compiles each immutable one-scene snapshot separately, awaits all scene results before aggregate publication, validates source and asset fingerprints, enforces the writer lock and rolls back on publication failures. `compileOne` test injection is unaffected. `executionMode` can explicitly select `in_process` or `process` in the programmatic API for regression/benchmark purposes; production defaults to `auto`.

The receipt `.authoring/scene-native-receipt.json` now reports `execution_mode`, `compile_wall_ms`, `cache_hit_count`, `cache_miss_count`. Timing is diagnostic only; not proof of quality or approval. Changed compiler dependency files invalidate cached native work. No native validation, preview, cross-scene continuity or review gate is removed.

## Bottleneck report

Run from the installed skill root:

```sh
node core/performance/diagnose-phase02.mjs <workspace>
```

It reads the existing `.authoring/phase02-execution-receipt.json`, `.authoring/fast-pipeline-profile.json`, `.authoring/scene-native-receipt.json`, and (if present) `preview/preview-report.json`. It ranks measured native step durations, reports scene compile/reuse and preview rebuild/reuse, and returns `DIAGNOSTIC_ONLY`. Missing timing stays `null`: never equate a missing receipt with zero cost. Step duration sums can exceed total wall time under parallel execution.

**Not measured:** LLM/agent writing, time spent sourcing/choosing art, human review, network/tool latency, and local Job@5 Remotion rendering. Do not assert total E2E improvement from a scene-direction microbenchmark. Use a representative episode workspace to find the actual dominant stage and compare a warm-cache rerun against a full rebuild.

## Editorial work budget

Use approved narration to determine story actions and meaningful scene assets. Prefer one focused story relationship over multiple decorative props/effects. Reuse stable character identity, hair and base assets across scenes; vary expression, state and action when semantically justified. Compile/revalidate only dirty scenes and dependencies; do not skip user approval or fail-closed validation.
