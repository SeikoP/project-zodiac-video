# Renderer 2.0.2 — stepped ("on twos") entity motion

Status: **candidate**. `runtime/releases/zodiac-renderer.json` keeps `current` and `defaults.job5` on 2.0.1; nothing selects 2.0.2 until a package manifest names it. Job@5 and the render-plan contract are unchanged.

## Change
`src/semantic-motion.mjs` samples entity motion every `MOTION_STEP_FRAMES = 2` frames instead of every frame.
- The step grid is anchored on the event's middle frame, so the peak pose of `subtle-tilt`, `small-bounce` and `focus-shift` is always sampled and the QA thresholds in `MOTION_EXPECTED` still hold.
- The last frame of an event always lands exactly on its end pose (`slide`, `fade-*`, `pop-in` end exactly where 2.0.1 ended).
- Captions, cover opening, watermark and spatial layout are untouched.

## Curves (event frames 10–21, one value per frame)
| motion | 2.0.1 | 2.0.2 |
| --- | --- | --- |
| `small-bounce` translateY px | 0 -1.59 -5.85 -11.42 -16.55 -19.59 -19.59 -16.55 -11.42 -5.85 -1.59 0 | 0 -1.59 -1.59 -11.42 -11.42 -19.59 -19.59 -16.55 -16.55 -5.85 -5.85 0 |
| `subtle-tilt` rotateDeg | 0 0.28 1.02 2 2.9 3.43 3.43 2.9 2 1.02 0.28 0 | 0 0.28 0.28 2 2 3.43 3.43 2.9 2.9 1.02 1.02 0 |
| `fade-in` opacity | 0 .02 .08 .17 .29 .43 .57 .71 .83 .92 .98 1 | 0 .02 .02 .17 .17 .43 .43 .71 .71 .92 .92 1 |

## Not yet verified
- A real Remotion render. The sandbox's npm install failed, so only the pure-JS unit tests and the numbers above were run locally (93/95; the other test needs `@remotion/cli` and fails identically on 2.0.1). CI job `integration / renderer-v2-0-2` runs the full suite and typecheck.
- Whether on-twos looks right on a real episode. Render one with 2.0.2 before switching defaults.

## Switching the default (separate change)
Update `current`/`defaults.job5` in the registry, `bootstrap/current-policy.json`, `compile-job-v5.mjs` and `validate-handoff-workspace-v2.mjs`, the Python pins in `tools/` (executor, package_validation, preflight, renderer_repair) and the tests that name 2.0.1.
