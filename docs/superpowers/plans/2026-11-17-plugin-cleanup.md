# Plugin Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove proven redundant plugin surfaces, repair Web/Local contract drift and reduce per-task guidance without weakening approval or native validation.

**Architecture:** Keep the canonical source and existing split builders. The parent implementation first unifies visual storytelling as Hình kể chuyện (`story_visual`), replacing both former active concepts; this cleanup verifies that migration, repairs narrow fixtures and stale ownership assertions, then condenses guidance through existing reference selection. No new orchestration or inventory framework.

**Tech Stack:** Node ESM/node:test, Python unittest/pytest, JSON manifests, Markdown guidance, existing deterministic ZIP builders.

**Spec:** `docs/superpowers/specs/2026-11-17-plugin-cleanup-design.md`

## Global Constraints

- Node >=22.5.0; use installed dependencies only.
- Web stays guidance-only and exports `zodiac-phase1-handoff@2`; it does not acquire a native runtime.
- Local continues accepting handoff v1 and v2; fresh Story Visual authoring requires an explicit use/omit decision.
- Hình kể chuyện (`story_visual`) is the sole active visual storytelling concept; optional lettering belongs to the same entity/asset/state.
- Remove Narrative Visual and Story Text from active prompts, guidance and schemas; old names remain only in explicit internal compatibility readers where required.
- Preserve source hashes, trust-boundary validation, explicit user approval and cache invalidation.
- Keep full draft guidance below 70000 bytes and design/scene guidance below 45000 bytes without removing required entry capabilities.
- Do not delete episode data, marketplace caches, historical handoffs or compatibility files based only on a text-search miss.
- Packaging and installed-cache changes are separate from source changes; no public release or MP4 acceptance is implied.

## Review Focus

- Isolated fixture imports must resolve before cache assertions run; Task 1 preserves actual checkpoint and invalidation checks.
- Web exports require genuine approval and all approved source hashes; Task 2 checks the lightweight host contract and retains handoff/import integrity tests.
- Deferred references must remain fetchable before validation/review; Task 3 keeps capabilities and required-reference coverage.
- Legacy handoffs/release transport can still need apparently obsolete source; Task 4 retains those callers and verifies both split and source-bundle checks.
- Unified visual storytelling can alter guidance rules and byte counts; Task 3 measures current source and verifies `story_visual` is the only active concept, with optional lettering in its same entity/asset/state.

---

Paths below use `S = plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline`; expand it literally when executing commands. Tasks 1–2 are narrow audit fixes authorized in the parent session; Tasks 3–5 remain planned cleanup and review work after the parent's `story_visual` migration. The earlier two-concept baseline is evidence only.

### Task 1: Restore the isolated Phase-2 fixture dependency

**Files:**
- Modify/Test: `S/orchestration/tests/phase02-execute.test.mjs` (`makeSource`, approximately lines 22–60).
- Read only: `S/features/episode/episode-handoff.mjs`, `S/core/evidence/approval-source-hashes.mjs`.

**Interfaces:**
- Consumes: `episode-handoff.mjs` imports `assertContentApprovalSources(workspace, state)` from `core/evidence/approval-source-hashes.mjs`.
- Produces: unchanged `makeSource() -> Promise<string>` with the real directly imported helper present in its temporary skill root; no production API changes.

- [x] **Step 1:** Reproduce using `node --test S/orchestration/tests/phase02-execute.test.mjs`. Record failing names and confirm the temporary-source missing import in stdout/receipt; do not attribute this to production cache invalidation.
- [x] **Step 2:** Add one real-file copy of `core/evidence/approval-source-hashes.mjs` to `makeSource`. Remove exact duplicate fixture writes only. Preserve the fake binaries and checks for cache reuse, tamper repair, source invalidation, failures and lease release. Replace the newly exposed obsolete preflight sentinel assertion with executed PASS/exit-code/validator-path assertions for both distinct preflight and native-asset receipts.
- [x] **Step 3:** Run the same suite. Observed: combined coordinator/entrypoint batch **18 PASS / 0 FAIL**, with previous cache/execution tests reaching their intended assertions. No approval checks were stubbed.
- [ ] **Step 4:** Review `git diff --check` and the single-file diff, then make a focused commit only when parent integration permits it.

