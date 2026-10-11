# Precompile Seam v2.4.39

## Owner and time
Phase02 `visual_compile` entry, before any native scene/character/environment compiler.

## Contract
1. Full narration must be reconstructable from scene voices in order, preserving all text (insignificant whitespace may differ).
2. A scene must not end inside an approved Narration paragraph. Multiple performance beats in one paragraph should become internal beat/events, not a new scene that breaks Job@5 segment policy.
3. Background (`env__` or environment role owned) is architectural/ambient only; automatically generated furniture belongs to no environment scene. A chair/bed/desk explicitly called for by script is an authored `prop`/`object` outside the environment layer.
4. Art Direction is required for new runs with `flags.art_direction_required=true` and uses `zodiac-scene-art-direction@2`, bound to source scene IDs, scene voices, native environment profiles, canonical palette IDs and justified action/color/space choices. Metaphorical Story Object is optional and never `render_layer:background`.
5. The executor records validator PASS receipts. A gate cannot be manually asserted without an executed receipt. Native Director + Visual Review + Job@5 seal remain mandatory; local runner still validates WAV, Timing, rendering and visual parity.

## Commands
```bash
node orchestration/validate-phase02-precompile-boundary.mjs /path/to/workspace
node orchestration/validate-phase02-art-direction.mjs /path/to/workspace
node orchestration/phase02-execute.mjs --workspace /path/to/workspace --run
```

## Migration boundary
Continuity imports and sealed packages must not be rewritten to satisfy a new authoring requirement. New fresh workspaces created from v2.4.39 declare the Art Direction flag. If upgrading a workspace, require an explicit verified migration of state/template and re-run all affected receipts. Do not edit `plugin_version` alone to feign an upgrade.

## Explicit intent decision
Visual intent records required, optional or omitted with reason and review_ref. Omitted returns OMITTED_EXPLICIT, not creative PASS; required flags cannot be disabled implicitly. A situation prop may carry the metaphor through changed shape, relation or consequence. Repeated reveal of the same object is insufficient. Effects are optional in v2, motion alone is not metaphor progression. Human mute-review remains required.
