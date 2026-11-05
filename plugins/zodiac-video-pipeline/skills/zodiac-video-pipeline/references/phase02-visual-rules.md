# Phase 02 — visual selection & authoring rules

Moved verbatim from SKILL.md so Phase 01 and Phase 03 work does not load them. The Fresh Run Isolation rule stays in SKILL.md. Read this file in full before any Phase 02 authoring or visual selection.

## Current visual selection
Current visual selection uses a fixed native face, plain or intrinsic zodiac-glyph shirts with selected colors, no accessories by default; optional restrained reaction/effect assets remain allowed when narration or acting requires them. Preserve the sign's icon baked on its shirt; omit decorative halos, rays and floating marks around that icon. Never infer a supporting actor's sign. Prefer feminine presentation with a tall slim silhouette for leads unless explicit episode design requests otherwise. Preserve pose/expression acting, props, symbolic story objects and supporting backdrops.

### Character identity variation
For fresh `zodiac-character-assembly-plan@2`, hair is an explicit story-first identity choice, not a fallback. Every character must own a `hair_id` and a meaningful hair decision reason. Use the expanded feminine pool across distinct silhouette families (bob/lob, wave, long loose, braid, bun, half-up, ponytail) rather than repeatedly choosing the same long-side-part or ponytail. Co-visible recurring people should have distinct hair IDs; intentional matching requires `design_intent.hair_reuse_reason` for every colliding character. Hair variation complements rather than replaces body-silhouette variation.

## Scene Accents
Scene Accents are optional context cues with explicit per-beat use/omission in Visual Coverage. Fresh accents have their own authoring category `scene_accent`, canvas-relative placement, optional actor-relative anchor, rear layering, one reusable SVG per identity, and voice-anchored visibility states. They do not require a Scene Set and must not constrain character positioning. Canvas, spatial and caption safety remain mandatory.

Scene accents are sparse narrative context cues, not a permanently decorated room. Their `initial_state` and boolean visibility `states` may be driven by ordinary voice-anchored events, reusing one SVG. Define when each cue enters and leaves; string lights suit a narrated birthday, while cafe cues only accompany the cafe passage. One continuous scene can contain many visual story turns. Narrative Visuals communicate thoughts, feelings and symbolic meaning independently of backdrop accents; simple visuals do not require setup/friction/payoff. Historical Story Object V2 remains importable and may play within one native scene without splitting approved narration paragraphs.

## Visual coverage before SVG compilation
Fresh Phase 02 requires per-beat visual_coverage in Visual Intent art_direction before SVG compilation. Fill actor, optional Scene Accent, Narrative Visual, ordinary prop, support and caption decisions with actual references or explicit omissions. The native seam and Visual Quality enforce coverage; a symbolic metaphor cannot substitute for ordinary props used by the narration.

## Scene Experience review

Every fresh scene must author an `experience_profile` in Visual Intent before native compilation:

```yaml
experience_profile:
  story_mode: behavior | relationship | exposition | transition | reflection | payoff | symbolic
  sparse_reason: <required only when deliberate negative space is the visual strategy>
  required_physical_entities: [<entity ids explicitly required by the narrated physical action>]
  story_focus:
    goal: <exact semantic_goal for this scene>
    focal_entity_id: <one visible character/prop/narrative_visual carrying the beat>
    supporting_entity_ids: [<visible story entities that materially support the focal entity>]
    links:
      - from: <focal/support entity id>
        to: <focal/support entity id>
        relation: <what visible relationship/action connects them>
        purpose: <why this relationship makes the semantic_goal clearer>
```

`story_focus` is mandatory for behavior, relationship, symbolic and payoff scenes, and for exposition scenes that contain multiple story entities. Transition/reflection beats may omit it when deliberately sparse. The profile is authoring-only and must never project into `production.json` or Job@5.

Fresh 2.6.10+ runs review story experience before native SVG generation. This is not a decoration-density quota. A scene does **not** gain depth because it has more layers. Depth is credited only when the focal entity and supporting story entities form a valid relation chain bound to the scene `semantic_goal`.

For each scene, explicitly consider character action, environment specificity, physical storytelling, depth separation, secondary action, visual callback and Narrative Visual role. Behavior or relationship narration should have an authored story action or meaningful physical/Narrative Visual progression; a passive actor plus passive context cue is a REVIEW condition, not a sufficient scene.

Every physical prop, Narrative Visual, event-targeted story entity, and co-actor required by a relationship scene must be either the focal entity or a supporting entity connected through authored `links`. An unlinked prop/Narrative Visual is decoration even if it has an event. Link `purpose` must explain how the relationship serves the exact semantic goal; do not add components merely to make a checklist green.

Sparse composition remains valid for reflection/payoff beats when negative space serves the semantic job and the omission rationale is explicit. Never add props, Scene Accents, effects or Narrative Visuals only to make a checklist green.

If narration explicitly involves a physical object, a symbolic Narrative Visual cannot replace that physical storytelling obligation. Scene Accents remain rear/context-only and independent from actor composition.

## Scene Production Pipeline (fresh 2.6.11+)

Phase 02 stays one editorial phase. Before native compilation, process the
canonical `.authoring/visual-intent.json` in five internal stages:

1. **2A Story plan:** determine semantic goals, narrated turns, scene dependencies,
   callback/payoff sources and continuity. Never split approved narration merely
   for visual variation.
2. **2B Cast and shared assets:** lock hair/body/outfit and shared prop identities.
   A character identity change invalidates every scene using the character.
3. **2C Scene production:** for every scene, confirm story-focus chain, physical
   interactions, scene event endpoints and native preview. Store per-scene source
   fingerprint, dependencies, and local QC in `.authoring/scene-checkpoints.json`.
4. **2D Cross-scene continuity:** verify cast identity, callback source ordering,
   recurring object continuity and payoff source before full Visual Review.
5. **2E Aggregate native review:** compile full scenes and event endpoint pairs,
   then obtain explicit user Visual Review. Scene-level authoring QC is never a
   substitute for native frame QC or user approval.

Use `features/scene-production/scene-checkpoints.mjs <workspace>` for a
read-only semantic comparison plus a checkpoint receipt derived from Visual
Intent. The experience validator's `--write` mode also generates this receipt
at the existing parallel native preflight boundary. A changed scene or shared
asset must not reuse stale receipts. `revision.rebuild` identifies scenes whose
own semantic input changed; `revision.revalidate` includes dependent callback
scenes. A cache hit must be verified against native output hashes by the
existing Phase-02 executor. Never infer a native PASS from the checkpoint's
`AUTHORING_QC_PASS`; `native_compiled=false` and `preview_verified=false`
until actual native receipts exist.

Optional authoring-only fields inside each scene's `experience_profile`:
`depends_on_scene_ids`, `callback_scene_ids`, `recurring_entity_ids` and
`payoff_source_scene_id`. References must point to earlier scenes. These fields
are not projected into production or Job@5. Sparse scenes remain legitimate and
no fixed prop, actor or effect quota is introduced.

The scene batch plan is authored by `scene-scheduler.mjs`; parallel batches
are safe for scene-local planning and QC, but shared native production writes
remain serialized until a separate, hash-verified scene compiler is installed.
Do not report faster native compilation solely because the batch plan allows
parallel scene-local work.
