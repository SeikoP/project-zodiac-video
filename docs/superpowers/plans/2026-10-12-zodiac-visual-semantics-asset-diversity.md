# Zodiac Visual Semantics, Maintenance Cleanup, and Asset Diversity Implementation Plan

> **Execution contract:** Use Superpowers TDD and executing-plans. Implement task-by-task in an isolated worktree. Do not skip RED runs. Do not merge/publish from this plan without an explicit finishing-branch decision.

**Goal:** Replace the incorrect fresh Story Object model with stateful Visual Metaphors, make background palettes affect real scene-set output, close the remaining maintainability/semantic bottlenecks identified by the post-refactor audit, and only then expand Asset V4 diversity.

**Spec:** `docs/superpowers/specs/2026-10-12-visual-metaphor-background-palettes-design.md`

**Base:** `main@de7cc1610d21a9ba97f63562014a3d958b7c589b`

**Implementation branch:** `codex/zodiac-visual-semantics-palettes`

## Global constraints

- Keep the three-phase pipeline and `zodiac-job@5` producer/runner boundary unchanged.
- No renderer schema/version migration.
- Fresh authoring must not create new Story Object plans.
- Legacy Story Object bytes remain readable and are never silently rewritten.
- Visual Metaphor is optional/narration-driven and may be stateful.
- A metaphor can have one state or multiple named states; no universal setup→friction→payoff requirement.
- Scene Set, Scene Accent, Prop/Contact Prop, Meme Prop, Effect, and Visual Metaphor remain distinct concepts.
- Background palettes are compiled/baked authoring assets, not runtime randomness.
- No generate-many-then-dedupe asset workflow. New assets require a distinct semantic/visual role before creation.
- Do not delete compatibility wrappers/runtime history without reverse-dependency evidence.
- Asset-library expansion is the final content-changing phase.

## Review focus

Review these failure modes deliberately:

1. Fresh runs accidentally continue loading or producing `story_object`.
2. Legacy approved Story Object packages are mutated instead of projected compatibly.
3. Stateful metaphors have renamed-but-visually-identical states.
4. Visual Metaphors leak into environment/background ownership.
5. Palette compilation changes SVG geometry instead of color roles only.
6. Same scene-set with two palette IDs collides on asset ID/output path.
7. Fresh auto-routing still selects the rejected `lopsided-bob` hair.
8. Character compiler split introduces geometry/output drift.
9. Contact/effect cleanup weakens semantic attachment or makes effects interchangeable.
10. Asset expansion inflates counts without adding coverage.
11. Wrapper/runtime cleanup deletes a still-supported path/version.
12. Preview diverges from actual compiler/library output.

---

## Task 1 — Replace fresh Story Object semantics with stateful Visual Metaphor

**Purpose:** Fix the root semantic mismatch before touching asset breadth.

### Files

Create:
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-metaphor/validate-visual-metaphor.mjs`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-metaphor/validate-visual-metaphor-composition.mjs`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-metaphor/compile-visual-metaphor-plan.mjs`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/visual-metaphor-contract.md`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/visual-metaphor-composition.md`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-metaphor.test.mjs`

