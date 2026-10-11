# Content craft for Zodiac sticker shorts

## Content Engine v2

Content transforms research, Viral guidance and optional references into a small creative contract. Loading a tool/skill is not the same as applying it.

### Viral analysis is an artifact, not a receipt

Concept always writes `viral-analysis.json`:

```json
{
  "version": "1.0",
  "mechanics": [
    {"id":"V1","principle":"transferable Viral principle","concept_application":"what changed in hook/progression/framing/payoff","writer_effect":"small downstream instruction that survives into the writer brief"}
  ],
  "rejected_moves": ["move rejected because it would cause claim drift"],
  "application_summary": "one concise summary"
}
```

A generic application summary without artifact-level mapping does not satisfy Concept.

### Reference mechanics are not evidence

When a reference is supplied, write `reference-mechanics.json` and transfer mechanics only: narrator stance, identity framing, cadence, facet sequencing, contrast/reversal timing, reset/escalation and recognition/payoff construction. Never copy reference lines or treat reference Zodiac claims as evidence.

```json
{
  "version":"1.0",
  "reference_present":true,
  "mechanics":[{"id":"R1","mechanic":"strong identity framing before facet expansion"}],
  "application_map":[{"mechanic_id":"R1","concept_application":"open from the approved identity tension, then widen into distinct supported facets"}]
}
```

With no reference, still emit `reference_present:false` with empty mechanics/mapping.

## Story shape and delivery are separate

New Zodiac uses only `character_deconstruction` as Story Shape; `hybrid_deconstruction` and `micro_story` are forbidden as shapes. Mini-scenes remain illustration devices. Delivery is `direct` or `conversational`.

Character deconstruction unfolds a source-bounded identity lens. Mini-scenes illustrate the lens; their length and order follow the premise. Historical hybrid/micro templates are not current selectable shapes.

## Story Spine

Every `narrative-plan.json` contains `identity_tension`, `starting_read`, `progression_intent`, and `payoff_target`. Every beat describes its real semantic_delta, including an intentional bridge, comic hold or delivery landing. Review the whole piece for progression; do not force a new trait into every beat.

Each beat is `SOURCE-SUPPORTED`, `EDITORIAL EXAGGERATION`, or `FICTIONAL MICRO-EXAMPLE` and maps to evidence refs. Editorial/fictional treatment may intensify presentation but cannot invent motive, cause, consequence, frequency, outcome, or psychological explanation.

Create intensity through identity framing, contrast, diction, rhythm, recognition, reversal, ordering and cumulative payoff—not claim inflation.

## Writer context

Compile only creative essentials into `phase3-writer-brief.json`: story shape/delivery, Story Spine direction, evidence-safe behaviors, selected Viral writer effects (possibly empty with an explicit omission decision), compact reference mechanics, audience/narrator vibe and forbidden claims.

Prefer lineage-bearing entries:

```json
{"viral_mechanics":[{"source_id":"V1","instruction":"<V1.writer_effect>"}],"reference_mechanics":[{"source_id":"R1","instruction":"<R1 mechanic/application>"}]}
```

`validate-content-contract.mjs` resolves those IDs, checks Story Spine carry-through and evidence refs, and rejects raw planning payload in the writer brief. Do not send the writer the full plan, raw SRT/reference, full evidence ledger/research, QC rules, assets, runtime instructions or packaging context.

Planner logic stays invisible in spoken narration. Write natural Vietnamese for a voice, with varied sentence lengths and controlled reactions; concrete manifestation does not need to become a full scene.


## Creative ordering lock (v2.4.15)
The Story Spine preserves identity_mechanism and misread_vs_reframe as recognition context; it does not force a misreading or twist. The beat sequence uses meaningful facets without a count quota; if the cast or setting takes control, return to the sign lens. Viral and visual object mechanics follow (never decide) the theme. See `zodiac-identity-first.md`.
A Viral omission writes mechanics: [] and decision: {mode: "omitted", reason: "<actual editorial reason>"}. Do not invent a mechanic to fill an artifact.
