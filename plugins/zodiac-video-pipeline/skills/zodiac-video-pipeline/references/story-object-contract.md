# Hình tượng kể chuyện — canonical authoring contract

A Story Object is a symbolic story-bearing visual, with setup → friction → payoff. It is separate from the continuous scene-set, an optional scene accent, a physical prop and a reaction effect.

Author `kind: story_object`, `visual_role: story_object`, asset category `story_object`, and per-beat `presentation_mode`. The Visual Intent compiler projects those semantics to existing object/interactive_prop/prop transport at the native boundary; existing reviewed object/effect transport remains compatible. No Job@5 or renderer migration is implied.

- `thought_metaphor`: use `near` or `emitted_by` to connect the metaphor to an actor. No floor, surface or physical grip is required.
- `physical_interaction`: require a physical prop with `held_by` or `on_surface` contact. A nearby object alone is not physical interaction.
- `visual_cutaway`: return to an actor scene after the cutaway.

Use Story Object plan @2, genuine narrated anchors, conceptual instance lineage, distinct semantic deltas and a relational payoff. Effects are optional consequences. Validate actual visible states/events; a renamed unchanged state is not progression. Do not use the Story Object as an environment role or background slot.

Native validation verifies structure, progression and lineage only. Report `STRUCTURAL_PASS`, `CREATIVE_REVIEW_REQUIRED`, `RUNTIME_QA_PENDING` separately. Human mute-review judges whether the metaphor reads; the runner owns temporal/media QA. Explicit required/optional/omitted decisions keep their reason and review reference.

## Visual treatment

User-facing name: Hình tượng kể chuyện. `story_object` remains the existing
internal authoring kind; do not rename transport fields or create another schema.
This is a story-bearing visual whose relation/state changes add narrative meaning.
The catalog contains starting geometry, not a closed icon list or a finished
metaphor for every episode.

Keep a simple readable silhouette and add a restrained intrinsic emphasis when
needed: a pivot, a small base, material in a pan, or one meaningful contour.
Preserve a recognizable visual identity through the authored states. Details
must belong to the object; no separate effect asset, floating decoration or
mandatory sparkle/ray/question-mark treatment is introduced. Degree of detail
follows the story idea and native visual review, not a path-count quota.

## Canonical taxonomy and compatibility

New productions use one `story_object` visual role for symbolic and narrative
objects. `story_symbol` is a deprecated legacy alias, not a new type or asset
budget. `presentation_mode` describes thought metaphor, physical interaction
or visual cutaway; it never changes the canonical visual role. Explicitly
distinguish prop (physical interaction) and effect (reaction emphasis).
Do not create duplicate entities for a story object and its symbolic meaning.

Scene Plan must identify the narrative setup, friction and payoff scene/beat
for each story object. Reuse a single conceptual entity with meaningful states
whenever it persists across beats. Rendering may instantiate scene-local
entity lifetimes while retaining conceptual lineage.
