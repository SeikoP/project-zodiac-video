# SDD ledger — plan: zodiac-phase2-asset-framework-cleanup-plan(1).md

Baseline: main d3c004d, plugin 2.4.59. Exact execution-source artifact verified against GitHub tree. Existing branch aa52117 contains tracked-file edits but none of its newly imported modules or registries. Recovered its tracked changes rather than redoing them.

Ruling: preserve physical assets and runtime versions until reverse-dependency and legacy/render gates pass — plan requires this — cost if wrong: delayed repository size reduction.
Ruling: complete the missing branch source and verify it before release — the existing branch is not executable — cost if wrong: additional review of recovered code.
Pre-flight: registry identity → environment compiler → staging/validators → Job@5 projection share the same scene-set IDs. Symbolic authoring kinds project only at the compile boundary; renderer schema remains unchanged.
Source retrieval: full GitHub Actions artifact resolves missing binary fixtures/fonts. Initial partial snapshot had three environment-caused failures; rerun exact baseline before counting product failures.

Task A/B/C: complete — taxonomy aliases, registry/compiler and symbolic projection. Six new contract regressions observed RED then GREEN; clean Gemini reproduction passes all staging and native character hash assertions.
Task D/E: complete — selected/per-step dependency graphs, preview intent/projection binding, finalizer, registry duration, role-specific identity locks and same-canvas identity preview. New preview/finalizer/identity/override regressions observed RED then GREEN.
Task F: dependency audit complete — 975 text files, 24 referenced compatibility assets; no physical deletion permitted.
Ruling: state_swap per-event overrides use existing state_swap_Nf Job5 IDs — Python timeline already proves interval-preserving lowering and renderer uses end_frame-start_frame — cost if wrong: compatibility with an outdated runner implementation; current renderer stays pinned to 2.0.1.
Validation limits: local full Python/renderer suites need unavailable pytest/tqdm/PySide6/Remotion dependencies; exact baseline source passes 531 native tests and targeted Python import/hash/timeline suite passes 14. Full remote CI is required before merge.

Final review: independent reviewer, no Critical issues; five Important findings.
Final: fixed accent transform loss — authored accent transform regression RED→GREEN.
Final: fixed deselected visible accent/unused registration — deselection regression RED→GREEN.
Final: fixed omitted accent generated ownership — real transactional compiler ownership regression RED→GREEN.
Final: fixed omitted selected meme source — global/meme-step pants.svg lineage regression RED→GREEN.
Final: fixed declared/inferred canonical identity fail-open — missing materialization and bad master bytes regression RED→GREEN.
Final review limits: rendered appearance, voice, temporal media behavior and full Python/Remotion compatibility require separate evidence; structural tests do not approve these.

Final validation: orchestration 550/550, library 138/138, targeted Python 14/14. Remote tests run 38230644496 on code commit 91f0cb3: all 18 jobs PASS, including full Python and actual renderer smoke. No episode media/voice/creative approval claimed.
Task G: plugin 2.4.61 published as pluginrel_6acca9f0d5b88191b4509a7c5295502a from verified source commit 91f0cb3ee249ccda784c897c69652cd2b907137d. Readback confirms version/release and changed source. Release-record update enables source artifact cutover.
