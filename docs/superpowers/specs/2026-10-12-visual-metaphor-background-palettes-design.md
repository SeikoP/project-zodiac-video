# Visual Metaphor + Background Palette System Design

**Date:** 2026-10-12  
**Branch:** `codex/zodiac-visual-semantics-palettes`  
**Base:** `main@de7cc1610d21a9ba97f63562014a3d958b7c589b`

## Status

Design proposed after the completed maintainability refactor. This spec intentionally limits implementation to the plugin / Asset V4 authoring system and preview tooling. Runner, Job@5 and renderer contracts are not redesigned.

## Intent

Fix three visual-authoring problems exposed by the full-frame Asset V4 diagnostic:

1. the red-shirt showcase character uses a hairstyle the user does not want;
2. the current **Story Object** concept is semantically wrong for the desired visual language;
3. scene-set backgrounds need several genuinely different color combinations rather than six palettes that all render the same paper background.

Also capture nearby debt found during the audit without expanding this implementation into another repo-wide refactor.

## User-visible success criteria

- Fresh authoring no longer asks for, requires or describes a `Story Object`.
- A Libra-style scale can appear *inside the existing scene* as a readable visual expression of “weighing two directions” without becoming the background or a physical prop.
- Visual Metaphors may be **stateful**. For example, a Libra scale can expose `tilt_left`, `balanced`, and `tilt_right` visual states and transition between them at narration anchors.
- Visual metaphor use is optional and narration-driven. A metaphor may have one state, several states, or a repeated state sequence; the system does **not** force every metaphor into a universal setup → friction → payoff lifecycle.
- Physical props, meme/contact props, scene accents, effects and visual metaphors remain distinct concepts.
- The red-shirt showcase character no longer uses `lopsided-bob`; that hairstyle is not selected by fresh preferred routing.
- Scene-set backgrounds can be rendered in several visibly different approved palette packs.
- Palette choice is authoring/compile-time only; Job@5 and renderer receive ordinary baked SVG assets.
- The full-frame showcase can render multiple background palette swatches for review.
- Existing legacy Story Object packages remain readable through a compatibility adapter/alias and are not silently rewritten.

---

## 1. Terminology and semantic model

### Replace: Story Object

The term `story_object` currently carries the wrong assumptions:

- it implies a discrete persistent object;
- fresh mode currently treats it as required;
- the validator expects setup → friction → payoff;
- it encourages authors to manufacture object state progression even when the narration only needs one symbolic visual cue.

This is the root mismatch.

### New canonical concept: Visual Metaphor

Canonical names:

- Human-facing: **Visual Metaphor / Ẩn dụ hình ảnh**
- Capability ID: `visual_metaphor`
- Authoring kind/role: `visual_metaphor`
- Plan: `.authoring/visual-metaphor-plan.json`
- Validators: `features/visual-metaphor/*`

A Visual Metaphor is **a scene-contained visual expression of an idea from narration**. It may use an object silhouette, symbol, relation, repeated mark or a multi-state visual mechanism, but its semantic identity is “what idea does this communicate?”, not “what physical object exists?”.

A Visual Metaphor may therefore have a stable identity plus authored **visual states**. The states belong to the metaphor concept, not to a physical-prop contract. For example, the same Libra scale metaphor can render as left-heavy, balanced, or right-heavy while remaining one conceptual metaphor.

Examples:

- Libra: the same scale exposes `tilt_left`, `balanced`, and `tilt_right`; narration anchors switch between them while the character considers competing directions.
- Gemini: two opposing speech/idea marks show conflicting readings.
- indecision: two directional arrows diverge from a thought locus.
- pressure: a narrowing visual relation can communicate constraint without becoming a physical prop.

### Explicit separations

| System | Purpose | Physical contact? | May replace scene-set? |
| --- | --- | --- | --- |
| Scene Set | Where the scene lives | no | n/a |
| Scene Accent | Small authored location cue inside Scene Set | no | no |
| Prop / Contact Prop | What a character physically uses/touches | often yes | no |
| Meme Prop | Approved comedic/contact prop | often yes | no |
| Effect | Temporary semantic/reaction consequence | no | no |
| **Visual Metaphor** | Express an abstract narration idea visually | optional | **never** |

A physical object may *carry* a metaphor, but it remains a Prop in transport. The authoring plan records the metaphor meaning separately instead of reclassifying every object as a new native entity kind.

## 2. Visual Metaphor authoring contract

### Fresh behavior

Fresh mode changes from “Story Object required” to **metaphor optional / narration-driven**.

Remove the default requirement:

`story_object_required: true`

Replace it with an authoring decision that can be:

- `required` — narration contains an abstract contrast/state that benefits materially from a visual metaphor;
- `optional` — metaphor may strengthen the beat but is not required;
- `omitted` — literal acting/prop/environment already communicates the beat.

No metaphor is required merely because the run is fresh.

### Plan shape

The new plan describes semantic cues, not a forced three-act object lifecycle.

Conceptual shape:

