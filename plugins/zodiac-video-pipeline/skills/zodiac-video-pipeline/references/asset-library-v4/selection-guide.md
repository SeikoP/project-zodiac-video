# Current asset selection

Use only this library's current registries. Retired IDs fail before authoring;
missing IDs do not trigger a historical example, alias or fallback. Historical
job recovery uses a separately pinned snapshot outside this package.

## Select by responsibility — fresh mode

- Background: select a narration-grounded context component for every scene, authored as a canvas-native Scene Accent behind the actors. A palette/color alone does not satisfy scene background coverage. Reuse context across related scenes when appropriate.
- Shot layout: independent actor composition from `shot-layouts/index.json`.
- Character: native body/hair/shirt identity, persistent across states.
- Prop: a real physically interacted item from `props/index.json`.
- Narrative Visual: the current authoring category for Story Object, thought, metaphor, contrast and meaning; require at least one in each fresh video with a visible, narration-grounded state change. Set `narrative_visual_decision.mode=required`. The runtime transport role remains `story_object`; a phone or character pose alone does not satisfy this layer.
- Scene Accent: independent context SVG (window, menu, notice board, lights). Select at least one visible context component per scene, with `scene_accent=use` coverage where it appears. Its transform uses canvas coordinates and optional actor-relative anchor. It stays behind the actors and must not overlap captions.
- Effect: optional emphasis of action or emotion, not mandatory decoration.

Each beat must explicitly use or omit Scene Accent in fresh Visual Coverage.
Selected Accent assets retain a valid category, scene ownership and visibility lifecycle.
No Scene Set ID, wall containment or view-box positioning is required or allowed for fresh authoring. Historical Scene Set registries remain compatibility-only.

Use `capability-index.json` for supported needs and `coverage-matrix.json` for
coverage. Per beat, select one shot-layout and primary action, then bind actual
entities. Scene Direction owns coordinates; the runner owns measured timing.

## Character identity and hair selection

Fresh Character Assembly is story-first. `hair_id` is not a cosmetic default and must be selected explicitly in the intent-bearing character plan. Derive the hairstyle from character role, psychological tension, performed action and contrast with the visible cast, then record a meaningful `decision_reasons.hair_id`.

The current feminine lead pool intentionally spans bob, lob, waves, long hair, braids, bun, half-up and ponytail silhouettes. Do not repeatedly choose the first long-hair/ponytail option. Co-visible recurring people should use different hair silhouettes. Matching hair is allowed only when the narrative intentionally calls for mirroring/twins/uniformity and every colliding character supplies a meaningful `hair_reuse_reason`.

Hair diversity does not replace body-silhouette diversity. Body + hair + shirt color should create a readable identity stack while face/pose/expression remain consistent with the native style.

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
`lean_tall`/`lanky_slouch` and select a story-appropriate hairstyle from the expanded feminine pool; explicit casting wins.

Accents are sparse context cues with a lifecycle, not a permanent room skin.
Use `initial_state` and `states: {hidden: {visible: false}, visible: {visible: true}}`
with ordinary voice-anchored fade/state events to enter and release them. These
states share the same SVG and canvas transform. A string-lights Accent can be authored for narrated celebrations; never add a birthday to another script.
One native scene may contain multiple story turns. Judge changes of meaning,
actor attention and object relations, not scene count or pose changes alone.

Fresh 2.6.11+ scene-level execution uses the canonical Visual Intent for a
source-fingerprinted scene graph and separate continuity verification. It must
not independently author a derived production/asset plan per scene. Native
compilation and final review remain the existing manifest-owned gate.
