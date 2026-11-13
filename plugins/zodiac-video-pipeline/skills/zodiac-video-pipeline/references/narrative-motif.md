# Phase 1 Narrative Motif

A **Narrative Motif** is a Phase-1 semantic story device: one recurring image, phrase, behavior, route, object idea, rule, or relationship that changes meaning as the Story Spine progresses.

It is authored **before Narration** when the selected concept depends on a recurring story image or continuity device. It is not a Phase-2 Visual Metaphor, Story Object, asset request, scene composition, prop specification, or animation instruction.

## Why it exists

A strong hook can still flatten after the midpoint when the script stops progressing and starts explaining. The motif gives the story one thing to keep transforming, so later beats can continue the story instead of restating the thesis.

Do not use a motif merely because a phrase sounds clever. A motif must carry semantic progression.

## Narrative Design contract

For a story-driven concept, put one `narrative_motif` object in `narrative-plan.json` before prose is drafted:

```json
{
  "narrative_motif": {
    "mode": "required",
    "label": "đường quen",
    "core_meaning": "what the motif represents at the opening",
    "setup_state": "how it first appears and what the viewer reads",
    "friction_states": [
      "how the same motif changes under pressure",
      "a later state that raises cost, conflict, or contradiction"
    ],
    "turn_state": "the point where the motif means something different",
    "payoff_state": "the final transformed state",
    "callback": "how the ending returns to it with added meaning",
    "removal_test": "what story connection is lost if the motif is removed",
    "beat_bindings": ["B1", "B2", "B3", "B4"]
  }
}
```

For a direct deconstruction that genuinely does not benefit from one recurring motif, use:

```json
{
  "narrative_motif": {
    "mode": "omitted",
    "reason": "specific editorial reason the Story Spine remains coherent without a recurring motif"
  }
}
```

Do not carry several competing motifs. Pick the one that best exposes the sign-specific mechanism.

## Prewrite tests

Before Narration, answer all of these from the plan itself:

1. **Meaning test** — what does the motif mean at setup, and what does it mean at payoff?
2. **Progression test** — does each return add pressure, consequence, contrast, reframe, or payoff rather than repeat the same joke?
3. **Removal test** — if it disappears, do the beats become a list of examples? If yes, it is doing real narrative work.
4. **Sign test** — would the motif still work unchanged for another sign? If yes, bind it more tightly to the selected identity mechanism.
5. **No Phase-2 leakage** — no asset name, layout, shot, renderer, SVG, or animation instruction belongs here.

## Second-half pulse

Narrative Design must also state how the story keeps moving **after the midpoint**. The second-half should not become an explanation plateau after a strong opening.

For every post-midpoint beat, identify at least one new job:
- new action or event;
- decision or failed workaround;
- consequence or rising cost;
- contrast;
- reframe/reveal;
- payoff/callback.

Two consecutive post-midpoint beats that only explain the interpretation are a redesign signal. Return to action, decision, consequence, contrast, or the motif in a changed state.

The ending should land through the transformed motif when a motif is present. Do not append a generic lesson after the payoff.

## Revision behavior

When a user likes the opening but says the later section loses rhythm, preserve the accepted opening unless the story engine requires otherwise. Rebuild the second-half pulse first: shorten explanation, add a new consequence/decision, advance the motif state, and make the payoff arrive through action or callback.

When the user rejects the idea itself, reopen Concept and Narrative Design rather than polishing sentences around a weak premise.
