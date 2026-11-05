# Phase 2 Progressive Experience Design

## Intent

Phase 2 currently catches many deterministic authoring defects only after native asset generation, and structurally valid scenes can still reach Visual Review with weak lived-in storytelling. The goal is to catch cheap defects before costly compilation, make scene richness explicit without forcing decorative quotas, and narrow revision reruns to the scenes/assets actually affected.

## Goals

- Add a cheap authoring checkpoint before native SVG/scene compilation.
- Add a Scene Experience review that evaluates lived-in context, physical storytelling, action, callbacks and depth.
- Detect authored SVG style metadata/palette/stroke violations before native compilation.
- Extend revision-impact output with scene-level rerun/reuse guidance backed by the existing semantic graph.
- Keep `.authoring/visual-intent.json` as the only agent-authored visual source of truth.
- Preserve the three public phases and Job@5/renderer contracts.

## Non-goals

- No new public Phase 2 subphase.
- No mandatory prop/accent count per scene.
- No automatic room decoration or Scene Set revival.
- No changes to Job@5 schema or renderer semantics.
- No machine claim that a scene is aesthetically good; unresolved experience review remains an editorial REVIEW.

## Chosen approach

Use the existing Phase-2 precompile seam, semantic cache and coordinator rather than introducing a second pipeline.

1. `progressive-preflight` validates deterministic authoring contracts before native assets: director beat completeness, scene-plan transitions, event motion registry compatibility, readable role geometry and authored SVG style.
2. `scene-experience-review` evaluates each fresh scene against story-led criteria. A scene can pass with sparse visuals when justified, but behavior/relationship narration cannot pass with only a passive actor plus passive accent and no meaningful action, physical prop, narrative visual transition, or callback.
3. `phase02-execute` runs both checks before expensive native compilation.
4. Revision impact uses `phase02-semantic-cache` to emit exact changed/dirty nodes plus scene-level `rebuild`/`reuse` guidance.

## Scene Experience contract

Per scene, review:

- `character_action`
- `environment_specificity`
- `physical_storytelling`
- `depth_separation`
- `secondary_action`
- `visual_callback`
- `narrative_visual_role`

Each criterion is `PASS|OMIT|REVIEW` with a reason. `OMIT` is valid only when editorially justified. The aggregate is `PASS` or `REVIEW`; unresolved REVIEW blocks Visual Review but does not pretend to be a renderer failure.

## Progressive preflight

The checkpoint is deterministic and cheap. It must catch defects that repeatedly surfaced in Cancer Phase 2 before native asset generation:

- director beat missing id/voice anchor/purpose/motion;
- scene-plan missing purpose/beats/transition reason;
- event motion duration incompatible with motion registry;
- unreadable prop/effect geometry;
- authored SVG missing style/handmade metadata;
- authored SVG stroke width outside token contract;
- authored SVG colors outside the current palette.

Existing precompile composition/coverage checks remain authoritative and continue to run.

## Revision semantics

A revision report must include:

- changed files;
- changed semantic graph nodes;
- dirty transitive nodes;
- `scenes.rebuild`;
- `scenes.reuse`;
- `assets.rebuild`;
- `assets.reuse`;
- aggregate review-index invalidation.

Changing one S03 physical prop should not imply rebuilding unrelated character assets or S01/S02/S04/S05 previews.

## Constraints

- Fresh runs remain canvas-native; Scene Set is compatibility-only.
- Scene Accent remains optional and rear-layer/context-only.
- Narrative Visual cannot replace a physical object explicitly involved in narration.
- Structural PASS does not imply aesthetic PASS.
- No approval is synthesized by any new validator.
