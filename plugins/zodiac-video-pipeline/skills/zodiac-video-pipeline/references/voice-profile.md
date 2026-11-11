# Voice profile contract

Voice is a first-class Phase 1 source track. It answers **how the narrator behaves**, never **what factual claims are allowed**.

## Required artifact
Write `.authoring/voice-profile.json` when a user provides one or more voice/style references.

Required fields:
- `format: zodiac-voice-profile@1`
- `reference_present: boolean`
- `narrator_relationship`
- `affection_model`
- `attack_style`
- `language_register`
- `comic_engine[]`
- `contradiction_engine[]`
- `sentence_music[]`
- `emotional_movement[]`
- `internal_voice[]`
- `warmth_rule`
- `forbidden_drift[]`
- `source_refs[]`
- `firewall`

The `firewall` object must state:
- `style_only: true`
- `may_transfer[]`: cadence, narrator stance, rhythm, slang behavior, joke mechanics, emotional reversal, sentence behavior, roughness.
- `must_not_transfer[]`: claims, exact jokes, distinctive phrases, exact sentences, reference-specific situations as facts.

## Source-bound style access
Narration may receive a bounded voice-reference capsule derived from the current user-supplied references. This is different from evidence. The capsule may contain short style observations or brief excerpts needed to judge rhythm, but must not authorize claims.

## Narrator family over adjective lists
Do not compress the source into labels such as `playful`, `sharp`, or `conversational`. Encode the relationship, comic engine, contradiction behavior, sentence music and emotional reversals.

## Default reference family for the current benchmark
The benchmark family is behavior-first, teasing/roasting on the surface, affectionate underneath, conversational Vietnamese, controlled roughness, absurd exaggeration, direct internal voice, and vulnerability that leaks through without turning into therapeutic prose.

## Forbidden drift
A narration is off-voice when it becomes a polished Zodiac explainer with slang painted on top, a therapist, a horoscope encyclopedia, or an inspirational conclusion.
