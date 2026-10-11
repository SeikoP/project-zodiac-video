# Visual Grammar v4 selection guide

Per beat: choose one Frame Skeleton + one primary Mechanic, then bind existing entities. Scene Direction owns coordinates.

For each ordinary character, choose identity once in `.authoring/character-assembly-plan.json`:
`body_profile + hair_id + face_profile_id + outfit_id + accessory_id + stable variant_seed`.
Each character state chooses only `pose_id + expression_id`. State-level identity changes are invalid.

Frame families: `single-character-focus`, `two-person-offset`, `prop-focus`, `reaction-closeup`, `caption-payoff`.
Mechanics: `explain`, `react`, `show-object`, `offer-object`, `confront`, `reveal`, `payoff`.

Choose structural cues only when the authored intent needs them. Archive-frame shots retain only the selected frame with wall/floor; room profiles do not instantiate extra cues. Structural cues stay separate from story props. Select a notebook, book, water bottle, backpack, pen, headset, tissue box or mirror only when narration calls for it.

Visual Grammar and Character Assembly plans are compile-time only and never cross the runtime boundary.

## Minimal selection
Use selection-policy.json to load core guidance and only selected extensions. Archive frame means exact SVG bytes, transform and viewport clipping from the referenced ZIP; wall and floor stay. No automatic window, board, lamp, shadow, perspective or gradient. Derivatives need a new identity and visual review. Legacy assets remain resolvable. Furniture is an authored semantic prop.

## Required bounded guidance and selected catalogs
The entry capabilities for environment indexes, bedroom and meme adapters read this bounded guide and record a genuine read/application summary. Their `selected_guidance_uri` identifies the complete registry required when that extension is selected; `selection-policy.json` resolves all selected IDs to the complete references. With no selection bound, retain the legacy complete reference list. No context filtering can waive compiler, style, contact, lifecycle or approval validators.

Fresh hair selection starts with the preferred_meme tier: asym-bang, lopsided-bob, spiky-overthink, antenna-short, blocky-cut. Render a comparison on the same face/body/outfit before selecting. soft-wave, side-part, clean-bun, high-ponytail and twin-tail remain explicit compatibility choices, never automatic variety. No default accessory. Use actual performed actions to plan states; an explicit authored budget is enforced, without a universal cap.