Modify:
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/bootstrap/capabilities.json`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/phases/02-visual-production.json`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`
- any fresh docs/manifests that still expose Story Object as current terminology.

### Interface

Canonical fresh plan:

```json
{
  "format": "zodiac-visual-metaphor-plan@1",
  "decision": {"mode": "required|optional|omitted", "reason": "..."},
  "metaphors": [{
    "id": "libra-two-directions",
    "meaning": "weighing competing choices",
    "visual_states": {
      "tilt_left": {"visual_read": "left dish lower"},
      "balanced": {"visual_read": "both dishes level"},
      "tilt_right": {"visual_read": "right dish lower"}
    },
    "cues": [{"scene_id": "S03", "voice_anchor": "...", "state": "tilt_left"}]
  }]
}
```

Fresh routing flag:
- remove `story_object_required: true`;
- add `visual_metaphor_selected: false` as the lightweight context-routing flag;
- detailed `required|optional|omitted` decision lives in the authoring plan, not in the boolean flags surface.

### Steps

- [x] **1.1 RED — write Visual Metaphor contract tests**
  - one-state metaphor passes;
  - Libra `tilt_left → balanced → tilt_right` passes;
  - cue references unknown state fails;
  - duplicate named states with identical authored visual-state signature fail when both are used;
  - metaphor with environment/background role fails;
  - no setup/friction/payoff requirement exists.
  - Expected: tests fail because current system only has Story Object validators.

- [x] **1.2 GREEN — implement compiler + validators**
  - Keep validation semantic and authoring-only.
  - Compile to existing native object/effect/state/event primitives.
  - Do not add a new Job@5 entity kind.
  - Expected: targeted Visual Metaphor tests pass.

- [x] **1.3 RED→GREEN — change fresh capability/manifests**
  - capability ID becomes `visual_metaphor`;
  - fresh required outputs use `.authoring/visual-metaphor-plan.json` only when selected;
  - fresh docs stop describing Story Object as current.
  - Expected: fresh-context tests show no current Story Object requirement.

- [x] **1.4 Regression gate**
  - Run:
    `node --test plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-metaphor.test.mjs plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/current-policy.test.mjs plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/conditional-context.test.mjs`
  - Expected: all pass.

- [x] **1.5 Commit**
  - `refactor(plugin): replace fresh story object with visual metaphor`

---

## Task 2 — Preserve legacy Story Object through an explicit compatibility projection and reduce fresh context

**Purpose:** Stop old semantics from contaminating fresh context without breaking approved packages.

### Files

Create:
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/compat/story-object/project-story-object-to-visual-metaphor.mjs`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/compat/story-object/README.md`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/visual-metaphor-compat.test.mjs`

Move or wrap as compatibility-only:
- existing `features/story-object/*`
- `references/story-object-contract.md`
- `references/story-object-composition-v2.md`

Modify:
- `bootstrap/capabilities.json`
- `orchestration/plan-step-context.mjs`
- `orchestration/phases/02-visual-production.json`
- relevant source-fingerprint/context tests.

### Interface

- Fresh:
  - `visual_metaphor_selected=false` → full metaphor guidance is not loaded.
  - `visual_metaphor_selected=true` → load Visual Metaphor contract/composition refs.
- Compatibility:
  - legacy `.authoring/story-object-plan.json` is read and projected in memory;
  - projection preserves source hash and does not write back unless explicitly migrating a new copy.

### Steps

- [x] **2.1 RED — compatibility fixture**
  - Existing Story Object fixture must validate through projection.
  - Hash of original legacy file must be unchanged.
  - Fresh context must contain zero `story-object-*.md` refs.

- [x] **2.2 GREEN — implement adapter and capability routing**
  - Explicit legacy detection only.
  - No auto-loading legacy Story Object references on fresh path.

- [x] **2.3 RED→GREEN — context budget**
  - Measure default fresh `02-visual-production / visual_compile`.
  - Acceptance:
    - no metaphor selected: **≤ 70,000 bytes**;
    - metaphor selected: bounded and no legacy Story Object docs;
    - explicit continuity/legacy retains required old guidance.

- [x] **2.4 Regression gate**
  - Run full orchestration context tests plus Visual Metaphor/compat tests.
  - Expected: green; fresh and legacy behavior both explicit.

- [x] **2.5 Commit**
  - `refactor(plugin): isolate story object compatibility and bound metaphor context`

---

## Task 3 — Make background palettes real compile-time scene-set variants

**Purpose:** Fix the current palette registry, where all “palettes” still render the same paper background.

### Files

Create:
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/scene-set/background-palettes.json`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/scene-set/compile-background-palette.mjs`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/scene-set/validate-background-palettes.mjs`
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/background-palette.test.mjs`

Modify:
- `references/asset-library-v4/scene-set/compile-scene-set.mjs`
- `references/asset-library-v4/scene-set/index.json`
- `art-direction/palette-registry.json`
- Asset V4 validator.
- Scene-set compile receipt schema/shape if local-only evidence needs a palette field.

### Approved packs

- `warm-paper`
- `mint-air`
- `blush-paper`
- `cool-study`
- `sand-coral`
- `neutral-graphite`

Default: `warm-paper`.

