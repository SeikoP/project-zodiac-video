# Creative Asset System — Narrative Visual ownership

## One fresh storytelling term

Fresh work uses **Narrative Visual — Hình ảnh kể chuyện** (`narrative_visual`) for symbolic/storytelling imagery. Story Object, Story Symbol and Visual Metaphor are legacy or runtime compatibility names, not separate creative categories.

## Two responsibilities

**Reusable construction assets**: character geometry, physical handled props, rig/contact mechanics, context accents, layout and motion mechanics. These may be selected from current registries for functional fit.

**Narrative Visual**: a scene-specific storytelling image whose meaning comes from the episode's Zodiac evidence, selected concept and Story Spine. It is not selected from a thematic illustration catalog.

## Ownership by phase

### Phase 1 — meaning and image direction

Phase 1 authors `narrative_plan.narrative_visuals[]` before narration is finalized. For each Narrative Visual it:

1. identifies the source-bounded Zodiac `trait_basis`;
2. connects it to the episode-specific `story_tension` and selected concept;
3. writes the silent-read `claim`;
4. compares `literal`, `metaphor` and `exaggeration` image candidates;
5. selects one candidate with a `selection_reason`;
6. defines the `humor_mechanism` and later `payoff_image`;
7. binds the direction to Narrative Plan beat IDs and evidence refs.

The three candidates are an ideation ladder, not three assets.

### Phase 2 — visual execution

Phase 2 reads the approved Phase-1 direction and authors the actual scene-specific SVG/states. It must not reopen the candidate competition or choose a stock zodiac metaphor.

Register a new Narrative Visual asset like this:

```json
{
  "creative_origin": {
    "mode": "phase1_directed",
    "phase1_visual_id": "NV1",
    "scene_id": "S01",
    "anchor_phrase": "exact words included in the approved narration"
  }
}
```

The scene's `narrative_brief.claim` must preserve the Phase-1 claim. Changing the claim or selected image direction is a Phase-1 revision, not a Phase-2 art tweak.

## Quality rules

- A Zodiac glyph or stock symbolic shape does not count merely because it resembles the sign.
- Prefer visual action, irony, escalation, contrast or callback that adds meaning beyond the spoken sentence.
- Humor is concept-dependent: use a visual joke when it fits, otherwise record a restrained mechanism rather than forcing comedy.
- Maintain a per-episode motif ledger. Reuse is intentional only when its meaning changes or continuity requires it.
- A beautiful static frame is insufficient when the approved direction promises progression or payoff.
- Run creative provenance, Narrative Visual kit lint, semantic fit, scene experience, endpoint inspection and genuine Visual Review.

## Compatibility

Historical visual-metaphor shapes and Story Object plans may still be read by explicit compatibility paths. They are not fresh-authoring inspiration or selectable Narrative Visual defaults.
