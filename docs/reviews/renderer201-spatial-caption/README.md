# Renderer 2.0.1 spatial and caption review

Source: existing `songtu-bi-tuong-doi-phe` Job@5, 24 fps, 1080 × 1920, eight scenes and 1,189 frames. No ZIP, authored SVG, production IR, narration, voice, timing or source render-plan edits.

Open [the before/after gallery](index.html) and [the entity audit](audit.json). Frame 1150 is 47.917 seconds and contains “bản đem nộp đâu?”. All PNGs are actual Remotion output, including the cover.

## Causes and changes

- Environment used authored layers 1/2/5 while characters defaulted to zero. The whiteboard covered Gemini's face. A shared role resolver distinguishes the existing native desk-edge as foreground, retains explicit roles and valid authored depth, and diagnoses unresolved roles. Default character depth 3 keeps the native board/window behind the actor and the desk at depth 5 in front. Occlusion relations override default ordering; stable ID ordering resolves ties. States inherit the last authored depth.
- Prepare ignored environments and only inspected static state rectangles; rendering clipped captions. Caption layout now uses scene → presentation → canvas/typography default, real Chromium font measurements, explicit wrapped lines, padding and bottom alignment inside the approved caption zone. The default reserves the bottom and right regions for TikTok UI. The full plan is checked frame by frame against visible SVG alpha bounds, uniform scale, rotation, motion and state swaps. Decorative background can sit behind text; foreground cannot enter the padded text rectangle. Adjustments are recorded without changing entity coordinates or bindings.
- Cover replaced all authored positions with one center. It now fits the selected visual group into the existing cover region with one common scale, preserving relative positions and depth.
- Studio preflight selected 2.0.1, then its controller prepared with hardcoded 2.0.0. Both now resolve the imported manifest pin. Renderer source/script/font changes enter the existing render fingerprint without invalidating TTS or timing.

## Validation

- Renderer: 64 behavioral and existing regression tests, plus TypeScript checks. The actual eight-scene fixture uses byte-identical copies of approved SVGs and the source plan, including the S07 pen slide and marked notebook.
- Python: full unittest suite and full pytest suite (`--capture=sys` avoids a Windows Tcl failure caused by descriptor capture). Eleven existing tests require external services/runtime opt-ins and remain skipped.
- Six pre-render gates pass over all 1,189 frames: role, layer, occlusion, caption zone, text fit and spatial bindings. The generated `.runtime/spatial-qc-report.json` includes bounds, roles, depth, motion and caption overlap per frame, plus logged caption placement.
- Event preview: 17 BEFORE/DURING or BEFORE/AFTER pairs, 16 active-caption frames covering every scene, and a real S07 animation clip. Preview HTML/JSON and a full MP4 live under `.zodiac-work/reviews/spatial-201/`.
- Full MP4: 1,189 frames, 49.541667 seconds. Audio was stream-copied from the existing final MP4. Both audio streams have SHA256 `adc9f75082f2611e4c46051c2f32b6260f22bc2deff1b64276b8be3b05ccfe8b`. Protected source hashes are recorded and verified in `audit.json`.

Viewed actual cover, frame 1150, S07 writing/marked states and caption frames from all eight scenes. The whiteboard stays behind faces; the desk and captions are separated; two-line captions remain visible. The source S07 motion and notebook marking stay intact. Caption quality is supported by rendered evidence, not only QC counters.

Occlusion uses conservative painted AABBs and a conservative recognition region for the current character silhouettes. Conflicting foreground geometry fails with entity/frame diagnostics; it is not silently repositioned. No per-scene coordinate patches were introduced.

## Changed code

- `src/visual-role.mjs`, `src/caption-layout.mjs`, `src/spatial-layout.mjs` and TypeScript declarations: shared role, depth, caption, geometry and cover resolution.
- `scripts/measure-layout.mjs`, `scripts/prepare.mjs`: real font/SVG measurements and mandatory pre-render gates/report.
- `src/ZodiacRenderPlan.tsx`, `src/ZodiacCover.tsx`, `src/types.ts`: shared resolution, unclipped captions and grouped cover placement.
- `scripts/preview.mjs`: actual caption stills, event pairs, animation and machine-readable QC in the review output.
- `tools/studio_v2/controller.py`, `tools/studio_v2/executor.py`: consistent renderer pin and source fingerprint.
- Renderer/Studio regression tests and fixture; `.gitignore` excludes Remotion's generated browser cache.

GitHub CI and merge status are recorded in the PR; merge is gated on every check passing.
