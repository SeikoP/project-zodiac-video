# Phase 02 composition contract

Fresh Phase 2 uses canvas-native context, independent actor/prop composition, and at most one Story Visual semantic owner for a given story direction.

## Scene composition

Each fresh scene may contain:
- actors/characters;
- one or more narration-grounded Scene Accents for context;
- physical props/support relationships when the action needs them;
- optional reaction/effect/meme acting;
- optional **Hình kể chuyện / `story_visual`**;
- runtime caption safe space.

Palette alone is not context. Story Visual has no quota and is never selected from a symbolic catalog. It exists only when Phase 1 supplied a concrete `story_visuals[]` direction. A Story Visual may be illustration, outlined lettering, or their combination. Lettering stays inside the same Story Visual entity/state/asset and never becomes an independent semantic layer.

Phase 02 owns implementation in `.authoring/visual-intent.json`: scene plan, cast, layout, context, physical interactions, exact narration anchors, Story Visual states/assets and coverage. Phase 1 remains authoritative for Story Visual meaning and any semantically required wording.

Before SVG writes, inventory each scene in `.authoring/scene-art-direction.json` with components, occlusion relations, spatial bindings, layout contract, and visual coverage. Coverage has one `story_visual` layer; there is no separate lettering coverage layer.

Run progressive preflight, coverage/completeness, Story Visual gates when applicable, native compilation, Director review, endpoint previews and genuine Visual Review. Runtime timing and final media QA stay downstream.
