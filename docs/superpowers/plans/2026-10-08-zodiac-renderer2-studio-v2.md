# Zodiac Control Plane v2 — Renderer 2.0 + Studio v2 Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the verified Control Plane v2 headless compiler to an immutable dumb renderer and an additive Studio v2 state/cache layer without changing the legacy v1 production path.

**Architecture:** `zodiac-job@5` is imported into a v2 workspace. Voice/timing artifacts are keyed by dependency hashes. The existing headless compiler produces `render-plan.json`. Renderer 2.0 consumes only that plan plus assets and audio; it does not resolve semantic triggers or schedule events. Studio v2 owns PACKAGE → VOICE → TIMING → PLAN → RENDER → AUDIO → OUTPUT state and structured errors.

**Tech Stack:** Python 3.11, unittest, Node 22, Remotion, existing Textual Studio codebase.

**Spec:** `docs/superpowers/specs/2026-10-08-zodiac-control-plane-v2-design.md`

## Global Constraints

- Keep legacy Studio/runtime/plugin paths untouched except additive shared utilities that preserve current behavior.
- Released `zodiac-remotion@1.21.0` remains immutable.
- New renderer lives under `runtime/zodiac-renderer/2.0.0`.
- Renderer 2.0 never reads `production.ir.json`, narration, semantic triggers, scheduling policy, or design markdown.
- Renderer 2.0 only consumes `render-plan.json`, resolved design token data, assets, timing/caption data already embedded or referenced by the plan, and media files.
- Studio v2 cache keys are dependency-based; ZIP name/job folder are not dependencies.
- Structured errors flow through `ControlPlaneError`; no substring classification in new v2 code.
- The legacy TUI may display v2 later; this milestone first proves headless Studio v2 orchestration.

---

### Task 1: Define renderer 2.0 executable plan boundary

**Files:**
- Create: `runtime/zodiac-renderer/2.0.0/renderer/package.json`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/tsconfig.json`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/scripts/prepare.mjs`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/tests/prepare.test.mjs`
- Create: `runtime/zodiac-renderer/2.0.0/runtime-manifest.json`
- Test: `tests/test_renderer_v2_boundary.py`

**Interfaces:**
- CLI: `node scripts/prepare.mjs <package-root>`
- Reads: `.runtime/render-plan.json`
- Writes: `.runtime/renderer-v2-props.json`
- Must reject packages where semantic files are passed as renderer input.
- Must not import legacy runtime scheduling modules.

- [ ] Write failing tests asserting prepare requires render-plan, never reads `production.ir.json`, preserves scheduled frame ranges byte-for-byte, and emits structured `RENDER_PLAN_INVALID` JSON on invalid plan.
- [ ] Verify RED.
- [ ] Implement minimal prepare boundary and manifest.
- [ ] Run Node tests + Python boundary tests.
- [ ] Commit `feat: add dumb renderer 2 prepare boundary`.

### Task 2: Minimal Remotion renderer 2 composition

**Files:**
- Create: `runtime/zodiac-renderer/2.0.0/renderer/src/index.ts`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/src/Root.tsx`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/src/ZodiacRenderPlan.tsx`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/src/types.ts`
- Create: `runtime/zodiac-renderer/2.0.0/renderer/remotion.config.ts`
- Test: `runtime/zodiac-renderer/2.0.0/renderer/tests/renderer-boundary.test.mjs`

**Interfaces:**
- Composition id: `ZodiacRenderPlan`
- Input: `renderer-v2-props.json`
- Events are rendered strictly from `start_frame/end_frame`; no scheduling/defaulting.
- Same-target overlap is not repaired. If present, pre-render validator must already have failed.

- [ ] Write failing tests that source contains no imports/references to semantic scheduling/default materialization and uses resolved frame ranges directly.
- [ ] Verify RED.
- [ ] Implement minimal composition using existing SVG asset rendering primitives copied/adapted only for visual drawing.
- [ ] Run npm test + typecheck.
- [ ] Commit `feat: render executable plans without semantic scheduling`.

### Task 3: Renderer 2 smoke on Scorpio golden plan

**Files:**
- Modify: `.github/workflows/tests.yml`
- Test: `tests/test_renderer_v2_scorpio.py`

**Interfaces:**
- CI job `renderer-v2-smoke`
- Uses checked-in Scorpio expected `render-plan.json`.
- Runs prepare + Remotion frame smoke.
- Expected: no overlap/scheduling code path exists in renderer.

