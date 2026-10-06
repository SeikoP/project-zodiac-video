# Shared Renderer Source Contract

The canonical renderer is a **versioned Zodiac Studio runtime**, not a file tree copied into each creative ZIP.

Current runtime:
- id: `zodiac-remotion`
- version: `1.14.0`
- SHA-256: `88f845a0e9304383ed6627127206185d301ba1516b1e16e591cbe1ba47c3d1f8`
- contract: `shared-job-props-v1`

## Data boundary
The shared renderer MUST NOT import `../../production.json` or `../../publish/publish.json`. Studio supplies measured timing, resolved events, `production`, and `publish` through Remotion props and sets `ZODIAC_PACKAGE_ROOT` to the imported job.

The runtime invokes Remotion with the job root as `--public-dir`, so `voice.wav` and `assets/**` remain package-owned data. Procedural SFX are generated into job runtime data, not stored in the ZIP.

## Required markers
Video/runtime: `calculateMetadata`, `production.scenes.map`, `timing.scenes`, `captionOverlayTop`, `fullCanvasContentStyle`, `voice.wav`, `render-props.json`, `ZODIAC_PACKAGE_ROOT`, `--public-dir=`, `spawnSync`, `ZodiacVideo`, `zodiac-story.mp4`.

Cover/publish: `Still`, `ZodiacCover`, `tilted_top_hook`, `publish.cover.identity`, `publish.cover.hook`, scene/entity state reuse, `cover.png`, `publish-copy.txt`, `publish.json`.

## Caption/font
`measureText(... validateFontIsLoaded: true)` may run only after local Patrick Hand 400 Vietnamese font readiness completes. Full-canvas visuals remain independent from caption overlay placement.

## Runtime testing
Runtime tests and TypeScript are cached by runtime hash and run once for the shared runtime, not once per job. Job-specific production/assets/timing validation remains in Zodiac Studio.
