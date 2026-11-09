# Per-episode benchmark and capability utilization

Read-only command (no ZIP, no phase transition, no mutation):

```bash
node skills/zodiac-video-pipeline/core/audit/episode-utilization-report.mjs <workspace> [prior-report.json]
```

The output has two independent sections:

- `capability_utilization`: declared capabilities from the phase manifests and actual PASS validator receipts. This **does not prove** external connectors were called. Leaf skill decisions require their own provenance; REQUESTED, NATIVE_REVIEW and unverified APPLIED are not proof.
- `optimization`: native execution timings, scene compile/reuse counts, preview rebuild/reuse, context transport tokens and semantic dirty-scene counts when the corresponding real receipts exist. Missing values are `null`. No speedup claim is produced without compatible measurement keys.

`comparison_key` must be supplied in a measured context-delivery receipt to permit a before/after comparison; reports with no key or differing keys are `NO_COMPARABLE_BASELINE`. Native wall time excludes human/agent authoring and review. The report is diagnostic only, never an approval or a substitute for the Phase 2 validators.

For a controlled experiment, capture a report for an unchanged rerun and another after a single-scene edit. Compare scene reuse and native wall times; use the *same* input size, scene count, plugin/renderer version and environment for a valid speedup claim. Run the existing synthetic benchmarks separately for dependency-closure correctness:

```bash
node skills/zodiac-video-pipeline/core/audit/benchmark-incremental-cache.mjs
node skills/zodiac-video-pipeline/core/audit/benchmark-plugin-orchestration.mjs
```

These synthetic tests are not proof of a production episode's end-to-end speedup.
