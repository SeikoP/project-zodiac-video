# Scene art direction — Phase 02

Fresh Phase 02 uses `.authoring/scene-art-direction.json` format `zodiac-scene-art-direction@2` and validates it with `validate-phase02-art-direction.mjs`. Historical probes are absent from this package; old jobs use an external pinned snapshot.

## Visual layers

1. `scene-set` — primary wall/floor/frame stage. It may remain consistent across scenes and does not require characters to be contained inside its outer frame.
2. `shot-layout` — actor/prop composition skeleton. It is not a background frame.
3. `scene accent` — optional simple context cue such as a few hanging strips; it must stay inside the scene-set wall region.
4. `Story Object` — independent symbolic narrative element with setup → friction → payoff when selected. A thought metaphor may float near/above an actor; physical contact is required only for `physical_interaction`.
5. `prop` / `effect` — ordinary physical objects and reaction emphasis. Neither may substitute for the Story Object premise or the scene-set.

Use `art-direction/palette-registry.json` for token colors. `art-direction/environment-registry.json` contains compatibility selected-cue/legacy profiles; fresh scene-set authoring does not need a room profile from that registry. Do not auto-add windows, boards, tables, lamps, shadows, gradients or perspective.

Run `node orchestration/validate-phase02-art-direction.mjs <workspace>` before native compilation. Then run native compilers, Director V2, preview pairs and human Visual Review. Structural PASS never implies aesthetic or runtime-media PASS.
