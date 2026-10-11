# Asset library routing — v4

Canonical new-production authoring is `references/asset-library-v4/` (`zodiac-visual-grammar-v4@4.0`). Visual Grammar selects Frame + Mechanic; native Character Assembly composes ordinary characters; Environment Composition and Scene Direction materialize the scene.

## Character routing
Ordinary characters use the V4 component catalog:
- 6 authored body profiles;
- 10 hair families;
- 4 stable face profiles and 2 identity accessories;
- 12 Zodiac + 5 generic outfits;
- 9 expressions;
- 19 poses, including 4 study actions.

Identity (`body + hair + face profile + outfit + accessory`) is fixed per entity. State changes only pose/expression. The compiler bakes one Human Stroke v2 SVG per state.

`references/asset-library-v4/` is the only active asset library. Its contracts, scene-direction compiler, environment examples, meme templates, props, accessories and validation tools are package-owned. Migration records retain historical source lineage; Phase 2 does not load files from a V3 directory.

Reusable props cover study and school contexts; classroom and hallway environments are micro-compositions made from separate structural cues, never full-scene backgrounds. Multi-person casting still prioritizes body/silhouette diversity; hair/outfit changes alone do not count as silhouette diversity.
