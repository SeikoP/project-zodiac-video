# Story text in Phase 2

Plan lettering with action, props and Narrative Visuals. Every fresh beat explicitly declares `layers.story_text=use/omit` with its editorial reason. Missing entities are not an omission decision. At reversals, accusations, demos and callbacks, decide what the viewer reads before/after the turn; leave quiet reflection quiet.

Author `kind: object`, `visual_role: overlay`, `category: overlay` SVGs, with `story_text: {purpose, reason, states: {state_id: text}, styles: {state_id: treatment}}` in Visual Intent only. Purposes: setup, contrast, payoff, annotation, dialogue, internal_voice. This layer never substitutes for props, Scene Accent or Narrative Visual.

Start hidden. Reveal/change/release at exact voice anchors; a final hold needs `hold_to_scene_end_reason`. Replace text rather than accumulate it. Never reveal a punchline early. Coverage selects actual text entities; different phrases or treatments require distinct asset paths.

## Treatments

| Style | Editorial use |
| --- | --- |
| bubble | Short spoken reply, tail toward speaker |
| thought | Private thought, trailing thought dots |
| burst | Surprise or emphatic reaction; WOW, UA or HA only when grounded |
| whisper | Quiet aside, light dashed contour |
| tag | Small annotation next to its object |
| ribbon | Brief announcement or product reveal |
| underline | Handwritten emphasis without a card |
| sfx | Narration-grounded sound word with action strokes |
| note | Crooked paper, tape and ochre marker; default |
| stamp | Coral rejection or completion verdict |
| score | Label plus numeric payoff |
| title | Setup line plus larger emphasis |

Compact styles normally use 1-4 words at 260-420 canvas pixels wide. Keep readable on a phone; shorten rather than shrink long prose. Place beside its speaker/object, away from faces, Narrative Visuals and lower captions. Keep one focal text at a time. Choose by meaning, not a quota or fixed rotation; vary phrases as well as shape.

Bake outlined Patrick Hand with `python tools/preview/bake-story-text.py <workspace> --intent <candidate.json>` before the owning writer (authoring-time fontTools required), or provide equivalent safe path SVGs. Keep canonical palette, accessible SVG titles and no runtime font dependency.

Run completeness, native style/geometry/caption and event-pair checks. Inspect scene entry, each reveal/release and final frames at phone size in browser screenshots. Structural PASS never approves creative quality, final glyphs or audio-aligned timing.
