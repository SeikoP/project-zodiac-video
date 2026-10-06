# Sticker storytelling for Visual Compile

A scene is performed visual storytelling, not static art under captions. Characters, props and scene modules enact the narration.

Consume the approved narrative plan as **intent**, not as layout instructions. For Conversational delivery, micro-scenes, narrator reactions and contradiction beats should become visible action/reaction changes where possible. When a narrative beat carries `interaction_id`, compile it into the Interaction Choreography plan instead of reducing it to independent character poses.

## Semantic-state principle
If narration implies a visible action/state, the visual must show that state even when the base library only provides a neutral/default asset. Derive from the nearest master rather than forcing the story to fit the source SVG. Recipes are shortcuts, not limits.

Never solve missing states by expanding the reusable library into `open/closed/held/revealed/...` files. Masters provide anatomy; package assets provide momentary story states.

Examples such as opening a container, taking an item out, changing a screen, folding/unfolding, switching a light, turning a page, moving an object, changing pose or expression are generic classes of behavior, not a closed feature list.

## Mechanism-first animation
When viewers should perceive the mechanism changing, use the semantic anatomy groups:
- derive the state needed by the beat;
- extract moving group(s) as package child entities;
- animate those child entities with the canonical event/state motion system;
- keep static structure in the parent entity.

This applies to props, characters and scenes. Do not count a whole-asset crossfade as a mechanism animation when a flap, lid, arm, door, curtain, page or other part should visibly move.

## Visual Progression Proxy
Before TTS/timing exists, normalize `scene.voice` to words and place meaningful non-camera state-changing events across the whole narration. Maximum gap: 15 normalized words start→first, between moments, and last→end. Camera-only moves, same-state events, random bounce, particles, glow and repeated zoom do not count.

After measured timing, authoritative gap is max 5.0 seconds.

## Event contract
Every event has target, action, before/after state, scene_start or exact voice_anchor, declared motion/duration, and optional SFX. Select anchors across opening, development, turn and payoff. Prefer semantically distinct state changes over repeated decorative motion.

## Caption-free test
Without captions, the viewer should still understand who reacts, what object/scene changes, what information is revealed and where the payoff lands. If the beat requires an asset state not yet in the library, derive it instead of weakening the beat.
