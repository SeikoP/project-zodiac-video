# Scene art direction — Phase 02

Fresh Phase 02 uses `.authoring/scene-art-direction.json` format `zodiac-scene-art-direction@2` and validates it with `validate-phase02-art-direction.mjs`. Historical probes are absent from this package; old jobs use an external pinned snapshot.

## Visual layers

1. `scene-set` — supporting rear picture/wall for depth. It may remain consistent across scenes; foreground characters own independent composition and physical support.
2. `shot-layout` — actor/prop composition skeleton. It is not a background frame.
3. `scene accent` — optional simple context cue such as a few hanging strips; it must stay inside the scene-set wall region.
4. `Story Object` — independent symbolic narrative element with setup → friction → payoff when selected. A thought metaphor may float near/above an actor; physical contact is required only for `physical_interaction`.
5. `prop` / `effect` — ordinary physical objects and reaction emphasis. Neither may substitute for the Story Object premise or the scene-set.

Use `art-direction/palette-registry.json` for token colors. `art-direction/environment-registry.json` contains compatibility selected-cue/legacy profiles; fresh scene-set authoring does not need a room profile from that registry. Do not auto-add windows, boards, tables, lamps, shadows, gradients or perspective.

Run `node orchestration/validate-phase02-art-direction.mjs <workspace>` before native compilation. Then run native compilers, Director V2, preview pairs and human Visual Review. Structural PASS never implies aesthetic or runtime-media PASS.

## Required visual coverage before compilation

Fresh Phase 02 must fill `visual_coverage` inside each Visual Intent scene's
`art_direction`. It projects only into scene-art-direction, never Job@5.
Use format `zodiac-visual-coverage@1`, SHA-256 of that scene's exact voice,
and ordered `beats` covering the whole voice with contiguous UTF-8 byte
`narration_range` values. A beat is internal pacing, not a new scene or a
change to approved narration paragraphs.

Every beat has `id`, `goal`, ordered `event_ids`, and decisions for all seven
`layers`: `actors`, `scene_set`, `scene_accent`, `story_object`, `props`,
`support`, `caption`. Each decision is `use` with a reason and actual
`entity_ids`, or `omit` with a nonempty editorial reason. Caption uses the
layout's reserved safe zone rather than a fake SVG entity. Use existing
entities/states; do not generate an asset just to fill a box.

The precompile seam enforces coverage even if art_direction_required is false.
It rejects missing decisions, narration gaps/stale hashes, missing or wrongly
classified entities, uncovered events, anchors outside their beat, selected
entities that never appear, and visible entities undeclared in that beat.
Ordinary props need an authored action and actor/surface spatial binding;
a symbolic Story Object cannot satisfy physical prop coverage. Support requires an explicit actor on_surface relation, so a held cup cannot bypass prop checks by being labelled support. The seam also reuses the producer role-size gate before SVG compilation. Support,
props and metaphors remain separate editorial decisions.

Physical objects explicitly involved in the narration deserve a decision:
for drinking coffee, consider a native cup with lift/lower/release states;
for sitting, provide a support or a documented crop that hides the contact.
Do not force props into every beat. A coffee cup may be lowered when a
question takes attention, then disappear when the cafe passage ends.
Coverage checks structure and actual visibility; semantic and visual review
still decide whether the action convincingly tells the story.

Revalidate coverage on native output in Visual Quality. Changing geometry,
source or decisions invalidates receipts; preview endpoints and human review
remain necessary. Runtime voice/timing/MP4 QA stays downstream.
