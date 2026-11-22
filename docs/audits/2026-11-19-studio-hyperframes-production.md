# Studio HyperFrames production path — 2026-11-19

Fresh Studio MP4 review export now uses **HyperFrames CLI 0.9.63**, the same
compiler-owned GSAP state/acting/caption painter as preview, and the selected
hash-verified Voice Lab assembly. Remotion remains available for old packages.
The user authorized prioritizing production while continuing expansion and the
established character-led limited 2D style; optional phase ordering was changed,
not source ownership or genuine human approval.

## User flow

Import genuine approved Phase 1 → generate/select/assemble/align in Voice Lab →
author Visual Intent → **Dựng cả episode → Xuất MP4 → Xem MP4 đã xuất**.
The same window plays the actual MP4 and copies its persistent filesystem path.
An old preview without export-bound source hashes requests one rebuild.

Export runs under the existing managed visual job, with actual HyperFrames
progress, cancellation and retry. Each export gets an immutable folder. Source
or voice changes, failed capture, invalid media or cancellation cannot replace
the previous healthy export. The private loopback origin verifies video hashes
and supports byte ranges; the browser receives no arbitrary filesystem route.
Current playback reads at most 256 MiB; disk streaming is deferred for larger
files. MP4 output is a technical review artifact, not publication or approval.

## Source and animation contracts

- The build now binds `production.json` and measured per-scene words/events.
  Export verifies the manifest, production, scene HTML and SVG bytes, then
  reconstructs each preview to check exact preview identity before assembly.
- One paused whole-episode timeline uses that same seekable painter. Voice
  anchors, state changes, restrained motion and Vietnamese captions are retained.
  `state_swap` is now a hard cut in both preview and MP4: frame inspection exposed
  crossfaded duplicate limbs, and a failing regression was fixed. Intentional
  authored fade motions remain available.
- Final publication holds visual-state and voice-state locks through verification
  and saving. The original manifest identifies export freshness even after
  re-aligning the same WAV and rebuilding at the same visual revision.
- Cancel can terminate only the owned process tree even when source validity has
  been lost. UTF-8 child logs are decoded explicitly on Windows, preventing
  reader-thread failure under cp1252. Previous recoverable files remain.
- `EXPORTED`, `STALE`, `UNKNOWN`, human review and publication are separate.
  The UI reloads export freshness on voice/build/timing changes. No code grants
  voice/visual/content approval or ticks concept progress upon render.

## Fresh checks

| Check | Result |
| --- | --- |
| Python export, P3/P4, P5 performance/transport, P1 RPC and P0 evidence | 55 passed, 105.221 s |
| Node export composition/tamper + P3/P4 compiler/SDK + P5 assets | 20 passed |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Rust | 2 passed, including actual Rust → Python `video.get` contract dispatch |
| Rust formatting / CRLF-aware diff check | passed |
| Export UI browser | actual fixture MP4 decode, progress, copy path, stale refresh and no approval writes at 1366×768, 1060×650, 1093×614 |
| Compact browser | six views, embedded gallery/acting/source/inspector/candidates/logs and pagination at three viewport sizes |
| Actual managed render | Python → Node → HyperFrames check/render → FFmpeg AAC mux → ffprobe → private HTTP range request → persisted receipt |

The final actual export has 1080×1920 video, 30 fps, 45 frames, 1.5 s duration,
H.264/AAC streams, 62,892 bytes and SHA-256
`c76766c841e09045e60d57fd58948841955a6e441e7655be7e7654c7bdade23a`.
The stable local copy is `.runtime/hyperframes-production-service-smoke/episode.mp4`;
its original immutable export path and source/voice/probe hashes are in
`.runtime/hyperframes-production-service-smoke/result.json`. Setup, acting and
reaction frames were extracted from the encoded MP4 and inspected. This is an
explicit **synthetic-content/timing fixture with an audible test tone**, not a
new approved episode or evidence of TTS/listening quality.

HyperFrames' non-strict check returned `ok: true`, no errors; warnings include
nested composition structure, separately muxed audio, safe-zone/craft/readability
for the short test scene. These are not human artistic acceptance. The actor
and phone fixture is unbound and does not establish hand-contact fidelity.
Native host dispatch was tested; native GUI playback and a real production
episode/listening review remain distinct work. Browser checks mock UI transport;
the actual managed service smoke exercises the real rendering backend separately.

## Independent review and repair

One independent read-only review found no Critical and three Important issues.
All were reproduced in failing tests and corrected: old timing could appear
fresh after a same-revision rebuild; invalid content could prevent process
cancellation; and voice verification was not atomic with publishing. Its stale
UI finding was corrected as part of freshness handling. The full affected
Python suite passed afterward. No second reviewer pass was claimed.

Actual capture also exposed Windows UTF-8 log decoding and cutout ghost limbs;
both received failing-then-passing checks. Earlier transient UI test failures
were caused by the app dev server closing; final browser checks used a separate
test Vite port 1421. Only that test server is stopped after verification.

## Boundaries and next production work

No release installer, shared-branch commit/push, real episode approval, automatic
publication or concept completion was produced. Existing dirty Ideas/catalog/
gallery work, original narration/audio, old packages and prior video outputs
were preserved. Remote CI is configured for the new unit tests but was not run.

Next: apply the loop to a selected real approved handoff, complete its acting/
meme/contact authoring and actual listening/visual review; then optional licensed
BGM/SFX mixing and delivery packaging. Gallery/model/palette expansion remains
in scope where it helps those scenes. It is not a prerequisite to exercising
the MP4 export path. Renderer parity with historical Remotion is not asserted.

Rollback reverses only this production slice's hunks and pinned dependency;
retain source projects, immutable export folders and the last healthy media.
Do not restore whole files over the pre-existing dirty worktree.