### Interface

Input:

```json
{
  "environment": {
    "scene_set_id": "scene-set-classroom",
    "background_palette_id": "mint-air"
  }
}
```

Compiled asset identity:

`ENV_SCENE_SET_CLASSROOM__PAL_MINT_AIR`

Output path:

`assets/environment/scene-set-classroom--mint-air.svg`

Receipt records:
- canonical master SHA;
- palette ID;
- compiled SHA.

### Steps

- [x] **3.1 RED — palette compiler tests**
  - same master + different palette → different SVG bytes;
  - path `d=` geometry and viewBox remain identical;
  - unknown palette fails closed;
  - same pair deduplicates;
  - different pairs cannot collide on asset ID/path.

- [x] **3.2 GREEN — implement role-token recoloring**
  - Only approved source color tokens may change.
  - Scene accents use the same palette mapping.
  - Do not edit canonical master SVGs.

- [x] **3.3 RED→GREEN — palette quality validator**
  - Validate required roles and basic luminance/contrast separation.
  - Do not add dark/night palette in this task.

- [x] **3.4 Asset-library gate**
  - Run palette tests + scene-set tests + V4 validator.
  - Expected: all six packs valid; current warm-paper output remains visually backwards-compatible.

- [x] **3.5 Commit**
  - `feat(assets): compile scene-set background palette variants`

---

## Task 4 — Fix hairstyle routing and modularize character geometry without output drift

**Purpose:** Remove the rejected red-shirt hairstyle from fresh automatic selection and eliminate the character compiler monolith before adding more character assets.

### Files

Create:
- `references/asset-library-v4/characters/geometry/body-profiles.mjs`
- `references/asset-library-v4/characters/geometry/hair-profiles.mjs`
- `references/asset-library-v4/characters/geometry/face-profiles.mjs`
- `references/asset-library-v4/characters/geometry/outfit-profiles.mjs`
- `references/asset-library-v4/characters/geometry/pose-profiles.mjs`
- `references/asset-library-v4/characters/geometry/expression-profiles.mjs`
- `references/asset-library-v4/characters/select-character-components.mjs`
- `orchestration/tests/character-geometry-modules.test.mjs`
- `orchestration/tests/character-routing.test.mjs`

Modify:
- `references/asset-library-v4/characters/compile-character-assembly.mjs`
- `references/asset-library-v4/characters/components/catalog.json`
- existing character validation tests.
- `tools/preview/build-zodiac-v4-asset-showcase.mjs`

### Routing decision

- `lopsided-bob`: retained, explicit/compatibility selectable, **not fresh preferred**.
- Red-shirt showcase character: use `blocky-cut`.
- Never delete a historical hair asset solely because fresh routing no longer prefers it.

### Steps

- [x] **4.1 RED — snapshot existing character compiler output**
  - Pin SVG SHA/normalized geometry for representative combinations covering all body profiles, several hair/outfit/pose/expression cases.
  - Expected: baseline fixtures captured before module extraction.

- [x] **4.2 GREEN — extract geometry owners**
  - `compile-character-assembly.mjs` becomes orchestrator/composer.
  - Geometry implementation lives in focused modules.
  - Expected: representative outputs byte-identical or normalized-geometry-identical per the pinned contract.

- [x] **4.3 RED→GREEN — fresh routing**
  - Auto-selection must not choose `lopsided-bob`.
  - Explicit request for `lopsided-bob` still works.
  - Showcase uses `blocky-cut`.

- [x] **4.4 Full character gate**
  - Run character assembly, identity, pose readability, outfit bake, visual intent tests.
  - Expected: no output drift outside explicitly approved routing/showcase selection.

- [x] **4.5 Commit**
  - `refactor(assets): modularize character geometry and fresh hair routing`

---

## Task 5 — Strengthen scene identity, contact semantics, and effect differentiation before adding new assets

**Purpose:** Fix quality bottlenecks in the existing vocabulary so new assets do not multiply ambiguous concepts.

### Files

