# Creative Asset System

Fresh storytelling imagery has one semantic type: **Narrative Visual — Hình ảnh kể chuyện** (`narrative_visual`). It is not an asset-library category.

## Ownership

**Phase 1** decides whether a Narrative Visual is justified. There is no quota. When used, `narrative_plan.narrative_visuals[]` contains one concrete drawable idea per visual: source-bounded trait, exact story point, silent viewer read, visible subject/action, concept/tone fit, centrality reason, and why image communicates better than Story Text.

**Phase 2** executes that direction. It may change geometry, states, placement and transition mechanics, but it may not change the story point or invent another symbol.

## Scene focus

A scene may use **Narrative Visual or Story Text, never both**. Actors, physical props, Scene Accent, optional reaction effects/meme acting and runtime captions are separate layers.

Narrative Visual is valid only when:

- it explains a central story point;
- its visible subject and action/state are concrete;
- it is tied to the approved Zodiac evidence/concept;
- it remains understandable with audio muted;
- it is more useful than a short Story Text phrase.

Generic zodiac glyphs, stock scales, hearts, question marks and other decorative symbols do not qualify by themselves.

## Phase 2 provenance

Every visible Narrative Visual asset records:

```json
{
  "creative_origin": {
    "mode": "phase1_directed",
    "phase1_visual_id": "NV1",
    "scene_id": "S01",
    "anchor_phrase": "exact approved narration"
  }
}
```

Run Narrative Visual presence/provenance, kit lint, semantic event, scene experience, endpoint preview and genuine Visual Review. Reuse is allowed only when the callback/continuity meaning is explicit.

Reusable construction assets remain characters, physical props, context accents, layouts and motion mechanics. Narrative Visual itself is always scene-authored from Phase 1 meaning, never selected from a thematic catalog.
