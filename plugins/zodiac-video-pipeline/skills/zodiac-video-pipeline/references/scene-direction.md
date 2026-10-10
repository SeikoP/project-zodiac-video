# Scene Direction & Visual Rhythm Contract — v1.2

## Goal
Turn approved narration into varied, coherent shot progression and guarantee that shot intent becomes different, **frame-safe** runtime-facing geometry.

`scene_direction` is semantic input. Semantic Assets runs the deterministic compiler after assets exist; metadata without compiled transforms is a failure.

## Per-scene semantic contract
Visual Compile writes `scene_direction` with `shot`, `focus`, `subject_placement`, `continuity_relation`, `foreground_role`, and a short semantic `composition_goal`. `focus` must resolve to a scene entity or `caption`. `foreground_role`, when used, must resolve to an existing scene entity. `two-person` declares existing speaker/listener and optional shared prop.

## Deterministic compiler
Run `references/asset-library-v4/scene-direction/compile-scene-direction.mjs <workspace> --write` after Semantic Assets.

The compiler preserves source aspect ratio, materializes only explicit shot roles into `state.transform`, applies one stable box across states of the same compiled entity, and clamps compiler-owned geometry inside the 1080×1920 canvas. Foreground depth comes from scale/layer/occlusion rather than uncontrolled off-canvas clipping. It writes `.authoring/scene-direction-compile-receipt.json` and never creates a runtime shot schema.

## Frame-quality guarantees
- `reaction-closeup` materially enlarges the focal character relative to `wide-environment`.
- `two-person` compiles separated speaker/listener boxes with readable shared-prop space.
- `over-shoulder` and `foreground-peek` use edge-biased but canvas-safe foreground geometry.
- `caption-led` restrains the focal subject in the upper field and must leave the lower caption-safe field usable.
- Environment props must read as coherent clusters. Reframes may preserve the logical location but must not repeat identical prop wallpaper through three or more distinct shots.
- Grounding cues and decorative environment do not occupy the subtitle-safe field as a substitute for visual depth.

## Continuity + rhythm
Same shot streak ≤2; rolling four-scene windows contain ≥2 shot profiles; same `(shot+focus+placement)` streak ≤2. Shot/camera/layout change never substitutes for a story-changing entity state.

## Ownership
- **Visual Compile:** semantic shot/focus/placement/continuity only; no exact coordinates.
- **Semantic Assets:** final geometry + compiler execution + frame-composition validation.
- **Runtime:** consumes materialized transforms and performs timing/interpolation/choreography; it does not auto-fix framing.
