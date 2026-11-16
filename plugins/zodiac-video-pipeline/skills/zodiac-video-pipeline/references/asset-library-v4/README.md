# Current native asset library

Style: `zodiac-paper-doodle-meme-v4` + `human-stroke-v2`.
Follow `selection-guide.md` and the current registries. The native selection
surface lives at `features/asset-selection/build-current-asset-review.mjs`.

Authoring order: canvas-native context Accent → shot layout/action → fixed character identity →
planned pose/expression states → explicit props/accents → Scene Direction.
Character geometry is baked per planned state; no post-generation deduplication.
State budget follows performed actions. The native face is fixed, shirts are plain or carry one intrinsic zodiac chest glyph, and shirt colors remain stable. No face variants, accessories or separate effect assets are selectable.

Fresh scenes use independent canvas coordinates. Context Accents stay behind actors
and outside caption areas; they do not constrain actor placement. Scene Set
registries and masters remain available only for explicit compatibility inspection
and pinned historical recovery; they are not fresh authoring choices. Physical props require physical contacts only when
a physical action is authored; Narrative Visuals follow their authored scene relationship without becoming physical props.

Current registry coverage is validated from data, not prose quotas. Historical
masters, room cues, migration guides and compatibility hair are absent. Resume
historical jobs through their separately pinned recovery snapshot. Re-authoring a
useful retired idea requires a new ID and explicit visual review.

Shot layouts/actions, native character/prop compilers, prop masters and meme
semantic templates remain current. No historical finished-character artwork is
an ordinary actor source. `frames/` is a compiler metadata path for shot layouts.

Visual Grammar selects roles; Character Assembly owns character geometry; Scene
Direction owns final placement. Job@5 handoff exports only referenced native
assets. Local runner owns measured timing and final media/render QA.
