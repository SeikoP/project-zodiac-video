# Cast: design the people before browsing the catalog

Fresh casts use `zodiac-character-assembly-plan@2`. For each character author a **design intent first**; the catalog (`characters/components/catalog.json`) only supplies vocabulary.

## Required per character
- `role` (`lead`/`support`), `identity_tension` (the exact dramatic contradiction), `audience_read` (the first impression and why it matters).
- `selection_basis: story_first`. Never `catalog_first`.
- `decision_reasons` for `body_profile`, `hair_id`, `face_profile_id`, `outfit_id`, `shirt_color_id`. Each says how the choice serves the story, not that it was available. The lead has an explicit `shirt_color_id`.
- `rejected_alternative {choice, reason}`: one plausible design you consciously rejected.
- `scene_anchor {scene_id, excerpt, meaning}`: the excerpt is exact text from a scene where this character speaks or acts.
- `state_purposes`: one distinct reason per state id, tied to something the viewer sees. Never make five near-identical states to fake a simple reaction. Every reason is a full sentence (at least 18 characters).
- `reuse_strategy`: `native_assembly_after_story` or `new_native_asset_after_story`. Reuse is a cost decision made after directing.

## Identity
Identity = body profile + hair silhouette + outfit cue + shirt color. Pose, expression, crop are state. Choose identity once for the episode; a change reopens every scene that uses the character.
- Hair is a story choice, not a default. Spread across silhouette families (bob/lob, wave, long loose, braid, bun, half-up, ponytail); do not repeat the first long-hair option. Co-visible recurring people take different hair ids; deliberate matching (mirrors, twins) needs `design_intent.hair_reuse_reason` on every colliding character.
- Outfit `zodiac-glyph-shirt` requires the matching English `zodiac_sign_id` (e.g. `sagittarius`); otherwise use `plain-shirt`. Keep the sign's icon baked on the shirt without halos or rays. Never infer a supporting actor's sign.
- Leads default to a tall slim, feminine presentation unless the episode design asks otherwise. Two distinct cast identities per episode; a lone narrator-like recurring cast stays consistent.

## States
Give each member 4–6 state ids that cover neutral, the reaction beats and the acting beats of the story, using only known pose and expression ids (poses group by meaning: speaking, giving/taking, conflict, distress, joy, handling, calm, movement; expressions: flat, alarm, smug/sly, distress, relief). A pose written where an expression belongs (or the reverse) is a mistake, not a synonym. Default maximum is three unique character assets unless an exception reason exists; motion-only changes reuse the same SVG.

## The episode cast plan
`episode_cast_plan` = `{format:'zodiac-episode-cast-plan@1', bindings:[{member_id, entity_id, scene_ids, role:'member', reason}]}`. `member_id` is the English zodiac id of the sign the character stands for, `entity_id` is the cast entity, `scene_ids` lists EVERY scene that character appears in (every scene of the episode must be bound), and `reason` says in a full Vietnamese sentence why this character carries that sign in this story. The cast is designed from the production brief's `characters` and `story_read`, not from the catalog first.
