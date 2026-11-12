# Narrative Visual — Hình ảnh kể chuyện (Phase 2 execution)

Fresh authoring uses one term only: **Narrative Visual** (`narrative_visual`). Phase 1 owns the creative direction in `narrative-plan.json:narrative_visuals[]`; Phase 2 materializes that direction. Story Object, Story Symbol and Visual Metaphor are compatibility/runtime vocabulary only.

## Phase 2 responsibilities

1. **Read the Phase-1 direction.** Select the relevant `narrative_visuals[]` entry by `id`. Do not run a second literal/metaphor/exaggeration competition and do not substitute a thematic catalog asset.
2. **Bind to the approved narration.** Choose an exact spoken `anchor_phrase` from the final narration and map the Phase-1 `beat_ids[]` to the scene/director beats that realize it.
3. **Write the scene brief.** `art_direction.narrative_brief.claim` must preserve the Phase-1 `claim`. Add only scene-specific state changes and exact narration anchors; changing the claim or selected image direction requires reopening Phase 1.
4. **Author the SVG.** One scene-specific SVG identity may contain multiple visibility/state groups. Human Stroke v2 stays: authored paths, no runtime jitter, filters or random wobble.
5. **Record provenance.** Every new Narrative Visual asset uses:
   ```json
   {
     "creative_origin": {
       "mode": "phase1_directed",
       "phase1_visual_id": "NV1",
       "scene_id": "S01",
       "anchor_phrase": "exact words in the approved narration"
     }
   }
   ```
6. **Reuse check.** Repetition is editorial review, not automatic failure. Reuse is acceptable only when continuity or callback meaning justifies it.
7. **Kit lint.** `validate-narrative-visual-assets.mjs` checks SVG safety, viewBox, focal paths, area, canvas placement and caption-safe zones.
8. **Blind readback (optional).** Rasterize the compiled frame and ask a fresh reviewer what story it communicates. Compare that answer with the Phase-1 claim. User Visual Review remains the approval.

## Blocking rule

For a fresh Phase-1-directed run, `narrative_visual_decision.mode=required` is not satisfied by a proposal paragraph, a compatibility asset, a generic zodiac icon or a coverage layer marked `omit`. The authored `visual-intent.json` must own an entity, native asset path, exact narration anchor, state/event semantics, and `creative_origin.phase1_visual_id` that resolves to the approved Narrative Plan.

Phase 2 may refine **how** the selected image is drawn, placed and transitioned. It may not replace **what the image means** without reopening Phase 1.
