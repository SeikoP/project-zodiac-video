# Narrative Engagement Engine — Phase 01

This is a contract inside the existing Concept → Narration workflow. It is not a new phase, sub-agent or virality guarantee.

## Goal

Preserve Zodiac identity and evidence while increasing the viewer's reason to continue through:
`recognition → curiosity → progression → reframe → payoff`.

Do not manufacture mystery, false stakes, unsupported psychology, guaranteed retention or a fixed “viral” beat quota.

## Concept output: engagement-design.json

Write `.authoring/engagement-design.json` before compiling the writer brief.

Required format: `zodiac-engagement-design@1`.

It binds to the exact selected concept and Narrative Plan and contains:
- `entry_hook.intent`: what the first spoken move gives the viewer;
- `entry_hook.mechanism`: why that move earns attention without false hype;
- `open_question`: the question/tension the viewer should want resolved;
- `recognition_loop`: 2–6 concrete recognition cues;
- `reframe_points`: 1–4 supported changes in interpretation;
- `payoff_callback`: what the ending returns to with added meaning;
- `beat_pull`: exactly one item per Narrative Plan beat with `beat_id`, `question_created`, `reason_to_continue`, `new_information`, and optional `payoff_promised`.

Each beat must add information, create/resolve a useful question, deepen recognition, reframe, or pay off prior setup. A beat that only repeats the prior explanation should be redesigned before Narration.

The writer receives only the compiled `engagement_direction`; do not inject the full beat map into the drafting context.

## Narration output: engagement-review.json

After the complete narration exists, review the actual spoken text and write `.authoring/engagement-review.json` with format `zodiac-engagement-review@1`.

Review exactly:
- `hook_strength`;
- `early_value`;
- `curiosity_continuity`;
- `recognition_density`;
- `reframe_strength`;
- `payoff_satisfaction`.

Each criterion needs `PASS|REVIEW`, a substantive note and a 3–35 word exact excerpt grounded in narration.

Also include:
- `pull_chain`: one grounded PASS/REVIEW entry per ordered Narrative Plan beat;
- `consecutive_explanation_risk`: REVIEW when two adjacent semantic beats merely explain without new behavior, question, contrast, reframe or payoff;
- `decision` and `revision_targets`.

Any unresolved REVIEW blocks Content Review.

## NORMAL ↔ SHARP

When the user selects this stance:
- NORMAL shows behavior, context and evidence-safe observations;
- SHARP catches a mistaken read, creates contrast, lands a reframe or closes a payoff.

Do not alternate by timer or quota. Change intensity only when the semantic job changes.


## Retention hardening

The Engagement Review remains semantic, but it must now be written with the deterministic Retention Structure gate in mind.

- **Repeated recognition is not progression.** Two adjacent examples that do the **same semantic job** without a new consequence, question, contrast, reframe or payoff are repetition and must be marked REVIEW.
- **Explanation-only runs are expensive.** Two adjacent **explanation-only** beats require repair unless the second beat creates a genuinely new interpretation or closes a setup. Return to action, dialogue, a physical object, contrast or consequence.
- **Hook value must be concrete.** Generic introductions such as “X has an interesting kind of…” are weak unless the actual anomaly/paradox/recognition/consequence lands immediately.
- **Long runtime needs turns.** Runtime is not capped, but >90 seconds needs enough pull beats and reframes to justify the time.
- **Trend fit is separate.** A trend or reference **cannot override** a Retention REVIEW. Trend fit may alter execution only after the story earns continuation on its own.
- **Payoff is not a summary.** The ending should resolve/reframe/callback to setup rather than merely restating the Zodiac interpretation.


## Emergent narrative archetype

An episode may use a recognizable narrative world when the **actual behavior mechanics** support it: detective case, quality control, interrogation, mock documentary, chat reconstruction, and other modes are examples, not a whitelist.

The key rule is **behavior first, label second**. A mode needs concrete mechanics in the selected story. Viewer feedback may strengthen the choice when audiences independently name the same role, but that feedback is resonance evidence only; it is never Zodiac evidence.

When `narrative_archetype` is present:
- do not map a sign to a permanent mode;
- keep `viewer_inference.explicitness=implicit`;
- do not say the target role label or aliases in narration;
- preserve a comment affordance so viewers can supply the label themselves;
- keep raw comments, usernames and handles out of writer context;
- repeat a recently used mode only with a substantive reason.

A Scorpio story can therefore behave like a detective case without the narrator saying “Bọ Cạp là thám tử.” The audience inference is the success condition.
