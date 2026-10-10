# Environment Composition Contract — v1.53

## Goal
Make sticker-story scenes feel inhabited and grounded without putting a character on top of a reusable full-scene background. Environment is scene composition, not a new image family.

## Modes
- `micro_environment` — default ordinary narrative scene; contextual props + structural cues across rear/subject/front depth.
- `minimal` — sparse support for close-up, meme macro, strong single-prop beat or intentionally empty frame.
- `none` — only when empty space is part of the visual idea.

## Canonical micro-environments
Visual Grammar v4 uses `environments/composition-index.json` for these supported locations:

- `bedroom-study-base` for private reactions, late-night study and overthinking;
- `classroom-study` for lessons, homework, exams and classmate interactions;
- `school-hallway` for arrivals, passing periods and corridor encounters.

For a bedroom, use `bedroom-study-base`:
- `clean` — default narration/explanation: rear window/curtain + bed/desk grounding, no foreground clutter.
- `cozy-depth` — emotional/overthinking: optional pillow/blanket foreground, subject occlusion ≤18%.
- `meme-payoff` — payoff only: background emphasis ≤0.60, at most one foreground cue and one meme accent.

Story props follow narration meaning. Choose a phone, notebook, book, water bottle, tissue box, headset, mirror, backpack or pen from `asset-library-v4/props/index.json` when it carries the beat.

## Scene Direction continuity integration
`continue`, `reframe`, `insert` normally retain the logical environment; `location_change` is a real place/context shift; `payoff_break` may simplify/de-emphasize the environment without inventing a new location. Use shot/focus/foreground changes for visual variety inside one room before changing location.

## Ownership
Visual Compile owns environment mode/profile/modifier, semantic prop roles, caption-open zone and foreground intent, but no exact coordinates. Semantic Assets owns v4 structural cue resolution, rear → subject → front layers, grounding/contact geometry, foreground occlusion and lineage. Runtime receives ordinary scene entities and does not generate/randomize/auto-place environments.

## Micro-environment quality gate
A normal micro-environment requires semantically useful props/cues, rear/front depth where permitted, grounding/contact, explicit layers for meaningful overlaps, safe foreground occlusion, decorative-only props within policy, usable caption-open space, and caption-free readability.

## Structural cues
Small reusable v4 cues include bedroom window/curtain and bed/desk edges, classroom whiteboard/window and desk edges, and hallway lockers/floor edge. They are separate assets, never a full-scene canvas, and obey Human Stroke v2.

## Density + two-character rule
Prefer coherent clusters over evenly distributed decoration. Environment never creates an additional character; relational beats bind existing cast and may use separate grounding cues plus a shared central prop.

## Forbidden
- full-canvas/reusable scene illustration or raster/generated background image;
- scene module used as one background asset;
- environment changes solely for shot variety;
- prop wallpaper with no story relationship;
- foreground object hiding face/key gesture/story-critical prop;
- exact layout coordinates authored in Visual Compile;
- runtime randomness for environment placement.
