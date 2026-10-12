# Supporting backdrop authoring

Select `environment.scene_set_id` for rear pictorial context and depth. A master
owns its artwork bytes, viewBox, transform and decorative wall/floor bounds.
It does not own actor placement, dimensions, standing/sitting surfaces or contact.

Compose characters in the foreground from their pose, action, props and shot.
Do not fit or ground actors on the backdrop wall/floor. Do not use the backdrop
as an actor frame slot or an on_surface/held_by contact target. Physical seating,
standing or held objects belong to separately authored story fixtures/props.

Backdrop size does not follow safe-height or actor size. Its decorative bounds
only constrain its own selected accents. Nothing requires actors to be inside,
outside or intersecting that rectangle; those are independent composition choices.

Choose `scene_accents` explicitly and keep their visible states inside the
transformed decorative wall. Do not add another backdrop as an accent.
At handoff, scene-set remains ordinary background transport. Actor staging and
contact remain separately authored; no renderer or Job@5 contract migration.
