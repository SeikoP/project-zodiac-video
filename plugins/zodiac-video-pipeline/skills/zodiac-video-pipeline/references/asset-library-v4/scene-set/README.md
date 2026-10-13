# Scene-set — fresh Phase 2 entrypoint

Select `scene_set_id` from [index.json](index.json) before staging performers. Each master is one continuous wall, floor and outer frame; preserve its declared asset hash, viewBox, transform and bounds. Registered fresh masters are resolved from `index.json`; the current set includes home, cafe, classroom, study, street and neutral stages. Structural registration is not creative approval. Do not redraw or split their floor into another background.

Use [contract/authoring.md](contract/authoring.md) for authoring and `compile-scene-set.mjs` for materialization after Character Assembly. The compiler owns generated registration and selected-source lineage. `environment.frame` stages performers and story fixtures; it does not own scene-set geometry.

Optional `scene_accents[]` come from [accents/index.json](accents/index.json). Keep every visible accent inside the selected wall region. An empty selection adds no room cues; deselection removes compiler-owned accents. Windows, sofas and tables are never defaults for this path. Old profiles resolve only through explicit selected-cue or legacy compatibility.

Shot-layouts describe composition, actions describe behavior, physical props are handled objects, and Story Objects carry symbolic progression. See [the canonical Story Object contract](../../story-object-contract.md). Foreground character composition is independent of the supporting rear artwork; scene-set geometry uses its dedicated bounds policy instead of ordinary caption occupancy.

Reusing the same scene-set is valid continuity. Review actor blocking, state and story progression rather than requiring a new background. Preview receipts bind current intent, projection, production and SVG hashes. Structural validation never grants creative approval or runtime media QA.