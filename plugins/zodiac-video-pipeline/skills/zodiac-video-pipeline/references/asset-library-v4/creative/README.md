# Creative Asset System

Fresh storytelling imagery has one semantic type: **Hình kể chuyện / Story Visual** (`story_visual`). It is not a reusable asset-library category.

## Ownership

**Phase 1** decides whether a Story Visual is justified. There is no quota. When used, `narrative_plan.story_visuals[]` contains one concrete direction with the exact story point, muted viewer read, visible subject/action, visual idea, contribution and optional semantically required lettering.

**Phase 2** executes that direction. It may change geometry, state assets, placement, transitions and lettering treatment, but it may not change the approved meaning or invent another symbol.

## One semantic owner

A Story Visual may be:
- illustration;
- outlined lettering;
- or illustration plus outlined lettering.

Optional `lettering` belongs to the same Story Visual entity/state/SVG asset. It is never a second role, overlay entity, coverage lane or approval path. Runtime captions remain separate.

Story Visual is valid only when:
- it explains a central story point;
- its visible subject and action/state are concrete;
- it is tied to the approved Zodiac evidence/concept;
- it remains understandable with audio muted;
- it adds information beyond actor performance, physical props and environmental context.

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
