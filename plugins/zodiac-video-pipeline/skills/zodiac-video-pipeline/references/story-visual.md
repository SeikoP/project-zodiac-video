# Hình kể chuyện — Story Visual

A Story Visual expresses one approved idea through original imagery, including literal illustration, nonliteral metaphor, exaggeration, symbolic composition, visual humor or typography. It need not depict a specific physical situation. Lettering and drawing remain one entity/state/SVG asset.

Read the exact narration beat and approved Phase-1 direction first. Write the intended viewer read in plain language before choosing a drawing. At phone size the visual's subject and intended relationship should be legible; the narration may supply context. A single meaningful static state or symbolic contrast is valid.

## Worked examples and removal test

| Narration point | Concrete visual progression | Added information |
| --- | --- | --- |
| Ma Ket handles everything | Task cards start under named Ma Ket / partner columns, then collect under Ma Ket; the partner's side ends at a large 0 | Accumulated responsibility and unequal ownership, not merely tired acting |
| Repeated offers are declined | Show first offer/refusal, another attempt, then the hand withdrawing; reveal the count of three only at the third occurrence | Why the other person stops offering |
| Finally accepting help | The physical bag changes hands; a label on that bag changes from ĐỂ TÔI! to ĐƯỢC XÁCH! | The small handoff becomes the permission payoff |

A generic floating battery, an unlabelled meter, a zodiac glyph or the word TRÁCH NHIỆM alone does not identify this relationship. A lamp establishes setting; an actor's slumped pose shows fatigue; runtime captions transcribe speech. None automatically supplies the causal explanation above. If removing the proposed visual loses no insight, humor, emphasis, emotion or memorability, omit it explicitly. Quiet scenes need no extra explanation; there is no quota.

## Approved meaning and execution

Phase 1 records `story_visuals[]` and an explicit `story_visual_decision`. Each direction supplies `id`, `beat_ids`, `story_point`, `viewer_read`, `visible_subject`, `visible_action`, `visual_idea` and `contribution` (what is lost without it). Optional `lettering[]` supplies exact necessary wording. Optional `evidence_refs[]` copies real source IDs; otherwise use approved beat lineage and the plan evidence boundary. No image needed: `{mode:"omitted",reason:"..."}`. Missing input is a blocker.

Phase 2 preserves that meaning and:
1. Binds `phase1_visual_id` and exact narration anchors in `art_direction.narrative_brief`, including drawable states when the idea evolves, or one meaningful state.
2. Authors one `story_visual` entity with one SVG per state and matching asset category. Optional `lettering` metadata belongs to that same entity; bake glyph paths into its SVG, never a separate text overlay or coverage lane.
3. Makes the intended visual relationship or metaphor legible; literal identity and ownership are needed only when relevant. Keep short words large enough at phone size. Hide future outcomes until their exact anchor; remove the visual when its job ends.
4. Declares `layers.story_visual` use/omit, names its actual entities/events, and runs provenance, completeness, presence, event/state and preview gates.

At Visual Review, inspect every transition and final frame at phone size, muted. Explain the intended meaning or visual joke; do not require a literal causal change. Check count/reveal timing, clipping, faces, handoffs and caption space. A machine PASS checks structure; it does not prove the picture communicates. Changing story meaning or necessary wording reopens Phase 1; drawing, geometry and treatment remain Phase 2 work.

Runtime Job@5 serializes this entity as `story_object` internally; fresh authoring uses only `story_visual`.
