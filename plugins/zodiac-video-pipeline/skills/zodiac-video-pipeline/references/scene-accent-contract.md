# Scene Accent — Canvas-native Context Cue

Fresh authoring category: `scene_accent`. Narration-grounded background/context detail (cafe window/menu, classroom board, string lights), independent from prop, support, effect and Narrative Visual. A palette-only canvas is insufficient scene context.

- Every fresh scene requires at least one visible context component, selected with `scene_accent=use` coverage in the beats where it appears. Individual cues may enter and leave; record explicit `use` or `omit` per beat.
- One SVG per conceptual identity, with `initial_state` and voice-anchored visibility transitions when required.
- Positions authored in canvas coordinates or optional actor-relative `above_head`, `near_left`, `near_right` placement (resolved to canvas by producer).
- Rear/background layering, independent from actor composition; no Scene Set, wall or view-box attachment.
- Validate asset/category, state, event, canvas bounds and caption-safe layout before handoff.
- Producer serializes role `scene_accent` with Job@5 `background` visual role and `environment` asset category; renderer checks caption collision at actual frames without counting accent as prop/effect.
- Select context for the narration and scene goal. A cue that is hidden in all reachable states, outside the canvas, missing its SVG, or absent from use coverage does not satisfy scene readiness.

Legacy wall-bound Scene Set cues retain separately verified compatibility handling.
