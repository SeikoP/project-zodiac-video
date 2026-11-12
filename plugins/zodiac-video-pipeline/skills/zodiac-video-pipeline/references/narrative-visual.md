# Narrative Visual — Hình ảnh kể chuyện

Narrative Visual is the **only** fresh storytelling-image type: `narrative_visual`. It is optional. Phase 1 decides whether the episode needs one and owns its meaning; Phase 2 only executes that approved direction.

## When to use it

Use a Narrative Visual only for a central point that is easier to understand as a concrete visible action/state than as actor performance, a physical prop, or a short Story Text phrase. There is no per-video quota.

A scene may contain **Narrative Visual or Story Text, never both**. Quiet scenes may use neither.

Reject a Narrative Visual when it is only a generic symbol, mood decoration, zodiac icon, or abstract noun. The image must preserve the Phase-1 `story_point`, `viewer_read`, `visible_subject`, `visible_action`, and `visual_idea`.

## Phase 2 execution

1. Read the selected Phase-1 direction by `id`; never invent a second concept.
2. Bind it to exact approved narration and the matching director beat.
3. Author `art_direction.narrative_brief` as:
   ```json
   {
     "format": "zodiac-narrative-brief@2",
     "phase1_visual_id": "NV1",
     "story_point": "exact Phase-1 story point",
     "viewer_read": "exact Phase-1 silent-read meaning",
     "anchor_phrase": "exact approved narration",
     "state_changes": [
       {"from": "concrete visible state", "to": "concrete changed state", "event_id": "E1", "anchor_phrase": "exact approved narration"}
     ]
   }
   ```
4. Author one scene-specific SVG identity with meaningful states. Every visible asset records `creative_origin.mode=phase1_directed`, `phase1_visual_id`, `scene_id`, and exact `anchor_phrase`.
5. Keep it visually focal only for the scene/beat that owns the story point. Remove or hide it when its job ends.
6. Run provenance, kit, coverage, event/state, preview, and human Visual Review gates.

Runtime Job@5 currently serializes this authoring role as `story_object`. That token is transport vocabulary only and is never exposed as a creative authoring option.

Changing the story point, viewer read, or visual idea requires reopening Phase 1. Phase 2 may change drawing geometry, layout, and state execution only.
