# Phase 2 current-assets cleanup — verification

Version: 2.5.0. Baseline source commit: 254f6b96d3e88631de6615b9af8f77cfc3eb179a.
Installed source at start: 2.4.68, release pluginrel_6acd577488d48191aaef4e7e081cf73b.
Development baseline: GitHub 2.4.69; changed private release prepared as 2.5.0.

## Verified behavior

- 37 historical files removed from the active plugin; exact inventory is retirement-inventory.json.
- 6 compatibility hair IDs and 34 old environment profile/cue IDs retired.
- Retirement is physical for historical SVGs/prose/contours, not only a prompt deny-list.
- Fresh selectors reject retired IDs and legacy/selected_cues modes; historical recovery uses an external pinned snapshot.
- Current props remain valid. Intent cannot hide native production identity under a matching asset ID. Native SVG metadata is checked too.
- Active interaction contracts no longer contain historical character geometry.
- Character/accessory and effect previews come from the native compiler; scene masters are hash-verified.
- Native catalog: 139 items, including shirt colors; static HTML generation verified. Hair contact sheet rendered and visually inspected from exact native SVGs. Full browser interaction QA was unavailable because no Chromium executable was installed.
- Selected stage/accents from canonical grammar input participate in source dependency hashes.
- Default current authoring context: visual_compile 64,522 bytes, assets 67,605 bytes.
- Focused Node suite: 32/32 PASS, including current-native compiler → review preview → sealed Job@5 ZIP and stale-source rejection.
- Python runner import/spatial hash tests via unittest: 4/4 PASS.
- Current library validator PASS, both release manifests and state template agree on 2.5.0.
- Shipping archive: 506 files; root-flat manifests, ZIP CRC and all local static module imports checked.
- Native preview and ZIP/import checks do not certify TTS timing, browser behavior or final MP4/media.

## Broad suite remains non-green

Before change: 597/643 PASS, 46 failures. Latest broad run:

```text
ℹ tests 659
ℹ pass 601
ℹ fail 58
ℹ duration_ms 20508.119768
```

Some tests still require explicitly retired room profiles, finished-character masters,
compatibility hair or old prose/version strings. Other failures existed in the baseline,
including scene-set API drift and malformed symbolic fixtures. They were not marked PASS,
removed to conceal failures or represented as final-media evidence. This branch needs a
separate test-suite migration/repair before claiming a fully green repository or merging
as an all-repository quality release. The focused current-native path above is verified.

## Review rulings

- Cut obsolete compatibility asset choices from the current release instead of keeping
  hidden fallbacks. Cost: historical jobs needing those capabilities must restore their
  pinned snapshot; no automatic identity migration.
- Independently validate intent and production assets after review found ID shadowing.
  Regression test observed RED then GREEN; focused suite stayed green.
- Remove obsolete guidance/interaction geometry discovered by review rather than point
  current authors at historical assets. Current interaction tests passed.
- Include current shirt colors in native catalog comparisons; no unsupported preview IDs.
- Retire the unused historical scene-art-direction probe, which also had a misplaced
  shebang syntax error. Current manifest uses validate-phase02-art-direction.mjs.
- Preserve the current user-facing plugin name, audience, defaultPrompt and App bindings.

## Full failure inventory

