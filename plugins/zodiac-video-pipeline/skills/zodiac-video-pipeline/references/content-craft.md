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

### Voice profile is the style source; reference mechanics are compatibility only

When a reference is supplied, write `voice-profile.json` as the first-class style contract. It captures narrator relationship, affection/attack model, language register, comic and contradiction engines, sentence music, internal voice, emotional movement, warmth limits and forbidden drift. `reference-mechanics.json` remains a migration/compatibility projection only; it must never become the writer's source of truth. Never copy reference lines or treat reference Zodiac claims as evidence.

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

Narration's primary creative inputs are `narrative-design.json + voice-profile.json`, plus minimal evidence and an optional bounded style-only reference capsule. `phase3-writer-brief.json` is a compatibility projection for legacy consumers: keep story shape/delivery, Story Spine direction, evidence-safe behaviors, selected Viral writer effects, audience context and forbidden claims, but do not flatten the narrator family into a few adjectives.

Prefer lineage-bearing entries:

```json
{"viral_mechanics":[{"source_id":"V1","instruction":"<V1.writer_effect>"}],"reference_mechanics":[{"source_id":"R1","instruction":"<R1 mechanic/application>"}]}
```

`validate-content-contract.mjs` resolves compatibility IDs, checks Story Spine carry-through and evidence refs, and separately validates `voice-profile.json` and `narrative-design.json` lineage. Do not send the writer the full plan, raw SRT/reference, full evidence ledger/research, QC rules, assets, runtime instructions or packaging context. A bounded voice-reference capsule may expose only style observations/brief excerpts under the reference firewall; it never authorizes claims.

Planner logic stays invisible in spoken narration. Write natural Vietnamese for a voice, with varied sentence lengths and controlled reactions; concrete manifestation does not need to become a full scene.


## Creative ordering lock (v2.4.15)
The Story Spine preserves identity_mechanism and misread_vs_reframe as recognition context; it does not force a misreading or twist. The beat sequence uses meaningful facets without a count quota; if the cast or setting takes control, return to the sign lens. Viral and visual object mechanics follow (never decide) the theme. See `zodiac-identity-first.md`.
A Viral omission writes mechanics: [] and decision: {mode: "omitted", reason: "<actual editorial reason>"}. Do not invent a mechanic to fill an artifact.


### Audience-emergent narrative archetypes

Engagement Design may include `narrative_archetype` when story mechanics support a recognizable world/role. Audience feedback can reinforce the choice, including qualitative user-reported feedback, but it is not evidence for astrology claims.

The writer receives only the compiled `narrative_mode` direction: behavior mechanics, visual grammar, viewer-inference target, labels not to say, and comment affordance. Never pass raw comments, usernames, handles or audience-profile data into the writer brief.

The target label is intentionally withheld when `explicitness=implicit`. The goal is not “tell viewers Scorpio is a detective”; the goal is “make the behavior so detective-like that viewers say it first.”

## Story engine before prose

A concept is not ready merely because its thesis is accurate. Before Narrative Design, ask whether the viewer has a reason to watch the idea **unfold**.

Reject or rebuild a premise when:
- the hook already reveals the whole conclusion;
- the middle can only add parallel examples;
- escalation changes nouns but not pressure, consequence or interpretation;
- the payoff merely restates the opening;
- the same premise survives a sign swap with only labels changed.

For story-driven concepts, choose one Phase-1 Narrative Motif and define its progression before drafting. The motif should expose the sign mechanism under changing pressure, not decorate the script. See `narrative-motif.md`.

Humor should attach to conflict, workaround, contradiction, narrator reaction or motif state. A joke that could be moved anywhere without changing the story is usually filler.
