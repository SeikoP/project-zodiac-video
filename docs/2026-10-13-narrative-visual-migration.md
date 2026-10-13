# Fresh visual authoring — canvas-first / Narrative Visual

**Only fresh production** (existing Job@5, reviewed assets, prior Scene Set work stay readable).

- Base: solid color, gradient, optional restrained pattern. Scene Set and wall plane are not mandatory and have no gate in the fresh selection policy.
- Characters occupy independent canvas positions, not pinned to a scene-set frame. Preserve caption collision, spatial bounds and actor focus.
- One creative category: `narrative_visual`. Use for thoughts, comparison, metaphor, symbolic objects and visual transformations.
- Legacy authoring names `story_object`, `story_symbol`, `visual_metaphor` are compatibility inputs only. They project to existing Job@5 `story_object` transport without changing the canonical schema.
- Narrative visual is not an interactive prop. Use `interactive_prop` for actual physical handling, `effect` for optional reaction emphasis.
- No forced setup/friction/payoff for a single image. Stateful narratives may use narrator-triggered left/right/balanced states.
- Visual Coverage `layers_version: narrative_visual@1` uses layers `actors,narrative_visual,props,support,caption`; legacy coverage remains interpreted with the legacy layer set until converted explicitly.

## Libra regression scenario

Actor and balance scale occupy independent transforms. Scale is positioned above the actor, tips left, tips right, returns center. It does not require `held_by`, a wall, a scene set or an effect. The renderer must verify final bounds and caption safety against actual frames. A producer fixture is not evidence of pixel parity.

## Rollback

Revert the fresh-mode selection/coverage/transport projection commits. Existing package schema and legacy interpreter remain unchanged.
