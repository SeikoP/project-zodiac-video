# Hình kể chuyện — Phase 1 direction

**Hình kể chuyện** (`story_visual`) makes one story fact visible: who does what, what changes, and what that change means. Start from the exact narration beat, not a symbol or asset catalog. A viewer must recognize the participants and infer the consequence without reading your brief or hearing the voice. It is optional, with no quota. Omission is an explicit approved Narrative Plan decision: `story_visual_decision={mode:"omitted",reason:"..."}`.

A Story Visual may be an illustration, outlined lettering, or both in the same visible state and SVG asset. Lettering is not a separate Phase-2 concept or layer.

## Author one concrete direction

When justified, add one concrete direction to `narrative_plan.story_visuals[]` for the story point it owns. Do not generate literal/metaphor/exaggeration variants or browse a symbolic catalog.

Each direction contains:
- `id`: stable identity;
- `beat_ids[]`: beats it explains;
- optional `evidence_refs[]`: copy real source IDs only when the approved plan/candidate carries them; lightweight handoffs may inherit evidence lineage through approved `beat_ids` plus the plan evidence boundary;
- `story_point`: exact content point the viewer needs to understand;
- `viewer_read`: what a muted viewer should infer;
- `visible_subject`: concrete person/object relationship on screen;
- `visible_action`: visible action or state change;
- `visual_idea`: drawable endpoints, not an abstract noun;
- `contribution`: the specific information lost if this Story Visual is removed;
- optional `lettering[]`: exact short wording required for the visual meaning.

Phase 2 owns drawing geometry, state layout and lettering treatment. It does not rewrite these semantic fields.

## Editorial test

Use a Story Visual only when all are true:

1. **Central:** removing it makes an important turn, comparison or consequence harder to understand.
2. **Concrete:** it names a visible subject plus a visible action/state change.
3. **Zodiac-grounded:** the meaning follows the selected evidence/concept rather than a generic sign icon.
4. **Silent-readable:** a viewer can infer the intended fact with audio muted.
5. **Additive:** it contributes information beyond actor performance, physical props and environmental context.

Generic scales, hearts, batteries, question marks, abstract meters, arrows between anonymous dots or decorative color changes fail this test unless the story-specific identities and causal change are visibly encoded.

## Lettering inside the visual

Use `lettering[]` only when the exact words are part of what the viewer must read. Keep it short. The words and drawing are not two competing concepts: Phase 2 bakes the lettering into the same Story Visual state/asset, using outlines rather than live SVG text.

## Ma Kết reference direction

For each idea write a before -> change -> consequence sentence. Example: both people own tasks -> recognizable tasks move to Ma Ket -> the partner has no remaining task. The labels identify ownership; the large zero communicates the consequence. A battery losing charge would only suggest tiredness and miss the relationship.

For the responsibility story, three accepted uses are:
- **B2:** recognizable task objects visibly move from two people's ownership to one person's side, so the workload concentration is readable rather than represented by an abstract pressure icon;
- **B4:** repeated refusal and the other person's withdrawal are shown as one causal progression; any short refusal wording is integrated into the same states rather than becoming an independent text overlay;
- **B6:** the real bag/ownership handoff remains physical, while any permission wording used for the payoff is integrated into the same Story Visual state when it materially sharpens the viewer read.

Do not add a battery, permission icon, balance glyph or other symbolic decoration when the cast and real prop already communicate the fact. The Story Visual must earn its space by adding information.

## Phase 2 handoff

Phase 2 references the direction by `phase1_visual_id`, binds exact narration anchors, and authors one `story_visual` entity with state assets. Optional lettering is metadata on those states. Supply enough story context to execute without guessing: whose objects these are, their starting ownership, the visible change, its consequence, necessary words and the exact reveal anchor. A final result or repetition count must not appear before it happens in narration. Inspect the actual phone-size before/after images; field completeness alone cannot prove comprehension.