Create:
- `references/asset-library-v4/scene-set/identity-contract.json`
- `references/asset-library-v4/contracts/contact-mechanics.json`
- `references/asset-library-v4/effects/semantic-families.json`
- `orchestration/tests/scene-set-identity.test.mjs`
- `orchestration/tests/contact-mechanics.test.mjs`
- `orchestration/tests/effect-semantic-families.test.mjs`

Modify:
- `scene-set/index.json`
- `scene-set/accents/index.json`
- `mechanics/index.json`
- `capability-index.json`
- `coverage-matrix.json`
- `effects/meme-effect-catalog.json`
- contact/effect validators.

### Decisions

Scene-set:
- each family declares a small cue vocabulary and a distinct semantic identity;
- do not turn backgrounds into detailed rooms;
- palette alone does not count as scene identity.

Contact:
- normalize `pass-object` capability vs `offer-object` mechanic naming;
- mechanics explicitly declare actor/receiver/focus/contact requirements;
- two-person contact validation checks both semantic roles, not just prop proximity.

Effects:
- separate `pressure`, `tension`, `emphasis` by semantic family and intended locus/orientation;
- visually identical path signatures cannot masquerade as distinct semantic families.

### Steps

- [x] **5.1 RED — scene identity contract**
  - Each of six scene sets must declare at least two allowed identity cues.
  - Cues must stay in scene-set/scene-accent ownership.
  - Palette changes alone cannot satisfy identity coverage.

- [x] **5.2 RED→GREEN — normalize contact mechanics**
  - Fix `pass-object` / `offer-object` mismatch.
  - Validate giver/receiver/contact slots.
  - Keep meme pants behavior “giver hands pants to receiver”; never face-cover semantics.

- [x] **5.3 RED→GREEN — effect semantic families**
  - Existing effects get family/intent/locus metadata.
  - Pressure/tension/emphasis must resolve to different semantic families with distinct authored geometry signatures.

- [x] **5.4 Regression gate**
  - Scene direction, interaction, meme contact, effect and V4 validation all green.

- [x] **5.5 Commit**
  - `refactor(assets): clarify scene contact and effect semantics`

---

## Task 6 — Close remaining maintainability debt touched by this work

**Purpose:** Remove stale compatibility/context debt only where evidence proves it is safe.

### Files

Create:
- `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/compatibility-surface.json`
- `docs/audits/2026-10-12-visual-workstream-dependency-audit.md`
- tests for dependency inventory/deprecation rules.

Modify/delete:
- zero-consumer thin orchestration wrappers proven safe to remove;
- context manifests that still point at wrappers instead of canonical owners;
- runtime retention metadata only if the audit needs explicit reasons.

### Steps

- [x] **6.1 RED — reverse dependency inventory**
  - Every orchestration wrapper must have either:
    - at least one current external/compat consumer, or
    - a deprecation/removal classification.
  - Fail on unclassified wrapper.

- [x] **6.2 GREEN — remove only proven-zero-consumer wrappers**
  - Update internal callers to canonical owner paths first.
  - Keep compatibility wrappers that are genuinely externally referenced.

- [x] **6.3 Context budget audit**
  - Default fresh visual compile target remains **≤70 KB** after Tasks 1–5.
  - Top refs must be current canonical guidance, not compatibility/history.

- [x] **6.4 Runtime history audit**
  - Run `tools/runtime/audit.py`.
  - If a version becomes `safe_to_archive`, archive/prune according to the runtime registry contract.
  - If none is safe, do **not** force deletion; write exact registered consumers/retention reasons to the audit doc.
  - This closes the ambiguity without lying about support.

- [x] **6.5 Full architecture gate**
  - plugin tests;
  - Python architecture/runtime/contract tests;
  - no fresh `compat/` imports.

- [x] **6.6 Commit**
  - `chore(architecture): close visual workstream dependency debt`

---

## Task 7 — Final phase: expand Asset V4 diversity from coverage gaps

**Purpose:** Only after semantics/compiler/maintenance are stable, increase the actual creative vocabulary.

### Principle

Do **not** add assets to hit a raw count. Before each new asset, add/confirm a coverage need. Every created asset must satisfy at least one uncovered semantic role, interaction, scene identity, or visual variation.

### Files

