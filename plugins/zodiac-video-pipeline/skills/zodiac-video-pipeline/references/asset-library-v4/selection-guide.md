# Visual Grammar v4 selection guide

Per beat: choose one Frame Skeleton + one primary Mechanic, then bind existing entities. Scene Direction owns coordinates.

For each ordinary character, choose identity once in `.authoring/character-assembly-plan.json`:
`body_profile + hair_id + face_profile_id + outfit_id + accessory_id + stable variant_seed`.
Each character state chooses only `pose_id + expression_id`. State-level identity changes are invalid.

Frame families: `single-character-focus`, `two-person-offset`, `prop-focus`, `reaction-closeup`, `caption-payoff`.
Mechanics: `explain`, `react`, `show-object`, `offer-object`, `confront`, `reveal`, `payoff`.

For bedrooms use `bedroom-study-base`; for classrooms use `classroom-study`; for corridors use `school-hallway`. Structural cues stay separate from story props. Select a notebook, book, water bottle, backpack, pen, headset, tissue box or mirror only when narration calls for it.

Visual Grammar and Character Assembly plans are compile-time only and never cross the runtime boundary.

## Minimal selection
Use selection-policy.json to load core guidance and only selected extensions. Archive frame means exact SVG bytes, transform and viewport clipping from the referenced ZIP; wall and floor stay. No automatic window, board, lamp, shadow, perspective or gradient. Derivatives need a new identity and visual review. Legacy assets remain resolvable. Furniture is an authored semantic prop.

## Required bounded guidance and selected catalogs
The entry capabilities for environment indexes, bedroom and meme adapters read this bounded guide and record a genuine read/application summary. Their `selected_guidance_uri` identifies the complete registry required when that extension is selected; `selection-policy.json` resolves all selected IDs to the complete references. With no selection bound, retain the legacy complete reference list. No context filtering can waive compiler, style, contact, lifecycle or approval validators.
