# Scene Plan — Phase 02 authoring gate

Before drawing actors, props, story objects or effects, write the ordered
narrative scenes. A **scene** is a coherent situation/visual composition; a
**beat** changes the meaning or attention inside it; an **event** changes an
entity state. Do not use one scene per sentence or per fixed time interval.

Author `production.json.scene_plan_required=true` for fresh Phase 02 work and
include `scene_plan` with `scenes:[{id,purpose,beats,transition_reason?}]`.
The order and IDs MUST equal `production.json.scenes`. New scenes beyond the
first need a reason for visual/narrative transition.

A deliberately continuous single-scene story is allowed only with
`single_scene_rationale`; if it contains several beats also describe
`continuous_visual_logic`. A plan claiming several scenes while production
contains only S01 is a blocking `SCENE_PLAN_DRIFT`.

Scenes should change when situation, time/place, camera/composition, narrative
focus or interaction materially changes. Preserve narration exactly; split
narration into contiguous, exhaustive segments without alteration, and bind
every voice anchor to its own scene. Keep story object setup/friction/payoff
and physical props grounded in visible scene states.

Historical Job@5 packages without scene_plan are still importable; this
metadata is producer-only and does not modify the Authoring IR or runner
contract fingerprint. Do not invent approval or force a migration of already
approved media.