Modify:
- `references/asset-library-v4/capability-index.json`
- `references/asset-library-v4/coverage-matrix.json`
- character catalog/geometry modules;
- scene-set accents/cues;
- props;
- mechanics;
- effects;
- Visual Metaphor asset catalog;
- Asset V4 README/validator.

Create:
- `references/asset-library-v4/visual-metaphors/index.json`
- stateful metaphor SVG/state definitions under `visual-metaphors/`
- new targeted prop/accent/effect/component SVGs.
- `orchestration/tests/asset-diversity-coverage.test.mjs`

### Minimum expansion targets

These are **minimum distinct-capability targets**, not quotas for duplicate art:

**Visual Metaphors**
- at least 6 reusable metaphor mechanisms with authored states:
  - balance scale: `tilt_left / balanced / tilt_right`;
  - split direction / fork;
  - push-pull / magnet-like attraction-repulsion;
  - spotlight/focus shift;
  - barrier/opening;
  - comparison/stack or level indicator.
- Each needs semantic intent and state-readability validation.

**Characters**
- add at least 4 fresh-preferred hairstyles with clearly different silhouettes;
- add at least 3 face/mark variations;
- add at least 4 accessories or outfit-detail variants;
- add at least 4 poses serving uncovered interactions/reactions.
- Do not recreate existing geometry with renamed IDs.

**Props / contact**
- add at least 8 contact-useful props across daily life/social/school/general storytelling;
- each prop declares contact sockets/compatible mechanics when applicable;
- prioritize items usable in multiple episodes over zodiac-specific one-offs.

**Scene identity**
- add at least 2 distinct optional identity cues per scene-set family;
- cues stay sparse and inside the scene-set framework;
- no full decorative background replacement.

**Effects**
- add only effects that fill missing semantic families after Task 5;
- target at least 4 new clearly distinct families, not variants of pressure/tension/emphasis.

**Mechanics / layouts**
- add at least 4 mechanics driven by the new contact/metaphor vocabulary;
- add layouts only when coverage matrix proves an uncovered cast/interaction arrangement.

### Steps

- [x] **7.1 RED — coverage-gap test first**
  - Encode the uncovered needs in `coverage-matrix.json`.
  - Test fails until each need resolves to a real, validated capability.

- [x] **7.2 Implement Visual Metaphor assets**
  - Start with Libra scale as the reference implementation.
  - Validate visible state differences.

- [x] **7.3 Expand character diversity**
  - Use modular geometry owners from Task 4.
  - Run silhouette/identity uniqueness checks.

- [x] **7.4 Expand props/contact + scene identity cues**
  - Add only items tied to explicit coverage needs.

- [x] **7.5 Expand semantic effects/mechanics**
  - Preserve family differentiation from Task 5.

- [x] **7.6 V4 integrity gate**
  - `validate-library.mjs` PASS;
  - no asset ID/path/hash collisions;
  - no unused generated assets;
  - no generate-many-dedupe artifacts;
  - capability index and coverage matrix resolve every new need.

- [x] **7.7 Commit**
  - `feat(assets): expand V4 semantic and visual diversity`

---

## Task 8 — Regenerate diagnostic previews and perform full E2E audit

**Purpose:** Validate the final system visually and structurally using the actual compiler/library.

### Files

Modify:
- `tools/preview/build-zodiac-v4-asset-showcase.mjs`
- `docs/previews/zodiac-v4-full-asset-showcase.svg`
- `docs/previews/zodiac-v4-full-asset-showcase.png`
- `docs/previews/zodiac-v4-full-asset-showcase.json`

Create:
- `docs/previews/zodiac-v4-background-palettes.svg/png`
- `docs/previews/zodiac-v4-asset-diversity-board.svg/png`
- final audit doc for the branch.

### Showcase requirements

Full-frame diagnostic must show:
- three different character identities;
- red-shirt character without `lopsided-bob`;
- Scene Set + sparse identity cues;
- Prop/Contact separated from Visual Metaphor;
- Libra balance metaphor with all three states visible in the diagnostic;
- semantic effects;
- runtime caption safe zone + Patrick Hand + `✦ bungmoto`;
- all six background palette packs;
- summary counts from the actual catalogs.

### Steps

