# Designing a scene

## 1. Read the beat
From the scene's narration name: the performer(s), the one visible action, the change, and the payoff. Write the viewer read in plain words ("Nhân Mã says 'để xem' while the group waits"). Pick `story_mode`: behavior, relationship, exposition, transition, reflection, payoff, symbolic. A scene does not gain depth from more layers.

## 2. The setting: Scene Accent (required for every scene)
**Every fresh scene has at least one visible context cue** behind the actors. This is never optional for a whole scene; only an individual beat may record an explicit `scene_accent=omit` with a reason, and only when another beat of the same scene shows the cue. A palette-only canvas does not satisfy it. It is **not** a Scene Set (retired, rejected by the compiler), not a prop and not a Story Visual.
- **What it is:** the actual place and a visible detail, drawn minimally: cafe window or menu, classroom board, notice board, string lights, a shelf, a clock, a lamp, a street tree, an awning. Declare `context {kind:"environment_detail", setting:"<the place>", visible_detail:"<what is drawn>"}` and bind `narrative_intent.voice_anchor` to exact scene text.
- **What it is not:** a floating battery, checklist, mood badge or relationship icon (if a checklist is physically used it is a Prop). Never enlarge a symbol to fill background area. When the narration names no place, **infer it from what the characters are doing** and draw that: texting late is a room with a lamp or a dark window; sharing plans over food is a counter, a menu board or a shop sign. "The narration does not say where" is never a reason to leave the scene without a setting. The cue is part of the surroundings (lamp, window, shelf, wall map, board, sign, string lights, tree), never the story content itself: a phone screen, a chat message or a held object is a Prop or a Story Visual, not the accent.
- **Where:** canvas coordinates (or actor-relative `above_head`, `near_left`, `near_right`), rear layer, independent of actor positions, never over the caption lane. One reusable SVG per identity; it may start hidden and become visible on a voice-anchored event. Related scenes may reuse the same cue.
- **Serialized** as role `scene_accent`, Job@5 visual role `background`, asset category `environment`; it does not count against prop or effect density.
- **In Studio you choose it in the stage answer** as `accent {accent_id, setting, visible_detail, anchor_id, parts}`. `setting` and `visible_detail` are short Vietnamese phrases naming the actual place and the actual drawn detail; `anchor_id` is the exact words of the scene it is tied to. Core draws the picture; you never write SVG or coordinates.
  - **`accent_id: "drawn"`:** you pick **two or three parts** Core draws in the channel style (one part rarely reads as a place), each with a slot (`left`, `center`, `right`) and a size (`medium` or `large` unless it is a small detail). Compose the place from parts that exist in the story: a food stall is `awning` + `counter` + `menu_board`; a room at night is `window` + `lamp` + `shelf`; planning a trip is `map` + `calendar` + `clock`; the street is `sign` + `tree` + `door`. One part per slot. A wide part (`awning`, `string_lights`, `curtain`) goes `across` the top, and then only floor parts (`counter`, `plant`, `lamp`, `door`, `tree`) may share the picture.
  - **`none_fits`** when the place cannot be drawn from the parts. Describe what is needed in `setting` and `visible_detail`: Core records a request for new art. Never pick a neutral mark just to have something, and never swap in a prop.
- **Review:** a muted viewer must recognize the stated setting; the cue stays subordinate to the action. A drawing that mismatches the declaration fails Visual Review even when the declarations validate.

## 3. Props
A prop is a physically handled item from the library, tied to an authored action. Each prop is either the focal entity or linked to it. Keep **one physical model per prop family in a scene** (a phone and a second phone is repetition, not richness); at most two support objects at a time. Match the spoken beat (food when food is spoken, a phone when texting). The library has no table, desk or chair. A needed prop that does not exist is requested, never substituted for a story prop. Never add a prop or accent only to turn a check green.

## 4. Experience profile (authoring-only)
```
experience_profile:
  story_mode: ...
  sparse_reason: <only when deliberate negative space is the strategy>
  required_physical_entities: [<props the narrated action physically needs>]
  story_focus:
    goal: <exactly the scene semantic_goal>
    focal_entity_id: <one visible character/prop/story visual carrying the beat>
    supporting_entity_ids: [<visible entities that support it>]
    links: [{from, to, relation: <visible action>, purpose: <why it clarifies the goal>}]
```
`story_focus` is mandatory for behavior, relationship, symbolic and payoff scenes and for exposition with several story entities; every supporting entity is linked. Every id is an entity in that scene. An unlinked prop or Story Visual is decoration, even with an event. Optional: `depends_on_scene_ids`, `callback_scene_ids`, `recurring_entity_ids`, `payoff_source_scene_id` (earlier scenes only).

## 5. Composition
- Frame → mechanic → character assembly → scene direction. Choose a frame whose required slots you can fill with real entities and a mechanic whose required capabilities that frame provides.
- Actors are large enough to read on a phone and vary in position and scale across scenes; the story entities together cover about 26 % of the story field. Shot or camera change never substitutes for a state change in the story.
- Hands and contact are real: bind the actual grip or contact. Keep the caption lane (y ≥ 1470) clear; foreground depth comes from scale and layer, not clipping off-canvas.
- Same shot streak at most two; avoid repeating identical framing and prop wallpaper across scenes.
- With an authored environment frame (`zodiac-environment-frame@1`: slots `performer`, `listener`, `story_fixture`, optional foreground), the frame owns entity geometry. A physical foreground fixture is a separate prop entity whose geometry crosses the lower body, never the face.
