# Selective adoption of main-2 specifications into main

Date: 2026-11-16. Source: `experiment/main-2` at `6505d969`.
Target inspected: `main` at `c29c0e53` (2.12.8).

This is a selective integration, not a merge of the experimental Studio. Source
specifications are design proposals; their historical inventory counts are not
current production guarantees. The experimental branch and its worktree remain
intact. No dependency, release bundle or installed plugin cache is changed.

## Decision and alternatives

Adopt compatible authoring rules and repair existing main inconsistencies now.
Reuse current Visual Intent, native compilers, asset registries and review gates.
A full branch merge would introduce the Tauri Studio, project service and separate
preview/editor lifecycle. Copying its entire design as current policy would also
advertise capabilities that main does not implement. Both are out of this change.

## Specification synthesis

All source paths below are under `docs/superpowers/specs/` on the pinned source
commit, unless marked as a plan. Retrieve the immutable original with
`git show 6505d969:<path>`.

| Source specification | Useful direction for main | Disposition |
| --- | --- | --- |
| `2026-11-14-agent-native-creative-studio-design.md` | One canonical episode source; locked approved narration; actual artifact evidence; distinguish handoff, video readiness and publication | Preserve existing source/review boundaries; one-window Studio stays experimental |
| `2026-11-14-zodiac-compiler-refactor-design.md` | Whole-episode dependency closure, shared asset reuse, targeted scene rebuild, atomic publish preserving last valid output | Future measured compiler slice; no second compiler or replacement of existing ownership/cache code here |
| `2026-11-14-zodiac-studio-asset-knowledge-graph.md` | Story action first, hard compatibility before ranking, explainable candidates; small typed maps before a database | Apply story/availability rules to selection guidance; automated candidate ranking remains future work |
| `2026-11-14-zodiac-visual-v5-color-system-design.md` | Fix stale fresh Scene Set guidance; eventually use semantic palette roles, preserve actor identity and readable captions | README, capability metadata and default gallery corrected now; new themes require compiled frame review |
| `2026-11-14-v5-prop-variant-diversity.md` | Family/model/appearance/state/view are different axes; owner continuity beats forced novelty; state changes are not new silhouettes | Applied to active selection guide; new phone masters and history-based ranking are not implemented |
| `2026-11-14-zodiac-audio-library-sound-design.md` | Voice first; silence valid; actual playable files and rights evidence; sparse measured-event cues; audio-only edits should reuse visuals | Retain as next audio design direction; no media import, new mix engine or license claim in this change |
| `2026-11-14-hyperframes-migration-inventory.md` | Preserve SVG sources, measured voice, recovery snapshots and renderer parity gates | Retain current renderer; no HyperFrames migration or artifact regeneration |
| `2026-11-14-studio-platform-choice-adr.md` | Treat platform choice separately from production correctness | Tauri/Qt host decisions stay experimental |
| `../plans/2026-11-14-unified-zodiac-studio-roadmap.md` | Evidence-based phase gates and scoped vertical slices | Reference roadmap only; no adoption of experimental P0-P4 acceptance as main acceptance |

## Implemented scope and compatibility

1. Mark all six legacy Scene Set capability entries `fresh: false`. Keep their
   IDs, geometry, cast metadata, hashes and legacy compilers intact.
2. Default current-asset gallery omits Scene Sets and exports
   `environment_mode: canvas`, matching the existing fresh compiler rejection
   `FRESH_SCENE_SET_RETIRED`. Explicit selected Scene Set IDs still render exact
   hash-verified compatibility previews and export the compatibility mode.
3. Correct asset README and Accent gallery descriptions: canvas-native context
   behind actors, caption-safe, with no wall containment.
4. Extend the existing selection guide: phone states share one physical model;
   do not promise nonexistent geometry, force props into scenes or change an
   owner's device to manufacture variety. History comparisons require explicitly
   supplied accepted/rendered evidence, not broad historical-job scans.

Affected callers and contracts: `buildCurrentAssetReview` CLI and gallery export,
selection guide consumers, capability-index consumers, gallery regression tests
and capability coverage expectations. Existing selected-stage hash/dependency
checks and historical compiler tests continue to run unchanged.

## Follow-on order and acceptance

These are separate future scopes, not delivered capabilities:

1. **Prop supply pilot:** author three visibly distinct phone geometry masters,
   register supported states/grips/views, prove ownership continuity and review
   phone-size frames. Recoloring is not acceptance.
2. **Palette pilot:** semantic role mapping for one fresh scene, preserve actor
   identity, inspect Vietnamese captions and dark/light contrast before expansion.
3. **Compiler optimization:** reuse existing semantic graphs/cache/ownership
   transactions; measure the same real episode cold, warm and after one edit.
   Negative tests must preserve last valid output. Fewer commands is not proof
   of faster authoring or better visuals.
4. **Audio pilot:** approved voice-only output remains valid; audition one actual
   authorized local track, test fades/ducking and measured cue sync, verify that
   changing music preserves voice and visual artifacts. Listening remains required.

No new database, blanket diversity quota, media download, theme switching,
automatic approval or renderer replacement is introduced.

## Validation

- Before implementation, the updated capability expectation and default gallery
  regression failed on old behavior (2 failures).
- After implementation, 38 tests passed across current-asset-surface,
  asset-capability-coverage, asset-diversity-coverage, minimal-character-library,
  fresh-narrative-visual and prop-symbol-retired-asset suites.
- Native `validate-library.mjs` passed; current registered SVG hashes preserved.
- No browser visual inspection, final MP4, audio listening, full repository suite,
  release build or installed-plugin synchronization was performed.
