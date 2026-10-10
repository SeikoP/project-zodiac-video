# Native Depth Background System v1 (2.4.31)

The background is a **set of independent native SVG entities**, not one image replacing the set or the Story Object. Exactly three geometry roles may be instantiated: rear (wall/light), divider (wall seam/door/split boundary) and front (desk edge/foreground frame/shadow). A scene may use fewer layers when a quiet shot needs open paper.

## Production integration
1. Director selects a **profile** from `references/depth-catalog.json` according to location and story beat; never change location for visual novelty. Select one of 5 palette IDs; contrast must distinguish actor, central Story Object, caption and scene edges. For a symbolic internal monologue, choose `split-thought` or `spotlight-payoff`, not a living room.
2. Author `.authoring/depth-composition-plan.json` (`zodiac-depth-composition-plan@1`), one entry per desired scene, each with `scene_id`, `profile`, `palette`, `rationale`, `layers: ['rear','divider','front']` subset, and `story_object_entity_id` when relevant. Do not use `depth__` as a Story Object; never generate art merely to reach a layer quota.
3. For automated Phase02 with a depth plan use `node orchestration/phase02-execute-with-depth.mjs --workspace <workspace> --run` (entry gate → native environment → depth → validation → Phase02 native coordinator). Direct/manual alternative: AFTER `compile-environment.mjs` and BEFORE Scene Direction, run `node orchestration/compile-depth-composition.mjs <workspace> --write`. It writes native SVGs, normal `production.assets` and `scene.entities` with explicit layers, no runtime-only fields and no Job@5 contract change. The compiler removes ONLY its own `depth__` entities when rerun.
4. Run `node orchestration/validate-depth-composition.mjs <workspace>` and existing Scene Direction/Visual QC afterwards. Re-run on source changes and invalidate all preview/Visual Review receipts tied to changed SVGs.
5. For actual pixel QA use Remotion before/peak/after + muted playback. Structural validation does not certify beauty.

## Style/occlusion guard
Uses human-like 5–8 px outline and a limited ink/paper palette. Rear at negative z, divider behind actor, front at z=15, but front SVG remains outside default caption-safe area (y < 1400). Story Object retains authored asset, layer and transforms; no blanket dimming or character recoloring. Shadows and atmospheric tones are light, deterministically authored inside native SVG. Never recolor an existing cast SVG via palette. Palette transition must match location/beat; preserve across a continuous scene unless an intentional emotional shift is narrated.

## Profile catalog
`bedroom-clean`, `bedroom-night`, `study-corner`, `classroom-day`, `school-hallway`, `split-thought`, `social-pressure`, `spotlight-payoff`.
Palettes: `bright-clean`, `warm-emotional`, `cool-reflective`, `dark-tension`, `comic-pop`.

## No false PASS
Compiler PASS = contract; visual review requires actual rendered frames. Do not create an extra ZIP or a separate runtime background generator.
