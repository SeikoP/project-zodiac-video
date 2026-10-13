# Sticker Storytelling Contract — v1.50.1

Build scenes as semantic state progression, not as a list of decorative overlays or camera reframes.

## Production video envelope
Every `production.json` must declare the Studio import envelope at the top level:
```json
"video": {"width":1080,"height":1920,"fps":30}
```
`width` and `height` are fixed at 1080×1920. `fps` must be a positive integer; 30 is the canonical pipeline default. This envelope is creative-package metadata required by Studio import and does not transfer timing ownership away from the runtime.

## Scene rule
Every scene must contain at least one story-changing entity state change. Shot changes, camera movement, environment decoration, glow, particles, zoom or idle bounce do not count as visual progression.

## Event rule
A normal event needs a stable event id, target entity/camera, semantic action, valid `state_before`/`state_after`, and `scene_start` or exact spoken `voice_anchor` phrase. `motion` and `performance` remain optional unless semantics require them.

## Scene Direction
After story action is known, apply `scene-direction.md`. Use shot/focus/placement/continuity to reveal that action clearly. Prefer a meaningful progression such as setup → interaction/detail → reaction/payoff instead of repeating the same centered framing.

Within one logical place, reframe the existing environment before selecting a new environment. `two-person` binds existing participants and must express relationship through blocking/eye direction/shared prop rather than merely showing two bodies.

## Environment staging
Select a current scene-set and explicit scene accents when the narration needs context. Character staging is independent of the outer frame; accents stay inside the wall. Physical furniture is an authored prop, not automatically generated background.

## Meme composition option
For a clearly meme-like beat, test whether one approved macro composition matches the situation and roles. Use at most one macro template per beat; it binds existing cast and compiles into ordinary states/events. Do not turn a micro effect into the main joke.

## Density
Use enough meaningful state changes that narration does not become a static talking head. Runtime validates measured visual gaps after TTS timing. Environment and shot density should support the semantic beat, not become decoration for its own sake.
