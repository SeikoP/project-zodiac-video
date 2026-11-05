# Zodiac Retention Quality — Design Spec

**Status:** APPROVED DIRECTION  
**Date:** 2026-11-05

## Problem

The pipeline can produce Zodiac content that is accurate, grounded and visually valid but still loses short-form viewers because it behaves like an essay rather than a retention-driven story.

The comparison between the Scorpio and Cancer packages exposed eight recurring weaknesses:

1. **Generic opening:** the first line can describe a trait without giving a concrete anomaly, conflict, paradox, consequence or strong recognition cue.
2. **Delayed value / open loop:** the cover or premise promises one thing, while the narration takes too long to create a concrete reason to continue.
3. **Recognition repetition mistaken for progression:** multiple examples can prove the same trait without adding new information, stakes or a reframe.
4. **Abstraction runs:** explanation can continue for several beats without returning to action, dialogue, object, contrast or consequence.
5. **Long runtime without enough turns:** a long narration can pass content quality even when the number of semantic turns is too small for its duration.
6. **Visual dead zones:** long scenes can have too few meaningful state changes/events.
7. **Payoff replaced by summary:** a thoughtful conclusion can pass even when the story lacks a satisfying turn/callback.
8. **Publish copy spoilers the payoff:** title/caption can reveal the ending and destroy completion incentive.

Trend fit is a separate signal. A trend or reference can influence execution, but **must never override a Retention REVIEW**.

## Architecture

Do not create a second subjective “viral score” system. Harden the existing Engagement Engine with three deterministic layers:

### 1. Retention Structure — Phase 01 Narration exit

New validator: `features/retention/retention-structure.mjs`.

Inputs:
- actual narration;
- `engagement-review.json`;
- `engagement-design.json`;
- `narrative-plan.json`.

It converts already-grounded Engagement Review excerpts into structural timing checks.

Rules:
- Hook evidence must end within the first **16 spoken tokens** (rough 3-second proxy at the current authoring rate).
- Early-value evidence and the first pull-chain evidence must end within the first **30 spoken tokens** (rough 6-second proxy).
- Pull-chain excerpts must be in narration order.
- Maximum gap between pull-chain evidence points is **90 tokens**.
- Payoff evidence must start in the final **45%** of narration.
- Estimated runtime > **90s** requires at least **5 pull beats** and at least **2 reframe points**.
- Estimated runtime > **120s** requires at least **6 pull beats**.
- Any structural issue returns `REVIEW` and blocks Content Review.

The existing Engagement Review remains responsible for semantic judgments. Its guidance is strengthened:
- two adjacent examples with the same semantic job are repetition, not progression;
- two adjacent explanation-only beats require repair unless the second creates a new contrast/reframe/payoff;
- a trend/reference cannot rescue a retention failure.

Output: `.authoring/retention-structure.json`.

### 2. Visual Retention — Phase 02 Visual Compile exit

New validator: `features/retention/visual-retention.mjs`.

It analyzes scene duration and **meaningful visual events** (state change or non-hold motion).

Rules:
- overall meaningful-event interval > **8s** => REVIEW;
- any scene > **20s** with fewer than **2** meaningful events => REVIEW;
- any scene with meaningful-event interval > **12s** => REVIEW;
- any scene > **30s** with fewer than **3** meaningful events => REVIEW;
- intentional sparse reflection/payoff scenes may be exempt only when an explicit sparse reason is authored.

Output: `.authoring/visual-retention-review.json`.

This directly catches the Cancer pattern (~132s / 9 events, with ~40.7s and ~26.7s one-event scenes) while allowing the Scorpio pattern (~82.7s / 20 total events, no long dead zone).

### 3. Publish Retention — Phase 02 Publish Prep exit

New validator: `features/retention/publish-retention.mjs`.

It compares the grounded payoff excerpt from Engagement Review against title, caption and cover hook.

If at least 3 distinctive payoff tokens are repeated and the payoff-token overlap ratio is >= **0.60**, return `REVIEW` with `PAYOFF_SPOILER`.

Output: `.authoring/publish-retention-review.json`.

## Status Model

Validators return only:
- `PASS`
- `REVIEW`

They never claim “viral”, “trend”, or guaranteed performance.

Reports include `risk_level: LOW|MEDIUM|HIGH` and `not_a_performance_guarantee: true`.

## Non-goals

- Do not infer real completion rate without actual platform analytics.
- Do not force every video into a fixed duration.
- Do not require motion every few seconds when a sparse beat has explicit semantic justification.
- Do not use current trend fit to waive retention problems.
- Do not replace human editorial review with a numeric score.

## Future calibration

When real post-level metrics become available, store them separately and calibrate thresholds against:
- 2s/3s hold;
- average watch time;
- completion rate;
- rewatch rate;
- shares;
- saves;
- comments.

Observed performance is calibration evidence, never retroactive proof that a weak contract was correct.
