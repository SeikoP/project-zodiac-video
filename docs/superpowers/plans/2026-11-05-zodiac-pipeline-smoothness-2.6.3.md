# Zodiac Pipeline Smoothness 2.6.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce complete authoring before Phase 1/2 review and make Phase 3 the only user-facing ZIP export.

**Architecture:** Add fail-closed authoring validators at Phase 2 entry/commit boundaries, strengthen receipt provenance, and encode output-surface policy in router/skill guidance. Preserve legacy code only behind non-fresh compatibility paths.

**Tech Stack:** Node.js ESM, JSON manifests, GitHub Actions.

**Spec:** docs/superpowers/designs/2026-11-05-zodiac-pipeline-smoothness-2.6.3.md

## Global Constraints
- Fresh V4 episodes use Narrative Visual, not legacy Story Object/Scene Set authoring.
- Phase 1/2 create no user-facing ZIP.
- Phase 3 emits exactly one Job@5 ZIP per revision.
- Genuine user approvals remain mandatory.
- No runtime/render behavior changes.

## Review Focus
- Missing scene_plan must block visual_compile before expensive asset compilation.
- A declared Narrative Visual or physical prop may not disappear from coverage/events.
- Receipt argv/output drift must invalidate a step commit.
- Fresh runs must reject legacy Scene Set/Story Object authoring while historical recovery remains importable.
- Review output policy must not block diagnostic directories/files.

---

### Task 1: Phase 2 completeness gate
- [ ] Add failing tests for missing Scene Plan and missing required storytelling layers.
- [ ] Implement `validate-phase02-authoring-completeness.mjs`.
- [ ] Wire it into visual_compile required capabilities/gates and precompile.
- [ ] Run Phase 2 test suite.

### Task 2: Receipt provenance
- [ ] Add failing tests for validator script mutation, argv mismatch and missing declared output hash.
- [ ] Extend validator receipt format with script SHA-256 and output hashes.
- [ ] Enforce receipt provenance in pipeline state/step commit validation.
- [ ] Run receipt/state tests.

### Task 3: Fresh-path legacy isolation
- [ ] Add failing tests proving fresh Scene Set/legacy Story Object authoring is blocked.
- [ ] Keep non-fresh historical recovery accepted.
- [ ] Run compatibility and Phase 2/3 tests.

### Task 4: User-facing output policy
- [ ] Add tests/static contract for Phase 1/2 no ZIP and Phase 3 single ZIP.
- [ ] Update SKILL/router/phase guidance and status vocabulary.
- [ ] Run orchestration contract tests.

### Task 5: Release 2.6.3
- [ ] Bump plugin manifests/template.
- [ ] Run full repository CI.
- [ ] Merge only after green.
- [ ] Update installed plugin release record and regenerate 01/02/03 execution bundles.
