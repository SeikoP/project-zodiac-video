# Emergent Narrative Archetype — Design Spec

**Status:** APPROVED DIRECTION  
**Date:** 2026-11-05

## Intent

Let Zodiac videos adopt a recognizable narrative world (detective case, QA/bug tracker, interrogation, mock documentary, chat reconstruction, etc.) when the **behavior in the story naturally supports it**.

The key Scorpio learning is audience-emergent: viewers independently inferred a **detective** role from Scorpio noticing inconsistencies, holding questions, comparing details and resolving the clue. The pipeline must preserve that inference gap instead of announcing “Scorpio is a detective.”

## Principles

1. **Behavior first, label second.** A narrative archetype requires at least two story mechanics. Audience comments can strengthen selection but cannot create a Zodiac claim by themselves.
2. **Audience inference is feedback, not astrology evidence.** Viewer language may validate resonance; it never proves a trait.
3. **Keep the label implicit.** The target label and aliases are downstream “do not say” terms unless the user explicitly asks to name the mode.
4. **No sign-to-mode table.** Scorpio is not permanently detective; Virgo is not permanently QA. Each episode ranks modes from its actual story mechanics.
5. **Mode is not Story Shape.** The canonical Story Shape remains `character_deconstruction`; narrative archetype is a delivery/world grammar layered on top.
6. **Comments stay upstream.** Raw comment text, usernames and handles never enter the writer brief. Only a compact qualitative signal may affect mode selection.
7. **Repetition control.** Reusing a recent mode requires a substantive repeat reason.

## Contract

Optional field in `engagement-design.json`:

```json
{
  "narrative_archetype": {
    "format": "zodiac-narrative-archetype@1",
    "mode_id": "detective_case",
    "selection_basis": "hybrid",
    "behavior_mechanics": [
      "notices a mismatch between two statements",
      "holds the question instead of confronting immediately",
      "compares details until a mundane explanation resolves the clue"
    ],
    "visual_grammar": [
      "case-file progression",
      "clue emphasis",
      "evidence comparison",
      "case-closed payoff"
    ],
    "viewer_inference": {
      "target_label": "thám tử",
      "aliases": ["detective"],
      "explicitness": "implicit",
      "comment_affordance": "Leave the role unnamed so viewers can identify and name it themselves."
    },
    "audience_evidence": {
      "source_kind": "user_reported_viewer_feedback",
      "normalized_mode_id": "detective_case",
      "signal_strength": "qualitative",
      "not_zodiac_claim_evidence": true
    },
    "recent_mode_ids": []
  }
}
```

`selection_basis` is one of:
- `story_mechanics`
- `audience_emergent`
- `hybrid`

Audience-emergent/hybrid requires matching `audience_evidence`, but the story still requires behavior mechanics.

## Writer handoff

`compileEngagementDirection()` emits only:
- `mode_id`
- `behavior_mechanics`
- `visual_grammar`
- `viewer_inference_target`
- `do_not_say_labels`
- `comment_affordance`
- whether audience resonance contributed

It must not pass raw feedback or source comments.

## Narration guard

If `viewer_inference.explicitness=implicit`, narration must not directly use the target label or aliases. This preserves the exact behavior seen in the Scorpio example: the audience supplies “thám tử” themselves.

## Examples

Scorpio coffee inconsistency:
`detective_case` is justified by clue detection + comparison + delayed question + resolution.

Virgo travel prep:
`quality_control` may be justified by error detection + dependency checking + correction. It does not require audience feedback.

A different Scorpio episode may choose `interrogation`, `inner_monologue`, `grounded_story`, or no archetype if those mechanics fit better.
