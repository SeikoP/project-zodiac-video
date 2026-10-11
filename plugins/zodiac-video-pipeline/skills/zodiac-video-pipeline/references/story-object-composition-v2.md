# Story Object Composition v2 — visual identity over wallpaper

This is an authoring/QC enhancement within Phase 02, **not** a Story Shape, renderer feature, fourth phase or new Job@5 field. The Libra scale on warm paper is the acceptance reference: **the scale visibly models both directions of thinking while the chibi character reacts**. Do not replace the scene with a large scale illustration, or turn the scale into the environment's `rear` or `background` entity. Blank paper is an intentional minimal environment when the idea needs no literal room.

## Editorial separation

1. **Story Object:** What thought, contradiction or action is being communicated? It remains a native V4 prop/entity with consistent identity and real state/events.
2. **Character:** Who feels or acts on that thought? Keep readable facial acting and a distinct silhouette when the metaphor is on screen, unless deliberately making an insert cutaway.
3. **Environment:** Where does it happen? Build location cues only when supported by Narration; `minimal` is the correct environment for symbolic/thought space. Do not draw or choose scenery simply to fill negative space.
4. **Effect:** Only a semantic consequence of story object or character. Do not substitute generic punctuation or rays for the metaphor.

## Supported presentation modes (per beat in `.authoring/story-object-plan.json`)

Add `presentation_mode` to **each** beat. These authoring-only modes do NOT appear in Job@5; the output is existing native entities, transforms, bindings and event motions.

- `thought_metaphor`: object floats/appears in readable relationship to a visible actor (`near` or `emitted_by`). This is an interpretation of a thought, not a material fixture. The paper-only Libra scale uses this. No physical table, wall, bedroom, or hand contact should be invented.
- `physical_interaction`: real story prop physically relates to an actor or surface through a valid authored binding: `held_by`, `on_surface`, `near`, `points_to`. The scene environment may stay intact, with front/rear depth and correct occlusion.
- `visual_cutaway`: a short authored insert or reframe that permits large object focus. Set `cutaway_return_scene_id` to a **later** existing scene containing a visible character; this prevents the insert from taking over the rest of the story. Do not invent a new environment location for the cutaway.

A metaphor can switch presentation modes across beats if the semantic narrative justifies it. No mandate to use all modes or to multiply SVG assets. Maintain the same `object_entity` idea, event lifecycle, and real voice anchors across setup → friction → payoff.

## Example: Libra

- setup, `thought_metaphor`: character centered; one recognizable small-to-medium balance scale above, paper-only background; it tilts left as one point of view is spoken.
- friction, `thought_metaphor`: same scale tilts right; small opposing marks attach to the relevant dish or thought side, not the entire frame.
- payoff, `thought_metaphor`: scale aligns/transforms in a meaningful callback while the character's facial expression resolves. Preserve caption space.

## Automated gates

`node orchestration/validate-story-object-composition.mjs <workspace> --write` checks each beat mode, backdrop role/slot misuse, actual visible native transforms, severe object-vs-character occlusion, excessive object footprint outside cutaways, mode-specific authored spatial links, and a later cast reentry for cutaways.

The check executes after Story Object v1 in the Phase-02 Director Review **before** native previews and again at the beginning of Phase 03 **before** staging ZIP. It does not certify artistic meaning, animation timing or real MP4 parity. Native preview pairs and human Visual Review must explicitly verify with audio muted: recognizability of the sign, two contrary visual ideas when appropriate, emotion readable, environment not falsely substituted, and escalation callback.

To avoid breaking older reviewed jobs, the strict presentation-mode requirement is enabled for **fresh 2.4.11+** runs. Older packages remain legacy unless they opt into per-beat mode; malformed modes and explicit backdrop takeover are still blocked when supplied. Source plan is already included in existing Phase-03 review lock.

## Runtime boundary

Do not add `presentation_mode`, scene role enum, or an automatic layout algorithm to renderer@2.0.1. Author as normal V4 prop/effect + `spatial_bindings` + scene transform/event; compile and test the actual native preview. If dynamic animation is not in the current supported motion registry, re-author into supported existing state motions, never claim unsupported renderer behavior.

## Scoped episodes
Narrative 2.1 may keep one central metaphor. Retain `central_metaphor.sign_contradiction` as the shared authored tension for @2 compatibility; `episode-cast-plan.bindings[].story_relation` states how each selected member changes its meaning. Do not copy one generic relation to every member. Recover only scene-local bindings/lenses through derive-scene-context; scope edits invalidate the review lock.

## Explicit intent decision
Visual intent records required, optional or omitted with reason and review_ref. Omitted returns OMITTED_EXPLICIT, not creative PASS; required flags cannot be disabled implicitly. A situation prop may carry the metaphor through changed shape, relation or consequence. Repeated reveal of the same object is insufficient. Effects are optional in v2, motion alone is not metaphor progression. Human mute-review remains required.
