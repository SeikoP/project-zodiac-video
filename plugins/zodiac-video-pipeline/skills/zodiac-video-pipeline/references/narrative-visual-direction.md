# Narrative Visual — Hình ảnh kể chuyện (Phase 1)

**Narrative Visual** is the only fresh-authoring term for the symbolic/storytelling image layer. Machine identifier: `narrative_visual`. Older names such as Story Object, Story Symbol and Visual Metaphor are compatibility vocabulary only and must not be offered as fresh creative choices.

Phase 1 owns the idea. Phase 2 owns only execution.

## Phase 1 direction

After Evidence and concept selection, author `narrative_plan.narrative_visuals[]`. Start from the source-bounded Zodiac mechanism/facet, then connect it to the selected concept and Story Spine. Do not start from an asset catalog.

Each direction contains:

- `id`: stable Narrative Visual identity.
- `beat_ids[]`: Narrative Plan beats whose meaning it advances.
- `evidence_refs[]`: evidence supporting the Zodiac trait/tension used by the image.
- `trait_basis`: the supported Zodiac characteristic being visualized.
- `story_tension`: the concrete contradiction or pressure in this story.
- `claim`: what a viewer should understand from the image with audio muted.
- `concept_fit`: why this image belongs to the selected concept rather than merely matching the sign.
- `concept_candidates.literal|metaphor|exaggeration`: three genuinely different image ideas.
- `selected_concept`: the chosen lane.
- `selection_reason`: why it reads best and advances the story.
- `humor_mechanism`: the visual joke, comic escalation, irony or deadpan relationship; do not add humor when the concept calls for restraint.
- `payoff_image`: how the same idea lands, changes meaning or resolves later.

The candidate ladder is an ideation tool, not three assets to render. One selected direction is handed to Phase 2.

## Selection rule

Prefer an image that passes all four editorial questions:

1. **Zodiac-specific:** is it grounded in the selected evidence/facet?
2. **Concept-fit:** does it advance this episode's premise and Story Spine?
3. **Visual read:** can the essential meaning be understood without narration?
4. **Story value:** does it add a joke, pressure, contrast, callback or payoff instead of repeating the spoken sentence?

A zodiac glyph, stock balance scale, generic heart, question mark or other ready-made symbol is not sufficient merely because it resembles the sign.

## Phase 2 handoff

Phase 2 must reference the Phase 1 direction by `phase1_visual_id`, bind it to an exact narration phrase, and author the SVG/states/layout. Phase 2 must not regenerate the literal/metaphor/exaggeration competition or substitute a prebuilt thematic illustration.

Historical assets and contracts remain readable only through explicit compatibility paths.
