# Studio P5 local progress — 2026-11-18

P5 gallery/palette/acting implementation is locally verified in the dirty
`experiment/main-2` worktree. **The full P5 gate remains open.** Existing Ideas,
MP4 review, catalog progress and other local work were preserved. No commit,
push, release build, package or production MP4 was created in this continuation.

## Behavior and corrections

- The existing authoritative V4/V5 props index feeds real compiled gallery
  previews and the constrained candidate service through Python/Rust transport.
  Three registered phone geometries are candidates; none is human-approved.
- A scoped acting edit checks duration and overlap only in the selected scene,
  keeping whole-episode source validation. Unchanged historical transition
  overruns cannot block an unrelated edit. The selected synthetic test's final
  transition was explicitly shortened to fit its 250 ms remaining speech window;
  the shared legacy compatibility fixture was preserved.
- Events must form a valid state chain in measured playback order after sorting
  by voice anchor, as well as in source order. Reversed anchors are rejected
  before source/history/revision mutation. Undo and confirmed agent application
  use the same canonical command boundary.
- Dark palette phone markings now use dark muted ink against the fixed light
  screen surface, without changing untagged skin/hair/actor colors.
- Catalog revision includes full metadata and SVG hashes. Changes to grip slots
  or context invalidate old candidate IDs even when SVG bytes are unchanged.
- Windows CI now registers P5 paths/tests. The transport test uses stdlib
  unittest so it is collected without introducing a pytest dependency.

## Fresh verification

| Check | Observed result |
| --- | --- |
| `python -m unittest tests.test_studio_p5_performance tests.test_studio_p5_transport tests.test_studio_p34_visual tests.test_studio_p1_agent tests.test_studio_p1_rpc -q` | 39 passed, 84.374 s |
| `node --test tests/studio_p5_assets.test.mjs tests/studio_p34_visual.test.mjs` | 16 passed |
| `pnpm exec tsc --noEmit` in `apps/zodiac-studio` | passed |
| `python .runtime/studio_native.py cargo test --locked --manifest-path src-tauri/Cargo.toml` | 1 Rust host test passed; existing linker informational warning |
| `node tests/studio_p5_gallery_browser.mjs` | passed: standalone gallery pagination/filter/image/palette/contact/read-only fixture |
| `node tests/studio_compact_layout.mjs` | passed: six views, embedded gallery, acting editor/event pagination, source/voice/inspector/log tabs at 1366×768, 1060×650, 1093×614 |
| Source-bound compiler/browser capture | three 1080×1920 palette/phone frames; image decode, visible actors/props, caption, preview hashes and contrast asserted |

Browser checks use the installed Playwright module and Thorium via
`PLAYWRIGHT_MODULE` and `STUDIO_BROWSER`, against the development Vite server.
The UI transport is mocked; this does not certify native WebView2 or real media
playback. Rust tests exercise the host, not the running P5 desktop experience.
Remote CI was updated but not run by this continuation.

Local logs: `.runtime/p5-final-python.log`, `p5-final-node.log`,
`p5-native-tests-current.log`. Frame evidence and hashes:
`.runtime/p5-review/{apricot-campus,rose-social,indigo-noir}.png` and
`.runtime/p5-review/receipt.json`; reproduction script:
`.runtime/p5-review-capture.mjs`. These are ignored workstation artifacts, not
committed fixtures. Narration and timing in these images are synthetic. The
phone floats in an unbound test slot; the frames prove no hand-contact fidelity.

## Review and decisions

One independent read-only review reproduced an Important reversed-anchor state
chain bug, now fixed with a failing-then-passing regression. Its catalog metadata
finding was treated as Important because stale contact constraints must
invalidate proposals; an isolated temporary catalog regression failed before the
fix and now passes. No deferred minor code findings remain from that review.
Additional frame inspection exposed the dark screen marking contrast bug; its
regression also failed before the correction. The frame capture helper initially
reused a document execution context; it now navigates to a fresh context per
frame and asserts visible entities/caption before saving.

The local `.codegraph/` has no index beyond its ignore file and the MCP result
belongs to another checkout. Current files were inspected directly, without
creating an index. No dependencies or new production abstractions were added.

## Remaining gate and next roadmap work

P5 still needs genuine palette/phone review, native scene playback/contact
inspection, real usage-history integration, complete meme composition previews
(gallery currently labels actor-state-only previews), and targeted character /
phone state/view improvements where review establishes need. Gallery refresh
rebuilds its preview projection rather than a persistent incremental gallery
index. These are explicit remaining work, not inferred passes.

Do not promote P5 based on these technical results. P6 concept/library/licensed
audio integration and P7 real final rendering/whole-video acceptance retain
their separate roadmap contracts. Human listening, production throughput,
renderer parity and publication are not asserted here.

Rollback during this dirty session must reverse only this continuation's hunks;
do not restore whole files over existing Ideas/P5 work. Existing revisioned undo
remains the rollback for authored scene changes.
