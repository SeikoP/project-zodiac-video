# Current asset selection

Use only this library's current registries. Retired IDs fail before authoring;
missing IDs do not trigger a historical example, alias or fallback. Historical
job recovery uses a separately pinned snapshot outside this package.

## Select by responsibility
- Scene-set: supporting rear picture/frame from `scene-set/index.json`; never an actor stage or physical support.
- Shot layout: actor composition from `shot-layouts/index.json`.
- Character: body, hair and shirt color from
  `characters/components/catalog.json`; identity is selected once per actor.
- State: performed pose and expression; plan before SVG generation.
- Prop: explicit narrated physical object from `props/index.json`.
- Story Object: symbolic progression, independently authored per
  `../story-object-contract.md`; not a background or forced physical interaction.
- Scene accent: optional context detail from `scene-set/accents/index.json`,
  contained by the wall. No automatic room decoration.

For each scene-set, explicitly select `scene_accents` or record a non-empty
`scene_accent_omission_reason` in the scene environment. An empty list alone is
not a reviewed choice and fails the native art-direction gate. Prefer one or
two context cues supported by the narration, such as a cafe window/menu.
Registry accent defaults with `placement_space: scene_set_view_box` follow the
selected backdrop transform. An authored `transform` is in canvas coordinates
and must fit the transformed wall; invalid overrides fail without auto-fitting.
Foreground actor slots, physical contacts and captions remain independent.

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
The scene-set is a supporting picture/wall behind the action. Foreground
characters own their composition and support cues independently of that artwork. Accents fit the transformed wall.
Scene-set masters own their dimensions; no universal full-safe-height rule.
Preserve face/caption readability and physical contact when the action needs it.

Load core guidance and only selected extension registries via
`selection-policy.json`. Required compiler/validator/review gates remain active.
Do not read migration records, historical episodes or old assets for inspiration.

Current selection has no face-profile, accessory or effect group. Shirts are plain; expressions and actor motion remain native acting.
