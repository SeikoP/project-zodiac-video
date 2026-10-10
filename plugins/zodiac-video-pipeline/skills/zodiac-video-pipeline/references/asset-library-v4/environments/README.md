# Bedroom Environment Composition — v4

For a bedroom location, use `bedroom-study-base` as the canonical micro-environment. It is composition metadata plus separate structural SVG cues, never a monolithic room background.

- `clean` — default narration/explanation: window/curtain + bed/desk grounding, 0 foreground cues.
- `cozy-depth` — emotional/overthinking beats: adds pillow/blanket foreground and may use relevant bedroom props; subject occlusion ≤18%.
- `meme-payoff` — payoff only: de-emphasized room, at most one foreground cue and one meme accent.

Visual Grammar records `{profile:"bedroom-study-base", modifier:"..."}`. During Semantic Assets:
1. `compile-environment.mjs` resolves that metadata to real ordinary assets/entities/roles and writes `.authoring/environment-compile-receipt.json`;
2. `validate-environment-binding.mjs` verifies the compiled binding;
3. Scene Direction runs only after those entities exist.

Structural foreground cues must start below the canonical caption-safe field (`y >= 1580`). Story props are selected from narration meaning rather than used as filler. Runtime receives ordinary entities only; there is no background-image schema or render-time environment randomization.

## Environment Frame V1 (plugin 2.4.7+)

For a fresh acted scene that has an environment profile, write an authored
`environment.frame` before Scene Direction; no decorative full-background fallback.
Frame has `version: zodiac-environment-frame@1`, concrete semantic `intent`,
`slots` (performer, listener, story_fixture, structural_fixture,
foreground_fixture, hand_prop), `contacts` (Job@5-supported spatial links),
and optional `occlusions`. See `references/environment-frame-system.md`.
`compile-scene-direction.mjs` resolves positions and materializes **existing**
state transforms/layers. The frame metadata is authoring only; Renderer sees
standard Job@5 entities and spatial_bindings. Legacy sources remain unchanged.
