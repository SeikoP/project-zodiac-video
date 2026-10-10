# Environment Composition Index — v1.0

This directory contains **composition metadata**, not reusable scene/background assets.

`index.json` defines context-driven micro-environment presets that arrange canonical props and lightweight package-owned structural cues into rear → subject → front depth.

Hard rules:
- no full-scene SVG/raster/background module;
- no generated background image;
- presets never spawn characters;
- Visual Compile selects mode/profile and semantic roles only;
- Semantic Assets resolves actual asset entities, layers, contact and occlusion;
- runtime receives ordinary scene entities, so no new runtime schema is introduced;
- `minimal`/`none` remain valid when a close-up, macro meme or isolated payoff is stronger without environment density.

Run `validate-environment-compositions.mjs` whenever the index changes.
