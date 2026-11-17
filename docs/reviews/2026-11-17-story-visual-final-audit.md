# Story Visual integration and cleanup audit — 2026-11-17

## Result

Remote main through `6a065c6e` was already present locally. The remaining local changes complete the unified `story_visual` contract, current creative-host tests, guidance cleanup and release 2.12.10. Authored drawing and optional lettering share one entity, asset and state. Fresh authoring requires an explicit visual decision; missing coverage still blocks progression. Internal Job@5 `story_object` transport remains in use.

## Review and fixes

- A fresh read-only review found that newly created lettering SVGs lacked replacement markers, causing a second bake to duplicate glyphs. New and existing SVGs now use the same replaceable group; regression checks bake all eight standalone treatments twice and preserve existing illustration bytes.
- Two shared state-validator negative tests were retained when removing the obsolete native Phase-1 audit fixture: absent executed-validator receipt and declared output without a matching material operation. They now use the current Phase-2 fixture in `validator-receipt-integrity-v156.test.mjs`.
- Four retired native Phase-1 suites targeted the replaced three-step native manifest. Current creative-host, approved-handoff import, receipt integrity and phase ownership tests cover the supported workflow. This removal does not waive Local validation or review.
- Coordinator fixture import closure includes the actual approval-source hash helper. Distinct executed preflight and asset validation receipts replace an obsolete sentinel assertion.
- The coordinator test subprocess limit increased from 12 to 30 seconds after a broad run timed out before reaching its cache assertions. Subprocess errors are now reported explicitly. No runtime cache bypass was introduced.
- Removed the unused split-builder import and duplicate lettering guide. Updated active guidance, schemas and fixtures to the unified concept. Retained the monolithic builder, shared Phase-1 helpers, commerce validation, humanizer and legacy transport because live callers remain documented in the cleanup design.

## Verification

- Final broad orchestration run: **813/813 pass**, zero skipped, 96.97 seconds. Log: `.runtime/reviews/story-visual-resume/final-verified.log`.
- Core visual/execute/entrypoint batch: **54/54 pass** before the two additional receipt regressions.
- Python baker and both distribution-builder suites: **13/13 pass**.
- Actual visual-compile guidance bytes using work-unit-context test options: full **69,843**, design **33,148**, scene **33,954**, validate **26,957**. Full guidance decreased from 72,639 by 2,796 bytes; original budgets and entry capability equivalence checks remain enforced. These are file-byte measurements, not latency or total prompt-token claims.
- Split archives: Web **23 files**, Local **504 files**, deterministic package/import checks pass.

## Plugin distribution

Both existing private account plugin identities were updated to **2.12.10** without changing default prompts, permissions, audience or scope. Full paginated read-back confirms current inventories and removal of obsolete paths: one Web path and twelve Local paths, including formerly packaged props absent from current source and without current source callers.

- Web: `plugins_6aef6b394f608191bde8fe8f65644939`, release `pluginrel_6afbffc7c1f48191b90f53b2bfbf43de`.
- Local: `plugins_6aef6b4911108191b8c00509bf0d0a58`, release `pluginrel_6afbfff447cc8191aaffd9b992ebfea1`.
- Account archives, inventory snapshots and per-file installation backups are in `.runtime/reviews/story-visual-resume/`. Current-session cache directories are compatibility snapshots; their patch receipts record actual version and source/archive provenance. Host refresh is distinct from source-byte verification.

## Capricorn package and remaining boundary

The source workspace `processing/zodiac-capricorn-nguoi-thua-20261116/workspace` contains the implemented A/B/C direction: work transferred to Ma Ket, repeated declined assistance followed by withdrawal, and lettering integrated into the bag handoff. S04 uses hands and task sheets rather than duplicate miniature actors. Approved narration bytes remain SHA-256 `64d23d5df1f647e7a94869cbcfcaaa8b4d9a15f7b6112e8d5b44445c741692ff`.

Three canonical manifest steps pass and the state remains **IN_REVIEW**. Native/director finalization and preview validation pass for six scenes and 25 event pairs. The final six-scene phone contact sheet was inspected. Review-only ZIP `.runtime/reviews/story-visual-production/ma-ket-story-visual-REVIEW_REQUIRED.zip` has SHA-256 `b5c207889eb54990207eb003368c9e5c81546487765fefe21f35339e3db129be`; its CRC and 142-file manifest were verified.

No exact-source human Visual Review was manufactured. Job@5 publication to `ready/`, TTS and MP4 rendering remain pending that review and subsequent execution; technical PASS is not visual approval or rendered-media acceptance.
