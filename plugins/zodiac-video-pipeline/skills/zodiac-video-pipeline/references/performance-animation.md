# Performance and Character State Assets — renderer 2.0

The handoff targets `zodiac-renderer@2.0.0`. The renderer changes character appearance by selecting a complete SVG asset; it does not animate limb groups inside character SVGs.

## Plan before creating assets

For a short clip, plan one base state and up to two standout variants per character. Reuse a planned state asset when another beat has the same identity, pose, expression, and crop. Run Character Assembly `--plan-only` first; its plan checks the budget before any SVG is written. A plot-critical exception must set `asset_budget.max_unique_states` and include a short `exception_reason`.

Use narration, caption emphasis, camera framing, and entity placement to carry beats that do not need a new readable pose or expression. Do not create a fresh character SVG for every sentence or emphasis beat. Do not generate finished SVGs and merge them afterward.

## Semantic motion contract

Every event in `zodiac-job@5` requires an explicit motion preset and duration. The plugin keeps those semantic choices in Authoring IR and the design token. It does not export resolved frame ranges, anticipation/hold/settle values, or renderer defaults.

Use `state_swap` when the character's planned appearance needs to change. The renderer selects the target full-body SVG at the state transition; separate old/new full-body assets are not crossfaded together.

## Visual progression

Handoff checks that narration remains attached to story-changing entity state events. Reuse existing character states where possible, and reserve new planned assets for a materially different readable pose, expression, or crop.
