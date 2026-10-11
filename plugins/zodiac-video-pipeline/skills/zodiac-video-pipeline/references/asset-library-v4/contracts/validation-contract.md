# Asset Library Validation Contract — v1.42.1

Validation layers:
1. library/style/lineage;
2. post-pose geometry/contact;
3. Visual Intent side/direction/locus;
4. Pose Readability and expression compatibility;
5. Meme Composition role binding + appearance continuity, when used;
6. human Visual Review.

Required readability gates:
- `pose_readability`
- `expression_intent_match`
- `occlusion_and_contact_readability`
- `joint_readability`
- `visible_grip_support`
- `meme_role_binding`
- `character_appearance_lock`

Meme composition invariants:
- macro template is compile-time only;
- one primary mechanic per beat: State Recipe OR Meme Composition, except explicit recipe reuse inside a composition;
- template roles bind existing scene entities first; template alone cannot spawn a character;
- offscreen roles still bind existing entities;
- template character paths are reference-only and cannot replace cast identity;
- source master, body profile, silhouette, hair identity, skin palette and outfit palette remain stable across meme states;
- held/offered props require visible grip/contact;
- tears originate from eye/cheek semantics, not arbitrary overlay coordinates or mouth;
- `contact-fan` is static, authoring-rotatable, and anchored to declared semantic locus;
- `prop-pressure` and `receipt-in-face` use receipt `top_mid`;
- `equip-this` means a giver offers pants to an embarrassed target; self-wearing/literal dressing is invalid;
- `caption-first-bottom` is a layout modifier, not a primary mechanic.

A case may not report final PASS merely because coordinates are in bounds.
