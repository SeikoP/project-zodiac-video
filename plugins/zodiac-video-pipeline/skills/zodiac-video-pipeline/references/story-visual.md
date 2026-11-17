# Hình kể chuyện — Story Visual

`story_visual` is the **only active storytelling-image concept** for fresh production. It is optional and Phase 1 owns its meaning; Phase 2 only executes the approved direction.

A Story Visual can be:
- an illustration;
- outlined lettering;
- or illustration and outlined lettering combined.

Those are expressions of the **same entity, same visible state and same SVG asset**. Optional `lettering` metadata describes the words and treatment for that Story Visual state. It is never a second entity kind, overlay role, coverage layer, approval path or competing focal concept.

## When to use it

Use a Story Visual only when it adds a central fact, relationship, comparison or consequence that actor performance, physical props and scene context do not already make clear. There is no per-video quota. Quiet scenes may omit it explicitly.

Reject generic symbols, zodiac glyphs, abstract nouns, decorative meters, floating icons or color changes that merely restate the narration. A Story Visual must preserve the approved Phase-1 `story_point`, `viewer_read`, `visible_subject`, `visible_action` and `visual_idea`.

When exact words are part of the meaning, Phase 1 may include optional `lettering`. Phase 2 may choose its style and placement, but the words remain inside the same Story Visual state/asset. Runtime captions stay separate and runtime-owned.

## Phase 1 direction

Fresh Narrative Plans use `story_visuals[]` plus an explicit `story_visual_decision`.

A direction contains:
- `id`;
- `beat_ids[]`;
- optional `evidence_refs[]`: use when the current approved plan actually carries source IDs; otherwise evidence lineage is inherited through the approved `beat_ids` and plan evidence boundary;
- `story_point`;
- `viewer_read`;
- `visible_subject`;
- `visible_action`;
- `visual_idea`;
- `contribution`: the specific information the Story Visual adds beyond the actor/prop/context performance;
- optional `lettering[]`: exact short wording that is semantically necessary.

If no Story Visual is needed, Phase 1 records `story_visual_decision={mode:"omitted",reason:"..."}`. Absence is not an omission decision.

## Phase 2 execution

1. Read the selected Phase-1 direction by `id`; never invent a replacement meaning.
2. Bind it to exact approved narration and the matching director beat.
3. Author `art_direction.narrative_brief` with the Phase-1 identity, story point, viewer read, exact anchor and concrete state changes.
4. Author one scene-specific `story_visual` entity. Each visible state points to one `story_visual` SVG asset.
5. If a state has lettering, bake outlined glyph paths into that same SVG. Do not create SVG `<text>`, a separate overlay entity, or a separate coverage decision.
6. Keep one semantic owner for the direction. Hide or change the Story Visual when its job ends.
7. Run provenance, asset/kit, coverage, event/state, preview and genuine Visual Review gates.

At Visual Review, inspect the actual before/after pair at phone size with audio muted. State what changed and what fact the second frame communicates. If removing the Story Visual loses no information, it should have been omitted. If the approved idea itself adds nothing, reopen Phase 1 instead of inventing a substitute locally.

Runtime Job@5 may serialize `story_visual` as `story_object`. That token is transport vocabulary only and is never exposed as a fresh creative authoring option.

Changing the story point, viewer read, visible subject/action, visual idea or semantically required wording reopens Phase 1. Phase 2 may refine geometry, drawing, layout, state transitions and lettering treatment only.
