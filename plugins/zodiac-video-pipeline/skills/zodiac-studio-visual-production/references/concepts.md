# Concepts and data model

## Canonical source
`.authoring/visual-intent.json` (`zodiac-visual-intent@1`) is the single source. Projections (production, character assembly, grammar, scene plans) are compiler-owned; never hand-edit them. Correct the source once, then recompile. Video is 1080×1920 at 30 fps. The story field is 1080×1400; the caption lane starts at y=1470 (`layout_contract.caption_safe_zone`).

## Entity kinds and visual roles
| kind | visual_role | meaning |
| --- | --- | --- |
| `character` | `character` | a cast member, assembled from body + hair + outfit + shirt; states are pose/expression |
| `object` | `interactive_prop` | an ordinary handled prop from the library (phone, notebook, cup) |
| `story_visual` | `story_visual` | one drawn explanation of a story fact (Hình kể chuyện) |
| `scene_accent` | `background` | a rear context cue showing the narrated place; not a prop, not a backdrop |
| `object` | `background` (id `depth__*`) | legacy name for set dressing in an ordinary prop; a Scene Accent is preferred |

Grammar slot names (`speaker`, `listener`, `subject`, `focus_prop`) are not visual roles.

## States, events, anchors
- An entity has named `states`, each `{asset, visible, layer, transform{x,y,width,height}}`, and an `initial_state`. An **event** moves one target between two of its states: `{id, target, state_before, state_after, action, trigger, motion}`. `state_before` must equal the target's current state in time order.
- A **voice anchor** is an exact substring of the scene's narration; the event fires on the measured time of that word. Never paraphrase an anchor. A repeated word needs an occurrence index.
- `action` is a short Vietnamese phrase for what the target visibly does. A scene with no authored action fails the character-action check.
- Motion changes pose by a hard cut (`state_swap`), or plays an acting move (`lean`, `recoil`, `pull-with-prop`, `enter`) with `state_before == state_after`. At most one acting event per target at a time; the next one cannot start before the previous ends.

## Layers
Lower layer paints first. Convention: dressing/scene accent behind (about 10), characters 20, handled props 30, story visuals 40. Captions and the brand overlay are runtime-owned above everything.

## Grammar
A scene's `grammar` is an object `{frame_id, mechanic_id, bindings}`, never prose. A **frame** (shot layout) defines slots (`subject`, `speaker`, `listener`, `focus_prop`…) with required kinds; a **mechanic** (`explain`, `react`, `confront`, `show-object`, `reveal`, `payoff`…) requires capabilities (`actor`, `target`, `focus_prop`, `payoff_subject`…) the frame must provide through *filled* slots. Pick them together: a mechanic that needs two characters cannot sit in a one-character frame.

## Experience profile (authoring-only)
`experience_profile.story_mode` is one of behavior, relationship, exposition, transition, reflection, payoff, symbolic. It never reaches production. See `scene.md`.

## Coverage
Fresh Visual Intent carries per-beat `visual_coverage` in `art_direction`: for actor, scene accent, story visual, ordinary prop, support and caption (and meme) each beat records either real entity/event references or an explicit omission with a reason.
