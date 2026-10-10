# Channel visual system and compile

## HARD STYLE LOCK
New production uses `paper-doodle-chibi-meme`, token `zodiac-paper-doodle-meme-v4`, Human Stroke v2. Historical V3 provenance is not an active asset dependency.

## Visual Grammar + Character Assembly
Use `Frame → Mechanic → Character Assembly/Skin → Environment → Scene Direction`.

For ordinary characters choose body silhouette first, then hair, face profile, accessory and outfit identity. Keep those fixed for the entity. State changes only pose/expression. Never fake height/weight by scaling one standard body; native body profiles use authored paths. The character compiler runs before Scene Direction so final asset geometry/viewBox exists before framing.

## Scene direction
Do not center every beat. Use semantic shot/focus/continuity; shot changes never substitute for story progression. Two-person blocking binds existing cast only.

## Environments
Use `bedroom-study-base`, `classroom-study` or `school-hallway` when the story location calls for it. Structural cues remain separate from story props; no monolithic scene background.

## Handmade + contact
Characters, props/effects and structural cues use v4/Human Stroke v2. Native character poses include visible hand contours and a hidden pose-aware prop anchor; grip/contact still follows post-pose semantic anchors and readability contracts.

Invalid: state-level identity swaps, scale-only body variants, legacy direct-copy, full-scene backgrounds, prop wallpaper, repeated centered framing, or camera motion hiding static storytelling.
