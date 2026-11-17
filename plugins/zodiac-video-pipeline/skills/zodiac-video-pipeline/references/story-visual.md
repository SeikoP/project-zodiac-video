# Hình kể chuyện — Story Visual

A `story_visual` makes one story fact visible: **who does what, what changes, and what that change means**. It can be an illustration, outlined lettering, or illustration and lettering combined in the same Story Visual entity/state/SVG asset. It is a storytelling explanation, not an image attached because the narration mentions an emotion.

Read the exact narration beat and approved Phase-1 direction first. Write the intended viewer read in plain language before choosing a drawing. Someone unfamiliar with this episode must be able to name the participants, follow the change and explain its consequence with audio muted.

## Worked examples and removal test

| Narration point | Concrete visual progression | Added information |
| --- | --- | --- |
| Ma Ket handles everything | Task cards start under named Ma Ket / partner columns, then collect under Ma Ket; the partner's side ends at a large 0 | Accumulated responsibility and unequal ownership, not merely tired acting |
| Repeated offers are declined | Show first offer/refusal, another attempt, then the hand withdrawing; reveal the count of three only at the third occurrence | Why the other person stops offering |
| Finally accepting help | The physical bag changes hands; a label on that bag changes from ĐỂ TÔI! to ĐƯỢC XÁCH! | The small handoff becomes the permission payoff |

A floating battery, an unlabelled meter, a zodiac glyph or the word TRÁCH NHIỆM alone does not identify this relationship. A lamp establishes setting; an actor's slumped pose shows fatigue; runtime captions transcribe speech. None automatically supplies the causal explanation above. If removing the proposed visual loses no important fact, omit it explicitly. Quiet scenes need no extra explanation; there is no quota.

## Approved meaning and execution

Phase 1 records `story_visuals[]` and an explicit `story_visual_decision`. Each direction supplies `id`, `beat_ids`, `story_point`, `viewer_read`, `visible_subject`, `visible_action`, `visual_idea` and `contribution` (what is lost without it). Optional `lettering[]` supplies exact necessary wording. Optional `evidence_refs[]` copies real source IDs; otherwise use approved beat lineage and the plan evidence boundary. No image needed: `{mode:"omitted",reason:"..."}`. Missing input is a blocker.

Phase 2 preserves that meaning and:
1. Binds `phase1_visual_id` and exact narration anchors in `art_direction.narrative_brief`, including drawable before/change/after states.
2. Authors one `story_visual` entity with one SVG per state and matching asset category. Optional `lettering` metadata belongs to that same entity; bake glyph paths into its SVG, never a separate text overlay or coverage lane.
3. Makes identity, ownership and direction explicit in the picture. Keep short words large enough at phone size. Hide future outcomes until their exact anchor; remove the visual when its job ends.
4. Declares `layers.story_visual` use/omit, names its actual entities/events, and runs provenance, completeness, presence, event/state and preview gates.

At Visual Review, inspect every transition and final frame at phone size, muted. Explain the change without relying on the brief. Check count/reveal timing, clipping, faces, handoffs and caption space. A machine PASS checks structure; it does not prove the picture communicates. Changing story meaning or necessary wording reopens Phase 1; drawing, geometry and treatment remain Phase 2 work.

Runtime Job@5 serializes this entity as `story_object` internally; fresh authoring uses only `story_visual`.
