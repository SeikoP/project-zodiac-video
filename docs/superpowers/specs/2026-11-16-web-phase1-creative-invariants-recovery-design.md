# Web Phase 1 Creative Invariants Recovery Design

## Intent

Repair regressions introduced while splitting Zodiac Web/Local and simplifying Web Phase 1 to creative-first authoring. Keep Web guidance-only and lightweight, but restore editorial rules that prevent narrow scenario dependence, generic plot drift, unsupported motives, weak text-only writing, and accidental copying from style references.

## Goals

- Preserve creative-first Web Phase 1: Evidence → Voice → Concept → Narrative Design → Narration → Content Review.
- Restore broad self-recognition without forcing listicle narration.
- Keep Zodiac identity stronger than plot, setting, moral arc, or delivery tricks.
- Keep evidence-bounded interpretation separate from invented motives.
- Require narration to work both audio-only and as plain text.
- Preserve emergent narrative archetypes such as the Scorpio detective pattern without stating the label for viewers.
- Preserve installed-plugin guidance that is newer than repository main, especially physical-situation design and single-voice TTS editorial review.
- Keep handoff format `zodiac-phase1-handoff@2` unchanged.

## Non-goals

- Do not restore Web runtime bootstrap, npm provisioning, native validators, pipeline state, caches, or performance overlays.
- Do not make Humanizer, Video Lab, or any enhancement mandatory.
- Do not add a new Phase 1 microphase or machine schema.
- Do not force school, workplace, romance, deadline, or any other context into fresh concepts.
- Do not merge or modify main/main 2 as part of implementation.

## Chosen approach

Encode a compact set of editorial invariants directly in the Web entry skill and protect them with bundle regression tests. Reuse the current reference vocabulary conceptually, but do not make those native reference files execution dependencies.

This is preferred over restoring the old canonical runtime because the current Web architecture intentionally removed execution machinery. It is also preferred over inventing a new JSON contract because these are editorial gates, not Local runtime inputs.

## Required editorial behavior

### Concept recognition and identity gate

Before selecting a concept winner:

1. **Behavior core** — describe the behavior without the chosen scenario.
2. **Broad recognition** — a viewer who has never lived the selected scenario can still recognize the behavior in themselves or someone they know.
3. **Multi-context test** — the behavior remains natural in at least three materially different everyday contexts. This is an internal concept test, not a requirement to narrate three examples.
4. **Scenario-dependency test** — if removing the scenario destroys the insight, reject or redesign the premise.
5. **Sign ownership** — the selected sign must remain meaningfully different under a sign-swap counterfactual.
6. **Scene dominance / moral drift** — reject stories where the plot, setting, redemption arc, friendship lesson, or generic moral becomes the real subject.

### Evidence and motive boundary

Show observable behavior first. Interpret within the evidence boundary. Do not state an invented inner cause, motive, outcome, diagnosis, statistic, or universal claim as fact. Style references may supply delivery mechanics only, never Zodiac claims, reference situations, exact jokes, distinctive phrasing, or unsupported motives/outcomes.

### Engagement and progression

Recognition is not progression. Repeated examples with the same semantic job must not substitute for a new action, decision, consequence, question, contrast, reframe, callback, or payoff. Apply this across the whole script, while keeping the existing stronger second-half rhythm floor.

### Narrative archetypes

Use behavior first, label second. When a story naturally behaves like a detective case, interrogation, mock documentary, chat reconstruction, or another emergent mode, keep the viewer-facing role label implicit so comments can supply the inference. Do not permanently map one sign to one mode.

### Dual editorial read

Before Content Review:

- **Audio-only pass:** a listener must follow speaker, action, time, cause/consequence, pronouns, spoken numbers/foreign words, and ending without seeing punctuation or the screen.
- **Silent-read pass:** the written narration must retain premise clarity, recognition, progression, reframe, payoff, ending energy, and sign specificity without imagined TTS, music, captions, motion, or editing.

## Source synchronization

Repository main currently lacks two guidance blocks present in the installed Web skill: physical situations in Narrative Design and the single-voice TTS editorial review. The repository skill becomes canonical by incorporating those blocks together with the recovered invariants.

## Compatibility

- No handoff schema bump.
- No Local Phase 2/3 migration.
- Patch version bump only.
- Existing approved handoffs remain valid.
