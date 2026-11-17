# Story Visual clarity follow-up — 2026-11-17

The user's follow-up prioritizes removing obsolete authoring concepts, explaining Story Visual with enough episode context, reviewing actual Capricorn imagery, improving it and packaging the result. The approved A/B/C story meaning and narration remain unchanged.

## Findings and implementation

- `references/visual-direction.md` still instructed independent lettering planning and authored overlays. The preceding guidance test omitted this file. Replaced those instructions with the single Story Visual entity/state/asset contract and extended the test; the regression was reproduced before repair.
- Web/Local entrypoints and both owning references now explain the purpose first: who does what, what changes and its consequence. Worked before/change/consequence examples distinguish story information from acting, environmental cues and subtitles. Required handoff context includes ownership, narrative anchor and contribution, rather than merely field names or a symbolic catalog.
- S02 lacked explicit owner labels and its zero was too small. Its revised drawing labels both sides and makes the empty partner workload readable at phone size.
- S04 exposed the repetition count too early. First refusal, repeated refusal and withdrawal now have distinct exact narration anchors; the count of three is reserved for the third occurrence. The canonical writer projects the new state/event into director and coverage plans.
- S06 bag lettering is split across two lines inside the same visual asset for readability, without adding a text role or altering its wording.
- The S06 physical action also lacked the second narrated bag, and the shared-prop profile placed its handle away from the hand. Added the retained bag and corrected native contact through opening, slip and acceptance states: two bags initially, one per person after the transfer. Actual endpoint handle-to-hand gaps are 3.92–4.50 px; lettering sits on the bag body below faces. Phone-size opening/slip/final images were inspected. Removed the sole unreferenced standalone permission overlay after backup; final workspace assets have no unreferenced files.
- Six corrupted explanatory strings in source Visual Intent were restored from unchanged approved contribution fields. Narration and the approved narrative plan retain their prior hashes.
- A browser inspection caught XML-prefixed SVG panels disappearing in inline HTML while structural checks passed. Fixed serialization and added `STORY_VISUAL_SVG_NAMESPACE_PREFIX` rejection to the shared kit validator. The mixed plain/prefixed regression failed first, then passed. This is a rendering compatibility guard, not a claim of automated creative judgment.

## Verification and distribution

- Broad orchestration: **814/814 pass**, no skipped tests, 80.78 seconds; log `.runtime/reviews/story-visual-production/clarity-tests.log`.
- Focused kit/presence/wiring/context checks: **36/36 pass**. Python baker/distribution checks: **8/8 pass**. Release/entrypoint checks after version preparation: **10/10 pass**.
- Actual draft guidance bytes: full **69,697**, design **33,002**, scene **33,808**. The fuller explanation remains under the original budgets without dropping required entry capabilities.
- Private Web and Local releases are **2.12.11**. Read-back confirms the new definition and removal of independent-overlay guidance; Local also contains the namespace fix. Split archives still contain 23 Web / 504 Local files. Installed development/cache bytes are checked against those archives; existing dependencies are preserved.
- A read-only independent review inspected actual phone-size imagery and the code/guidance delta, finding no material defect in those changes. Static inspection does not establish audio timing, animation contact or human approval.

The revised package includes `START-HERE.html`: actual scene images, exact narration, contributions and state anchors, plus the approved narrative plan. It is a review package until a genuine source-bound human Visual Review permits Job@5 publication; no approval is inferred from technical PASS.

Final episode evidence: all three manifest steps and 17 native/director steps pass; state remains IN_REVIEW. Preview validation covers six scenes and 29 event pairs (58 event endpoint frames plus 12 scene frames). Narration and approved Narrative Plan hashes are unchanged. The four-stage S04 and three-stage S06 phone contact sheets were inspected. Archive CRC, every manifest file hash, current source hashes and all packaged production asset bytes are verified. The current artifact is `.runtime/reviews/story-visual-production/ma-ket-story-visual-2.12.11-REVIEW.zip`; its sibling `.sha256` file binds the exact archive.