- [x] **8.1 RED — preview manifest assertions**
  - no `Story Object` label;
  - no red-shirt `lopsided-bob`;
  - all six palettes represented;
  - all three scale states represented;
  - counts pulled from catalogs, not hard-coded.

- [x] **8.2 Render previews using actual compilers/assets**
  - Rasterize through the same SVG toolchain used by the existing showcase workflow.

- [x] **8.3 Full plugin gate**
  - Run complete orchestration/reference suite.
  - Run Asset V4 validator.

- [x] **8.4 Runner/runtime non-regression gate**
  - Python compile + architecture/runtime/contract tests.
  - Qt/current renderer smoke through CI if required by the existing workflow.
  - Confirm Job@5 schema/version unchanged.

- [x] **8.5 Final review**
  - Use Superpowers requesting-code-review.
  - Explicitly review every item in **Review focus**.
  - Important/Critical findings get one TDD fix pass; minors are ledgered.

- [x] **8.6 Commit**
  - `docs(preview): regenerate V4 visual system diagnostic`

---

## Final completion gate

The workstream is complete only when all of the following are true:

- no fresh authoring path creates or requires Story Object;
- stateful Visual Metaphor supports the Libra left/center/right balance example;
- legacy Story Object packages remain readable without byte rewrite;
- fresh default context is ≤70 KB and compatibility guidance is not auto-loaded;
- six real background palette packs produce visibly different baked scene-set SVGs;
- fresh routing cannot auto-select `lopsided-bob`;
- character geometry has focused owners instead of one monolithic compiler;
- scene-set identity does not depend on palette alone;
- contact semantics distinguish giver/receiver/prop relationships;
- effect semantic families are distinct;
- compatibility wrappers/runtime history have explicit evidence-based retention/removal status;
- Asset V4 diversity expansion passes coverage-based validation;
- final diagnostic preview is generated from actual current assets/compiler;
- full plugin, Asset V4, architecture/runtime/contract and required CI gates are green;
- no Job@5 or renderer contract migration occurred.

## Commit sequence

Expected semantic commits:

1. `refactor(plugin): replace fresh story object with visual metaphor`
2. `refactor(plugin): isolate story object compatibility and bound metaphor context`
3. `feat(assets): compile scene-set background palette variants`
4. `refactor(assets): modularize character geometry and fresh hair routing`
5. `refactor(assets): clarify scene contact and effect semantics`
6. `chore(architecture): close visual workstream dependency debt`
7. `feat(assets): expand V4 semantic and visual diversity`
8. `docs(preview): regenerate V4 visual system diagnostic`


## Completion record

Completed on branch `codex/zodiac-visual-semantics-palettes`.

Verified production head before documentation/workflow cleanup:
`dc33c27c1985f81287003f65bec84f93aa2a0946`

Final verification — GitHub Actions run `38291678808`:
- targeted Visual Metaphor/current-policy/context suite: **15/15 PASS**
- full plugin orchestration/reference suite: **653/653 PASS**
- Asset V4 validator: **PASS**
- selected Python runtime/contract/application/runner architecture gate: **24/24 PASS**
- runtime retention audit: **12 registered versions, safe_to_archive=[]**
- fresh visual-compile context: **19 refs / 68,522 bytes**
- final preview builder: **PASS**

Final Asset V4 inventory:
- 6 scene sets
- 12 scene accents
- 6 background palettes
- 6 body profiles
- 14 hairstyles
- 7 face profiles
- 17 outfits
- 25 poses
- 22 props
- 6 accessories
- 20 mechanics
- 20 effects / 11 indexed effect capabilities
- 6 stateful Visual Metaphor mechanisms
- 11 meme templates

Visual review confirmed:
- red-shirt diagnostic character uses `blocky-cut`, not `lopsided-bob`;
- Visual Metaphor balance scale exposes `tilt_left / balanced / tilt_right`;
- Story Object is absent from the fresh authoring model and retained only through compatibility;
- six background palettes produce visibly different baked scene-set output with the same geometry;
- Prop/Contact, Visual Metaphor and semantic effects are shown as separate systems;
- diagnostic previews are generated from current compilers/catalogs.

No Job@5 or renderer contract migration was introduced.
