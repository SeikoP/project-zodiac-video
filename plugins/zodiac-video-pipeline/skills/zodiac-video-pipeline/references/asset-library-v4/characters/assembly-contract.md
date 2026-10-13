# Native Character Assembly v4

New ordinary characters are compile-time assemblies, not copied character SVG variants.

Identity is chosen once per `entity_id`:
`body_profile + hair_id + face_profile_id + outfit_id + shirt_color_id + accessory_id + stable variant_seed`. The native face is fixed and expressive; no face-profile menu or identity marks/accessories are available.
If omitted, `face_profile_id` resolves to `balanced` and `accessory_id` resolves to `none`.
When the plan omits `shirt_color_id`, Character Assembly deterministically assigns a native palette color and avoids duplicate colors among characters visible in the same scene while palette capacity allows. The chosen color is stored in the character blueprint and remains fixed across all states. State may change `pose_id + expression_id` and an optional compile-time `crop_id` for reaction shots. Crop does not alter identity.

Canonical component catalog: `components/catalog.json`.
Plan: `.authoring/character-assembly-plan.json` using `zodiac-character-assembly-plan@2` for new work (requires intentional character design from Story Spine). Legacy @1 remains supported for existing packages.

## Plan state assets before SVG creation
Plan only performed actions and expressive changes before compilation. There is no universal state count. Repeated names with the same planned identity/pose/expression/crop share one key before SVG creation; no byte dedupe after generation. Optional asset_budget.max_unique_states enforces the authored limit and needs no invented exception narrative.

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

Body profiles use authored path geometry, never `scale()` to fake height/weight. Body, hair and shirt color are selectable identity components. The shirt is plain and the native face is fixed. Pose/expression/crop are state components. Every pose has visible hand contours; `prop_slot` is a hidden pose-aware anchor. Meme recipes can require a specific pose, expression, and crop on the initial state; the compiler checks those values before baking. Outfit accents are deterministic from `variant_seed`; there is no render-time randomness.

Historical character/hair/outfit lineage is provenance only. Ordinary character production uses native assembly. Specialist references supplied for a new job must be separately re-authored as V4 derivatives; direct-copy/relabel remains forbidden.


## Body silhouette QC (2.3.4)
Profile must alter actual native geometry, not renderer scale. `lean_tall` / `lanky_slouch` have visibly longer legs than `standard_compact`; `petite_compact` / `stocky_short` shorter legs; `round_soft` has broader shoulders and torso. Keep hands/prop anchors and leg endpoints coherent across poses; validate before visual review. Vary profile by roles, not at random. Approved character identities must be reopened for visual review if body profile changes.

## Minimal resting geometry
rest_sitting uses authored bent knees in a 520×800 viewport; rest_lying uses a horizontal torso and extended limb paths in 900×760 viewBox. Neither rotates the full SVG. Preserve identity fields and plan state budget before compile. Compiler exposes left_grip/right_grip/prop_slot/seat sockets matching hand geometry, including write. Placement must honor intrinsic ratio and sofa support behind the actor; catalog integrity is separate from episode contact pixels and runner motion checks. New resting assets require visual review.

Lead casting defaults prefer feminine presentation and tall slim body profiles; explicit episode selection wins. `zodiac-glyph-shirt` requires one of the twelve native `zodiac_sign_id` values and bakes only its chest glyph. Plain shirts remain available for actors whose sign is not specified. The sign joins the identity hash and blueprint so different signs cannot reuse an incorrect baked asset. No surrounding icon decoration is restored.
