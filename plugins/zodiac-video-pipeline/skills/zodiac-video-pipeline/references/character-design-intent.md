# Character Design Intent v2.4.5 — story before library

All fresh production projects use `zodiac-character-assembly-plan@2` in `.authoring/character-assembly-plan.json`. This is the same authoring surface as Character Assembly; no fourth phase or additional character asset collection.

For each `characters[]` specification, author `design_intent` **before** browsing the V4 component catalog:

- `role`: `lead` or `support`; `identity_tension`: the exact dramatic contradiction; `audience_read`: visual first impression and why it matters.
- `selection_basis`: exactly `story_first`, never `catalog_first`.
- `decision_reasons`: `body_profile`, `hair_id`, `face_profile_id`, `outfit_id`, `shirt_color_id`. Every field must justify its effect on the story, not availability in the catalog. Lead has an **explicit shirt_color_id** to prevent random identity drift.
- `rejected_alternative`: `choice`, `reason` documenting one plausible, consciously rejected design.
- `scene_anchor`: `{scene_id,excerpt,meaning}`, where excerpt occurs in the exact speaking scene with this character.
- `state_purposes`: one distinct reason per state ID, tied to an action/emotion the audience actually sees. Do not create 5 almost identical state SVGs to simulate a simple reaction; reuse if it carries meaning.
- `reuse_strategy`: `native_assembly_after_story` or `new_native_asset_after_story`. Reuse is a cost decision **after** directing.

Gate: `node orchestration/validate-character-intent-preflight.mjs <workspace>` and native `compile-character-assembly.mjs --plan-only` both validate the intent. The Phase-02 coordinator invokes the gate before touching generated SVGs. The catalog supplies vocabulary only; it never elects a protagonist. Existing `@1` plans remain readable in legacy continuation. This validator checks structured provenance and links; human Visual Review must still judge face identity, emotion and tone in the real drawings.
