# Creative Asset System — 2.6.16

## Two separate responsibilities

**Reusable construction assets**: human-stroke silhouette primitives, people/body/hair/outfits, physical handled props, rig, contact mechanics, scene accents, motion grammar, safe-area layouts. Build once and select for *functional* fit. The twelve new SVG props in `props/index.json` are physical nouns, not prefabricated story beats.

**Must be authored for the scene**: Narrative Visual, psychological metaphor, relationship pressure, transformation, ironic reveal, scene-specific evidence, visual punchline, and payoff. Never select a prefabricated thematic illustration just because the Zodiac sign matches. An existing visual metaphor in the legacy catalog is a shape compatibility reference, not the default creative answer in fresh production.

## Required process for fresh Phase 2

1. For each beat, declare **the concrete psychological claim** and exact voice anchor. Determine the actors and causal object/action relationship before choosing artwork.
2. Develop **three distinct candidate images** (literal situation / metaphor / exaggeration). Choose one based on new information, readability and payoff continuity. Record discarded ideas and why the winner was selected.
3. For a scene-original symbolic illustration, author SVG specifically for that scene and register the asset under `intent.assets[asset_id].creative_origin`:

   ```json
   {
     "mode": "scene_authored",
     "scene_id": "S01",
     "claim": "A character quietly absorbs the cost of a promise",
     "anchor_phrase": "exact words included in S01 narration",
     "concept_candidates": {
       "literal": "A hand holding the other person's unfinished checklist",
       "metaphor": "A single thread pulling three different obligations",
       "exaggeration": "A tower of unfinished promises bending toward the hero"
     },
     "selected_concept": "metaphor",
     "selection_reason": "The thread can tighten across an actual acting beat"
   }
   ```

4. Bind visual states, events, authored placement and scene narration. The graphic may be sparse or static when that strengthens meaning. Do **not** add visual objects just to satisfy a numeric quota.
5. Run `node features/visual-composition/validate-creative-asset-provenance.mjs <workspace>` before native compile for fresh Narrative Visual authoring. This must report `PASS` (or `NOT_APPLICABLE` for a non-fresh run). Block missing provenance, mismatched scene ownership, missing voice anchors, unsafe SVG and unexplained repeated graphic bytes across different scenes. The checker does **not** judge artistic quality.
6. Run existing Narrative Visual SVG kit lint, semantic fit, scene experience, frame inspection and genuine Visual Review. Inspect endpoints: a beautiful static frame alone does not prove narrative progression.

## Avoid repetitive visuals

Maintain a per-episode **visual motif ledger**: unique object purpose, state transition, emotional pressure and relation to other objects. Repetition is intentional only when its meaning changes; reuse across unrelated scene claims requires a reviewer and explicit reason. No random stock asset roulette.

## Character design

Feminine leads are preferred where approved. Keep character identity consistent per person while varying *between* cast members: overall body silhouette, hair family, wardrobe color and expression/pose. A new hair silhouette is not a substitute for acting, and hair must remain readable in profile, crop and reveal. The existing expanded hair catalogue contains 18 profiles; do not revert to a single default ponytail.

## Handoff boundaries

Creative preflight cannot forge a phase gate or user approval; receipts remain in the existing manifest chain. No local runner, MP4 or timing work is part of plugin E2E. Existing approved narration and images remain unchanged unless explicitly revised.
