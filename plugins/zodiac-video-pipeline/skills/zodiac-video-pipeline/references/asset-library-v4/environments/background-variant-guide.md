# Deterministic composition variants

For each location use reusable structural cues in `composition-index.json` and combine with shot variants already supported by `compile-environment.mjs` (`medium-character`, `two-person`, `reaction-closeup`, `prop-insert`, `caption-led`, `wide-environment`). A variant is a camera/subject/staging decision, **not** a new full-room SVG. Maintain consistent room identity between adjacent shots; use semantic focus props and density only where needed.

- bedroom: desk-side, bed-side, window-side, phone insert
- classroom: front-row, board-facing, two-desk, exam closeup
- hallway: lockers-side, pass-by, conversation, rush
- living room: sofa-left, sofa-two-shot, window-side
- kitchen: counter-front, side reaction, busy hands
- doorway: arrival, departure, forgot-item insert
- cafe: two-person table, window waiting, phone insert
- street: walk-and-talk, corner pause, passing encounter
- library: shelf-side, book insert, paired study
- schoolyard: break, conversation, return-to-class

**Important:** `zodiac-renderer@2.0.1` reads only baked ordinary entities. Never transfer these variant labels as unsupported runtime fields. Existing Environment Compile uses predeclared transforms and shot types. Do not pretend it supports freeform camera positioning; add geometry support to the compiler and validate output before promising new layouts.

## Single simple background style across profiles

All V4 micro-environment structural cues share the same **simple, lightly filled paper-doodle** drawing language, regardless of location:
- classroom and library should both use restrained flat palette fills alongside handmade contours;
- a structural desk/shelf/window is not a different line-art-only visual system when placed in a different room;
- keep the existing cue count, environment density, profiles, placements, and caption-safe geometry unchanged unless the narration itself requires a change;
- do not modify character, story prop, effects, event semantics, or shot direction in order to "fix" a background style mismatch;
- reuse the same palette and stroke widths (typically 6–8 source units) and controlled path wobble. No gradient, new ornamental objects, or total full-room illustration.

When unifying an existing set, edit only mismatched structural SVGs, rerun the environment binder + visual validators and the exact-asset native preview, and confirm all non-environment files/scene events/geometry stay identical.
