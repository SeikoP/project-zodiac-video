# Narrative Visual — Hình ảnh kể chuyện (Phase 1)

**Narrative Visual** is the single fresh storytelling-image concept. It is **optional**. Do not create one to satisfy a quota.

Use it only when one concrete image can explain a central story point more clearly than actor performance, a physical prop, or Story Text. If the scene is better served by a short readable phrase, choose Story Text instead. Phase 2 may never show Story Text and Narrative Visual in the same scene.

## One direction, not variants

When a Narrative Visual is justified, author exactly one concrete direction in `narrative_plan.narrative_visuals[]`. Do not create literal/metaphor/exaggeration variants. Do not browse a symbolic catalog.

Each direction contains:

- `id`: stable identity.
- `beat_ids[]`: the Narrative Plan beats it explains.
- `evidence_refs[]`: evidence supporting the Zodiac trait used by the image.
- `trait_basis`: the source-bounded Zodiac characteristic.
- `story_point`: the exact content point the viewer needs to understand.
- `viewer_read`: what a viewer should understand with audio muted.
- `visible_subject`: the concrete person/object relationship visible on screen.
- `visible_action`: the observable action or state change that carries meaning.
- `visual_idea`: one specific image composition, described literally enough to draw.
- `concept_fit`: why it belongs to this episode's selected concept.
- `centrality_reason`: why this point deserves the scene's focal semantic layer.
- `why_visual_not_text`: why an image communicates this better than Story Text.
- `tone_fit`: how the image preserves this episode's comic, sharp, restrained or warm tone.
- `payoff_image` (optional): a later concrete callback or resolution when the story actually needs one.

A direction must describe visible nouns and verbs. “Balance”, “pressure”, “conflict”, “choice” or “harmony” by themselves are not drawable ideas.

## Editorial test

Use a Narrative Visual only when all are true:

1. **Central:** removing it would make an important story turn harder to understand.
2. **Concrete:** the direction names a visible subject plus a visible action/state change.
3. **Zodiac-specific:** the meaning is tied to selected evidence, not a generic sign icon.
4. **Silent-readable:** a viewer can infer the intended point without hearing the line.
5. **Better than text:** a short Story Text card would communicate the point less effectively.

For Libra, a stock scale is not enough. A scale is acceptable only when the current story conflict is visibly encoded in what is on each side, who changes it, and what that change reveals. Otherwise use a more literal scene action or Story Text.

## Phase 2 handoff

Phase 2 references the direction by `phase1_visual_id`, binds an exact narration anchor, and authors the SVG/states/layout. It may refine execution but may not change the story point or invent another symbolic concept.
