# Studio HyperFrames production path

User direction: continue expanding Studio, move export to HyperFrames, retain the
existing character-led limited 2D animation; prioritize an actual persisted MP4.
This supersedes phase ordering, not source ownership or human approvals.

- [x] Reuse the compiler-owned state/acting/caption painter for scene preview
  and one deterministic whole-episode HyperFrames composition. Source-hash-bind
  production, measured words/events and assets. Pin local HyperFrames CLI.
- [x] Add managed revision-checked MP4 export via the existing visual worker,
  real progress/cancel/retry, immutable output folders, selected verified voice
  mux and ffprobe QA. Preserve last healthy output on failure/source drift.
- [x] Add native whitelist/RPC/UI export controls and private verified playback,
  download/path and truthful exported-versus-reviewed status. No new app window.
- [x] Run positive/negative contract tests, actual HyperFrames MP4 smoke at
  1080x1920 with frame inspection and audio, compact browser checks and review.

Reused: canonical Visual Intent/voice, episode build, GSAP/HyperFrames preview,
managed process/job lifecycle, FFmpeg, private preview origin and typed RPC.
No source narration rewrite, fake approval, static slideshow fallback, release
package, automatic publication, speculative music catalog or new renderer.
Optional gallery/meme/asset expansion stays on the roadmap after this vertical
slice. Remotion retains old package compatibility; fresh export is HyperFrames.

The MP4 is a technical review export until the user watches/listens and approves.
Current visual/listening review remains separate. Tests may use explicit
synthetic fixtures; those must never count as production content approval.

## Verification and remaining production acceptance

Actual managed export produced a persistent 1080×1920, 30 fps MP4 with AAC
through Python → Node → HyperFrames → FFmpeg and private range-enabled playback.
The 1.5 s fixture uses synthetic narration/timing and an audible test tone;
human listening/visual approval and a real production episode remain pending.
See [the source-bound receipt](../../audits/2026-11-19-studio-hyperframes-production.md).

One independent review's three Important findings were reproduced and fixed:
original export-manifest freshness across same-revision rebuilds; cancellation
after source invalidation; and one voice lock around final verification/commit.
The UI refreshes stale state on voice/timing/build changes too. State swaps are
hard cuts in both preview and output, preventing ghost limbs in cutout acting.

Next expansion stays production-focused: complete scene/meme/contact authoring
and review on an actual selected episode; measured speech/listening acceptance;
optional licensed sound/mix and final packaging. Extra palette/model/history work
is not a prerequisite to using the export path and is not cancelled.
