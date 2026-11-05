# Zodiac Retention Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic retention structure, visual rhythm and payoff-spoiler gates so grounded Zodiac videos cannot pass review while behaving like slow essays.

**Architecture:** Keep the existing Engagement Engine as the semantic reviewer and add deterministic validators that measure timing/position/density from its grounded excerpts and authored scene events. Wire the new validators into existing Phase 01 Narration, Phase 02 Visual Compile and Phase 02 Publish Prep review boundaries.

**Tech Stack:** Node.js ESM, node:test, JSON phase manifests.

**Spec:** `docs/superpowers/specs/2026-11-05-zodiac-retention-quality-design.md`

## Global Constraints

- Do not introduce a guaranteed virality score.
- Hook proxy threshold: 16 tokens.
- Early-value / first-pull proxy threshold: 30 tokens.
- Maximum pull-chain gap: 90 tokens.
- Payoff must begin in final 45% of narration.
- Runtime >90s requires >=5 pull beats and >=2 reframes; >120s requires >=6 pull beats.
- Overall meaningful visual-event interval must be <=8s.
- Scene meaningful-event interval must be <=12s unless explicitly sparse.
- Publish payoff overlap >=0.60 with >=3 distinctive tokens blocks as spoiler.

## Review Focus

- Narration excerpts with punctuation/diacritics must still resolve to the correct token positions.
- Long narration with many words but too few semantic pulls must REVIEW.
- Hold-only events must not inflate visual event density.
- Sparse scenes may bypass density only with explicit authored rationale.
- Generic overlapping words must not create false payoff-spoiler blocks.

---

### Task 1: Retention structure validator

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/retention/retention-structure.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/retention/tests/retention-structure.test.mjs`

**Interfaces:**
- Produces: `analyzeRetentionStructure({narration, engagementReview, engagementDesign, plan})`
- CLI: `node retention-structure.mjs <workspace> [--write]`

- [ ] Write tests for early hook PASS, late hook REVIEW, long-runtime/few-turn REVIEW and pull-gap REVIEW.
- [ ] Run tests and verify RED.
- [ ] Implement token-position analysis and workspace writer.
- [ ] Run tests and verify GREEN.

### Task 2: Visual retention validator

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/retention/visual-retention.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/retention/tests/visual-retention.test.mjs`

**Interfaces:**
- Produces: `analyzeVisualRetention(production)`
- CLI: `node visual-retention.mjs <workspace> [--write]`

- [ ] Write Scorpio-like PASS and Cancer-like REVIEW fixtures.
- [ ] Run tests and verify RED.
- [ ] Implement meaningful-event and duration analysis with sparse exemption.
- [ ] Run tests and verify GREEN.

### Task 3: Publish payoff-spoiler validator

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/retention/publish-retention.mjs`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/retention/tests/publish-retention.test.mjs`

**Interfaces:**
- Produces: `analyzePublishRetention({publish, engagementReview})`
- CLI: `node publish-retention.mjs <workspace> [--write]`

- [ ] Write Scorpio caption spoiler REVIEW and non-spoiler PASS tests.
- [ ] Run tests and verify RED.
- [ ] Implement normalized distinctive-token overlap.
- [ ] Run tests and verify GREEN.

### Task 4: Pipeline wiring and guidance hardening

**Files:**
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/phases/01-content.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/phases/02-visual-production.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/engagement-engine.md`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/retention-quality.md`
- Test: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/retention-quality-v271.test.mjs`

**Interfaces:**
- Phase 01 Narration emits `retention-structure.json` and gate `retention_structure`.
- Phase 02 Visual Compile emits `.authoring/visual-retention-review.json` and gate `visual_retention`.
- Phase 02 Publish Prep emits `.authoring/publish-retention-review.json` and gate `publish_retention`.

- [ ] Write manifest/guidance test and verify RED.
- [ ] Wire all three validators and outputs.
- [ ] Add repetition/abstraction/trend-separation guidance.
- [ ] Run focused tests and full CI.
