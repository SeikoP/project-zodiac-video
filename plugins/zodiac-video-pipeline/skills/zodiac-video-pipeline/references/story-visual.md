# Hình kể chuyện — Hình ảnh kể chuyện

Hình kể chuyện is the **only** fresh storytelling-image type: `story_visual`. It is optional. Phase 1 decides whether the episode needs one and owns its meaning; Phase 2 only executes that approved direction.

## When to use it

Use a Hình kể chuyện only for a central point that is easier to understand as a concrete visible action/state than as actor performance, a physical prop, or a short chữ trong hình phrase. There is no per-video quota.

A scene may contain **Hình kể chuyện or chữ trong hình, never both**. Quiet scenes may use neither.

Reject a Hình kể chuyện when it is only a generic symbol, mood decoration, zodiac icon, or abstract noun. The image must preserve the Phase-1 `story_point`, `viewer_read`, `visible_subject`, `visible_action`, and `visual_idea`.

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

At Visual Review, inspect the actual before/after pair at phone size with audio muted. State who changes what and the consequence visible in the second frame; compare that reading with the approved `viewer_read`. Check that the image reveals information beyond the actor/prop performance, rather than merely occupying space or changing color. If the intended cause cannot be read, repair the execution. If the approved idea itself adds nothing, report it for Phase-1 revision; do not invent replacement meaning or certify contribution from a state-swap PASS.

Runtime Job@5 currently serializes this authoring role as `story_object`. That token is transport vocabulary only and is never exposed as a creative authoring option.

Changing the story point, viewer read, or visual idea requires reopening Phase 1. Phase 2 may change drawing geometry, layout, and state execution only.
