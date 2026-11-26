# Studio P5 asset usage — 2026-11-19

The gallery and candidate inspector now share source-bound usage from other
registered projects' current committed builds. This is a completed technical
slice of P5; **human acceptance and the full P5 gate remain open**.

## Behavior

Project Core follows the existing registry cursor pages and verifies approved
content identity, current Visual Intent source/revision, narration hash, stored
build versus disk manifest, complete scene inventory, scene preview hashes and
the corresponding generated SVG hashes. Symlinked or escaping paths, missing,
malformed, tampered or stale evidence excludes that episode. Reads do not create
an approval, repair source or modify another project's state. History is loaded
before taking the current project's edit lock, avoiding cross-project lock
cycles. Existing request staging remains unchanged.

Gallery and candidate usage match exact SVG SHA-256, independent of episode-local
asset aliases. Gallery **Ngữ cảnh** displays episode/scene IDs, build and manifest
provenance. Candidate inspection shows technical use counts. These remain
`NOT_REVIEWED`; candidate ordering/IDs and all role/contact/continuity constraints
are unchanged. No technical build creates a repetition penalty, no popularity
signal is treated as suitability, and no status is promoted.

The projection scans the **first 500 registry IDs**, using 100-project pages,
then retains the 50 latest valid builds **inside the scanned set**. This is not
global recency ordering for libraries larger than 500 projects. Both API and UI
report partial coverage. An indexed projection is deferred until library size
or measured query cost warrants it. There is no new database or dependency.

## Verification

| Check | Current result |
| --- | --- |
| Python usage/performance/transport/P3-P4 suite | 30 passed, 101.164 s |
| Actual two-project Python → Node RPC integration | 1 passed, 7.338 s; identical history in gallery/candidate; visual status still UNKNOWN |
| Node P5 assets + P3-P4 compiler/SDK suite | 17 passed |
| TypeScript `pnpm exec tsc --noEmit` | passed |
| Standalone gallery browser | passed: history episode/scenes/unreviewed label, pagination/filter/palette/contact/read-only, 1366×768 / 1060×650 / 1093×614 |
| Compact browser | passed: six views, embedded gallery/acting/source/voice/inspector/log tabs, candidate partial-scan label, three viewports |

Python checks cover reopen without state changes; exact source-byte matching;
changed narration/intent/manifest/preview/SVG; stale revision; unsafe symlink;
registry pagination/scan cap; one missing project; non-object state; malformed
event payload; and identical gallery/candidate data. The end-to-end RPC check
imports two synthetic test handoffs and compiles actual eight-scene fixtures.
These are technical test sources, not new human approvals or production videos.

Browser tests use the installed Playwright/Thorium and mock UI transport. Real
RPC tests exercise the production Python/Node boundary separately. Native P5
WebView2 playback was not revalidated; no Rust contract changed. Remote CI was
not run. The existing P5 unittest glob already collects the new usage tests.

Local logs: `.runtime/p5-usage-python-final.log`, `p5-usage-rpc.log`,
`p5-usage-node.log`, `p5-usage-compact-final.log`. New logic was tested failing
first (`p5-usage-red.log`, `p5-usage-node-red.log`). One independent read-only
review reproduced a malformed event payload crash; its regression failed in
`p5-usage-review-red.log` before the fix. Its partial-count UI finding was treated
as required correctness: `p5-usage-coverage-red.log` failed before adding the
notice. Both fixes passed; no deferred review findings remain.

Initial browser reruns exposed a fixture interception issue: Vite appends cache
queries to changed backend module URLs. The affected test routes now accept
that suffix. The new notice initially pushed pagination outside the 614 px
window; shortening the existing usage line restored the compact layout.

## Remaining roadmap scope

Exact SVG use does not measure model/appearance/view/action/shot repetition,
character component reuse or reviewed/published provenance. Current Studio
visual status remains UNKNOWN. Reviewed history and soft ranking penalties
require verified visual review integration; this slice does not invent it.
Full meme composition previews, native phone grip/contact inspection, genuine
palette/phone acceptance, character quality and justified phone variants remain
P5 work. P6/P7 gates are unchanged.

Frontend HMR updates the running dev UI; restart the dev app to load the changed
Python module. No release build/package, commit, push, MP4 or user project
approval was produced. Preserve all existing dirty work if reversing these
specific hunks.
