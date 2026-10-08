# Runtime caption/font smoke-gate v1 (P0)

Status: proposed; implement against the actual renderer after tracing entry points. Regression input: zodiac-bocap-hai-phien-ban-v2.6.zip.

1. Consume scene.caption_segments first. Validate strict monotonic [start_ms,end_ms), semantic phrase grouping, max 2 lines, preferred_breaks only when line width fits. Do not treat word timestamps as pages.
2. Legacy fallback chunker only when explicitly enabled and logged: group semantic clauses, avoid 1–2 word fragments except intentional emphasis, respect width/time/speech pauses, preserve punctuation. In strict production mode missing caption_segments is a fatal validation error.
3. Resolve bundled font asset before frame composition. Log requested family, discovered font path, loaded family and fallback flag. Primary: Patrick Hand (verified Vietnamese coverage required). Explicit optional fallback: Segoe Print then cursive only in non-strict preview; missing/bad font in production fails loudly. Never emit 'Patrick Hand loaded' unless font bytes were loaded AND verified by renderer.
4. Preflight boxes in 1080x1920 pixel coordinates: caption_safe_zone and character/prop/effect zones. Measure actual caption shaping bounds including accents and outlines; detect temporal intersections after animation overshoot and reject release.
5. Density caps: 3 characters, 2 prominent props, 2 prominent effects, reduced prominent props/effects (<=1 each by default) when 3 characters. Do not silently hide actors.
6. Check voice/audio duration. Reject treating duration_hint_frames=1 as authoritative for voiced scenes; derive scene length from actual recorded narration/timed audio.
7. Smoke-gate three scenes: (a) 3 characters, (b) phone/prop, (c) longest caption. Save screenshot, machine-readable preflight JSON and logs including font, watermark, caption grouping, collision and density. Only then full 12-scene render.
8. Keep ✦ bungmoto watermark stable and outside caption safe zone. No new assets, props, backgrounds or preview redesign in P0.

Exit requirements: unit tests for grouping, strict missing-font, fallback diagnostics, safe-zone collision, density, duration; 3-scene screenshot checks and successful 12-scene render. Do not mark release ready without test artifacts.
