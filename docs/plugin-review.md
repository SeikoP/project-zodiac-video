# zodiac-video-pipeline 0.9.1 review

Reviewed the 0.9.1 skill, production-handoff contract, Remotion renderer scaffold, and the `RENDER_READY` example package.

## Confirmed design

- The plugin owns evidence, story, narration, visual compile, and video-specific asset production.
- Production illustrations are hand-authored SVGs unique to each video's contract. Simple shapes/props can be declared as procedural SVG primitives in `production.json`; the pipeline does not need a fixed pose library or generated raster images.
- A `RENDER_READY` export contains `narration.txt`, one canonical `production.json`, its own `assets/`, and `renderer/`.
- Voice creation, measured `.runtime/timing.json`, preview, and MP4 rendering are local production steps. Runtime timing belongs outside the canonical `production.json`.
- The uploaded `zodiac-content-pipeline-v0.1.zip` is a carousel/content skill; it is not a video package and has no production contract or Remotion renderer.

## Findings to address in the plugin

1. **No dependency lockfile.** `renderer/package.json` pins direct versions, but the renderer handoff uses `npm install` without a `package-lock.json`; transitive versions can therefore resolve differently across dates or machines. Add and ship a lockfile, then use `npm ci` in the local handoff.
2. **Object asset files are not checked by the renderer preflight.** `renderer/scripts/render.mjs` verifies actor SVG paths and object asset IDs, but it does not verify that an object's registered SVG path exists. This runner checks all registered assets and scene object references before invoking Remotion.
3. **Voice duration is not compared with total frame duration.** The renderer requires `voice.wav` and checks timing continuity, but it does not compare the WAV's measured duration with `total_duration_frames / fps`. Add a tolerance-based check so a mismatched voice/timing pair is caught before rendering.
4. **Generated SFX files are present in the plugin export template.** The renderer regenerates declared procedural SFX from `production.json`; shipping pre-generated WAVs in the template can leave stale/duplicate artifacts. Keep only the generator in the template, or document why generated files belong there.
5. **Full build/render verification is still outstanding.** The contract and example package pass the runner's static checks, but this review did not run `npm install`, the TypeScript compiler, or an MP4 render. Do not treat the renderer as end-to-end verified until those commands pass with a real measured voice/timing pair.

## Runner boundary

This repository handles safe extraction, package and SVG validation, runtime timing validation, pinned direct dependency installation, typecheck, preview, and render. It does not synthesize Vietnamese voice or infer timestamps from narration text: timing must come from the actual generated or recorded voice.
