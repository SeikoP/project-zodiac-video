# Finalization: Story Visual, visual acting and series-topic opening (2026-11-22)

## Source invariants
- Branch `experiment/main-2`, dirty worktree (pre-existing changes preserved); no commit, merge, push.
- Episode `love-sincere-sagittarius-20261118` / Nhân Mã; user-approved narration text / assembled voice / ASR timings untouched. Existing revision-4 and revision-5 MP4 review candidates preserved.
- Visual Intent changed from revision 5 (`003a912471ab9ec175c034a46f142387b43b83d601fa35ad4cb4c8afb2de0843`) to revision 6 (`9903ab40012db89ad1b4c03c7185225ba5588b97e38855c1b4d4ae77c5f106c5`).

## Root cause and resolved mismatches
1. V5 Story Visual preview/video rendered but external Phase2 presence validator returned seven violations: missing coverage and narrative brief in S02/S03, apparent phase1 origin mismatch because no brief ID, and unexecuted SV01. These violations meant an unsupported semantic handoff even with a TECHNICAL_VALID MP4.
2. Revision 6 now binds S02 contrast-chat and S03 native Story Text back to approved `story_visuals[SV01]` using `narrative_brief@2`, `visual_coverage@1`, text voice anchors, exact Phase1 direction, explicit assets `creative_origin`, and one canonical `story_visual` per scene. Both are still independent of the native caption layer. No separate `story_text` entity.
3. Real Phase2 `validate-story-visual-presence.mjs` on revision 6: **PASS**, `issues: []`. Independent shadow-workspace gate PASS *before* source.replace; real workspace gate PASS *after* commit. Related Node tests **21/21 PASS**.
4. S03, S04, S06 now have speech-driven reactions in existing cast states: S03 switches Nhân Mã's expression on excuse and back to deadpan on `để xem`; S04 returns from phone-search behavior to deadpan when narration mocks the route; S06 gives the friend a side-eye when Nhân Mã is over-invested and returns Nhân Mã's reaction on the final question. These are meaningful edits to voice-anchored state transitions, not random density fillers.
5. Original cover badge used first character `N`, which is not a zodiac sign. `visual_opening.mjs` now renders twelve hand-authored scalable zodiac glyph SVG paths; Sagittarius uses diagonal NE arrow, not a font-dependent character monogram. The series name and topic remain `12 CUNG HOÀNG ĐẠO` and `Cách Nhân Mã yêu thật lòng`, with zero preroll / no narration delay / original subtitle start.
6. Cover + chat + Story Text use native renderer and SHA-bound source; no silent fallback to Remotion story/text boards. `visual_opening.mjs` participates in compiler hash; prompt and production contract remain source-derived.

## Technical proof
- Build rev6: `7e90025c5d1b4dada13e5e9809f8bfc8`, **8/8 scenes** `TECHNICAL_VALID`; zero QA issues, zero `ACTING_BEATS_SPARSE` warnings in S03/S04/S06 and all other scenes. `renderer_parity=NOT_ASSERTED`, `human_review=PENDING`.
- Node preview/export/caption/migration tests: **19/19 PASS** (including 12 glyphs, no text fallback); canonical Phase2 story-visual presence/lettering tests: **21/21 PASS**.
- Real-world visual outcome still requires decoded frame comparison and human artistic review; disappearance of QA warnings is not equivalent to cinematic success.
- Latest separate immutable media output should be recorded here only after successful r6 export and independent MP4 QA.

## Known limitations
- Generic legacy Remotion designed-cover payload is intentionally still rejected; `series-topic-opening@1` is a self-contained, narrower HyperFrames design contract.
- Soundtrack and SFX creative mixing remain explicit unsupported media tracks, not invisible voice-only success.
- S03/S04/S06 state changes are modest performance improvements using existing V4 poses. More sophisticated scene directing (prop handling, camera, gestures) requires an approved visual review of decoded frames.
- Native Tauri E2E not inferred from Vite/browser tests; no automatic approval or social publishing.

## Final re-render + review bundle: verified
- Cover screenshot review on initial revision-6 export found a real ghosting defect: actor feet visible behind low-gradient paper cover near y=1100–1250 (independent RGB check **737 non-background pixels**). Corrected `visual_opening.mjs` to opaque paper until close to y=1470, preserving untouched caption lane, with regression assertions. Presentation contract upgraded to `zodiac-visual-presentation@4` to invalidate old visual builds.
- New build `d4ff22bc4b1a4966959fff958502f3f0`, revision 6, **8/8 TECHNICAL_VALID**, zero scene QA errors/review warnings. Old revision-6 preview and export kept; no overwrite. Renderer creative approval remains PENDING.
- Full corrected HyperFrames MP4 export ID `6a2e2668454949b1863b0351f55e85a7`. Local review candidate:
  `.runtime/story-visual-cover-repair/r6-final/episode.mp4`
  H.264 1080×1920, AAC approved-voice-only, 74.4 seconds, 4,740,447 bytes, SHA-256 `658f33ec6791e9429b27cd70dc0b39d1dfe26345c0dc6a735e17546dbc67895e`.
- Independent `.runtime/story-visual-cover-repair/r6-final/qa-final.json` confirms **full video decode PASS, cover pixel-identical to frame zero, 38 caption cues, same source voice hash `e5f35bb23d0897bdf8a23fce95d03a7fdb203772eed82cbe2740f03806689394` and cover actor ghosting **0 pixels**. Directly inspected PNG `intro.png` confirms background clear of actor feet and distinct Sagittarius glyph. The voice/caption still starts at frame zero.
- Immutable review ZIP `.runtime/story-visual-cover-repair/r6-final/zodiac-nhan-ma-review-r6.zip` (4,967,465 bytes): `episode.mp4`, `cover.png`, `captions.srt`, `receipt.json`, `qa-final.json`, plus `SHA256SUMS.txt` and `README.txt`.
- Regression summary: 19/19 Node renderer/cover/caption tests, 21/21 canonical Phase2 story visual presence/lettering tests, 10/10 Studio initial authoring tests, 2/2 Tauri host tests; GUI Vite build PASS, Git diff whitespace check PASS. Real phase2 presence validator on source revision 6 PASS with 0 issues.
- Visual quality: S02 split-chat and S03 Story Text fit the semantic contract. S03/S04/S06 now change actor states on relevant narration phrases. Still a *review candidate*: actor staging remains simple and some scenes have substantial negative space. No claim of artistic approval, no music/SFX creative mix, no native full Tauri GUI E2E or upload/publish.
- Git branch `experiment/main-2` remains dirty and **uncommitted**. No merge/push; unrelated edits preserved.
