# Emergent Narrative Archetype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional audience-informed narrative-archetype layer to Engagement Design without hard-coding signs to formats or leaking the role label into narration.

**Architecture:** A focused contract validates narrative-archetype decisions. Engagement Design may carry the decision, compile it into a minimized writer direction, and enforce the implicit-label gap. No new pipeline phase or Story Shape is introduced.

**Tech Stack:** Node.js ESM, node:test, existing Engagement Engine.

**Spec:** `docs/superpowers/specs/2026-11-05-emergent-narrative-archetype-design.md`

## Global Constraints

- Story Shape remains `character_deconstruction`.
- `behavior_mechanics` requires 2–6 entries.
- `viewer_inference.explicitness` is `implicit` in V1.
- Audience feedback is not Zodiac evidence.
- Raw comments/user identity fields are forbidden downstream.
- Recent-mode reuse requires `repeat_reason`.
- No fixed sign → mode map.

## Review Focus

- Audience feedback alone must not select a mode without story mechanics.
- Qualitative user-reported feedback must work without fabricated mention counts.
- Label aliases must be blocked from narration when inference is implicit.
- Writer direction must omit `audience_evidence`.
- Repetition control must not block first-time use.

---

### Task 1: Narrative archetype contract

Create `features/episode/narrative-archetype.mjs` and tests. Export:
- `assertNarrativeArchetype(value)`
- `compileNarrativeArchetypeDirection(value)`
- `assertImplicitArchetypeLabel(value, narrationRaw)`

RED tests cover the five Review Focus cases, then implement minimal validation.

### Task 2: Engagement Engine integration

Modify `features/episode/engagement-contract.mjs` so:
- `assertEngagementDesign` validates optional `narrative_archetype`;
- `compileEngagementDirection` carries minimized `narrative_mode`;
- `assertEngagementReview` checks implicit label leakage.

Extend the existing engagement progressive test.

### Task 3: Editorial guidance

Update:
- `references/engagement-engine.md`
- `references/narrative-modes.md`
- `references/content-craft.md`

Document audience-emergent feedback, behavior-first selection, implicit viewer inference, no sign mapping, and the boundary between Story Shape and narrative world grammar.

### Task 4: Verification

Run focused Node tests and full PR CI. Do not merge or publish from this plan.
