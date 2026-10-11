# Zodiac Visual Grammar Library v4

Canonical new-production style: `zodiac-paper-doodle-meme-v4` + `human-stroke-v2`.

Authoring order (fresh):
`Scene-set → shot-layout (legacy path: Frame Skeleton) → primary Mechanic → Character Assembly / Skin Binding → optional selected cues/scene accents → Scene Direction`.

`scene-set/` is the primary visual framework. `frames/` is retained as the compatibility path for shot/layout skeletons, not the background frame.

## Native Character Assembly
Ordinary characters are not selected as one finished SVG. Visual Compile writes `.authoring/character-assembly-plan.json`; identity is `body_profile + hair_id + face_profile_id + outfit_id + shirt_color_id + accessory_id`, while state is `pose_id + expression_id` plus optional compile-time `crop_id`. Face profiles, accessories and shirt colors stay fixed across states. Semantic Assets creates `.authoring/character-state-asset-plan.json` first, checks a default limit of three unique state assets per character, then compiles one package-owned SVG per planned key before Scene Direction.

Native component coverage: 6 body profiles, 10 hair families, 4 face profiles, 2 accessories, 12 Zodiac + 5 generic outfits, 9 expressions and 19 poses. Study actions include writing, reading, carrying a backpack and texting. Body variation is authored geometry, not `scale()` distortion. Hand contours and a hidden pose-aware `prop_slot` preserve readable contact. Cry expressions include eye-rooted tears; reaction crops remain compile-time SVG viewBoxes. The local runner switches complete SVG assets; it does not rig-animate limbs inside SVGs. Never compare finished SVG bytes to merge assets.

## Meme adapters
`memes/templates/index.json` owns all 11 promoted semantic template contracts; `memes/index.json` maps them into V4 frame/mechanic bindings, existing-entity roles, layout boxes, contact semantics and native acting requirements. Old reference SVG artwork is not part of the production library. The selected adapter's pose/expression/crop requirements must appear in the character assembly plan, and Scene Direction consumes its role boxes.

## Scene-set and environment extensions
`scene-set/` owns the stable wall/floor/frame stage. Characters may overlap in front. Context accents stay inside the authored wall region. Old room profiles and structural cues are selected-cue/compatibility extensions, never automatic fresh defaults.

## Environment composition
`scene-set/` is the fresh primary visual scaffold. `environments/composition-index.json` remains an explicit selected-cue/legacy registry for bedroom, classroom and other location cues; those cues never auto-appear behind a primary scene-set. Structural cues and story props stay separate. `props/index.json` registers physical props and `characters/accessories/index.json` registers identity accessories.

## Geometry ownership
Visual Grammar chooses semantic roles. Character Assembly owns baked character geometry. Environment chooses depth roles. Scene Direction owns final x/y/width/height. Runtime never randomizes these choices.

Authoring-only meme metadata is removed at handoff. Handoff exports `zodiac-job@5` for `zodiac-renderer@2.0.0`.


## Scene-set first taxonomy — 2.4.60 source
Fresh authoring separates the persistent `scene-set/` visual scaffold from `shot-layouts/` actor composition. Room/window/furniture profiles are selected-cue or compatibility material, not fresh defaults. `frames/` remains a compatibility path only.
