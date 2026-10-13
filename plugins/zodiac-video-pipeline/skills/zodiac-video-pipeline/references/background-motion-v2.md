# Background & Performance Coverage — v2.2

The canonical render format is **zodiac-job@5**, targeting immutable **zodiac-renderer@2.0.1**. Do not add `environment` or `animation` keys to final IR unless the canonical schema admits them. The authoring `production.json` is compiled to ordinary entities/states/SVG references before handoff.

## Environment story plan
For each scene choose the current scene-set and explicit optional accents, semantic prop roles and shot. The stage does not contain the performer. Accents stay inside the wall; no room profile or structural cue fallback is available. Maintain logical location unless narration changes it.

## Movement must convey action
Character SVG budget is a **planning heuristic**, not an arbitrary hard creative ceiling. Start with one base state and add *as many pre-justified action-critical states as needed* by `asset_budget.max_unique_states` plus `exception_reason`; determine needs before drawing, never post-generation dedupe. In any dialogue/action beat with changed emotion or material gesture, do not use unchanged character SVG alone for the entire beat. Favor planned contact-valid states when a pose really changes; otherwise animate entity transform, prop state, camera/shot, reaction accent, or timed effect through supported canonical `event.motion` presets. Do **not** claim runtime limb rigging or shape morph of full SVG: unsupported by renderer 2.0.

## Animation coverage
For every non-static visual beat, plan at least one materially visible motion **from the existing renderer-supported vocabulary**: prop nudge/arrival/exit, reaction mark pop/fade, emphasis scale/translation, character entrance, camera reframe, or validated state_swap. If the canonical renderer supports no such preset for a requested act, mark the beat as unsupported and pre-plan a different SVG state; never invent preset names. A still SVG asset is acceptable if an entity/event explicitly moves it. Effects must have a start and release beat and meaningful emitter/contact binding. Repeat/recycle asset masters with different semantic placements/events rather than duplicating drawings.

## Parity gate
Compare begin/middle/end preview stills and final render frames at matched semantic times: equal entity count, SVG references, props/effects, layer order, caption clearance and position. Missing asset or unsupported motion fails production (no silent drop). Runtime performs alignment/timing and must not randomize composition. External runner code requires its own separate commit and integration testing; editing this plugin alone does not deploy runner updates.
