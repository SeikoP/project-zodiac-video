# Production Handoff — v2.0.0

VISUAL REVIEW is the final human approval. Handoff is Assemble → Validate → deterministic Export → post-ZIP QC.

Phase 2 owns authoring semantics, Visual Grammar v4 assets, scene direction and publish preparation. Handoff converts this approved authoring state to `zodiac-job@5`; it does not project runtime frames or materialize renderer defaults.

Every exported event must have an explicit `motion.preset` + positive `duration_frames` in the approved authoring payload. Handoff maps that preset to `desired_motion` and stores its duration in `design-token.json.motion_defaults`. Missing/ambiguous motion fails export rather than being guessed. Existing explicit semantic scheduling is preserved; when absent, the job@5 boundary uses conservative `max_drift_frames=8`, `merge_policy=never` for the Timeline Compiler.

Style/caption/watermark intent remains in the v4 design token, including Patrick Hand typography and `✦ bungmoto` identity. Renderer 2 owns actual pixels and frame timing after Plan validation.

## Production-ready ZIP gate (v2.3.9)
A successful `validate-handoff-workspace-v2` alone is not a complete release. Production export must call `run-phase03-production.mjs` on a Phase-02 user-approved workspace sealed by `seal-phase02-review.mjs`. It checks immutable source bytes, canonical model round-trip, visual spatial/effect lifecycle, brand/publish and runner-compatible events **before** ZIP emission. Legacy low-level exporters require this review evidence too. Only `PRODUCTION_READY_ZIP` is asserted upstream; runtime media quality remains separately unverified until real render.
