# Hình kể chuyện — Hình ảnh kể chuyện (Phase 1)

**Hình kể chuyện** is the single fresh storytelling-image concept. It is **optional**. Do not create one to satisfy a quota. Omission must be an explicit Phase-1 editorial decision in the approved Narrative Plan: `story_visual_decision={mode:"omitted",reason:"..."}`. Name the concrete actor/physical-prop action or text that makes another image unnecessary. An absent or empty array alone is incomplete input, not a decision. Export and Local import block it.

Use it only when one concrete image can explain a central story point more clearly than actor performance, a physical prop, or chữ trong hình. If the scene is better served by a short readable phrase, choose chữ trong hình instead. Phase 2 may never show chữ trong hình and Hình kể chuyện in the same scene.

## One direction, not variants

When a Hình kể chuyện is justified, author exactly one concrete direction in `narrative_plan.story_visuals[]`. Do not create literal/metaphor/exaggeration variants. Do not browse a symbolic catalog.

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
- `contribution`: why an image communicates this better than chữ trong hình.
- `tone_fit`: how the image preserves this episode's comic, sharp, restrained or warm tone.
- `payoff_image` (optional): a later concrete callback or resolution when the story actually needs one.

A direction must describe visible nouns and verbs. “Balance”, “pressure”, “conflict”, “choice” or “harmony” by themselves are not drawable ideas.

## Editorial test

Use a Hình kể chuyện only when all are true:

1. **Central:** removing it would make an important story turn harder to understand.
2. **Concrete:** the direction names a visible subject plus a visible action/state change.
3. **Zodiac-specific:** the meaning is tied to selected evidence, not a generic sign icon.
4. **Silent-readable:** a viewer can infer the intended point without hearing the line.
5. **Better than text:** a short chữ trong hình card would communicate the point less effectively.

For Libra, a stock scale is not enough. A scale is acceptable only when the current story conflict is visibly encoded in what is on each side, who changes it, and what that change reveals. Otherwise use a more literal scene action or chữ trong hình.

## Show the missing information

Start with the exact narration sentence. Name what the audience still cannot see or infer from the actors and physical props. If nothing is missing, omit Hình kể chuyện. Repeating the sentence as a pictogram adds no information.

Describe two drawable endpoints: who has what before, who does what, and what visibly differs afterward. `viewer_read` describes the causal fact a viewer can point to, rather than a feeling such as pressure, loneliness or responsibility. A color change, floating icon, enlarged object or abstract meter alone does not show that cause.

For the Ma Ket responsibility story, a battery draining beside a clock does not explain why the partner stops helping. Show the offered hand, the task being taken back, and the hand withdrawing. Those are actor/physical-prop actions, so they do not need an additional Hình kể chuyện. Likewise, handing over the real shopping bag already explains the ending; an abstract permission icon would dilute it.

When an actual comparison cannot be staged clearly with the cast, one concrete diagram can earn its place: show the same three recognizable task objects moving from two people's sides to one person's side while the other side becomes empty. Specify object identities, ownership, order and the exact consequence; generic dots or arrows labelled only as responsibility do not carry that information. Use this only when approved narration supports the comparison and the simpler physical action cannot do the job.

Before approving the direction, describe the image without using the narration's abstract nouns. Then remove it mentally: state the specific fact or story turn that is lost. If no fact is lost, omit it. This is an editorial judgment, not something field lengths or SVG lint can certify.

## Phase 2 handoff

Phase 2 references the direction by `phase1_visual_id`, binds an exact narration anchor, and authors the SVG/states/layout. It may refine execution but may not change the story point or invent another symbolic concept.
