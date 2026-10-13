# Phase 02 regression repair — 2026-10-13

Source development version: 2.5.6-dev.3. ChatGPT installed plugin is unchanged.

Changes:
- Scene-set defaults start at y=0 with height=780, reserving independent foreground composition. Captions use the lower safe zone.
- Current native visual-intent validator matches the 2.0-current-native contract instead of retired recipe matrices.
- Whole-scene SVG sizing now matches event frame sizing.
- Art-direction preflight requires selected scene accents or a non-empty scene_accent_omission_reason.
- Every accent registry entry has a hash-verified source. Default placement uses scene_set_view_box coordinates; explicit transforms remain in canvas coordinates and must fit the wall.
- Visual Intent records generated accent components; the composition resolver recognizes their compiler ownership before SVG generation.
- Semantic asset fit distinguishes a verified compiled background accent from a story-facing object, while maintaining checks for ordinary props and forged accent metadata.

Validation:
- 47 selected tests across 12 related suites passed, including 11 new regression cases. This is not a claim that the full repository suite or GitHub Actions passed.
- Real Song Tu native Phase 02 passed 66/66 applicable capabilities, 19 coordinator steps and Director review.
- Native review includes one complete scene and all 45 event endpoint pairs. Both cafe window and menu accents stay in the rear wall; actor coordinates remain independent.
- Approved narration unchanged. New visuals remain IN_REVIEW; voice/timing/Remotion/MP4 acceptance have not run.

Compatibility:
Native art-direction validation will now block unreviewed empty accent selections. Existing intent that intentionally omits accents must record scene_accent_omission_reason. No automatic decoration or historic fallback is introduced.

Publish source to GitHub first; update installed ChatGPT plugin only when requested later.
