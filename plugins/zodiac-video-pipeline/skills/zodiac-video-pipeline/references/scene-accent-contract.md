# Scene Accent — Canvas-native Context Cue

Fresh authoring category: `scene_accent`. Narration-grounded background/context detail (cafe window/menu, classroom board, string lights), independent from prop, support, effect and Narrative Visual. A palette-only canvas is insufficient scene context.

- Every fresh scene requires at least one visible context component, selected with `scene_accent=use` coverage in the beats where it appears. Individual cues may enter and leave; record explicit `use` or `omit` per beat.
- One SVG per conceptual identity, with `initial_state` and voice-anchored visibility transitions when required.
- Positions authored in canvas coordinates or optional actor-relative `above_head`, `near_left`, `near_right` placement (resolved to canvas by producer).
- Declare `context={kind:"environment_detail",setting:"...",visible_detail:"..."}` on the entity and bind `narrative_intent.voice_anchor` to the exact scene narration. Name the actual place and visible detail, not an abstract topic. A floating battery, checklist, mood badge or relationship icon is not a background merely because its category says Scene Accent. If a checklist is physically used, make it a Prop; if an image explains an idea, assess it as Narrative Visual in Phase 1.
- Rear/background layering, independent from actor composition; no Scene Set, wall or view-box attachment.
- Validate asset/category, state, event, canvas bounds and caption-safe layout before handoff.
- Producer serializes role `scene_accent` with Job@5 `background` visual role and `environment` asset category; renderer checks caption collision at actual frames without counting accent as prop/effect.
- Select context for the narration and scene goal. A cue that is hidden in all reachable states, outside the canvas, missing its SVG, or absent from use coverage does not satisfy scene readiness.

Legacy wall-bound Scene Set cues retain separately verified compatibility handling.

Native validation checks the declaration, anchor, rear layer, geometry and coverage. It cannot infer the drawing from JSON. Inspect the actual SVG and scene endpoints: can a muted viewer recognize the stated setting? Does the cue stay subordinate to the action? A mismatching drawing is a Visual Review failure even when its declarations pass. Never enlarge a symbol to satisfy background area.
