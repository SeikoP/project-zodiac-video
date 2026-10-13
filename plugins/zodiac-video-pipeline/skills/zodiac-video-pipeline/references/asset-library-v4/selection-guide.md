# Current asset selection

Use only this library's current registries. Retired IDs fail before authoring;
missing IDs do not trigger a historical example, alias or fallback. Historical
job recovery uses a separately pinned snapshot outside this package.

## Select by responsibility — fresh mode

- Background: a simple color/gradient/optional pattern; never a Scene Set wall.
- Shot layout: independent actor composition from `shot-layouts/index.json`.
- Character: native body/hair/shirt identity, persistent across states.
- Prop: a real physically interacted item from `props/index.json`.
- Narrative Visual: one authoring category for thought, metaphor, contrast and meaning; optional states and actor/group/canvas anchors.
- Scene Accent: optional independent context SVG (window, menu, notice board, lights). Its transform uses canvas coordinates and optional actor-relative anchor. It stays behind the actors and must not overlap captions.
- Effect: optional emphasis of action or emotion, not mandatory decoration.

Each beat must explicitly use or omit Scene Accent in fresh Visual Coverage.
Selected Accent assets retain a valid category, scene ownership and visibility lifecycle.
No Scene Set ID, wall containment or view-box positioning is required or allowed for fresh authoring. Historical Scene Set registries remain compatibility-only.

Use `capability-index.json` for supported needs and `coverage-matrix.json` for
coverage. Per beat, select one shot-layout and primary action, then bind actual
entities. Scene Direction owns coordinates; the runner owns measured timing.

## Native selection surface
Run `features/asset-selection/build-current-asset-review.mjs <output-directory>`
from the skill root. Optional `--selection <asset-selection.json>` renders only
selected IDs. The surface groups components, backdrops and props; clicking
a whole card selects it and exports `zodiac-asset-selection@1` JSON. Selection is
not an approval or compiler receipt. Identity review still precedes full scenes.

All comparisons use a stable face/body/outfit canvas, native compiler geometry
or hash-verified SVG bytes. Current hair has no compatibility tier. A useful
retired idea may return only through re-authoring, a new ID and visual review.
Do not transfer visual references between actors.

## Geometry and context

Characters are placed independently on canvas. Accents supplement spatial context without constraining cast positions; they remain behind action and must be caption-safe. Narrative Visuals are positioned for readability and do not inherit physical prop contact requirements.

Load core guidance and only selected extension registries via
`selection-policy.json`. Required compiler/validator/review gates remain active.
Do not read migration records, historical episodes or old assets for inspiration.

Current native casting does not expose alternate face/accessory components by default; effects may be selected intentionally.
Expressions and actor motion remain native acting. `zodiac-glyph-shirt` preserves one
intrinsic chest icon selected by `zodiac_sign_id`, with no surrounding decoration.
Keep unknown supporting signs unassigned. Prefer feminine lead presentation,
`lean_tall`/`lanky_slouch` and suitable long/ponytail hair; explicit casting wins.

Accents are sparse context cues with a lifecycle, not a permanent room skin.
Use `initial_state` and `states: {hidden: {visible: false}, visible: {visible: true}}`
with ordinary voice-anchored fade/state events to enter and release them. These
states share the same SVG and canvas transform. A string-lights Accent can be authored for narrated celebrations; never add a birthday to another script.
One native scene may contain multiple story turns. Judge changes of meaning,
actor attention and object relations, not scene count or pose changes alone.
