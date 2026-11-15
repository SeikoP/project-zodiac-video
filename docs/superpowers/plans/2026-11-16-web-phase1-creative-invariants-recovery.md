# Web Phase 1 Creative Invariants Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the editorial invariants lost from Zodiac Web Phase 1 while keeping the current creative-first architecture and handoff contract unchanged.

**Architecture:** Keep all behavior guidance in the existing `zodiac-video-web/SKILL.md`, sync the repository copy with newer installed guidance, and add regression coverage in the split-bundle tests. Bump the canonical plugin patch version consistently without changing handoff schemas or Local behavior.

**Tech Stack:** Markdown skill guidance, Python `unittest`, existing deterministic split-plugin builder, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-16-web-phase1-creative-invariants-recovery-design.md`

## Global Constraints

- Preserve creative-first Web Phase 1 with no native runtime/bootstrap/validator dependency.
- Preserve `zodiac-phase1-handoff@2`.
- Do not change Local Phase 2/3 behavior.
- Do not force multi-context examples into narration; multi-context is a concept test only.
- Preserve installed physical-situation and single-voice TTS guidance.
- Keep main and main 2 unchanged; implementation lives on a feature branch.

## Review Focus

- A deadline/school/work premise must fail the concept guidance when the behavior does not survive outside that scenario.
- A story that still works almost unchanged after replacing the Zodiac sign must be rejected as sign-swappable or scene-dominated.
- Narration must not convert plausible motives into factual claims.
- Style references must not leak their situations, claims, jokes, or phrases into the new episode.
- Strong performance or visuals must not rescue text that fails a silent read.

---

### Task 1: Lock recovered Web editorial invariants with regression tests

**Files:**
- Modify: `tests/test_split_plugin_bundle_builder.py`

**Interfaces:**
- Consumes: Web split archive built by `build_profile(ROOT, "web", ...)`.
- Produces: regression contract asserting the entry skill contains the recovered editorial guidance and the built Web archive carries it.

- [ ] Add a failing test that asserts the built Web skill contains the recognition/identity gate, motive boundary, style firewall, progression rule, implicit archetype rule, silent-read pass, audio-only pass, physical-situation guidance, and no handoff schema change.
- [ ] Open/update the PR and verify GitHub Actions fails on the new test before skill implementation.
- [ ] Commit the test.

### Task 2: Restore and consolidate the creative guidance

**Files:**
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-web/SKILL.md`
- Modify: `plugins/zodiac-video-pipeline/distributions/web.plugin.json`
- Modify: `plugins/zodiac-video-pipeline/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`

**Interfaces:**
- Consumes: Task 1 regression expectations and installed-plugin guidance.
- Produces: canonical Web skill with the recovered invariants; canonical version `2.12.2`.

- [ ] Restore the installed physical-situation and single-voice TTS guidance into repository source.
- [ ] Add Concept recognition/identity gate with behavior core, broad recognition, multi-context, scenario dependency, sign ownership, scene dominance, and moral drift checks.
- [ ] Add evidence/motive boundary and style-only firewall.
- [ ] Add whole-script recognition-vs-progression rule and implicit narrative-archetype rule.
- [ ] Add silent-read editorial pass while retaining audio-only review.
- [ ] Update Web default prompt to mention the recognition/identity gate without reintroducing native validators.
- [ ] Bump canonical version fields from 2.12.1 to 2.12.2.
- [ ] Verify split-bundle and handoff tests pass.

### Task 3: Verify release/build compatibility and review branch

**Files:**
- No product-code additions expected; only fixes required by verification/review.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: CI-green feature branch ready for integration decision.

- [ ] Verify release consistency and both split profile builds through existing tests/CI.
- [ ] Confirm handoff contract remains `zodiac-phase1-handoff@2` and Local tests remain green.
- [ ] Review the complete diff against the spec, fix any Critical/Important issue with RED→GREEN coverage.
- [ ] Leave the feature branch unmerged for the user's integration decision.
