# Phase 1 Voice-First Rewrite Design

## Intent
Rewrite Zodiac Phase 1 so reference voice is a first-class source, not a compressed side effect of reference mechanics. Keep the Phase 2 boundary compatible with `zodiac-phase1-handoff@1`.

## Goals
- Separate Evidence, Voice, Concept, Narrative Design, Narration, Semantic Review, Voice Review, Story Review.
- Permit bounded style-reference access during narration while prohibiting reference claims, exact jokes, distinctive phrases and situations from becoming evidence.
- Make voice fidelity a blocking editorial gate.
- Make Humanizer and other enhancement plugins optional, surgical fallbacks.
- Remove duplicated quality ownership and keep deterministic validators separate from editorial review.
- Preserve the existing Phase 1 handoff contract consumed by Phase 2.

## Non-goals
- Rewrite Phase 2/3.
- Copy source transcript wording.
- Keep internal Phase 1 artifacts backward compatible.
- Require optional content-enhancement plugins on the critical path.

## Core contracts
`voice-profile.json` captures narrator relationship, affection model, attack style, register, comic engine, contradiction engine, sentence music, emotional movement, warmth rule, internal voice, forbidden drift, and style-only source provenance.

`narrative-design.json` maps each beat to purpose, evidence refs, voice devices and rhythm. It must not flatten evidence and voice into prose instructions.

`voice-fidelity-review.json` is an editorial artifact with decision PASS/REVIEW and dimensions for narrator relationship, spoken naturalness, roughness preservation, comic aggression, behavior-before-analysis, contradiction energy, internal voice, sentence music, warmth leakage, generic-AI distance and same-narrator plausibility.

## Dependency policy
Core-first, plugin-optional. A plugin/tool remains required only when a regression test demonstrates material quality or correctness impact that the core cannot provide. Otherwise it becomes optional or is removed.

## Compatibility
The Phase 1 exporter continues producing `zodiac-phase1-handoff@1`. New internal artifacts may be included, but Phase 2 must not require them in this rewrite.
