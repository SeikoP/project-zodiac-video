# Story Visual (Hình kể chuyện)

A Story Visual makes **one story fact visible: who does what, what changes, what that means**. It may be an illustration, outlined lettering, or both inside the same entity, state and SVG. It is an explanation, not an image attached because the narration mentions an emotion.

## Decide first
Read the exact narration beat, the brief's plan for it (and any Phase 1 direction as evidence only), then write the intended viewer read in plain words. Someone who has not seen the episode, muted, must name the participants, follow the change and state the consequence. **Removal test:** if removing it loses no important fact, omit it and say why. A lamp establishes a setting, a slumped pose shows fatigue, captions transcribe speech; none of them supplies a causal explanation. There is no per-scene quota and quiet scenes need none, but the **episode** must not be a row of talking characters: the brief (`brief.md`) plans, from one read of the whole script, which scenes state a countable, comparable or written fact and gives each a picture; `none` everywhere needs a reason that holds for every scene.

Examples of what counts: task cards that start in two named columns and collect on one side while the other ends at a large 0; a first offer, a refusal, another attempt, then the hand withdrawing, with the count revealed only at the third; a bag that changes hands while its label changes from "ĐỂ TÔI!" to "ĐƯỢC XÁCH!". A floating meter, an unlabeled battery, a glyph or one abstract word does not identify the relationship.

## Input and execution
Phase 1 records `story_visuals[]` plus an explicit `story_visual_decision` (`required`, or `omitted` with a reason). Each direction has `id`, `beat_ids`, `story_point`, `viewer_read`, `visible_subject`, `visible_action`, `visual_idea`, `contribution` (what is lost without it) and optional exact `lettering[]`. Missing input is a blocker for the owner, never something to invent. Phase 2 does not pick a Story Visual from a catalog; it authors one scene-specific drawing per state.

Phase 2 then:
1. binds `phase1_visual_id` and exact narration anchors in `art_direction.narrative_brief`, with drawable before / change / after states;
2. authors one `story_visual` entity with one SVG per state and the matching asset category; any words are baked into that SVG's paths, never a separate text overlay or coverage lane;
3. makes identity, ownership and direction explicit in the picture, with short words large enough at phone size; hides future outcomes until their exact anchor and removes the visual when its job ends;
4. declares `layers.story_visual` use or omit, names its entities and events, and passes provenance, completeness, presence, event/state and preview checks.

## Layout and review
The Story Visual sits in its own band above the actors; actors, props and accents never overlap it. In review inspect every transition and the final frame at phone size, muted, without the brief: count and reveal timing, clipping, faces, handoffs, caption space. A machine PASS checks structure and does not prove the picture communicates. Changing the story meaning or necessary wording reopens Phase 1; drawing, geometry and treatment stay Phase 2.

Story Visual art in Studio is **Core-rendered** from a small structured spec (templates such as `story_text`, `chat_compare`); the agent never emits raw SVG, HTML, scripts or URLs.

## What the Ma Kết package did with it (use the same thinking)
Ma Kết's three Story Visuals were not pictures placed in a scene; each one **was the scene's argument and it changed over time**: a workload board whose items moved from one side to the other until the partner's column read 0; three numbered offer/refuse frames that ended on a withdrawn hand; a tag on the very bag being handed over that changed from ĐỂ TÔI! to ĐƯỢC XÁCH!. In each, the actors changed state on the same voice anchors as the picture (weary → concerned while the offers were refused; accept while the tag changed), and a prop took part (the bag slipped, was retained, was accepted). So in Studio:
- Reveal the Story Visual on the beat it explains, not at the top of the scene (Core uses the beat's own words).
- Put a character acting event on the SAME anchor as the reveal and one more where the story turns, so the actors react to what the picture shows.
- A prop belongs in the scene only if the narration handles it and one of your events acts on it; otherwise leave it out. Everything on screen either reveals, reacts to, or is acted on by the story beat.

## Studio graphics: your own pictures (only the script is fixed)
The owner approves the narration. Every picture decision after that is Studio's to invent, so Studio does not wait for a Phase 1 direction to draw a picture. In the stage choice, `graphic` is one optional drawing (stamp, meter, versus, receipt, route, folder, tally or chat_thread) that makes ONE fact of the scene visible: a verdict word, a level between two sides, two columns compared, items and a total, stops on a route, a named folder, a count, messages. Choose it when the narration states something the viewer can see better than hear; otherwise `none`.
- Different picture in every scene (a sketch is drawn anew each time, so it never repeats). Two scenes that both end in a tally or a chat read as a template, not as a story; Core sends the later scene back.
- Use the narration's own words in the fields, short. The first piece appears on the anchor you choose and the next pieces on the anchors after it, so pick the anchor where the fact is said.
- A scene with a Phase 1 Story Visual keeps that one; no second picture.

## Not a label
A Studio graphic that would read the same with the characters removed is a label card, not a story picture. Apply the five tests in `invention.md` (removal, anchor, change, own words, size) before choosing a motif, and prefer a picture the characters visibly react to on the same anchor. Different motif per scene is the minimum, not the goal: fill the fields with this moment's own words.

## Sketch: the picture you draw yourself (preferred)

Fixed layouts (stamp, meter, versus, receipt, route, folder, tally, chat_thread) are the same drawing in every episode. The default picture is a **sketch**: you compose it for this scene from parts, on a 960x630 canvas.

- Parts: box, circle, line, arrow, text (a short label, at most 28 characters), face (happy, flat, angry, sad, surprised), check, cross, heart, star, scribble. 3 to 18 parts. Colours: ink, paper, teal, coral, gold, card.
- `step` 1 to 4, no gaps, is the order the drawing builds up on the anchors: draw the cause first, the effect on the next anchor.
- Draw what happens in THIS scene, the way a person would sketch it on a napkin: the cake cut into two unequal slices with a coral arrow pointing at the big one; a door, a clock and a small face getting angrier by step; two faces with a heart growing between them. Not a chart, not a caption on a card.
- Keep parts apart, keep 40 px free at the edges, give every label a box wide enough for it (Core refuses text that does not fit; it never shrinks below readable).
- A sketch passes the five tests in `invention.md` like any picture. Two scenes never share the same drawing; a callback to an earlier sketch is allowed only when the brief names it.
- Use a fixed layout only when its form is the fact itself (a receipt for a bill, a route for stops) and say so in the brief's `why`.
