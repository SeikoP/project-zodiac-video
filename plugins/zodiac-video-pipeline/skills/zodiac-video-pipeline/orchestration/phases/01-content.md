# Phase 1 — Creative Content

Phase 1 is deliberately split into small creative units:

**Evidence → Voice → Concept → Narrative Design → Narration → Content Review**

The purpose of the split is to improve creative focus, not to add more machinery.

## Web execution model

On ChatGPT Web, Phase 1 is a **creative-host workflow**. Do not bootstrap a phase-scoped source bundle, install npm dependencies, run native compilers, generate validator receipts, maintain caches, benchmark performance, or block authoring on pipeline-state.

Those concerns belong to Local/native production, not to writing.

## Microphase behavior

### Evidence

Research enough to understand the sign's distinctive mechanism and useful tensions. Stop when the interpretation is independently supported and creatively actionable. Evidence is a foundation, not a content outline.

### Voice

Decide how this narrator thinks and speaks before drafting. Capture sharpness, restraint, sentence shape, rhythm, humor behavior and forbidden habits. User-supplied SRT/text references are style sources, not content to copy.

### Concept

Generate multiple premises with meaningfully different story engines. Reject concepts that still work unchanged after swapping the zodiac sign. Select the strongest valid concept automatically unless the user asks to choose.

Novelty and emotional tension are more important than satisfying a fixed template.

### Narrative Design

Build one coherent Story Spine with:
- a hook that creates immediate tension or recognition;
- escalation rather than repeated trait listing;
- at least one reframe/reveal;
- a payoff that changes how the opening is understood;
- optional narrative-visual direction only when a concrete image is central to the story.

Do not pre-design Phase-2 scenes or assets.

### Narration

Draft from the selected concept, Story Spine and Voice Profile. Optimize for:
- specificity;
- spoken naturalness;
- contrast and surprise;
- semantic progression;
- recognizable zodiac identity;
- a finish that lands rather than fades.

Do not write to pass a validator. Editorial review happens after a real draft exists.

There is no fixed fictional-ad requirement and no fixed duration band unless the current brief requires one.

## Content Review

This is the only required human approval boundary. Present the exact final narration and a compact concept/voice summary. Explicit user approval completes Phase 1.

After approval, package the approved bytes into `zodiac-phase1-handoff@2`. Web does not create or activate native pipeline state. Local reconstructs the native boundary state from the approved capsule.
