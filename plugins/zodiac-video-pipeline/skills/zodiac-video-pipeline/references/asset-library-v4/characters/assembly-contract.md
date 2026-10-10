# Native Character Assembly v4

New ordinary characters are compile-time assemblies, not copied character SVG variants.

Identity is chosen once per `entity_id`:
`body_profile + hair_id + face_profile_id + outfit_id + shirt_color_id + accessory_id + stable variant_seed`. Face profile controls stable eye geometry and identity marks; accessories are baked into every state.
If omitted, `face_profile_id` resolves to `balanced` and `accessory_id` resolves to `none`.
When the plan omits `shirt_color_id`, Character Assembly deterministically assigns a native palette color and avoids duplicate colors among characters visible in the same scene while palette capacity allows. The chosen color is stored in the character blueprint and remains fixed across all states. State may change `pose_id + expression_id` and an optional compile-time `crop_id` for reaction shots. Crop does not alter identity.

Canonical component catalog: `components/catalog.json`.
Plan: `.authoring/character-assembly-plan.json` using `zodiac-character-assembly-plan@2` for new work (requires intentional character design from Story Spine). Legacy @1 remains supported for existing packages.

## Plan state assets before SVG creation
The default budget is three unique character assets per short clip: one base state and up to two standout variants. The budget counts unique `identity_signature + pose_id + expression_id + crop_id` keys, so repeated state names with the same planned components share one asset before compilation. Finished SVG bytes are never compared to merge assets. If a plot-critical character needs more than three unique keys, set `asset_budget.max_unique_states` and provide an `exception_reason` in that character's assembly spec.

Semantic Assets must create and verify `.authoring/character-state-asset-plan.json` before writing character SVGs, in this order:

```text
node references/asset-library-v4/characters/compile-character-assembly.mjs production.json .authoring/character-assembly-plan.json --plan-only
node references/asset-library-v4/characters/compile-character-assembly.mjs production.json .authoring/character-assembly-plan.json --write
node references/asset-library-v4/validation/validate-character-assembly.mjs .
node references/asset-library-v4/validation/validate-outfit-bake-v4.mjs .
then Scene Direction compilation
```

The write step rejects a missing or stale asset plan and checks the full budget before calling the SVG compiler. It compiles one SVG per planned key, updates `production.assets` plus state asset references, and reports unique assets and reused states. Runtime receives ordinary baked SVGs only; component metadata never crosses the runtime boundary.

## Motion before asset expansion
Do not add a new pose or prop just to decorate every narration beat. Keep the same character asset when a beat can be carried by the existing event motion, entity transform, camera focus, caption timing, or one sparse reaction mark. Compile another character SVG only when a readable pose, expression, or crop change materially changes the picture. Keep each scene near the token's density target: one focal interaction and one supporting story prop; add more only when the narration requires them.

Body profiles use authored path geometry, never `scale()` to fake height/weight. Hair, face profile, accessory and outfit are identity components. Pose/expression/crop are state components. Every pose has visible hand contours; `prop_slot` is a hidden pose-aware anchor. Meme recipes can require a specific pose, expression, and crop on the initial state; the compiler checks those values before baking. Outfit accents are deterministic from `variant_seed`; there is no render-time randomness.

Historical character/hair/outfit lineage is provenance only. Ordinary character production uses native assembly. Specialist references supplied for a new job must be separately re-authored as V4 derivatives; direct-copy/relabel remains forbidden.


## Body silhouette QC (2.3.4)
Profile must alter actual native geometry, not renderer scale. `lean_tall` / `lanky_slouch` have visibly longer legs than `standard_compact`; `petite_compact` / `stocky_short` shorter legs; `round_soft` has broader shoulders and torso. Keep hands/prop anchors and leg endpoints coherent across poses; validate before visual review. Vary profile by roles, not at random. Approved character identities must be reopened for visual review if body profile changes.