### Task 2: Test creative Web ownership instead of native CLI instructions

**Files:**
- Modify/Test: `S/orchestration/tests/split-entrypoint-contract.test.mjs`.
- Read only: `plugins/zodiac-video-pipeline/skills/zodiac-video-web/SKILL.md`, `S/orchestration/phases/01-content.json`.
- Verify: `tests/test_split_plugin_bundle_builder.py`, `S/orchestration/tests/phase1-handoff-export.test.mjs`, `local-phase1-bootstrap.test.mjs`.

**Interfaces:**
- Consumes: Phase-1 manifest `execution_mode: "creative_host"`, steps evidence/voice/concept/narrative_design/narration; Web skill lightweight handoff contract.
- Produces: entrypoint test enforces host-only Web creation of `zodiac-phase1-handoff@2`, genuine Content Review, approved SHA-256 inventory, Local ownership of pipeline state/Phase 2 and no native bootstrap. Existing Local entrypoint assertions stay intact.

- [x] **Step 1:** Run `node --test S/orchestration/tests/split-entrypoint-contract.test.mjs`; expect the current native-export-script assertion to fail.
- [x] **Step 2:** Replace the four obsolete native script/manifest text assertions with explicit manifest and skill assertions for the interfaces above. Keep `must not activate Phase 2`, no Phase-3 CLI and distinct skill-name assertions. This is a test-contract correction; do not reintroduce Node requirements into Web guidance.
- [x] **Step 3:** Run the entrypoint test and `python -m pytest tests/test_split_plugin_bundle_builder.py -q`. Observed: entrypoint 2 PASS; bundle 6 PASS after mechanical concept rename.
- [x] **Step 4:** Run handoff export/bootstrap suites named above. Observed: 15 PASS including negative drift/missing-input checks. Review the diff; committing is left to parent integration.

### Task 3: Restore guidance budgets without waiving capability coverage

**Files:**
- Modify repeated prose and old active links as needed: `S/references/visual-direction.md`, `scene-direction.md`, `sticker-storytelling.md`, and the canonical Story Visual reference established by the parent migration.
- Test: `S/orchestration/tests/work-unit-context.test.mjs`, `context-fast-path.test.mjs`, `current-policy.test.mjs`.
- Read only: `S/orchestration/plan-step-context.mjs`, `S/orchestration/phases/02-visual-production.json`.

**Interfaces:**
- Consumes: `loadStepContext(phase, step, flags, options) -> Promise<context>` and `context_manifest[].bytes`, required/deferred references and entry capabilities.
- Produces: unchanged reference paths and task contracts; full draft <70000 bytes, design/scene <45000; validation/review still obtains owning references. No new API.

- [ ] **Step 1:** Run work-unit-context test; record current byte sums using the exact flags/options in the spec. The audit measured 72639/36126/36932/25928 bytes before concurrent visual integration.
- [ ] **Step 2:** Compare repeated direction/layering/approval explanations in the owning files. Remove the former two-concept instructions and broken links; keep Story Visual rules once in their owning guidance with concise references elsewhere. Save at least the current overage plus one byte; do not raise existing budget assertions, delete required catalogs, or hide entry capabilities.
- [ ] **Step 3:** Add/retain assertions that design/scene entry capability sets equal full context, the canonical Story Visual and visual-direction references remain available, and deferred validation/review references are supplied at their owning work unit. Assert that active prompts/guidance/schema contain one `story_visual` concept with optional lettering in the same entity/asset/state; no integration flag or two-layer workaround. Old strings may occur only in clearly isolated internal compatibility readers or historical records.
- [ ] **Step 4:** Run the three test files above and remeasure all four contexts. Expected: original budget tests pass and required capabilities remain identical; report byte savings separately from token/latency claims.
- [ ] **Step 5:** Review affected bundle references and commit guidance/test changes as one focused unit.

