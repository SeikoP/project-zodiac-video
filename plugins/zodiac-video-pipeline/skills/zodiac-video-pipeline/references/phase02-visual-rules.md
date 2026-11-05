# Phase 02 — visual selection & authoring rules

Moved verbatim from SKILL.md so Phase 01 and Phase 03 work does not load them. The Fresh Run Isolation rule stays in SKILL.md. Read this file in full before any Phase 02 authoring or visual selection.

## Current visual selection
Current visual selection uses a fixed native face, plain or intrinsic zodiac-glyph shirts with selected colors, no accessories by default; optional restrained reaction/effect assets remain allowed when narration or acting requires them. Preserve the sign's icon baked on its shirt; omit decorative halos, rays and floating marks around that icon. Never infer a supporting actor's sign. Prefer feminine presentation with a tall slim silhouette for leads unless explicit episode design requests otherwise. Preserve pose/expression acting, props, symbolic story objects and supporting backdrops.

## Scene Accents
Scene Accents are optional context cues with explicit per-beat use/omission in Visual Coverage. Fresh accents have their own authoring category `scene_accent`, canvas-relative placement, optional actor-relative anchor, rear layering, one reusable SVG per identity, and voice-anchored visibility states. They do not require a Scene Set and must not constrain character positioning. Canvas, spatial and caption safety remain mandatory.

Scene accents are sparse narrative context cues, not a permanently decorated room. Their `initial_state` and boolean visibility `states` may be driven by ordinary voice-anchored events, reusing one SVG. Define when each cue enters and leaves; string lights suit a narrated birthday, while cafe cues only accompany the cafe passage. One continuous scene can contain many visual story turns. Narrative Visuals communicate thoughts, feelings and symbolic meaning independently of backdrop accents; simple visuals do not require setup/friction/payoff. Historical Story Object V2 remains importable and may play within one native scene without splitting approved narration paragraphs.

## Visual coverage before SVG compilation
Fresh Phase 02 requires per-beat visual_coverage in Visual Intent art_direction before SVG compilation. Fill actor, optional Scene Accent, Narrative Visual, ordinary prop, support and caption decisions with actual references or explicit omissions. The native seam and Visual Quality enforce coverage; a symbolic metaphor cannot substitute for ordinary props used by the narration.



## Scene Experience review

Fresh 2.6.9+ runs review story experience before native SVG generation. This is not a decoration-density quota.

For each scene, explicitly consider character action, environment specificity, physical storytelling, depth separation, secondary action, visual callback and Narrative Visual role. Behavior or relationship narration should have an authored story action or meaningful physical/Narrative Visual progression; a passive actor plus passive context cue is a REVIEW condition, not a sufficient scene.

Sparse composition remains valid for reflection/payoff beats when negative space serves the semantic job and the omission rationale is explicit. Never add props, Scene Accents, effects or Narrative Visuals only to make a checklist green.

If narration explicitly involves a physical object, a symbolic Narrative Visual cannot replace that physical storytelling obligation. Scene Accents remain rear/context-only and independent from actor composition.
