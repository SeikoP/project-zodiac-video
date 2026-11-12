# Scene Art Direction — Phase 02

Fresh Phase 2 uses `.authoring/scene-art-direction.json` format `zodiac-scene-art-direction@2`.

## Visual components

1. **Actor / Character** — identity, pose, expression and performed action.
2. **Scene Accent** — canvas-native environmental/context cue behind the action. Palette alone is insufficient context.
3. **Physical Prop / Support** — handled or contacted objects with explicit spatial relations and actions.
4. **Effect / Meme acting** — optional reaction emphasis tied to actual narration/action.
5. **Focal semantic layer** — choose **Narrative Visual OR Story Text OR neither** for the whole scene. Never use both.
6. **Caption safe zone** — reserved runtime subtitle space, not an authored SVG entity.

Narrative Visual is optional and Phase-1-directed. It is valid only when a concrete visible subject/action explains a central story point better than Story Text. Generic symbols and decorative zodiac imagery do not qualify.

## Visual coverage

Fresh coverage uses `zodiac-visual-coverage@1`, exact scene narration SHA-256, and contiguous UTF-8 narration ranges. Every beat records `use/omit` with a reason for applicable layers and names the real entity IDs when used.

Story Text and Narrative Visual are mutually exclusive across the entire scene. Meme use is independent but must bind actual acting/state events. Ordinary props require an authored action plus spatial relation. Support requires real contact. Do not generate assets to satisfy quotas.

Run `validate-phase02-art-direction.mjs`, coverage/completeness gates, native compilers, Director review, preview pairs, and human Visual Review. Structural PASS never implies aesthetic or final-media PASS.