- V4 is canonical and historical migration data has no runtime dependency (3.565295ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/architecture-v4.test.mjs`
- plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/asset-selection-policy.test.mjs (90.975666ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/asset-selection-policy.test.mjs`
- full diagnostic manifest reflects current visual semantics and live catalog counts (11.259757ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/asset-showcase-preview.test.mjs`
- Study Bedroom stays inside the three-step Visual Production phase (11.93047ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/bedroom-v153-wiring.test.mjs`
- router remains thin and points to Visual Grammar rather than embedding bedroom-specific rules (1.66822ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/bedroom-v153-wiring.test.mjs`
- channel follows semantic beat rhythm without mandatory intensity (2.638906ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/channel-voice-default.test.mjs`
- fresh automatic hair routing excludes lopsided-bob while compatibility can request it (4.655903ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/character-geometry-modules.test.mjs`
- character-only guidance is registered (1.273654ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/character-only-v230.test.mjs`
- Character single policy in both manifests (1.937636ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/character-publish-audit.test.mjs`
- plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/classroom-caption-safety.test.mjs (70.810366ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/classroom-caption-safety.test.mjs`
- intent permits registered compiler component before materialization, never authored missing (2.571304ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/composition-stages.test.mjs`
- no-meme cafe omits unselected registry guidance but retains exit validators (3.437708ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/conditional-context.test.mjs`
- an explicitly requested legacy selection retains full catalog guidance (0.22522ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/conditional-context.test.mjs`
- environment system remains wired through v4 Visual Production (7.923849ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/environment-composition-wiring.test.mjs`
- V4 environment examples remain composition-only metadata (2.707089ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/environment-composition-wiring.test.mjs`
- phase execution implementation has explicit owners (10.057945ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/executable-architecture.test.mjs`
- router invokes execution preflight before phase execution (5.480714ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/execution-bootstrap.test.mjs`
- female-messy-bun stable id uses a bounded V4 hair silhouette (3.108953ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/female-clean-bun.test.mjs`
- female-messy-bun has a v4 human-stroke exemplar and remains stable id (3.439463ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/female-extension-visual-quality.test.mjs`
- approved Gemini reproduces cast, staging, symbolic progression, preview and Job5 from a clean workspace (99.140478ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/gemini-clean-repro.test.mjs`
- GitHub transport fallback requires version+integrity and does not certify failed CI (4.096665ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/github-source-fallback-guide.test.mjs`
- skill references exact optional fallback (8.443227ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/github-source-fallback-guide.test.mjs`
- plugin 2.1 manifests and skill pin job5 renderer2 with preplanned sparse character states (8.062352ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/job-v5-phase-wiring.test.mjs`
- plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/native-composition-contract.test.mjs (92.096744ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/native-composition-contract.test.mjs`
- two authored endpoints per event with explicit motion-only limitation (20.503404ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/native-preview-pairs.test.mjs`
- standalone index displays every event without iframe or data URLs (8.284027ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/native-preview-pairs.test.mjs`
- v2.1 metadata and semantic renderer boundary are current (4.083745ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase-audit-v156.test.mjs`
- symbolic authoring kind projects to existing Job5 transport only at intent boundary (10.216403ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase2-framework.test.mjs`
- selected dependency graph excludes unselected library bytes and includes selected master bytes (950.343832ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase2-framework.test.mjs`
- scene-set validation binds declared identity, geometry and exact master hash (4.237707ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase2-framework.test.mjs`
- producer review requires source-backed two endpoints/event, not Remotion (7.510949ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/preview-ownership-contract.test.mjs`
- native rest poses preserve identity and use authored bent or horizontal limbs (1.385681ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/rest-pose-contact.test.mjs`
- writing socket is the actual authored hand rather than a generic contact point (0.208064ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/rest-pose-contact.test.mjs`
- lying outfit is clipped to its torso and has no floating standing shadow (0.168775ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/rest-pose-contact.test.mjs`
- producer and local-runner review scopes are explicit (18.331665ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/review-ownership-boundary.test.mjs`
- Phase 02 native gates are preserved, without a Remotion gate (5.490569ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/review-ownership-boundary.test.mjs`
- Job@5 export is Phase 03 only; no extra phase (2.074101ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/review-ownership-boundary.test.mjs`
- orchestrator accepts compiler_result proof (4.003955ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-direction-compiler-wiring.test.mjs`
- runtime contract targets renderer 2.0 state assets (2.788069ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-direction-compiler-wiring.test.mjs`
- v4 remains compile-time and the package targets renderer 2.0 (4.286003ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-direction-wiring.test.mjs`
- plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-set-identity.test.mjs (74.814982ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-set-identity.test.mjs`
- plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-set-regressions.test.mjs (95.140893ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/scene-set-regressions.test.mjs`
- one intent projects native composition grammar and handoff without adding background cues (12.041978ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/simplification-release.test.mjs`
- new Phase-02 source template keeps Visual Metaphor opt-in for fresh content (2.60821ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/story-object-system.test.mjs`
- new fresh run blocks absent story object plan by release policy (4.020858ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/story-object-system.test.mjs`
- one authored entity change reaches native projections deterministically (3.76096ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-intent-projection.test.mjs`
- tampering a derived projection invalidates ownership receipt (0.466555ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-intent-projection.test.mjs`
- scene art direction is projected to the native intent contract (0.436719ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-intent-projection.test.mjs`
- an empty execution receipt cannot hide production drift (14.231836ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-intent-projection.test.mjs`
- manifest finalization permits forced native revalidation only after genuine source-bound core and completed steps (6.079472ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-intent-projection.test.mjs`
- fresh template no longer requires Story Object and exposes lightweight metaphor routing flag (2.460016ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-metaphor.test.mjs`
- v4 visual-quality pipeline runs structure + style + semantic gates (6.809566ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-quality-v4-integration.test.mjs`
- wrapper blocks legacy style through v4 production gate (2.512235ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-quality-v4-integration.test.mjs`
- two characters using one body profile fail cast diversity (98.101144ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-structure-v4.test.mjs`
- v4 visual-quality pipeline runs structure + style + semantic gates (1.837365ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-quality-v4-integration.test.mjs`
- wrapper blocks legacy style through v4 production gate (1.271741ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-quality-v4-integration.test.mjs`
- two characters using one body profile fail cast diversity (96.011909ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-structure-v4.test.mjs`
- fresh-run isolation is explicit in skill and router (6.912291ms) — `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/context-isolation.test.mjs`
