# Runtime / Authoring Boundary — renderer 2.0

## Visual Compile owns semantics
- entity/state/action/event order and voice anchors;
- Frame/Mechanic selection;
- character identity blueprint (`body_profile`, `hair_id`, fixed balanced face, plain/intrinsic-glyph shirt, optional `zodiac_sign_id` and `shirt_color_id`) and state (`pose_id`, `expression_id`, optional `crop_id`);
- meme adapter selection, existing-entity role bindings, required contacts, caption slot and composition-specific role boxes;
- supporting scene-set/contained-accent selection and semantic Scene Direction roles.

## Semantic Assets owns compiled geometry
1. native Character Assembly + identity/outfit validation;
2. native props with explicit object/state bindings;
3. deterministic Environment Compile + binding validation;
4. Scene Direction after final character/environment entities exist;
5. Visual Quality over the final authoring package.

Character components, Visual Grammar, meme adapter metadata and environment composition metadata remain authoring-only. Runtime receives baked SVG assets and ordinary entities.

## Typography + brand overlay
Caption text and runtime watermark share the demo CSS stack `"Patrick Hand", "Segoe Print", cursive`. `caption_style.font_family` retains `Patrick Hand` for backwards compatibility while `caption_style.css_font_family` and `font_stack` carry the exact demo behavior.

The `✦ bungmoto` watermark is a runtime brand overlay in `visual_system.brand_overlay`; it must not be baked into reusable SVG assets. Canonical layer is 30, below subtitle layer 40.

## Handoff is a strict boundary
`compile-job-v5.mjs` exports semantic Authoring IR as `zodiac-job@5`. It does **not** repair semantic authoring errors or add runtime performance defaults. The package pins `zodiac-renderer@2.0.1` and carries explicit motion intent and duration.

## Local renderer `zodiac-renderer@2.0.1`
Character state changes select a complete SVG asset. The renderer does not rig-animate limb groups inside those SVGs. Plan the minimum necessary character states from actual changes in action or expression, without a fixed state count. Reuse the same SVG state when an authored beat only requires emphasis; do not add redundant SVGs.

The local Control Plane measures timing and compiles the semantic handoff for rendering. Production entities and assets remain ordinary renderer inputs; authoring-only character component plans and library metadata stay out of the ZIP.
