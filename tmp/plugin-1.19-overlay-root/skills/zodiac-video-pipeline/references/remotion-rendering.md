# Shared Remotion runtime 1.15

Zodiac-job@3 packages do not contain a renderer. The trusted renderer lives in Zodiac Studio as the exact pinned runtime `zodiac-remotion@1.15.0` / `4d52e6ca766649546482a5cdfbf879f4f19c4d3c41c07c7743cccec1a7100ffa`.

The runtime consumes job-owned `design.md`, `production.json` v2.0, package SVG assets, `voice.wav`, measured `.runtime/timing.json`, and publish metadata through the shared job-root contract. It performs no creative planning.

## Render boundary
Local runtime owns:
1. voice generation from approved narration;
2. measured word-level alignment and scene frame ranges;
3. exact runtime resolution + dependency preparation;
4. schema, lineage, Semantic Animation Gate, caption, asset/state/event, voice-anchor and progression validation;
5. `.runtime/render-props.json` and procedural SFX;
6. Remotion preview/render and publish output.

Studio sets `ZODIAC_PACKAGE_ROOT` and invokes Remotion with the job root as `--public-dir`. Runtime source never imports a package-relative `../../production.json`.

`Root.tsx` may declare `durationInFrames={1}` only because canonical `calculateMetadata` replaces it with measured timing.

Strong articulation events are blocked when they use unexplained whole-asset swaps. Part-level motion uses package-owned child entities declared in `event.mechanism.parts`.

Do not copy `templates/remotion-renderer/` into a job ZIP. The template mirrors the runtime contract for maintenance/reference; the bundled Studio runtime and its manifest hash are authoritative.
