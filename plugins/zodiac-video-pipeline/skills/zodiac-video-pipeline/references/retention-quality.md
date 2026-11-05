# Retention Quality Contract

This contract hardens the existing Engagement Engine. It does not guarantee virality and does not replace editorial judgment.

## Phase 01 — Retention Structure

Use grounded excerpts already present in `engagement-review.json`.

Mechanical limits:
- hook evidence ends by spoken token 16;
- early-value and first-pull evidence end by token 30;
- pull-chain evidence stays in narration order;
- max pull gap is 90 tokens;
- payoff evidence begins in the final 45% of narration;
- >90s requires >=5 pull beats and >=2 reframes;
- >120s requires >=6 pull beats.

Any issue is REVIEW.

## Phase 02 — Visual Retention

Meaningful visual events are state changes or non-hold authored motion.

Mechanical limits:
- overall meaningful event interval <=8s;
- each non-sparse scene interval <=12s;
- scene >20s needs >=2 meaningful events;
- scene >30s needs >=3 meaningful events.

Sparse reflection/payoff/transition is exempt only with an explicit authored sparse reason.

## Publish Prep — Payoff Protection

Compare the grounded payoff excerpt with title, caption and cover hook.

If >=3 distinctive payoff tokens recur and the overlap ratio is >=0.60, mark `PAYOFF_SPOILER` and REVIEW.

## Editorial interpretation rules

- Repeated recognition examples with the same semantic job are repetition, not progression.
- Two adjacent explanation-only beats require a new contrast, consequence, reframe or payoff.
- A thoughtful summary is not automatically a payoff.
- Trend fit is separate and never waives Retention REVIEW.
