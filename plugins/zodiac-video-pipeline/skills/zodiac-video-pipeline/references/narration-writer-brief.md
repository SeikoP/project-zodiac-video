# Narration Writer Brief

`phase3-writer-brief.json` is now a compatibility projection, not the narrator's voice source. Before Narration, compile it from the validated concept/evidence lineage, while the actual draft receives `narrative-design.json + voice-profile.json` as first-class inputs. Never compress the voice family into this brief.

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
rhythm_direction: <compact topic-specific direction; change intensity when the meaning changes>
voice_profile_ref: voice-profile.json
narrative_design_ref: narrative-design.json
motif_candidates:
  - <optional payoff image>
narrative_visual_direction:
  - id: <Phase-1 Narrative Visual id>
    beat_ids: [<Narrative Plan beat ids>]
    trait_basis: <source-bounded Zodiac trait>
    story_point: <exact point the image explains>
    viewer_read: <silent-read meaning>
    visible_subject: <concrete visible subject/object relationship>
    visible_action: <observable action/state change>
    visual_idea: <one concrete drawable image idea>
    concept_fit: <why it belongs to this episode>
    centrality_reason: <why this point deserves visual focus>
    why_visual_not_text: <why image beats short Story Text>
    tone_fit: <how it preserves episode tone>
    payoff_image: <optional later callback/resolution>
engagement_direction:
  entry_hook: <compact first spoken move>
  open_question: <question/tension to carry>
  recognition_cues: [<2–6 concrete recognition cues>]
  reframe_cues: [<1–4 supported reframes>]
  payoff_callback: <ending callback with added meaning>
forbidden_claims:
  - <unsupported motive/cause/consequence/frequency/outcome>
```

## Voice-first authoring contract
For fresh content, `voice-profile.json` is mandatory. It answers **who is telling this, what relationship they have with the subject, how they attack/joke, how affection leaks through, how sentences move, and what drift is forbidden**. `narrative-design.json` maps that voice family onto the supported beat progression.

`rhythm_direction` may remain in the compatibility brief for legacy consumers, but `narrator_vibe` is no longer a required 1–4 adjective contract. If a legacy artifact still carries `narrator_vibe`, treat it as descriptive metadata only and never as a substitute for the Voice Profile.

Fresh 2.6.8+ also compiles `engagement_direction` from validated `engagement-design.json`. The writer sees this compact direction only; the full beat-level pull map stays outside draft context.

Prefer the `source_id + instruction` form so `validate-content-contract.mjs` can prove lineage. Legacy plain strings remain readable only when they textually resolve to the source artifact.

Keep the brief compact. `narrative_visual_direction` is semantic Phase-1 story intent only: it may guide lines that give the selected image a natural anchor, but it must not turn narration into stage directions. Never include raw SRT/reference lines, reference Zodiac claims, full beat objects, `devices`, the full evidence ledger/research, full QC, assets, animation, runtime or package rules. `audience_vibe` is concept-driven, not automatically `student_peer`. All planner vocabulary is internal-only and must be translated into natural viewer-facing Vietnamese.

## Mandatory Zodiac-first brief for fresh v2.4.15+
Include `sign_identity_mechanism`, `misread_vs_reframe`, `three_facets`, `sign_swap_counterfactual`, `scene_usage_limit`, and `non_moral_payoff` from the chosen candidate. three_facets is a compatibility field name for a nonempty list, not an exact count. misread_vs_reframe is recognition context, not mandatory misunderstanding/twist. They are *creative essential context*, not full research or QC. Explicitly instruct the writer to **explain the sign, not narrate a long fictional episode**. Scenes are compact manifestations; no obligatory moral transformation. Distinguish behavioral observation from evidence about individual people.

Fresh >=2.4.47 keeps a nonempty `rhythm_direction` for compatibility. Voice ownership lives in `voice-profile.json`; beat-level delivery ownership lives in `narrative-design.json`. Keep rhythm compact; no fixed gắt baseline, emotional quota, beat inventory or performance tags in narration. Post-write QC adds exact anchors/emphasis to the plan from actual draft text.

Carry compact creative_direction from authored extras unchanged. Viral mechanics may be omitted with an explicit reason in viral-analysis; no filler effect is required. Narrator stance follows the premise/user.
