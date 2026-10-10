# Cover opening presentation

New authored videos may set `publish.cover.opening` to `{ "enabled": true, "duration_sec": 1.5, "transition_sec": 0.3 }`.

Renderer 2.0.1 source with cover-opening support renders the existing ZodiacCover component from frame zero, then dissolves it into the existing first scene. No frames are prepended and no scene, event, voice or caption timing is rewritten. Captions and the runtime watermark remain above the opening; the standalone cover's extra footer watermark is omitted in the video. `cover.png` continues to render independently.

Duration must be 0.5–3 seconds and fit inside the first measured scene starting at zero. Transition must be positive, at most 0.6 seconds, shorter than total duration and resolvable in the current fps. Invalid metadata blocks prepare and render. Missing metadata preserves old behavior; `enabled:false` opts out.

This is compatible presentation metadata within publish@1/Job@5, not a semantic event scheduler. Update the runner source before using it: an older installed renderer does not acquire this feature through metadata alone. The existing source-hash cache checks continue to detect changed bundled renderer bytes.

Review the actual opening, dissolve and first uncovered frames with subtitles; cover-only approval does not certify subtitle collisions or the transition. `scripts/smoke-cover-opening.mjs` renders real 1080×1920 frames from the existing Song Tu fixture. It verifies rendering and canvas, not artistic merit or collision-free pixels. The fixture is regression evidence, not a new approved production video.
