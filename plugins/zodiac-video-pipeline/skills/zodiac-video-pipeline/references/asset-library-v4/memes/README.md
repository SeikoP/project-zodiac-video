# Visual Grammar v4 Meme Adapters

Meme adapters preserve reviewed action, role relationships, composition, and crop from the promoted V4 semantic contracts while compiling characters and assets with the native V4 style.

Visual Compile may add this field to a scene in `visual-grammar-plan.json`:

```json
{
  "meme_composition": {
    "id": "cry-hug-object",
    "bindings": {"actor": "hero", "prop": "keepsake"}
  }
}
```

`id` must exist in `index.json`. `bindings` maps recipe roles to entities already present in the scene. The compiler resolves the registered v4 frame, mechanic, placements, and acting requirements. Explicit `frame_id` or `mechanic_id` overrides are allowed only when they match the adapter. Missing required roles, wrong entity kinds, unknown entities, and adapter mismatches fail closed.

The V4 registry points to a local contract in `memes/templates/`. These contracts contain semantic layout and contact rules; legacy reference SVGs are not included. New assets use `zodiac-paper-doodle-meme-v4` and `human-stroke-v2` with truthful V4 lineage.

The compiler writes authoring-only `scene.visual_grammar.meme_composition` metadata and `scene.scene_direction.meme_layout`. Every adapter declares an effect ID, normalized role anchor, pixel size, layer, and semantic locus. The generic `compile-meme-effects.mjs` compiler resolves those values, writes deterministic V4 SVG assets, and adds effect entities before Scene Direction consumes the registered role boxes and owns final transforms. A receipt finalizer records the final boxes after Scene Direction, then the validator checks every selected meme effect. Runtime handoff strips adapter metadata after the geometry and assets are compiled.

Effects are intentionally data-driven so the catalog can grow without adding meme-specific JavaScript branches. To add a meme, add its adapter and source contract here, provide an effect primitive in `../effects/meme-effect-catalog.json`, set a role-based anchor and bounded size, then add adapter and compile tests. If the meme needs a bespoke prop, list it in `asset_requirements`; the same compile step materializes and binds the package-owned V4 prop. The compiler rejects unknown effect IDs and missing role anchors.

| Meme adapter | Native V4 effect | Locus |
|---|---|---|
| absurd-offer | `offer-swish` | hand to offered prop |
| cry-closeup | `tear-trails` | eyes to cheeks |
| cry-hug-object | `tear-squeeze` | tears while hugging the prop |
| equip-this | `offer-impact` | pants handoff |
| facepalm-closeup | `facepalm-impact` | hand meeting forehead |
| heart-offer-overkill | `sparkle-burst` | around heart |
| mirror-self-check | `mirror-glint` | reflection edge |
| prop-pressure | `contact-fan-pressure` | prop toward target |
| receipt-in-face | `contact-fan-receipt` | receipt toward target |
| side-eye-object | `question-accent` | gaze endpoint near prop |
| wallet-flex | `wallet-shine` | wallet edge |

`equip-this` has two required characters: `giver` and `embarrassed_target`. Its native pants prop passes from the giver's hands to the receiver's handoff zone; the adapter checks the two waistband contacts and receiving hand within 32px. No face-covering contact is allowed.

Required actions are listed in `acting_requirements`. Visual Compile must use those values in the corresponding initial character state in `.authoring/character-assembly-plan.json`. Character Assembly verifies them while preserving each character's body, hair, and outfit identity.

If any scene selects a meme, set `.authoring/pipeline-state.json` `flags.meme_selected` to `true` before Semantic Assets. The Phase 2 selection validator rejects a mismatch so conditional V4 template and integrity checks cannot be skipped.
