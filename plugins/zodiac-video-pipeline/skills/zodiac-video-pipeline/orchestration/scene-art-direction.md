# Scene Art Direction — Phase 02

Fresh Phase 2 uses `.authoring/scene-art-direction.json` format `zodiac-scene-art-direction@2`.

## Visual components

1. **Actor / Character** — identity, pose, expression and performed action.
2. **Scene Accent** — canvas-native environmental/context cue behind the action. Palette alone is insufficient context.
3. **Physical Prop / Support** — handled or contacted objects with explicit spatial relations and actions.
4. **Effect / Meme acting** — optional reaction emphasis tied to actual narration/action.
5. **Story Visual** — optional Phase-1-directed semantic visual. It may be illustration, outlined lettering, or both inside one entity/state/asset.
6. **Caption safe zone** — reserved runtime subtitle space, not an authored SVG entity.

Story Visual is valid only when a concrete visible subject/action contributes a central fact that actors, props and context do not already make clear. Generic symbols and decorative zodiac imagery do not qualify. Lettering is optional metadata on the Story Visual, not another entity, role or coverage lane.

## Visual coverage

Fresh coverage uses `zodiac-visual-coverage@1`, exact scene narration SHA-256, and contiguous UTF-8 narration ranges. Every applicable layer records `use/omit` with a reason and names real entity IDs when used. Story Visual coverage uses only `layers.story_visual`; lettering never receives an independent decision.

Meme use is independent but must bind actual acting/state events. Ordinary props require an authored action plus spatial relation. Support requires real contact. Do not generate assets to satisfy quotas.

Run `validate-phase02-art-direction.mjs`, coverage/completeness gates, native compilers, Director review, preview pairs and human Visual Review. Structural PASS never implies aesthetic or final-media PASS.
