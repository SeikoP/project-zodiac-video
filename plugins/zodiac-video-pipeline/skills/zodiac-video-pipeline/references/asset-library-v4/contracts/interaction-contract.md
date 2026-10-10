# Interaction Choreography Contract — v1.42.1

## PASS hierarchy
`GEOMETRY PASS → SEMANTIC PASS → VISUAL REVIEW → PASS`.
Any later-stage failure blocks final PASS.

## Meme role binding
When an interaction uses a Meme Composition:
- `meme_template_id` identifies the selected macro composition;
- `meme_role_bindings` maps every template role to an **existing interaction participant**;
- a template may not add a participant/entity;
- a two-role template in an A+B scene binds to A+B, never A+B+C;
- an offscreen role still binds to an existing participant;
- character reference paths from the template are cast-neutral examples only.

## Appearance continuity
Meme pose derivation preserves each bound participant's character master, body profile, silhouette, hair identity, skin palette and outfit/torso palette. Pose/expression/contact changes do not authorize recoloring or character-master swaps.

## Hard readability regressions
- `awkward`: bent right arm; visible elbow; hand contacts outer head scratch region; arm does not run through `face_core`; snot is a small under-nose reaction.
- `rose_peek`: 30–45% of final silhouette behind the left occluder, at least 55% face readable, rose stem touches mouth, accent is right/outward.
- `receipt_shame`: right hand visibly grips/overlaps receipt, at least 25% of hand remains visible, expression reads deadpan/embarrassed/caught; incompatible specialist grin requires adapter.

## Existing interaction locks
Damage Run tears originate at eyes/cheeks and speed trail is right. Banner Bonk uses both hands. Center-hold recipes require two-hand contact.

## Cross-character
Reuse semantic rules, not copied coordinates, masters, outfits or colors.
