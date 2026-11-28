# Creative Asset System

Fresh storytelling imagery has one semantic type: **Hình kể chuyện / Story Visual** (`story_visual`). It is not a reusable asset-library category.

## Ownership

**Phase 1** explores original visual expressions of approved meaning and normally selects a compelling one. No per-scene quota; a specific physical situation is not required. Directions retain the existing story point, viewer read, drawable subject/state, visual idea, contribution and optional lettering. Phase 2 invents the drawing.

**Phase 2** executes that direction. It may change geometry, state assets, placement, transitions and lettering treatment, and freely invent or refine the symbol within the approved meaning; changing the meaning requires review.

## One semantic owner

A Story Visual may be:
- illustration;
- outlined lettering;
- or illustration plus outlined lettering.

Optional `lettering` belongs to the same Story Visual entity/state/SVG asset. It is never a second role, overlay entity, coverage lane or approval path. Runtime captions remain separate.

Story Visual is valid only when:
- it expresses an approved story point, emotion, joke or reframe;
- its visible subject and action/state are concrete;
- it is tied to the approved Zodiac evidence/concept;
- its visual composition is legible at phone size; narration may supply context;
- it adds clarity, wit, emphasis, emotional impact or memorability beyond the other layers.

Generic zodiac glyphs, stock scales, hearts, question marks and decorative symbols do not qualify by themselves.

## Phase 2 provenance

Every visible Story Visual asset records:

```json
{
  "creative_origin": {
    "mode": "phase1_directed",
    "phase1_visual_id": "SV1",
    "scene_id": "S01",
    "anchor_phrase": "exact approved narration"
  }
}
```

Run Story Visual presence/provenance, kit lint, semantic event, scene experience, endpoint preview and genuine Visual Review. If lettering is present, it must be outlined inside the same Story Visual asset and validated through that same lineage/coverage path.

Reusable construction assets remain characters, physical props, context accents, layouts and motion mechanics. Story Visual itself is always scene-authored from Phase-1 meaning, never selected from a thematic catalog.
