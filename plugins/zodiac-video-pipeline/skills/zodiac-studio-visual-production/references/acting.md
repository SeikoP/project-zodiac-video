# Acting: what happens, on which word

Channel performance is voice-led: **cause → reaction → payoff**. Quiet close-ups may land a cutting joke. Avoid random motion, meaningless effects, memes or cuts, soothing imposed on the voice, and quotas.

## The three beats
Every scene runs three beats tied to exact voice anchors: (1) intention, (2) action or contact, (3) a readable reaction hold. Only the part that carries the beat moves; everything else holds. Components that appear may enter from off-screen (`enter` from left/right/top/bottom, trigger `scene_start`, state unchanged).

## Events
- Pose or expression changes are a **hard cut** (`state_swap`), never a cross-fade. Acting moves (`lean` degrees ≤ 20, `recoil` degrees ≤ 12, `pull-with-prop` with a group) keep `state_before == state_after`.
- Use at least one acting move per scene. One acting event per target at a time. The next event of a target may not start before the previous one ends, so two anchors a third of a second apart cannot both act on one actor; choose the stronger one. A pose that must return to rest gets its own explicit return event.
- The trigger text is an exact substring of the scene narration; a case or spacing slip is snapped, anything else is wrong. Every event carries a short Vietnamese `action` saying what the target visibly does.
- An event can only move a character to a state the entity lists. A prop has one state; it acts through a move, not a state change.
- A changed-state `slide` needs a real `near` binding, on-canvas endpoints, unchanged size, 24–360 px of travel.

## Blocking and framing
Director beats say `performer`, optional `target`, `action`, `reaction`, `semantic_purpose`, `shot_reason`, `visual_payoff`. Two-person dialogue uses the existing speaker/listener, never a third actor. Optional per-beat `blocking {entity_id, anchor, side, relayout}` with sides above/below/left/right/between/diagonals, `between` needs a distinct `secondary_anchor`, `offset_px` 0–180; it only moves explicit non-character support, never heroes, and invalid placement fails rather than hiding things.

## Meme reactions
A meme is performed by the channel's own cast, never imported characters. Start normal, then at the exact voice anchor cut to the adapter's pose, expression and crop through `state_bindings`. Situations: self-cringe or bravado collapse (`facepalm-closeup`, `cry-closeup`), denial or self-recognition (`receipt-in-face`, `mirror-self-check`), excess affection (`heart-offer-overkill`, `wallet-flex`), waiting or exhaustion (`impatient-wait`, `exhausted-slump`), friendly warning (`smiling-threat`, `take-that-back`), exit or teasing (`polite-exit`, `playful-cheek-poke`), concession (`innocent-shrug`, `awkward-grin`, `silent-judgment`). Each beat declares `meme` use or omit with a reason; use needs the reacting `entity_ids`, the adapter, `state_bindings` and the anchored reaction in `event_ids`. No quota; serious passages stay quiet.

## Sound and timing
Voice timing is measured and authoritative. Do not delay narration or captions for visuals. HyperFrames has no audio of its own here: voice (and any approved music) is mixed at export.
