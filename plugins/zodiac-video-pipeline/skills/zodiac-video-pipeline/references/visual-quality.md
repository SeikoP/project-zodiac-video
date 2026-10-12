# Visual Quality Gate — v1.54

Visual Production must pass semantic fit, native Character Assembly, identity/diversity, Human Stroke v2, pose/contact readability, frame composition and environment quality before VISUAL REVIEW.

## Native character quality
- Every ordinary character has one identity blueprint: `body_profile + hair_id + face_profile_id + outfit_id + shirt_color_id + accessory_id`.
- Shirt colors stay fixed across states and differ between simultaneously visible characters when the native palette has enough choices.
- State may change only `pose_id + expression_id + crop_id`.
- Body profiles are authored geometry; `scale()` is not a body-type system.
- Native catalog covers 6 body profiles, 10 hair families, 4 face profiles, 2 accessories, 17 outfits, 9 expressions and 19 poses.
- Every compiled pose has visible hand contours; `prop_slot` is a hidden pose-aware anchor.
- Outfit core geometry is distinct across all 17 outfit IDs; small accents may vary deterministically by seed.
- Character Assembly runs before Scene Direction. Compiled output must pass `validate-character-assembly.mjs`, `validate-outfit-bake-v4.mjs` and Human Stroke v2.

## Semantic assets
Primary story reuse requires fit >=0.80; supporting reuse >=0.55; `reuse_near_match` is forbidden. Low-fit primary needs derive V4 assets. Historical geometry may inform semantics but cannot be direct-copied/relabelled.

## Cast diversity
Different recurring visible people should differ by body/silhouette when practical. Hair/outfit differences do not replace silhouette diversity. Identity cannot drift across states.

## Environment + frame
Current scene-sets provide spatial depth. Optional scene accents are separately selected and wall-contained; actor geometry is not wall-contained. Keep caption/face readability and relational two-person separation.

Run declared Phase 2 validators before VISUAL REVIEW. Failures repair the loose workspace; newly produced assets must pass V4 validation.
