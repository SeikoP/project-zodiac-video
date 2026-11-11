# Phase 1 Voice-First Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the compressed-reference Phase 1 authoring path with a voice-first core while preserving the Phase 2 handoff boundary.

**Architecture:** Evidence and Voice are independent source tracks. Concept and Narrative Design combine them without turning style into evidence. Narration is generated with bounded style-reference access, then blocked by independent Semantic, Voice Fidelity and Story reviews. External enhancement plugins are optional fallbacks.

**Tech Stack:** Node.js ESM, JSON contracts, existing Phase 1 state/orchestration, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-11-phase1-voice-first-rewrite-design.md`

## Global Constraints
- Preserve `zodiac-phase1-handoff@1`.
- Reference content is style-only unless independently present in evidence.
- No full-script Humanizer rewrite on the default path.
- Editorial quality is judged by review artifacts, not keyword scoring.
- Deterministic validators enforce schema, lineage and blocking decisions only.

## Review Focus
- Generic polished Zodiac prose with slang tokens must fail voice review.
- A valid voice profile must never authorize unsupported factual claims.
- Narration context must receive voice data without receiving forbidden reference facts as evidence.
- Optional plugin absence must not block Phase 1.
- Phase 2 handoff-required files remain unchanged.

### Task 1: Voice profile contract
- [ ] Add voice-profile guidance and deterministic validator.
- [ ] Add tests for complete profile, missing dimensions and source firewall.

### Task 2: Voice fidelity gate
- [ ] Add voice-fidelity review validator.
- [ ] Test PASS/REVIEW, stale source hashes and generic-AI drift blocking.

### Task 3: Orchestration rewrite
- [ ] Replace compressed reference-only narration context with voice profile and narrative design artifacts.
- [ ] Add voice review as blocking narration gate.
- [ ] Keep Phase 1 handoff compatibility.

### Task 4: Dependency cleanup
- [ ] Make Humanizer/content enhancement optional and failure-targeted.
- [ ] Document core/optional/obsolete dependency policy.

### Task 5: Regression and release
- [ ] Add voice fixtures/negative fixtures based on mechanics from the supplied reference style without copying sentences.
- [ ] Run Phase 1 tests and split bundle tests.
- [ ] Bump version and build/release web plugin after green verification.
