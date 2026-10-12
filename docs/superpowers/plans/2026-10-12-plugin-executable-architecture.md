# Plugin Executable Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move executable plugin implementation out of the flat `orchestration/` directory into explicit `core/`, `features/`, `phases/`, and `compat/` owners while preserving current CLI/public paths and Job@5 behavior.

**Architecture:** `orchestration/` becomes the routing and public-entry layer only. Internal imports point directly to owner modules. Old public CLI paths remain thin forwarding wrappers only where current manifests, docs, or external tools still reference them. Compatibility implementation cannot be imported by fresh Phase 1→2→3 paths.

**Tech Stack:** Node.js 22 ESM, JSON phase/capability manifests, node:test.

**Spec:** `docs/superpowers/specs/2026-10-12-zodiac-maintainability-refactor-design.md`

## Global Constraints

- Preserve exactly three phases and the `zodiac-job@5` producer/runner boundary.
- Preserve approved content/evidence/receipt semantics; structural PASS never implies creative/media PASS.
- Keep current Director v2 and Job@5 v2-named implementation on the current path; only truly pre-Job5 projection/export code belongs in `compat/`.
- Fresh code must never import `compat/`.
- Existing public/CLI orchestration paths used by active manifests/SKILL/reference contracts stay callable through thin forwarding wrappers until a later deprecation gate.
- No duplicate implementation: a wrapper may only re-export/forward to one owner module.
- Do not delete compatibility code until reverse-dependency tests prove no current consumer.

## Review Focus

1. A moved CLI validator invoked through the old orchestration path must preserve exit code/stdout/stderr.
2. A fresh Phase 2 import graph must contain no `compat/` module.
3. Job@5 modules with `v2` in their filename must remain current, not be misclassified as legacy.
4. Relative asset/schema/plugin paths must resolve from the new physical module location.
5. Current manifests and external reference modules must resolve either the owner path or an explicit public wrapper, never a missing old path.

---

### Task 1 — Core ownership and explicit compatibility boundary

**Files:**
- Create: `skills/zodiac-video-pipeline/core/{policy,state,evidence,schema,release,audit}/...`
- Create: `skills/zodiac-video-pipeline/compat/{production-v1,migrations}/...`
- Create: `orchestration/forward-cli.mjs`
- Modify: internal imports and affected tests.
- Test: `orchestration/tests/executable-architecture.test.mjs`

**Interfaces:**
- Produces owner modules under `core/` and `compat/`.
- Public wrappers use `forwardCliIfMain(import.meta.url, targetUrl)` and `export * from <owner>`.

- [ ] **Step 1: Write RED architecture tests**
  Assert owner directories exist; legacy projection/export modules live under `compat/`; current Job@5 modules are not in compat; wrappers contain no implementation beyond forwarding; fresh dependency graph cannot reach compat.

- [ ] **Step 2: Verify RED**
  Run targeted architecture test; expect failure because owner modules do not exist and implementation is still flat.

- [ ] **Step 3: Move core and true compatibility modules**
  Rewrite relative imports to their owner paths. Keep wrappers only for active public paths. Add one shared CLI forwarding helper.

- [ ] **Step 4: Verify GREEN + full plugin suite**
  Run targeted architecture tests and all orchestration/reference tests.

- [ ] **Step 5: Commit**
  `refactor(plugin): establish core and compatibility owners`

### Task 2 — Feature-owned compilers and validators

**Files:**
- Create: `features/episode/`
- Create: `features/narration-performance/`
- Create: `features/story-object/`
- Create: `features/scene-set/`
- Create: `features/visual-composition/`
- Create: `features/cover/`, `features/ending/`, `features/meme/`, `features/publish/`
- Modify: capability registry owner metadata and all internal imports/tests.

**Interfaces:**
- Capability entries expose `owner` paths.
- Current feature callers import owner modules directly.
- Public orchestration validator/compiler paths remain wrappers only when active references still require them.

- [ ] **Step 1: Write RED ownership tests**
  Assert Story Object, Scene Set, Cover, Narration Performance and Visual Composition compiler/validators resolve from feature owners; capability registry owner metadata points to real modules; no feature owner imports compat.

- [ ] **Step 2: Verify RED**
  Expected failure on missing feature owner files/owner metadata.

- [ ] **Step 3: Move feature implementation and rewrite imports**
  Preserve CLI behavior through wrappers for manifest/documented entrypoints.

- [ ] **Step 4: Verify GREEN + full plugin suite**
  Run feature architecture tests, V4 library validator and full plugin tests.

- [ ] **Step 5: Commit**
  `refactor(plugin): move compilers and validators to feature owners`

### Task 3 — Phase ownership and orchestration root cleanup

**Files:**
- Create: `phases/phase01/`, `phases/phase02/`, `phases/phase03/`
- Move current phase execution/commit/seal/handoff implementation to those owners.
- Modify active phase manifests/reference modules to owner paths where an old public wrapper is unnecessary.
- Keep only router/context/public CLI wrappers plus manifest/docs in `orchestration/`.
- Update architecture docs and provenance inventory.

**Interfaces:**
- Phase implementations may depend on `core/` and `features/`; current Phase 3 may depend on Job@5 handoff modules.
- Phase implementations may not depend on `compat/` in fresh mode.
- `orchestration/plan-step-context.mjs` remains a public routing entrypoint.

- [ ] **Step 1: Write RED root-cleanup tests**
  Assert orchestration top-level implementation count is below 40; remaining `.mjs` files are allowlisted public/router wrappers; wrappers forward to owner modules; fresh phase dependency graph is compat-free.

- [ ] **Step 2: Verify RED**
  Expected failure because orchestration currently contains more than 100 implementation modules.

- [ ] **Step 3: Move phase implementation, update active references, delete internal-only old paths**
  Retain wrappers only for active public/CLI contracts.

- [ ] **Step 4: Final verification**
  Run full plugin suite, V4 validation, current Phase 1→2→3 structural fixtures, CLI parity checks, and static dependency audit.

- [ ] **Step 5: Commit**
  `refactor(plugin): make orchestration a thin public routing layer`

## Completion Gate

Phase F is complete only when:

- full plugin suite is green;
- V4 asset validator is green;
- active Job@5 CLI paths preserve behavior;
- fresh dependency graph has zero `compat/` imports;
- `orchestration/` top-level implementation surface is below 40 `.mjs` files and remaining files are entry/router/wrappers;
- no moved module has a duplicate implementation at the old path.