```json
{
  "format": "zodiac-visual-metaphor-plan@1",
  "decision": {
    "mode": "required|optional|omitted",
    "reason": "...",
    "review_ref": "..."
  },
  "metaphors": [
    {
      "id": "libra-two-directions",
      "meaning": "weighing competing choices",
      "visual_states": {
        "tilt_left": {
          "visual_read": "left dish visibly lower than right"
        },
        "balanced": {
          "visual_read": "both dishes level"
        },
        "tilt_right": {
          "visual_read": "right dish visibly lower than left"
        }
      },
      "cues": [
        {
          "scene_id": "S03",
          "voice_anchor": "...",
          "state": "tilt_left",
          "relation": {
            "mode": "near|emitted_by|anchored_to_scene",
            "anchor": "character.lead"
          }
        },
        {
          "scene_id": "S03",
          "voice_anchor": "...",
          "state": "balanced"
        },
        {
          "scene_id": "S03",
          "voice_anchor": "...",
          "state": "tilt_right"
        }
      ]
    }
  ]
}
```

Rules:

- one cue is valid;
- multiple cues may recur if narration justifies recurrence;
- a metaphor may declare multiple named `visual_states` and switch states at real narration anchors;
- state changes must be visibly distinct when authored (for example `tilt_left` / `balanced` / `tilt_right`), not renamed duplicates;
- no setup/friction/payoff minimum;
- no fake progression requirement;
- no requirement that every metaphor must change state a fixed number of times;
- metaphor must remain legible with audio muted;
- metaphor cannot occupy the environment/background role;
- physical contact is validated only when the selected transport is a physical prop;
- effects remain optional consequences.

### Native/runtime boundary

No Job@5 migration.

Visual Metaphor compiles to existing native primitives:

- prop/object/effect asset transport;
- existing transform/state/event;
- existing spatial bindings.

The metaphor plan and QC receipt remain authoring-only evidence.

### Compatibility

Legacy files remain supported:

- `.authoring/story-object-plan.json`
- `story_object` capability/flags
- legacy validators and wrappers

Compatibility adapter behavior:

- legacy Story Object is projected to the Visual Metaphor semantic model for validation;
- no automatic rewrite of approved legacy bytes;
- fresh authoring never creates new Story Object plans;
- old terminology is moved to compatibility documentation and omitted from fresh context.

This avoids breaking reviewed packages while stopping the wrong model from propagating.

---

## 3. Character hair correction

The diagnostic red-shirt character currently uses `lopsided-bob`.

Decision:

- remove `lopsided-bob` from the **fresh preferred** hairstyle pool;
- retain the asset as compatibility-selectable so older approved identities remain reproducible;
- use a quieter fresh hairstyle for the red-shirt showcase character (`blocky-cut` preferred for the diagnostic);
- add a routing/validation test so fresh automatic selection does not choose a compatibility/deprecated hairstyle.

This is a routing change, not destructive asset deletion.

---

## 4. Background palette system

### Current problem

`art-direction/palette-registry.json` contains six semantic palettes, but every palette has the same `paper: #FFFDF9`.

Scene-set frames hard-code colors directly in SVG, and `compile-scene-set.mjs` performs direct-copy with master SHA validation.

Therefore the current registry cannot produce visibly different background palettes.

### Chosen approach: compile-time role recoloring

Keep one canonical scene-set geometry master per environment. Add a **background palette registry** and bake palette variants during scene-set compilation.

This avoids:

- multiplying hand-authored SVG copies;
- renderer changes;
- Job@5 schema changes;
- runtime color randomness.

### Palette roles

Scene-set masters use the existing known role colors as source tokens:

- wall/card: `#FFFDF9`
- floor/paper: `#F6F0E6`
- ink: `#2F3C44`
- soft detail: `#D0C1B3`
- slate detail: `#435064`
- teal accent: `#8EC0B9`
- coral accent: `#E97A66`
- ochre accent: `#F2C45C`

The compiler maps these semantic roles into a selected palette.

### Initial palette packs

The first implementation provides **six** deliberately distinct but still light/readable packs:

1. `warm-paper` — current canonical palette; backwards visual baseline.
2. `mint-air` — mint wall/floor with warm ochre/coral accents.
3. `blush-paper` — soft blush wall/floor with teal/ochre counter-accent.
4. `cool-study` — blue-grey paper with slate/teal accents.
5. `sand-coral` — warm sand paper with coral/ochre emphasis.
6. `neutral-graphite` — low-chroma warm grey background with one restrained accent.

No dark-background pack in the first pass. A true night palette would require revalidating character outline/caption contrast and should not be smuggled into a background-only change.

### Compile contract

Scene authoring may specify:

```json
{
  "environment": {
    "scene_set_id": "scene-set-classroom",
    "background_palette_id": "mint-air"
  }
}
```

If omitted, use `warm-paper`.

The scene-set compiler:

