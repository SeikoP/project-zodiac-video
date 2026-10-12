# Current asset selection

Use only this library's current registries. Retired IDs fail before authoring;
missing IDs do not trigger a historical example, alias or fallback. Historical
job recovery uses a separately pinned snapshot outside this package.

## Select by responsibility
- Scene-set: stable wall/floor/frame stage from `scene-set/index.json`.
- Shot layout: actor composition from `shot-layouts/index.json`.
- Character: body, hair, face, outfit, shirt and optional accessory from
  `characters/components/catalog.json`; identity is selected once per actor.
- State: performed pose and expression; plan before SVG generation.
- Prop: explicit narrated physical object from `props/index.json`.
- Story Object: symbolic progression, independently authored per
  `../story-object-contract.md`; not a background or forced physical interaction.
- Effect: selected semantic consequence, subject and enter/release lifecycle.
- Scene accent: optional context detail from `scene-set/accents/index.json`,
  contained by the wall. No automatic room decoration.

Use `capability-index.json` for supported needs and `coverage-matrix.json` for
coverage. Per beat, select one shot-layout and primary action, then bind actual
entities. Scene Direction owns coordinates; the runner owns measured timing.

## Native selection surface
Run `features/asset-selection/build-current-asset-review.mjs <output-directory>`
from the skill root. Optional `--selection <asset-selection.json>` renders only
selected IDs. The surface groups components, stages, props and effects; clicking
a whole card selects it and exports `zodiac-asset-selection@1` JSON. Selection is
not an approval or compiler receipt. Identity review still precedes full scenes.

All comparisons use a stable face/body/outfit canvas, native compiler geometry
or hash-verified SVG bytes. Current hair has no compatibility tier. A useful
retired idea may return only through re-authoring, a new ID and visual review.
Do not transfer visual references between actors.

## Geometry and context
Characters may overlap and extend beyond the outer scene-set; the stage supplies
depth and does not contain the performer. Accents fit the transformed wall.
Scene-set masters own their dimensions; no universal full-safe-height rule.
Preserve face/caption readability and physical contact when the action needs it.

Load core guidance and only selected extension registries via
`selection-policy.json`. Required compiler/validator/review gates remain active.
Do not read migration records, historical episodes or old assets for inspiration.
