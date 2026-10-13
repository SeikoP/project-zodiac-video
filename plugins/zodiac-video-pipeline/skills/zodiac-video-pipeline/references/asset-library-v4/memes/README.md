# Visual Grammar v4 Meme Adapters

Meme adapters preserve reviewed action, role relationships, composition, and crop from the promoted V4 semantic contracts while compiling characters and assets with the native V4 style.

Visual Compile may add this field to a scene in `visual-grammar-plan.json`:

```json
{
  "meme_composition": {
    "id": "cry-hug-object",
    "bindings": {"actor": "hero", "prop": "keepsake"}
  }
}
```

`id` must exist in `index.json`. `bindings` maps recipe roles to entities already present in the scene. The compiler resolves the registered v4 frame, mechanic, placements, and acting requirements. Explicit `frame_id` or `mechanic_id` overrides are allowed only when they match the adapter. Missing required roles, wrong entity kinds, unknown entities, and adapter mismatches fail closed.

The V4 registry points to a local contract in `memes/templates/`. These contracts contain semantic layout and contact rules; legacy reference SVGs are not included. New assets use `zodiac-paper-doodle-meme-v4` and `human-stroke-v2` with truthful V4 lineage.

The compiler writes authoring-only `scene.visual_grammar.meme_composition` metadata and `scene.scene_direction.meme_layout`. `compile-meme-props.mjs` materializes only native props declared in `asset_requirements` and binds them to object states. Its receipt lists the actual prop assets and bindings. Scene Direction owns final transforms. Effects are removed; any effect entity or nonempty effect specification is rejected.

A new meme needs role geometry and character/prop actions. Add a bespoke prop requirement only when the scene actually uses it. Do not add effect primitives, effect receipt finalizers or effect review steps.
