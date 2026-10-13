# Canvas-native Scene Accent — current implementation and gates

**Canonical fresh authoring:** `kind=scene_accent`, `visual_role=scene_accent`, asset category `scene_accent`. The semantic meaning is environmental context, not background replacement, prop, support or story symbol.

Producer owner: `features/visual-composition/validate-canvas-accents.mjs`. Supports independent state visibility, actual canvas geometry, optional static actor-relative placement (`above_head`, `near_left`, `near_right`), narration-anchor existence, asset category/path presence and caption exclusion. Missing accent is legal; explicit omission is required by fresh Visual Coverage (`layers_version=narrative_visual@1`).

Transport: the fresh authoring source projects to Job@5 environment category with explicit entity `role=scene_accent` and `visual_role=background`. This **does not** consume effect/prop density. Renderer `src/spatial-layout.mjs` recognizes the context role and frame-samples caption collisions, while rear layering stays intact. Legacy Scene Set is not required in fresh.

Tests: `orchestration/tests/canvas-accent-regression.test.mjs`, `runtime/zodiac-renderer/2.0.1/renderer/tests/spatial-layout.test.mjs`. Human review of physical composition, native-preview/pixel frame parity, and full video are separate, unverified acceptance gates.

Roll back the Phase 2 accent projection/renderer-geometry commits as a set; preserve legacy importer support.
