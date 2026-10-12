# Zodiac Maintainability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Zodiac plugin, asset framework and local runner into maintainable current-path modules while preserving Job@5 and legacy compatibility boundaries.

**Architecture:** Keep the repository's top-level layout and migrate internals behind stable registries/services. Fresh production uses current policy/capability metadata; compatibility is explicit and late-bound. Runner and runtime are consolidated only after plugin/asset boundaries are stable.

**Tech Stack:** Node.js ESM, JSON registries/schemas, Python 3.11, PySide6, Remotion/TypeScript, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-12-zodiac-maintainability-refactor-design.md`

**Status:** IMPLEMENTED on `codex/zodiac-maintainability-refactor`; pending integration/release.

## Global Constraints

- `zodiac-job@5` remains the Phase 3 producer/runner handoff.
- Plugin owns content/visual authoring and structural validation.
- Local runner owns measured TTS, timing, audio, Remotion, MP4 and media QA.
- Structural PASS never implies creative/visual/audio PASS.
- Existing approved episode bytes and approvals are not silently rewritten.
- Fresh paths must not auto-load compatibility-only room/environment cues.
- No Job@5 or renderer schema migration is required.
- Compatibility/runtime bytes are deleted only after reverse-dependency and compatibility gates prove deletion safe.
- No generate-many-then-dedupe asset workflow.

## Review Focus

1. Fresh Phase 2 with `scene_set` and no legacy cues must not load compatibility environment references.
2. A retained legacy workspace must resolve old entrypoints through wrappers/adapters without becoming a second implementation.
3. Unknown capability/runtime IDs must fail closed with structured errors rather than silently falling back.
4. Generated contract bundles must fail release validation when canonical root schema hashes drift.
5. GUI current-path behavior must remain usable when no legacy job exists and must not require importing legacy controllers for Job@5 execution.

---

### Task 1: Phase A — Plugin/control-plane consolidation

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/bootstrap/current-policy.json`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/bootstrap/capabilities.json`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/current-policy.mjs`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/capability-registry.mjs`
- Modify: `plugins/zodiac-video-pipeline/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/SKILL.md`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/plan-step-context.mjs`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/select-asset-guidance.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/current-policy.test.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/capability-registry.test.mjs`
- Test: existing context/release suites under `orchestration/tests/`

**Interfaces:**
- Consumes: existing phase manifests and `selection-policy.json`.
- Produces: `loadCurrentPolicy() -> object`, `resolveCapability(id, {run_mode, flags}) -> capability`, and `loadStepContext(...).effective_policy`.
- Later tasks consume capability IDs and policy values only; they do not depend on release-history prompt text.

- [ ] **Step 1: Write failing policy/registry tests**
  - `loadCurrentPolicy()` returns exact current values: narrative `2.1`, story_object `v2`, visual_grammar `v4`, scene_system `scene-set@1`, character_assembly `v2`, handoff `zodiac-job@5`, renderer `zodiac-renderer@2.0.1`.
  - unknown capability throws `CAPABILITY_UNKNOWN <id>`.
  - fresh scene-set context contains current policy and does not include compatibility environment guidance when no compatibility cue is selected.
  - active plugin prompt contains no `RELEASE 2.4.` history clauses.

- [ ] **Step 2: Run RED tests**
  Run: `node --test plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/current-policy.test.mjs plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/capability-registry.test.mjs`
  Expected: FAIL because policy/registry modules do not exist.

- [ ] **Step 3: Implement current policy and capability registry**
  - `loadCurrentPolicy(root?)` loads and validates the bootstrap policy.
  - `resolveCapability(id, context={})` resolves one registry item and fails closed for unknown IDs.
  - `plan-step-context.mjs` adds `effective_policy` and uses selected capability metadata without waiving existing validators/receipts.
  - Slim active prompt to stable invariants + `SKILL.md`/current-policy routing; preserve all current safety/approval/runtime boundaries in canonical docs/modules rather than release-history prose.

- [ ] **Step 4: Run GREEN and regression suites**
  Run targeted RED tests, then:
  `node --test plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/*.test.mjs`
  Expected: all orchestration tests PASS.

- [ ] **Step 5: Commit**
  Commit message: `refactor(plugin): consolidate current policy and capabilities`.

### Task 2: Phase B — Asset registry and coverage expansion

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/capability-index.json`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/coverage-matrix.json`
- Create/modify: scene-set registry/assets for `classroom`, `study`, `street`, `neutral`
- Modify: effect catalog/lifecycle metadata
- Modify: action/mechanic/contact registries
- Modify: `selection-policy.json`
- Modify: `select-asset-guidance.mjs`
- Test: asset library and orchestration asset-selection tests

**Interfaces:**
- Consumes: Task 1 capability registry and current policy.
- Produces: `resolveAssetCapability(need) -> registered capability IDs`; new assets remain compile-on-use and selected-dependency scoped.
- Runner contract remains unchanged.

- [ ] **Step 1: Write failing asset coverage tests**
  Assert four new fresh scene-set families resolve without legacy room refs; 1/2/3 actor layout/contact capabilities resolve; selected effects carry lifecycle metadata; unknown need reports structured missing capability.

- [ ] **Step 2: Run RED tests**
  Run asset-selection/framework tests.
  Expected: FAIL on missing scene/effect/contact capabilities.

- [ ] **Step 3: Implement metadata-driven registry and Wave 1 assets**
  Add only the required scene/effect/contact capabilities, preserving V4 style tokens, wall-region accent rules, Character Assembly, Story Object separation and selected dependency materialization.

- [ ] **Step 4: Run GREEN + clean fresh fixture**
  Run nested asset tests plus Phase 2 clean reproduction/selection tests.
  Expected: PASS with no compatibility refs in fresh scene-set fixture.

- [ ] **Step 5: Commit**
  Commit message: `feat(assets): add capability-driven visual coverage`.

### Task 3: Phase C — Runner unification

**Files:**
- Create: `tools/application/service.py`
- Create: `tools/application/compat.py`
- Create: focused `tools/runner/` modules for package, voice, timing, plan, render, audio, output ownership
- Modify: `tools/studio_qt/app.py`
- Modify: `tools/studio_v2/session.py`, `controller.py`, `executor.py`
- Modify: `tools/studio/controller.py` and `tools/zodiac_local.py` into compatibility/public wrappers where migrated
- Test: new `tests/application/` plus existing studio/studio_v2/zodiac_local suites

**Interfaces:**
- Consumes: unchanged Job@5 and current runner contracts.
- Produces: `ApplicationService.open_package(path)`, `run(stage|all, resume=True)`, `rerun(stage)`, `status()`; `CompatibilityAdapter` owns legacy routing.
- Qt depends on ApplicationService, not both controller families.

- [ ] **Step 1: Write failing application-service parity tests**
  Current Job@5 package selects current runner without importing legacy pipeline behavior; legacy fixture selects CompatibilityAdapter; invalidation/cache semantics match existing v2 state.

- [ ] **Step 2: Run RED tests**
  Run new application tests.
  Expected: FAIL because service/adapter do not exist.

- [ ] **Step 3: Implement service and extract responsibilities**
  Move behavior without changing external semantics; keep old entrypoints as thin wrappers until tests/callers migrate.

- [ ] **Step 4: Run GREEN + GUI/import regression**
  Run application, studio_v2, studio_qt, zodiac_local/package tests and Python compile.
  Expected: PASS; GUI current path no longer directly coordinates two controller families.

- [ ] **Step 5: Commit**
  Commit message: `refactor(runner): unify application service and legacy adapter`.

### Task 4: Phase D — Runtime and contract consolidation

**Files:**
- Create: `runtime/releases/zodiac-renderer.json`
- Create: `runtime/releases/zodiac-remotion.json`
- Create: `tools/runtime/registry.py`
- Create: `tools/runtime/resolver.py`
- Reorganize canonical contracts under `contracts/public`, `contracts/plugin`, `contracts/assets` with compatibility lookup
- Create: contract bundle generator and manifest
- Modify: `tools/control_plane/contracts.py`
- Modify: runtime selection in current runner
- Test: runtime registry, contract parity, supported-version and reverse-dependency tests

**Interfaces:**
- Consumes: Task 3 ApplicationService/runtime requests and package renderer pins.
- Produces: `resolve_runtime(runtime_id, version) -> RuntimeSpec`, `contract_path(name)` compatibility behavior, generated plugin contract manifest with canonical hashes.
- Historical runtime source deletion is allowed only for entries proven unreferenced.

- [ ] **Step 1: Write failing registry/contract tests**
  Assert supported versions resolve from registry; unknown version fails closed; no current-path hard-coded runtime default bypasses registry; generated plugin bundle hashes equal canonical root contracts.

- [ ] **Step 2: Run RED tests**
  Run new runtime/contract tests.
  Expected: FAIL because registry/generated bundle do not exist.

- [ ] **Step 3: Implement registry, resolver and canonical contract ownership**
  Preserve old `contract_path()` callers through compatibility lookup; migrate current runtime consumers; generate plugin contract copies.

- [ ] **Step 4: Run GREEN + reverse-dependency audit**
  Run runtime/renderer/import/contract tests. Produce explicit list of runtime source versions safe/unsafe to archive.
  Expected: PASS; only unreferenced versions may be pruned.

- [ ] **Step 5: Commit**
  Commit message: `refactor(runtime): centralize versions and contract ownership`.

### Task 5: Phase E — Test/CI consolidation and cleanup

**Files:**
- Split `tests/test_zodiac_local.py` by package/voice/timing/render/audio/compatibility ownership while preserving test behavior.
- Split/organize plugin test invocation by core/phases/assets/compatibility/release.
- Modify: `.github/workflows/tests.yml`
- Update current architecture docs and historical indexes.
- Remove only wrappers/runtime/history proven unused by Task 4 audit.

**Interfaces:**
- Consumes: all current-path modules and compatibility adapters from Tasks 1–4.
- Produces: CI tiers `smoke`, `unit`, `contract`, `integration`, `compatibility`, `release`; no production interface changes.

- [ ] **Step 1: Write/adjust CI structure tests and test-discovery parity checks**
  Assert current fast suites do not require every historical runtime; compatibility suite remains separately runnable; test discovery count/critical fixtures are preserved during splits.

- [ ] **Step 2: Run RED checks**
  Expected: current workflow lacks the target tier structure and monolithic ownership checks fail.

- [ ] **Step 3: Split tests, tier CI, remove proven-dead compatibility material**
  Do not delete anything not proven safe by Task 4 dependency evidence.

- [ ] **Step 4: Run full verification**
  Run Python compile/tests, plugin orchestration/library suites, renderer supported-version suites, contract/integration/compatibility/release checks.
  Expected: 0 failures; actual media/creative QA remains explicitly outside structural completion.

- [ ] **Step 5: Commit**
  Commit message: `test: tier zodiac validation and retire dead compatibility paths`.

## Final branch verification

- Re-run all task-level suites from a clean branch state.
- Compare final dependency audit against baseline.
- Verify plugin release metadata and source hashes are coherent if a release is prepared.
- Do not publish/merge without explicit user action.

## Completion record

All five implementation phases have been executed on the feature branch.

- **Phase A — Plugin/control plane:** current-policy routing, fail-closed capability registry, bounded step capability selection and compatibility-free fresh defaults.
- **Phase B — Asset system/coverage:** metadata-driven narrative need resolution, six fresh scene-set families, bounded accents, three-person comparison and semantic capability coverage.
- **Phase C — Runner unification:** ApplicationService current path, lazy legacy adapter, focused runner process/package/audio ownership, Qt shell decoupled from dual controllers.
- **Phase D — Runtime/contracts:** runtime registry, Job@5 renderer pin preservation, root canonical contract manifest and generated plugin contract bundle. Reverse audit blocks physical runtime pruning because all registered versions still have consumers.
- **Phase E — Tests/CI/cleanup:** domain-split runner regressions, compatibility matrix, tiered job display names with stable job IDs, current architecture document and historical-guidance boundary.

Final local verification:

- `node --test ...orchestration/tests/*.test.mjs ...references/*.test.mjs` → **608 PASS**.
- V4 `validation/validate-library.mjs` → **PASS**.
- broad Python non-Qt suite → **599 PASS, 11 skipped, 23 subtests PASS**.
- architecture/runtime/contract subset → **25 PASS**.
- `python -m compileall -q tools tests` → **PASS**.
- Qt runtime tests remain CI-gated because PySide6 is unavailable in the local verification environment.

Historical runtime source was deliberately retained; no source tree passed the reverse-dependency deletion gate.