- [ ] Add failing workflow/test expectations.
- [ ] Verify RED.
- [ ] Add CI smoke job and fixture adapter.
- [ ] Verify renderer-v2 smoke GREEN.
- [ ] Commit `ci: smoke renderer 2 with Scorpio golden plan`.

### Task 4: Artifact dependency keys v2

**Files:**
- Create: `tools/control_plane/cache.py`
- Test: `tests/test_control_plane_cache.py`

**Interfaces:**
- `voice_key(narration, voice_profile, tts_settings, engine_version)`
- `timing_key(voice_hash, narration, aligner_settings, aligner_version)`
- `plan_key(ir_hash, timing_hash, design_hash, compiler_version)`
- `render_key(plan_hash, assets_hash, renderer_version, renderer_hash)`
- `audio_key(video_hash, music_hash, mix_settings)`
- Canonical hash normalization is stable across dict ordering/newlines.

- [ ] Write failing dependency-invalidation matrix tests.
- [ ] Verify RED.
- [ ] Implement canonical key functions.
- [ ] Run targeted + full Python suite.
- [ ] Commit `feat: add dependency-based artifact cache keys`.

### Task 5: Studio v2 state model

**Files:**
- Create: `tools/studio_v2/__init__.py`
- Create: `tools/studio_v2/pipeline.py`
- Create: `tools/studio_v2/state.py`
- Test: `tests/test_studio_v2_state.py`

**Interfaces:**
- Steps: `PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT`
- Each step stores `status, input_hash, output_hash, reuse, error`.
- Package revision metadata is independent of workspace directory name.
- No migration of legacy state yet.

- [ ] Write failing state-machine tests for clean build, visual-only invalidation, narration invalidation, renderer-only invalidation, music-only invalidation.
- [ ] Verify RED.
- [ ] Implement state model and dependency invalidation.
- [ ] Run targeted + full suite.
- [ ] Commit `feat: add Studio v2 pipeline state`.

### Task 6: Studio v2 headless orchestrator

**Files:**
- Create: `tools/studio_v2/controller.py`
- Create: `tools/studio_v2/runner.py`
- Test: `tests/test_studio_v2_controller.py`

**Interfaces:**
- `StudioV2Controller.import_package(path)`
- `StudioV2Controller.build_plan()`
- `StudioV2Controller.prepare_renderer()`
- Reuses supplied fixture voice/timing when dependency keys match.
- Writes structured step state and never invokes legacy string classifier.

- [ ] Write failing tests using minimal and Scorpio fixtures.
- [ ] Verify RED.
- [ ] Implement package handshake, plan compile/validate, renderer prepare orchestration.
- [ ] Run targeted + full suite.
- [ ] Commit `feat: orchestrate package-to-renderer v2 headlessly`.

### Task 7: Three-scenario cache regression

**Files:**
- Create: `tests/test_studio_v2_cache_scenarios.py`
- Extend: `tests/fixtures/scorpio-two-versions/`

**Interfaces:**
- Scenario A clean: PACKAGE→OUTPUT path eligible.
- Scenario B visual-only: VOICE/TIMING reused, PLAN/RENDER invalidated.
- Scenario C renderer-only: VOICE/TIMING/PLAN reused, RENDER invalidated.
- Scenario D music-only: through RENDER reused, AUDIO invalidated.

- [ ] Write scenario tests first.
- [ ] Verify RED.
- [ ] Implement only missing cache/controller behavior.
- [ ] Verify all scenarios GREEN.
- [ ] Commit `test: prove Studio v2 cache dependency scenarios`.

### Task 8: Whole-milestone verification

**Required proof:**
- legacy Python suite green;
- legacy runtime 1.21 green;
- control-plane-v2-core green;
- renderer-v2-smoke green;
- Scorpio E22 arrives at renderer with zero overlap;
- renderer source contains no semantic scheduler/default materializer;
- Studio v2 uses structured errors only.

- [ ] Run full GitHub Actions.
- [ ] Review branch diff against spec.
- [ ] Fix at most one Critical/Important review pass with RED→GREEN tests.
- [ ] Leave PR #59 unmerged.
- [ ] Write next plan: Plugin 2.0 job@5 export + TUI v2 presentation + legacy adapter.
