# Phase 2 Progressive Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catch deterministic Phase-2 defects before native asset generation, block underdeveloped story scenes before Visual Review, and produce scene-level incremental revision guidance.

**Architecture:** Extend the existing precompile seam and Phase-2 coordinator rather than creating another pipeline. Add focused pure validators for progressive authoring and Scene Experience, wire them into the manifest/coordinator, then extend the existing semantic graph revision report.

**Tech Stack:** Node.js ESM, node:test, existing Zodiac Phase-2 manifests/cache/validators.

**Spec:** `docs/superpowers/specs/2026-11-05-phase2-progressive-experience-design.md`

## Global Constraints

- `.authoring/visual-intent.json` remains the only agent-authored visual source of truth.
- No new public phase or Job@5/renderer schema change.
- Fresh Phase 2 remains canvas-native; Scene Set is compatibility-only.
- Scene richness uses editorial REVIEW semantics, not fixed decorative quotas.
- Existing validators remain fail-closed.

## Review Focus

- Sparse but intentionally minimal scenes must not be falsely rejected.
- Behavior/relationship scenes with passive actor + passive accent must return REVIEW.
- Custom authored SVGs must fail before native compilation when style metadata, stroke or palette is invalid.
- Single-scene edits must not dirty unrelated scene previews/character assets.
- Existing legacy/compatibility runs must not be forced through fresh-only experience rules.

---

### Task 1: Progressive authoring preflight

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/validate-phase02-progressive-preflight.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase02-progressive-preflight.test.mjs`

**Interfaces:**
- Consumes: visual intent, production projection, motion registry, design token/style contract.
- Produces: `validateProgressivePreflight({intent,production,motionRegistry,designToken,readAsset}) -> {status,issues}`.

- [ ] Write failing tests for missing Director v2 fields, invalid state-swap duration, authored SVG metadata/stroke/palette violations, and a valid fixture.
- [ ] Run the targeted test and confirm RED for missing implementation.
- [ ] Implement the validator with fresh-only checks.
- [ ] Run targeted tests to GREEN.

### Task 2: Scene Experience Review

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/validate-scene-experience.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase02-scene-experience.test.mjs`

**Interfaces:**
- Consumes: canonical Visual Intent scenes and narration-derived scene voice.
- Produces: `reviewSceneExperience(intent) -> zodiac-scene-experience-review@1`.

- [ ] Write failing tests: behavior scene with passive actor+accent returns REVIEW; scene with meaningful physical action returns PASS; intentional sparse reflection scene may PASS with explicit omission rationale; narrative visual cannot substitute for explicitly narrated physical object.
- [ ] Verify RED.
- [ ] Implement criterion evaluation and aggregate decision.
- [ ] Verify GREEN.

### Task 3: Wire progressive gates into Phase 2

**Files:**
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/phase02/phase02-execute.mjs`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/phases/02-visual-production.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/phases/02-visual-production.md`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase02-execute.test.mjs`

**Interfaces:**
- Consumes: Task 1 and Task 2 validators.
- Produces: fail-closed pre-native checkpoint and a durable `.authoring/scene-experience-review.json` before semantic assets.

- [ ] Add a failing coordinator test proving native compilers are not called when progressive preflight blocks.
- [ ] Add a failing coordinator test proving unresolved Scene Experience REVIEW blocks final Visual Review path.
- [ ] Verify RED.
- [ ] Wire entry capabilities/gates and coordinator execution order.
- [ ] Verify targeted tests GREEN.

### Task 4: Fine-grained revision impact

**Files:**
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/cache/phase02-semantic-cache.mjs`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/audit/assess-revision-impact.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase02-revision-impact.test.mjs`

**Interfaces:**
- Consumes: semantic graph before/after.
- Produces: scene/asset rebuild and reuse lists in revision-impact report.

- [ ] Write failing test where only S03 prop changes.
- [ ] Assert S03 preview/review aggregate are dirty while unrelated scene previews and character assets are reusable.
- [ ] Verify RED.
- [ ] Add graph classification/report projection.
- [ ] Verify GREEN.

### Task 5: Full verification and release readiness

**Files:**
- Modify docs only if test output reveals contract wording drift.

- [ ] Run plugin-native Node test suite.
- [ ] Run repository Python/unit suite used by CI.
- [ ] Run candidate plugin integrity workflow locally where available.
- [ ] Run syntax checks for new modules.
- [ ] Review manifest/output-surface/release tests.
- [ ] Commit all changes and open PR; do not merge until CI is green.
