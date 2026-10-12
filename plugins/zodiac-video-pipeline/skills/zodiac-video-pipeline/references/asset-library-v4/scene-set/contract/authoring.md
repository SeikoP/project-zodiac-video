# Scene-set authoring

Select `environment.scene_set_id` from `scene-set/index.json`. Each master owns one continuous frame/wall/floor SVG, exact SHA-256, viewBox, transform and wall/floor bounds. Character staging is independent and may overlap the outer frame. `environment.frame` stages performers and fixtures; it does not own or redraw the scene-set.

Context is optional. Select `scene_accents: [{id, entity_id, transform?}]`; every visible accent state must fit inside the transformed wall. Never select a second room/background as an accent. Physical furniture is an explicitly narrated prop. Legacy profiles and cues resolve old jobs and explicit selected-cue work only; they never decorate a selected scene-set automatically.

Compilation registers selected native assets after character assembly. Scene-set/scene-accent authoring semantics project to existing background/effect transport. Shot layouts own composition skeleton semantics; actions own semantic mechanics, not geometry. Identical scene-set geometry is normal continuity. Repeated complete actor/story staging remains a review diagnostic.
