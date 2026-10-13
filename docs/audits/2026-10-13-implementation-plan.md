# Implementation plan — 2026-10-13

1. **A Stabilization:** repair Python syntax and renderer caption collision, isolate plugin-native root causes, rerun mandatory CI. Gate: P0 cleared, CI success.
2. **B Contracts:** canonical schema generation, semantic taxonomy alignment, legacy Story Symbol compatibility, plugin provenance; ZIP import/export roundtrip. Gate: no fingerprint drift.
3. **C Visual narrative:** prove Scene Plan consistency, co-visible density, spatial ownership/contact, actual frame evidence, no narration changes. Gate: deterministic negative and frame tests pass.
4. **D Performance:** collect baselines, optimize only measured bottlenecks, compare before/after. Gate: no unexplained regressions.
5. **E Production:** native E2E, GUI/headless, actual MP4 voice-tail/media QA, review readiness. Gate: all critical verification passes.

No self-merge while P0/CI red. Keep existing approvals and compatibility unless explicitly reviewed.
