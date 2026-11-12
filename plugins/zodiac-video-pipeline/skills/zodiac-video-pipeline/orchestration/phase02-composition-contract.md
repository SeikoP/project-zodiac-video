# Phase 02 composition contract

Fresh Phase 2 uses a canvas-native context, independent actor/prop composition, and one optional focal semantic layer per scene.

## Scene composition

Each fresh scene may contain:

- actors/characters;
- one or more narration-grounded Scene Accents for context;
- physical props/support relationships when the action needs them;
- optional reaction/effect/meme acting;
- **either Narrative Visual or Story Text, never both**;
- runtime caption safe space.

Palette alone is not context. Narrative Visual has no per-video quota and cannot be selected from a symbolic catalog. It exists only when Phase 1 supplied a concrete `narrative_visuals[]` direction. Story Text is the alternative when short words communicate the point better.

Phase 02 owns implementation in `.authoring/visual-intent.json`: scene plan, cast, layout, context, physical interactions, exact narration anchors, state changes, and coverage. Phase 1 remains authoritative for Narrative Visual story meaning.

Before SVG writes, inventory each scene in `.authoring/scene-art-direction.json` with components, occlusion relations, spatial bindings, layout contract, and visual coverage. Native compilers materialize geometry and projections; generated files are not authoring sources.

Run the progressive preflight, coverage/completeness, Narrative Visual or Story Text gate as applicable, native compilation, Director review, endpoint previews, and genuine Visual Review. Runtime timing and final media QA stay downstream.