1. verifies canonical master SHA;
2. validates palette ID against the approved registry;
3. replaces known semantic source colors in memory;
4. writes a baked SVG;
5. assigns palette-specific asset ID/path, e.g.
   - `ENV_SCENE_SET_CLASSROOM__PAL_MINT_AIR`
   - `assets/environment/scene-set-classroom--mint-air.svg`
6. records both master SHA and compiled SHA in lineage/receipt.

This permits the same scene-set geometry to appear with different palettes in different scenes without asset-ID collision.

Scene accents are recolored through the same palette roles so they remain coherent with the selected background.

### Guardrails

- unknown palette → fail closed;
- canonical master geometry remains unchanged;
- palette compiler may change only approved color tokens, not path geometry;
- output must preserve stroke/fill structure and viewBox;
- palette contrast test verifies readable ink/detail separation;
- no random palette selection at render time;
- palette selection may be automatic at authoring time, but it must be recorded in the plan/receipt.

---

## 5. Showcase / review updates

Update the reusable full-frame diagnostic:

- red-shirt character uses the new fresh-preferred hair;
- remove every “Story Object” label;
- demonstrate **Visual Metaphor** using a Libra-like scale / two-direction example rather than phone ping → silent;
- keep Prop/Contact in a separate panel;
- add a bottom palette strip showing the six background palette packs on the same scene-set geometry;
- preserve caption safe zone, watermark, effects and three-character comparison.

The showcase remains diagnostic and may exceed production density.

---

## 6. Context and capability routing

Fresh Phase 2 capability becomes `visual_metaphor`, not `story_object`.

Unlike the old system, the capability is **not loaded unconditionally for every fresh visual compile**.

Preferred routing:

- always load a small decision contract or decision field;
- load full Visual Metaphor authoring guidance only when decision is `required|optional` and the episode actually uses one;
- legacy Story Object guidance loads only in compatibility mode / legacy plan detection.

This addresses a remaining context bottleneck identified in the previous audit: Story Object guidance was one of the larger fresh references even when the visual did not need a metaphor.

---

## 7. Tests / acceptance gates

### Visual Metaphor

- RED: fresh pipeline no longer requires `story_object_required`;
- RED: a single Libra metaphor cue is valid without setup/friction/payoff;
- RED: a stateful Libra metaphor can expose `tilt_left`, `balanced`, and `tilt_right` and bind each state to narration anchors;
- RED: duplicate/visually unchanged named states are rejected when a state transition is authored;
- RED: metaphor used as background/environment is blocked;
- RED: physical prop contact rules remain separate;
- RED: legacy Story Object fixture still validates through compatibility projection;
- GREEN: fresh context does not load Story Object compatibility docs.

### Hair routing

- RED: fresh preferred hair pool excludes `lopsided-bob`;
- GREEN: explicit compatibility selection can still reproduce it;
- showcase red-shirt identity no longer uses it.

### Background palette

- RED: same scene-set + two palette IDs produce different SVG bytes;
- geometry/path-data remains identical;
- unknown palette fails closed;
- identical scene-set/palette pair deduplicates to one compiled asset;
- same scene-set with two different palettes produces two non-colliding assets;
- palette registry passes contrast/style-token validation;
- six palette thumbnails render in showcase.

### Regression

- full plugin suite green;
- Asset V4 validator green;
- current Job@5/runtime contract tests green;
- no renderer schema/version change.

---

## 8. Related backlog gathered from the previous audit

### Included now

- wrong Story Object semantic model;
- old Story Object context overhead;
- red-shirt fresh hairstyle choice;
- background palettes that currently do not affect real SVG output;
- showcase terminology/example mismatch.

### Explicitly deferred

1. **Character compiler monolith**
   - geometry for body/hair/outfit/pose is still concentrated in `compile-character-assembly.mjs`;
   - later refactor should split geometry modules after the visual direction is stable.

2. **Scene-set identity beyond color**
   - the six scene sets still share nearly identical frame geometry;
   - palette variants improve mood but do not solve location silhouette by themselves;
   - later pass should add a small cue vocabulary per scene, not heavy wallpaper/furniture.

3. **Contact/prop richness**
   - interaction library remains shallower than character library;
   - add only after metaphor/prop separation is stable.

4. **Effect semantic overlap**
   - pressure / tension / emphasis are still visually close;
   - defer to a semantic-effect pass rather than adding more effects now.

5. **Context budget**
   - fresh visual compile was reduced to ~76.8 KB in the previous audit;
   - conditional Visual Metaphor guidance should reduce it further;
   - do not blanket-trim canonical contracts.

6. **Compatibility wrappers**
   - orchestration still contains many thin forwarding wrappers;
   - delete only after a reverse-dependency/deprecation gate.

7. **Historical runtime source duplication**
   - registered compatibility consumers still block pruning;
   - unrelated to this visual-authoring phase.

## Non-goals

- no renderer redesign;
- no Job@5 schema migration;
- no full scene-set structural redesign;
- no deletion of legacy Story Object bytes/assets;
- no character geometry refactor in this phase;
- no dark/night palette until contrast is separately validated.