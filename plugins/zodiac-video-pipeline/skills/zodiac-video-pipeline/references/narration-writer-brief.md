# Narration Writer Brief

Compile `phase3-writer-brief.json` from the full narrative plan before Narration. This is the writer's minimized creative context, not a copy of the planner workspace.

```yaml
sign: <label>
topic: <plain-language focus>
content_engine: character_deconstruction
delivery_mode: direct | conversational
audience_vibe: neutral | student_peer | custom
thesis: <one sentence>
identity_tension: <Story Spine value>
progression_intent: <Story Spine value>
payoff_target: <Story Spine value>
evidence_safe_behaviors:
  - <observable supported behavior/tension>
viral_mechanics:
  - source_id: V1
    instruction: <writer_effect from viral-analysis.json>
reference_mechanics:
  - source_id: R1
    instruction: <mechanic/application from reference-mechanics.json>
situation_territories:
  - <optional context, not an exact beat script>
narrator_vibe:
  - <2–4 qualities>
motif_candidates:
  - <optional payoff image>
forbidden_claims:
  - <unsupported motive/cause/consequence/frequency/outcome>
```

Prefer the `source_id + instruction` form so `validate-content-contract.mjs` can prove lineage. Legacy plain strings remain readable only when they textually resolve to the source artifact.

Keep the brief compact. Never include raw SRT/reference lines, reference Zodiac claims, beat IDs, `beats`, `devices`, the full evidence ledger/research, full QC, assets, animation, runtime or package rules. `audience_vibe` is concept-driven, not automatically `student_peer`. All planner vocabulary is internal-only and must be translated into natural viewer-facing Vietnamese.


## Mandatory Zodiac-first brief for fresh v2.4.15+
Include `sign_identity_mechanism`, `misread_vs_reframe`, `three_facets`, `sign_swap_counterfactual`, `scene_usage_limit`, and `non_moral_payoff` from the chosen candidate. They are *creative essential context*, not full research or QC. Explicitly instruct the writer to **explain the sign, not narrate a long fictional episode**. Scenes are compact manifestations; no obligatory moral transformation. Distinguish behavioral observation from evidence about individual people.