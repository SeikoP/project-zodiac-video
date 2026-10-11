# Outfit Assembly v4

Outfit is an identity component compiled into the character torso before runtime.

Native catalog provides 12 Zodiac cores plus a generic pool. A sign representative uses the matching Zodiac outfit; ordinary peers/narrator use the generic pool unless the story explicitly assigns otherwise.

`outfit_id` and `shirt_color_id` are fixed identity fields for one character across all states. Shirt colors come from `components/catalog.json` and are assigned deterministically; simultaneously visible characters use different shirt colors whenever the palette has enough colors. `variant_seed` deterministically varies small accent placement while preserving the core. Pose/expression changes may not recolor, replace or reroute the outfit. Runtime never composes outfit layers.

Historical outfit lineage is provenance only. Any user-supplied legacy outfit reference must be re-authored with `zodiac-paper-doodle-meme-v4` + `human-stroke-v2` and validated through Character Assembly.

When two or more characters are visible in the same scene, their baked `outfit_decoration` geometry must be distinct. If two identities resolve to the same decoration signature, change the generic outfit or `variant_seed` before review; `validate-outfit-bake-v4.mjs` hard-fails duplicate visible outfit geometry.
