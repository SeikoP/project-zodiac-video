# Scene Accent — Canvas-native Context Cue

Fresh authoring category: `scene_accent`. Contextual detail (cafe window/menu, classroom board, string lights), not a background replacement, prop, support, effect or Narrative Visual.

- Optional by scene and beat: record explicit `use` or `omit` with reason in fresh Visual Coverage.
- One SVG per conceptual identity, with `initial_state` and voice-anchored visibility transitions when required.
- Positions authored in canvas coordinates or optional actor-relative `above_head`, `near_left`, `near_right` placement (resolved to canvas by producer).
- Rear/background layering, independent from actor composition; no Scene Set, wall or view-box attachment.
- Validate asset/category, state, event, canvas bounds and caption-safe layout before handoff.
- Producer serializes role `scene_accent` with Job@5 `background` visual role and `environment` asset category; renderer checks caption collision at actual frames without counting accent as prop/effect.
- Never decorate empty space automatically. Missing optional Accent is not a failure when omitted intentionally.

Legacy wall-bound Scene Set cues retain separately verified compatibility handling.
