# Interaction Choreography Contract

## Goal
A scene with multiple entities should read as one performed exchange, not several stickers moving independently.

Interaction planning is compile-time only. It is compiled into the existing production v2 entity/state/event contract. New packages pin `zodiac-remotion@1.15.0`; the interaction plan itself is not shipped because runtime 1.15 consumes the compiled entities/events plus semantic mechanism contract.

## When interaction planning is required
Create an interaction when a beat includes any of these:
- two or more characters affecting one another;
- transfer/offer/show of a shared prop;
- shared attention to the same screen/note/object;
- approach, avoidance, following, interruption, comfort, confrontation or catching/revealing;
- seating/standing arrangement where distance or orientation carries meaning.

A character merely existing beside another character is not an interaction.

## Choreography model
Use these fields in `.authoring/interaction-plan.json`:
- `participants`: entity IDs taking part;
- `initiator`: who starts the exchange;
- `responders`: who responds;
- `shared_prop`: optional entity ID for a transferred/shared object;
- `ownership.before` / `ownership.after`: required for handoff/transfer;
- `scene_slot`: spatial relationship/slot from `interaction-map.json` when available;
- `anchors`: optional contact/gaze anchor declarations;
- `event_ids`: ordered production event IDs implementing the exchange;
- `intent` and `resolution`.

## Interaction grammar
### handoff / offer / take
1. giver already owns or reaches for prop;
2. receiver notices/reaches;
3. hand/prop anchors meet or visibly overlap;
4. ownership changes;
5. giver releases;
6. receiver settles/reacts.

The prop must not disappear from one hand and appear in another without a transfer phase.

### shared_focus / show
1. initiator presents or reveals target;
2. partner turns/gazes toward it;
3. both attention vectors converge on the same target;
4. reaction is asymmetric when possible.

### comfort
1. approach or offer;
2. receiver registers initiator;
3. contact/prop offer/proximity becomes legible;
4. receiver responds;
5. distance/posture resolves into a new stable relationship.

### confrontation
1. close or block distance;
2. face/gaze converges;
3. initiator gesture lands first;
4. responder recoils, freezes, turns away, pushes back or otherwise answers;
5. scene ends with a changed spatial relation.

### follow / avoid
Leader and follower must preserve an intentional offset. A look-back, stop, direction change or widening distance should make the relationship legible.

### interrupt / reveal_catch
The interruption must steal attention: entry/contact/reveal happens first, then the interrupted character freezes or turns, then the prior action is abandoned or redirected.

## Anchor rules
Character anchor profiles are defined in `interaction-map.json`. Coordinates are master-viewBox hints and should be transformed with the derived character placement. Use `left_hand`, `right_hand`, `face`, `gaze_origin`, `chest`, `feet_center` and `prop_slot` as semantic attachment points.

For contact/handoff, hand/prop anchors should visually overlap or land within roughly 24–40 source-space px after derivation. Exact geometry may be adjusted for pose clarity.

## Spatial rules
Prefer scene-defined slots over arbitrary coordinates. Use left/right seating, threshold, counter, desk, door, window or shared-surface anchors to communicate relationship. Proximity should change when the story changes.

## Timing rules
Do not make initiator and responder perform the same reaction on the same frame unless the beat explicitly calls for synchronized action. The normal pattern is initiative → readable delay → response. A small 2–12 frame response lag is usually enough at 30fps, but narration timing remains authoritative.

## Quality gate
A planned interaction fails when:
- fewer than two interaction members visibly change;
- referenced participants/events do not exist;
- a handoff lacks a shared prop or ownership transition;
- a shared prop never receives an event during transfer;
- the responder has no event after the initiator;
- event ordering contradicts the planned sequence;
- the scene is only simultaneous decorative motion without relational consequence.


## Executable schema parity
`validate-interactions.mjs` reads `interaction-plan.schema.json` and treats its required fields, allowed fields, enum values, array cardinality and uniqueness constraints as authoritative before running choreography semantics. Unknown authoring fields are rejected instead of being silently ignored.

A plan can therefore fail in two layers:
1. **schema shape** — malformed/unknown/missing fields, duplicate members/events, too many participants, empty intent;
2. **choreography semantics** — missing participants/events, invalid scene slots/anchors, broken initiative→response order, incomplete handoff/shared-focus behavior.
