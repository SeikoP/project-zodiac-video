# Studio P5 assets, palettes and acting implementation

**Goal:** real source-backed gallery, distinct phone geometry and semantic palettes,
with canonical voice-anchored limited 2D acting authoring in experimental Studio.

**Spec:** roadmap P5; Visual V5 color system; prop variant diversity; creative
Studio §2.1. Existing P3/P4 is reused. No new renderer or dependency.

## Tasks and interfaces

- [x] Asset source: three phone masters in the existing authoritative props index;
  actual compiled component previews; `describeGallery()` with items, themes and
  source hashes. Preserve legacy readers/IDs and contact restrictions. Test hashes,
  distinct silhouettes, palette contrast, constraints and unsafe SVG rejection.
- [x] Transport: `assets.gallery(project_id)` exact RPC through existing compiler
  action, Python owner and Rust whitelist. Test unexpected parameters fail closed.
- [x] UI: replace placeholder asset page with paged real previews, role/search,
  provenance and candidate fit inspector; dynamic theme selector via canonical
  commands. Verify TypeScript and compact browser sizes.
- [x] Acting: `scene.performance` updates only existing scene events, with existing
  states and voice anchors, revision/undo and full compiler validation. Agent can
  propose this scoped command. Test malformed, stale and out-of-scope requests.
- [x] Integration: existing P3/P4 regressions, host checks, source-bound preview
  artifacts and independent review. Evidence: [P5 progress receipt](../../audits/2026-11-18-studio-p5-progress.md).
- [ ] P5 acceptance: genuine review of palettes/phone geometries, native acting
  playback/contact inspection, and remaining usage/preview completeness below.

## Rulings

- Preserve all pre-existing dirty Ideas/MP4 work; no commit/push/release requested.
- Three palettes and three phone geometries are candidates until the user reviews
  their actual previews. Technical PASS cannot close the human P5 gate.
- Existing-assets-only restrictions govern style auditions; P5 explicitly
  authorizes new registered phone geometry. Never add decorative story content.
- Phase 7 retains final whole-video acceptance. New acting direction uses existing
  P3/P4 source/preview APIs without reopening their technical acceptance.

## Review focus

Unverified contact after model replacement; palette mutation of skin/hair;
stale catalog hashes; hidden components at compact sizes; events escaping their
scene or silently editing narration. Recent usage must come from real evidence.

## 2026-11-18 continuation

This checklist records the bounded implementation slice, not the full roadmap
P5 gate. Local checks passed: 39 Python tests, 16 Node tests, TypeScript, locked
Rust host test and browser layouts including embedded gallery/acting editor at
1366×768, 1060×650 and 1093×614. Three source-bound 1080×1920 frames were saved
under `.runtime/p5-review/`; narration/timing are synthetic and grant no approval.

The scoped acting validator now ignores unchanged scenes' legacy duration
overruns, but still validates the episode structure and checks the edited scene's
duration, overlap and actual measured playback state chain. Catalog metadata
changes invalidate candidates. Screen markings retain contrast on dark themes.

Remaining P5 scope: reviewed phone grip/contact in actual scenes; verified usage
history integration; complete meme composition previews (currently actor states);
character quality improvements and richer phone state/view/case variants where
review demonstrates need. Eight palettes are a ceiling, not a required expansion.
Keep P5 open and do not start P6/P7 under an assumed human approval.

## 2026-11-19 source-bound usage slice

- [x] Project Core reads actual committed build manifests through the existing
  registry, verifies source/manifest/scene/asset bytes, excludes the current
  project and returns a bounded read-only usage projection. No new database or
  approval writer. Missing/corrupt/stale/untrusted builds do not count.
- [x] Gallery and candidate queries share that projection. Match prop usage by
  source SHA rather than episode-local aliases; display episode/scene/source
  provenance. Technical builds remain explicitly unreviewed and never receive a
  reviewed-use ranking penalty. Existing hard feasibility constraints remain.
- [x] Add focused tamper/reopen/pagination and transport/UI checks; record
  results and independent review. P5 human acceptance remains open.

Ruling: current `EpisodeStatus.visual` is always UNKNOWN. Technical build usage
is useful inspectable evidence, but cannot become reviewed history or close the
reviewed-reuse gate. Keep that distinction explicit in UI and API.

Verified: 30 affected Python tests plus one two-project RPC integration test,
17 Node tests, TypeScript, standalone gallery and compact editor at three
viewport sizes. One independent review's corrupt-event failure was reproduced
and fixed; candidate truncation is visible too. See
[usage evidence](../../audits/2026-11-19-studio-p5-usage-progress.md).
Exact-byte technical usage is delivered; reviewed/model-level reuse and the
remaining meme/contact acceptance work are still open. The projection scans
the first 500 registered project IDs and reports up to 50 latest valid builds
within that set, explicitly reporting partial coverage.
