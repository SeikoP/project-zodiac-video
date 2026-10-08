# Zodiac Control Plane v2 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prove the headless contract/compiler core for Zodiac Control Plane v2 before changing Studio, renderer, or plugin production paths.

**Architecture:** New `zodiac-job@5` authoring data is validated against one canonical contract family. Measured `timing.json` and semantic `production.ir.json` feed one deterministic Timeline Compiler, which produces executable `render-plan.json`. A Plan Validator guarantees zero same-target overlap and complete runtime references before any renderer is allowed to run.

**Tech Stack:** Python 3.11 stdlib, JSON Schema-compatible canonical documents, unittest, existing GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-zodiac-control-plane-v2-design.md`

## Global Constraints

- Do not modify released runtime `zodiac-remotion@1.21.0`.
- Do not change the current v1 Studio/plugin production path in this plan.
- New production format is `zodiac-job@5`; legacy `zodiac-job@4` remains untouched until the migration plan.
- Semantic IR must not contain resolved frame ranges.
- Timeline Compiler is the only owner of semantic-event frame scheduling.
- Same-target overlap may be shifted or explicitly merged only under author policy; unresolved conflict fails in PLAN, never RENDER.
- Identical normalized inputs must produce byte-identical normalized `render-plan.json`.
- New executable failures use canonical structured error objects, not message substring classification.
- No new third-party Python dependency is added in this milestone.

## Review Focus

- Duplicate voice anchors: deterministic resolution or structured failure, never non-deterministic first-match behavior.
- Same-target events with insufficient drift allowance: emit `TIMELINE_TARGET_CONFLICT` with exact event/scene/target details.
- Cross-target simultaneous events: remain legal and must not be serialized unnecessarily.
- Scene-boundary overflow after conflict shifting: fail PLAN with a structured bound error.
- Stable hashing/normalization across Windows/Linux newline and dictionary insertion order.

---

### Task 1: Canonical contract package

**Files:**
- Create: `contracts/zodiac-job-v5.schema.json`
- Create: `contracts/authoring-ir-v1.schema.json`
- Create: `contracts/timing-v1.schema.json`
- Create: `contracts/render-plan-v1.schema.json`
- Create: `contracts/design-token-v4.schema.json`
- Create: `contracts/publish-v1.schema.json`
- Create: `contracts/error-v1.schema.json`
- Create: `tools/control_plane/__init__.py`
- Create: `tools/control_plane/contracts.py`
- Test: `tests/test_control_plane_contracts.py`

**Interfaces:**
- Produces: `contract_path(name: str) -> Path`
- Produces: `canonical_contract_hash(name: str) -> str`
- Produces: `validate_contract_shape(name: str, document: dict) -> list[ContractIssue]`
- Consumes later: all v2 compiler/validator modules.

- [ ] **Step 1: Write failing tests** for presence of all seven canonical schemas, deterministic hashes, minimal valid Job/IR/Timing/RenderPlan documents, and rejection of missing required fields.
- [ ] **Step 2: Run** `python -m unittest tests.test_control_plane_contracts -v` and verify failures are due to missing `tools.control_plane`/contracts.
- [ ] **Step 3: Implement minimal schemas and `contracts.py`**. The validator supports the schema subset used by these files: object/array/scalars, required, const/enum, properties, additionalProperties, minItems, minimum/maximum, pattern, and local `$ref`.
- [ ] **Step 4: Run targeted tests**, then `python -m unittest discover -s tests -v`.
- [ ] **Step 5: Commit** `feat: add canonical control-plane v2 contracts`.

### Task 2: Structured error contract

**Files:**
- Create: `tools/control_plane/errors.py`
- Modify: `contracts/error-v1.schema.json`
- Test: `tests/test_control_plane_errors.py`

**Interfaces:**
- Produces: `ControlPlaneError(code, stage, message, scene_id=None, event_id=None, target=None, detail=None)`
- Produces: `ControlPlaneError.to_dict() -> dict`
- Produces: `error_result(error: ControlPlaneError) -> dict`
- Consumed by Timeline Compiler and Plan Validator.

- [ ] **Step 1: Write failing tests** asserting exact JSON shape and stable error codes.
- [ ] **Step 2: Run tests and watch RED**.
- [ ] **Step 3: Implement the error object and schema-aligned serialization**.
- [ ] **Step 4: Run targeted + full Python suite**.
- [ ] **Step 5: Commit** `feat: add structured control-plane errors`.

### Task 3: Authoring IR loader and static validator

**Files:**
- Create: `tools/control_plane/authoring.py`
- Test: `tests/test_authoring_ir.py`
- Fixture: `tests/fixtures/control-plane-v2/minimal/production.ir.json`
- Fixture: `tests/fixtures/control-plane-v2/minimal/design-token.json`
- Fixture: `tests/fixtures/control-plane-v2/minimal/timing.json`

**Interfaces:**
- Produces: `load_authoring_ir(path: Path) -> dict`
- Produces: `validate_authoring_ir(document: dict) -> None`
- Guarantees: no resolved `start_frame`/`end_frame` fields; event IDs unique per job; trigger policy explicit.

- [ ] **Step 1: Write failing tests** for valid semantic events, duplicate IDs, forbidden resolved-frame fields, missing target/state references, and duplicate voice-anchor policy.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement loader/static validation using canonical contracts plus cross-reference checks**.
- [ ] **Step 4: Run targeted + full suite**.
- [ ] **Step 5: Commit** `feat: validate zodiac authoring ir`.

### Task 4: Deterministic voice-anchor resolver

**Files:**
- Create: `tools/control_plane/anchors.py`
- Test: `tests/test_timeline_anchors.py`

**Interfaces:**
- Produces: `resolve_voice_anchor(scene: dict, timing_scene: dict, trigger: dict) -> int`
- Raises: `ControlPlaneError(code="ANCHOR_NOT_FOUND", stage="PLAN", ...)`
- Raises: `ControlPlaneError(code="ANCHOR_AMBIGUOUS", stage="PLAN", ...)`

- [ ] **Step 1: Write failing tests** for unique phrase resolution, repeated phrase ambiguity, occurrence-index resolution, punctuation/case normalization, and missing anchors.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement deterministic normalized-token matching over measured timing captions**.
- [ ] **Step 4: Run targeted + full suite**.
- [ ] **Step 5: Commit** `feat: resolve measured voice anchors deterministically`.

### Task 5: Timeline Compiler lane scheduler

**Files:**
- Create: `tools/control_plane/timeline.py`
- Test: `tests/test_timeline_compiler.py`

**Interfaces:**
- Produces: `compile_render_plan(ir: dict, timing: dict, design_token: dict) -> dict`
- Internal: `schedule_target_lane(events: list[ResolvedEvent], scene_end: int) -> list[ScheduledEvent]`
- Error codes: `TIMELINE_TARGET_CONFLICT`, `TIMELINE_SCENE_BOUNDS`.
- Produces normalized plan `format = "zodiac-render-plan@1"`.

- [ ] **Step 1: Write failing tests** for no-conflict scheduling, same-target shift, legal cross-target overlap, explicit merge, max-drift failure, scene-bound overflow, stable event order, and byte-stable normalized output.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement preferred-frame resolution and per-target lane scheduling with deterministic shift/merge policy**.
- [ ] **Step 4: Run targeted + full suite**.
- [ ] **Step 5: Commit** `feat: add deterministic timeline compiler`.

### Task 6: Render Plan Validator

**Files:**
- Create: `tools/control_plane/render_plan.py`
- Test: `tests/test_render_plan_validator.py`

**Interfaces:**
- Produces: `validate_render_plan(plan: dict, ir: dict | None = None) -> None`
- Produces: `target_overlap_count(plan: dict) -> int`
- Error codes include `PLAN_SCHEMA_INVALID`, `PLAN_TARGET_OVERLAP`, `PLAN_STATE_INVALID`, `PLAN_ASSET_MISSING`, `PLAN_SCENE_BOUNDS`.

- [ ] **Step 1: Write failing tests** that deliberately inject overlap, invalid state transitions, scene overflow, missing assets, duplicate event IDs, and unresolved semantic trigger fields.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement plan validation; do not repair data**.
- [ ] **Step 4: Run targeted + full suite**.
- [ ] **Step 5: Commit** `feat: validate executable render plans`.

### Task 7: Headless build command

**Files:**
- Create: `tools/control_plane/cli.py`
- Modify: `pyproject.toml`
- Test: `tests/test_control_plane_cli.py`

**Interfaces:**
- CLI: `zodiac-control build <package-root> [--output <path>]`
- Output artifact: `.runtime/render-plan.json`
- Success stdout contains: `PACKAGE_VALID`, `PLAN_COMPILED`, `PLAN_VALID`, `TARGET_OVERLAP_COUNT=0`.
- Failure stdout/stderr emits one canonical error JSON object and exits non-zero.

- [ ] **Step 1: Write failing CLI tests** for a valid fixture and a target-conflict fixture.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement CLI orchestration only; keep scheduling/validation inside earlier modules**.
- [ ] **Step 4: Run targeted + full suite**.
- [ ] **Step 5: Commit** `feat: add headless v2 plan compiler command`.

### Task 8: Scorpio overlap regression fixture

**Files:**
- Create: `tests/fixtures/scorpio-two-versions/package/package-manifest.json`
- Create: `tests/fixtures/scorpio-two-versions/package/production.ir.json`
- Create: `tests/fixtures/scorpio-two-versions/package/design-token.json`
- Create: `tests/fixtures/scorpio-two-versions/package/narration.txt`
- Create: `tests/fixtures/scorpio-two-versions/timing.json`
- Create: `tests/fixtures/scorpio-two-versions/expected/render-plan.json`
- Create: `tests/test_control_plane_scorpio_golden.py`

**Interfaces:**
- Golden event `E22` intentionally prefers a frame that overlaps a prior event on the same `scorpio` lane.
- Compiler must serialize E22 within its allowed drift and produce zero overlap.
- Fixture is headless: no TTS call and no real render yet.

- [ ] **Step 1: Write golden test first** with expected E22 preferred/resolved frames and `TARGET_OVERLAP_COUNT=0`.
- [ ] **Step 2: Verify RED** before fixture/compiler adjustments.
- [ ] **Step 3: Add the smallest representative Scorpio fixture preserving the overlap behavior**.
- [ ] **Step 4: Run golden + full suite and compare normalized output byte-for-byte with `expected/render-plan.json`**.
- [ ] **Step 5: Commit** `test: add Scorpio timeline golden fixture`.

### Task 9: CI gate for Control Plane v2 core

**Files:**
- Modify: `.github/workflows/tests.yml`
- Create: `docs/control-plane-v2-core.md`

**Interfaces:**
- New CI job: `control-plane-v2-core`
- Runs focused v2 tests and the Scorpio golden command.
- Legacy runtime jobs remain unchanged.

- [ ] **Step 1: Add a test that inspects the workflow and fails while the dedicated job is absent**.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Add the CI job and concise developer documentation**.
- [ ] **Step 4: Run full Python suite; open PR and require `python`, legacy runtime jobs, and `control-plane-v2-core` to pass**.
- [ ] **Step 5: Commit** `ci: gate control-plane v2 core`.

### Task 10: Whole-milestone verification and review

**Files:**
- No production files unless review finds a Critical/Important defect.
- Update: this plan only if a documented ruling is required.

**Interfaces:**
- Required proof:
  - all Python tests pass;
  - dedicated v2 CI job passes;
  - Scorpio golden output has `TARGET_OVERLAP_COUNT=0`;
  - existing runtime 1.21 CI remains green;
  - no v1 production path files changed except additive CLI entry point in `pyproject.toml`.

- [ ] **Step 1: Run the full GitHub Actions workflow on the branch**.
- [ ] **Step 2: Review diff against the design spec and verify every core milestone requirement**.
- [ ] **Step 3: Fix at most one Critical/Important review pass with RED→GREEN tests**.
- [ ] **Step 4: Record deferred minors; do not expand scope**.
- [ ] **Step 5: Leave the branch unmerged and proceed to the next implementation plan: Renderer 2.0 + Studio v2 integration.**
