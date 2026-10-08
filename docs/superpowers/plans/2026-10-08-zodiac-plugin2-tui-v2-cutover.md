# Zodiac Control Plane v2 — Plugin 2.0, TUI v2, and Cutover Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and TDD for every production change.

**Goal:** Finish the v2 production path from zodiac-job@5 ZIP import through local voice/timing, plan compilation, Renderer 2, audio/output, TUI presentation, Plugin 2.0 export, legacy import, and final Scorpio production gate.

**Architecture:** Studio v2 becomes the only orchestrator for new job@5 packages. Existing TTS/alignment/render/audio primitives may be reused through narrow adapters, but legacy state machines and string error classification are not reused. TUI detects job@5 and presents Studio v2 state. Plugin 2.0 emits authoring IR only. Legacy job@4 is isolated behind an adapter.

**Branch:** `refactor/zodiac-control-plane-v2`

## Task 1 — Secure job@5 ZIP import

**Files:**
- Create: `tools/control_plane/package_io.py`
- Modify: `tools/studio_v2/controller.py`
- Test: `tests/test_control_plane_package_io.py`
- Test: `tests/test_studio_v2_zip_import.py`

**Requirements:**
- Accept directory or ZIP input.
- ZIP must be root-flat or one unambiguous wrapper directory.
- Reject traversal, absolute paths, drive paths, duplicate normalized names, symlinks.
- Import identity comes from package content, never ZIP filename.
- Validate manifest handshake before copying into active workspace.
- Package revision display name may use ZIP name, but cache/state identity may not.

## Task 2 — Voice/TTS artifact service v2

**Files:**
- Create: `tools/studio_v2/voice.py`
- Test: `tests/test_studio_v2_voice.py`

**Requirements:**
- Wrap existing local TTS primitive behind one structured interface.
- Compute `voice_key` before generation.
- Reuse existing voice artifact only when dependency key matches.
- Per-scene artifacts and concatenated `voice.wav` have explicit hashes.
- TTS failures become canonical `ControlPlaneError(stage="VOICE")`.
- No legacy PipelinePlan or legacy string classifier.

## Task 3 — Alignment/timing artifact service v2

**Files:**
- Create: `tools/studio_v2/timing.py`
- Test: `tests/test_studio_v2_timing.py`

**Requirements:**
- Wrap measured alignment behind one interface.
- Compute `timing_key` from voice hash + narration + aligner config/version.
- Reuse timing iff key matches.
- Output must satisfy canonical `timing-v1`.
- No visual/progression scheduling validation in this stage.
- Alignment errors are structured `TIMING_*` errors only.

## Task 4 — Full Studio v2 runner

**Files:**
- Modify: `tools/studio_v2/controller.py`
- Create: `tools/studio_v2/executor.py`
- Test: `tests/test_studio_v2_executor.py`

**Pipeline:**
`PACKAGE → VOICE → TIMING → PLAN → RENDER → AUDIO → OUTPUT`

**Requirements:**
- Each stage computes input hash before work.
- Matching input/output artifact => `reused=true`.
- Visual-only patch reuses VOICE/TIMING.
- Renderer-only update reuses through PLAN when contract-compatible.
- Music-only update reuses through RENDER.
- PLAN uses the already-tested Timeline Compiler.
- RENDER invokes Renderer 2 only.
- State is persisted after every stage transition/failure.

## Task 5 — TUI v2 presentation and routing

**Files:**
- Create: `tools/tui/v2_adapter.py`
- Modify: `tools/tui/app.py`
- Modify: `tools/tui/model.py`
- Test: `tests/test_tui_v2_adapter.py`
- Test: `tests/test_tui_app.py`

**Requirements:**
- Detect `zodiac-job@5` at import.
- Route job@5 to Studio v2; job@4 remains legacy path.
- Display seven v2 stages with generated/reused distinction.
- Display package revision independently from workspace folder.
- Structured error fields are displayed directly; no reclassification.
- Existing GUI layout remains; do not redesign visuals in this task.

## Task 6 — Legacy job@4 adapter

**Files:**
- Create: `tools/control_plane/legacy_adapter.py`
- Test: `tests/test_control_plane_legacy_adapter.py`

**Requirements:**
- Conversion is explicit `job@4 → authoring-ir@1`.
- No legacy renderer/runtime fields survive into executable scheduling.
- Unsupported semantics fail with `LEGACY_ADAPTER_UNSUPPORTED`.
- Adapter is import-only and never used by Plugin 2.0.

## Task 7 — Plugin 2.0 job@5 producer

**System:** private ChatGPT plugin `zodiac-video-pipeline`.

**Target version:** `2.0.0`.

**Requirements:**
- Keep exactly three phases: `01-content → 02-visual-production → 03-handoff`.
- Handoff exports:
  - `package-manifest.json` as `zodiac-job@5`;
  - `production.ir.json`;
  - `design-token.json`;
  - `narration.txt`;
  - `assets/**`;
  - `publish/**`.
- Do not export resolved frame scheduling.
- Do not export runtime motion/performance defaults.
- Manifest pins `zodiac-renderer@2.0.0` and canonical authoring contract hash.
- Existing naming rule remains: `zodiac-<cung>-<concept>[-v<patch>].zip`.
- Add plugin-side regression tests proving forbidden runtime fields are absent.

## Task 8 — Scorpio production E2E

**Fixture:** current “Bọ Cạp — Hai phiên bản”.

**Scenarios:**
1. Clean job@5 build.
2. Visual-only patch.
3. Renderer-only patch.
4. Music-only patch.

**Hard assertions:**
- clean pipeline reaches OUTPUT;
- same-target overlap count entering renderer = 0;
- visual-only patch: VOICE/TIMING reused;
- renderer-only patch: VOICE/TIMING/PLAN reused;
- music-only patch: PACKAGE/VOICE/TIMING/PLAN/RENDER reused;
- no semantic scheduler/default materializer in Renderer 2;
- no string-based error classifier in Studio v2.

## Task 9 — Cutover gate

**Requirements before merge:**
- full GitHub Actions green twice consecutively;
- Scorpio clean + three patch scenarios green;
- PR architectural review has no Critical/Important findings;
- Plugin 2.0 readback confirms job@5 contract;
- legacy v1 remains usable for rollback;
- main cutover is one explicit merge, not incremental cherry-picks.

**Final rollout:**
- Merge PR #59 only after all gates.
- Mark v2 Studio path default for job@5.
- Keep job@4 auto-routed to legacy/adapter path during migration window.
