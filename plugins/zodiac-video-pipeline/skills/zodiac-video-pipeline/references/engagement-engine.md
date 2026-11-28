# Narrative Engagement Engine — Phase 01

This is a contract inside the existing Concept → Narration workflow. It is not a new phase, sub-agent or virality guarantee.

## Goal

Preserve Zodiac identity and evidence while increasing the viewer's reason to continue through:
`recognition → curiosity → progression → reframe → payoff`.

Do not manufacture mystery, false stakes, unsupported psychology, guaranteed retention or a fixed “viral” beat quota.

## Concept output: engagement-design.json

Write `.authoring/engagement-design.json` before compiling the writer brief.

Required format: `zodiac-engagement-design@2` (`@1` stays readable for approved legacy runs; it has no `interaction`).

It binds to the exact selected concept and Narrative Plan and contains:
- `entry_hook.intent`: what the first spoken move gives the viewer;
- `entry_hook.mechanism`: why that move earns attention without false hype;
- `open_question`: the question/tension the viewer should want resolved;
- `recognition_loop`: 2–6 concrete recognition cues;
- `reframe_points`: 1–4 supported changes in interpretation;
- `payoff_callback`: what the ending returns to with added meaning;
- `interaction`: the viewer's move after watching (see below);
- `beat_pull`: exactly one item per Narrative Plan beat with `beat_id`, `question_created`, `reason_to_continue`, `new_information`, and optional `payoff_promised`.

Each beat must add information, create/resolve a useful question, deepen recognition, reframe, or pay off prior setup. A beat that only repeats the prior explanation should be redesigned before Narration.

The writer receives only the compiled `engagement_direction`; do not inject the full beat map into the drafting context.

## Interaction design (design@2)

A story that is well told can still leave the viewer with nothing to do. `interaction` has exactly four short fields, each tied to this episode, never a generic call to action:
- `comment_move`: one spoken moment that lets the viewer place themself or pick a side (a named choice between two behaviors of the sign, not "comment below");
- `share_target`: the specific person this is for ("the one in your life who ..."), spoken or clearly implied;
- `quotable_line`: one 4–25 word line of the narration written to be repeated; it must appear in the narration exactly as written;
- `replay_seam`: how the last line returns to the opening image, word or question with a changed meaning, so a replay reads differently.

Direct address ("bạn") is allowed at these points and wherever it makes recognition personal; keep the narrator's voice and do not turn the episode into a lecture addressed to the viewer. A viewer move must come from the story, never from a false stake, forced controversy or an unsupported claim about the sign. Do not alternate address by quota.

The review (`interaction_check`) quotes the spoken text for each of the four fields. The quotable line is also checked verbatim against the narration. This is an editorial gate, not measured engagement: record real comments, shares and replays after publishing before drawing conclusions.

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
- **Payoff is not a summary.** The ending should resolve/reframe/callback to setup rather than merely restating the Zodiac interpretation. A counted hook needs explicit accounting: every promised facet is delivered, later beats deepen those facets, and the ending changes their meaning instead of adding a new list.
- **Narrative Economy Review:** use the deletion test and distinct semantic gain across all beats, not only consecutive ones. Diagnose topic drift, generic behavior, repeated explanation and skeleton-driven padding. Repair only material defects; preserve strong beats and stop if no defect remains. See `narration-skeleton.md` section 6c for evidence and revision diff guidance. No token minimum is an excuse for filler, and editorial review is not measured retention.


## Narrative archetype

The optional narrative world (detective case, QA, interrogation, ...) is defined in `narrative-modes.md`. When `narrative_archetype` is present the design validates it and the review checks that the role label is never spoken.

## Second-half continuity

The post-midpoint rule lives in `narrative-motif.md` (Second-half pulse). The review still marks two adjacent explanation-only beats as REVIEW, and when the user likes the opening but the later section loses rhythm, repair the pull chain after the midpoint first.
