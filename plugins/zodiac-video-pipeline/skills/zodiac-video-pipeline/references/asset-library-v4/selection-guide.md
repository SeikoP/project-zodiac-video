# Visual Grammar v4 selection guide

Start with the selected **scene-set** (the stable wall/floor/frame stage). Use `capability-index.json` to resolve current scene/layout/interaction/effect capabilities before authoring; `coverage-matrix.json` is the audit view of supported narrative needs. Per beat, choose one shot-layout (historically `Frame Skeleton`) + one primary Mechanic, then bind existing entities. Scene Direction owns coordinates. `frames/` remains the compatibility path for shot-layout metadata; it is not the scene-set library.

For each ordinary character, choose identity once in `.authoring/character-assembly-plan.json`:
`body_profile + hair_id + face_profile_id + outfit_id + accessory_id + stable variant_seed`.
Each character state chooses only `pose_id + expression_id`. State-level identity changes are invalid.

Frame families: `single-character-focus`, `two-person-offset`, `prop-focus`, `reaction-closeup`, `caption-payoff`.
Mechanics: `explain`, `react`, `show-object`, `offer-object`, `confront`, `reveal`, `payoff`.

Choose structural cues only when the authored intent explicitly selects `selected_cues`. Fresh archive-frame/scene-set shots retain the selected outer frame with wall/floor and do not instantiate window/sofa/table/room cues. Optional `scene_accent` details stay inside the scene-set `wall_region`. Structural cues stay separate from story props. Select a notebook, book, water bottle, backpack, pen, headset, tissue box or mirror only when narration calls for it.

Visual Grammar and Character Assembly plans are compile-time only and never cross the runtime boundary.

## Minimal selection
Use selection-policy.json to load core guidance and only selected extensions. Archive frame means exact SVG bytes, transform and viewport clipping from the referenced ZIP; wall and floor stay. No automatic window, board, lamp, shadow, perspective or gradient. Derivatives need a new identity and visual review. Legacy assets remain resolvable. Furniture is an authored semantic prop.

## Required bounded guidance and selected catalogs
The entry capabilities for environment indexes, bedroom and meme adapters read this bounded guide and record a genuine read/application summary. Their `selected_guidance_uri` identifies the complete registry required when that extension is selected; `selection-policy.json` resolves all selected IDs to the complete references. With no selection bound, fresh runs retain core guidance only. Complete extension indexes load only when the corresponding extension is explicitly selected or when `selected_cues` / `legacy` compatibility mode is requested. No context filtering can waive compiler, style, contact, lifecycle or approval validators.

Fresh hair selection starts with the preferred_meme tier: asym-bang, lopsided-bob, spiky-overthink, antenna-short, blocky-cut. Render a comparison on the same face/body/outfit before selecting. soft-wave, side-part, clean-bun, high-ponytail and twin-tail remain explicit compatibility choices, never automatic variety. No default accessory. Use actual performed actions to plan states; an explicit authored budget is enforced, without a universal cap.

For a fresh scene-set select environment.scene_set_id and explicit scene_accents only. Role-specific visual_identity_intent records silhouette_priority, reference_notes, reference_entity_id and identity_lock; references never transfer between cast members. Review .authoring/character-identity-preview/index.html before assembling full scenes. preferred_meme is a default tier, not a ban on explicitly reviewed high-ponytail or other compatibility hair.