### Task 4: Remove only proven dead wiring

**Files:**
- Modify: `tools/release/build_split_plugin_bundle.py` (unused import only).
- Test: `tests/test_split_plugin_bundle_builder.py`.
- Read only: `tools/build_source_bundle.py`, `tools/release/build_plugin_bundle.py`, `.github/workflows/tests.yml`, `.github/workflows/zodiac-plugin-release.yml`.

**Interfaces:**
- Consumes/Produces: unchanged `build_profile(root: Path, profile: str, destination: Path) -> dict`; manifest identities, deterministic ZIP selection and import closure stay identical.

- [ ] **Step 1:** Confirm `select_phase_files` occurs only in the import within the split builder; remove that unused import. No new test is needed for this trivial deletion.
- [ ] **Step 2:** Run `python -m pytest tests/test_split_plugin_bundle_builder.py -q`; expected PASS, unchanged Web/Local selection and deterministic hashes within each run.
- [ ] **Step 3:** Keep humanizer, affiliate skill, monolithic release builder, shared Phase-1 artifacts and v1 reader. Record their exact live caller/selection paths from the spec; any new deletion candidate must have module imports, dynamic filenames, manifest selection, tests and workflow callers checked first.
- [ ] **Step 4:** Review and commit only the dead import and any evidence update. Do not migrate release workflows opportunistically.

### Task 5: Triage the remaining baseline failures and close the audit

**Files:**
- Modify evidence: `docs/superpowers/specs/2026-11-17-plugin-cleanup-design.md`.
- Input: `.runtime/reviews/capricorn-20261117/full-tests-final.log`, `docs/reviews/2026-11-17-capricorn-visual-validation.md`.
- No predetermined production-code changes in this task.

**Interfaces:**
- Consumes: current failing test names/results and the known 45-name baseline.
- Produces: evidence rows with exact test, actual failure, current contract, defect/stale-fixture/stale-policy classification and smallest owning fix. Unresolved causes remain explicitly unresolved.

- [ ] **Step 1:** Re-run focused tests from Tasks 1–4. Run the same broad orchestration command used by the parent baseline, at a stable HEAD, and record names/counts separately from prior logs.
- [ ] **Step 2:** Group remaining failures by shared cause. In particular inspect three-native-step assumptions against the five-step creative-host manifest, native Phase-1 receipt assertions against approved-handoff import, and release triggers against active workflows. Retain security/receipt/ownership negative coverage; do not delete entire suites because their setup is stale.
- [ ] **Step 3:** For each unresolved runtime or policy defect, write one bounded follow-up with its owning code and failing regression. Implement only when that scope is authorized; no broad architecture rebuild.
- [ ] **Step 4:** Run `git diff --check`, report proven removals, before/after guidance bytes, focused/broad outcomes and remaining failures. Source success does not claim cache installation, human visual approval, TTS timing or rendered MP4 acceptance.

## Self-review

## Execution closure — 2026-11-17

Tasks 1–5 were integrated and verified; see `docs/reviews/2026-11-17-story-visual-final-audit.md` for final evidence and retained callers. Full guidance is 69,843 bytes (2,796 below the measured starting snapshot) without increasing the existing budget. The final orchestration run passes 813/813; Python baker/distribution checks pass 13/13. The fresh review's two retained receipt negatives and missing-target baker regression are included. Retired native Phase-1 fixture suites were removed only after checking the current creative-host/import boundary and transplanting their unique shared-state security checks.

Web/Local private account releases and installed source bytes are synchronized to 2.12.10. Capricorn has a verified review package and remains IN_REVIEW; exact-source human Visual Review, Job@5 publication and rendered-media acceptance are separate pending work.

The spec's keep/remove/defer table maps to Tasks 1–4; unresolved baseline classification maps to Task 5. Public interfaces and canonical sources remain unchanged. Every review-focus condition has an owning verification step. No deletion is justified solely by archive absence, and no threshold increase substitutes for reducing context.
