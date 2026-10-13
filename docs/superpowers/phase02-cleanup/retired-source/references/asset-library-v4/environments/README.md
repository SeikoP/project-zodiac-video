# Environment profiles — selected-cue compatibility extension

Fresh Phase 02 uses the `scene-set` system as the primary visual framework. This directory exists for **explicit selected-cue authoring and continuity/legacy compatibility only**. Do not choose a profile automatically for a fresh episode, and do not add windows, boards, sofas, tables, beds or other room furniture merely because a profile contains them.

When selected-cue compatibility is explicitly active, `environment.profile` selects one bounded micro-environment profile from `composition-index.json`; `environment.modifier` may adjust only that profile's permitted cues. Profiles include cafe, classroom, home, street, study and bedroom variants. No profile is the universal default.

Visual Grammar records the selected compatibility profile only on that path. During Semantic Assets:
1. `compile-environment.mjs` first materializes any selected primary scene-set;
2. only scenes that explicitly carry a compatibility `profile` receive selected structural cues;
3. `validate-environment-binding.mjs` verifies those compiled bindings;
4. Scene Direction runs after the real entities exist.

Fresh scene-set authoring instead uses `environment.scene_set_id` and optional `scene_accents[]` from `scene-set/`. The selected scene-set owns the continuous wall/floor/frame; Environment Frame stages actors and real story fixtures, not background geometry.

Structural foreground compatibility cues must stay outside the canonical caption field and respect the profile occlusion budget. Story props are selected from narration meaning rather than used as filler. Runtime receives ordinary entities only; there is no background-image schema or render-time environment randomization.

## Environment Frame

For fresh scene-set work, author `environment.frame` as actor/fixture staging metadata. Actor-only frames are valid on a primary scene-set; do not invent furniture to satisfy a compatibility assumption. For selected-cue/legacy profiles, existing fixture/contact requirements remain supported. See `references/environment-frame-system.md`.
