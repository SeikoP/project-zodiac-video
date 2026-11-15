# Web Phase 1 Creative Invariants Recovery Implementation Plan

> **For agentic workers:** Use Superpowers TDD and verification discipline. Steps use checkbox syntax.

**Goal:** Restore editorial invariants lost from Zodiac Web Phase 1 while keeping the current creative-first architecture and handoff contract unchanged.

**Base:** `experiment/main-2` at `6505d96910adfcd1c65dc06190b1fde9bf3105bc`.

**Architecture:** Keep behavior guidance in `zodiac-video-web/SKILL.md`, sync the repository copy with newer installed guidance, add regression coverage in split-bundle tests, and bump the canonical patch version consistently.

**Spec:** `docs/superpowers/specs/2026-11-16-web-phase1-creative-invariants-recovery-design.md`

### Task 1: Lock editorial invariants with RED regression coverage

- [ ] Add split-bundle regression test for Recognition & Identity Gate, motive boundary, style firewall, whole-script progression, implicit archetype, dual editorial read, physical-situation guidance, and unchanged handoff v2.
- [ ] Open a draft PR against `experiment/main-2` and verify the new test fails before implementation.

### Task 2: Restore canonical Web guidance

- [ ] Restore physical-situation and single-voice TTS guidance.
- [ ] Add Behavior Core, Broad Recognition, Multi-context, Scenario Dependency, Sign Ownership, Scene Dominance, Moral Drift.
- [ ] Add evidence/motive boundary and style-only firewall.
- [ ] Add whole-script recognition-vs-progression and implicit narrative-archetype rules.
- [ ] Add silent-read pass while retaining audio-only pass.
- [ ] Update Web/default prompts without restoring native Web execution.
- [ ] Bump canonical version 2.12.1 → 2.12.2.

### Task 3: Verify

- [ ] Split bundle + handoff v2 + Local bootstrap checks green.
- [ ] Creative Web architecture checks green.
- [ ] Python/unit and release candidate checks green.
- [ ] Review diff against this spec.
- [ ] Leave both base branches unchanged pending explicit integration.
