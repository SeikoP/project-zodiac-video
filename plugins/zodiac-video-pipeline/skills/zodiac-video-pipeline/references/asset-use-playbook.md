# Asset use playbook — Phase 02

## Bootstrap and resume

Read the full STYLE_TOKEN in `references/design.md` once at bootstrap; copy it intact to workspace `design.md`. Read approved narration and the active phase manifest. Do not restore design decisions from prior chat or another sign's package.

For each active scene:

```bash
node orchestration/derive-scene-context.mjs <workspace> <scene-id> --budget 12
```

This bounded view contains component reasons, voice anchors, native locators, state keys/reuse, contacts/front-back and source hashes. `SOURCE_READ` is a read, not QC or approval. `STALE` means reload the referenced plans and revalidate. Use `--full` only for recovery or detailed scene inspection. Read full token again if its hash changed. The capsule's input hashes can be passed as `expectedSourceSha256` to the API; a newly read capsule alone does not prove earlier inputs are unchanged.

## Design before asset selection

1. From the approved narration beat, name the performer, story object, action and visual payoff. Each component needs a reason and an exact voice anchor.
2. Choose identity/contrast before browsing body/hair/outfit presets. Open only the relevant catalog section. Native reuse is an implementation decision, not the creative rationale.
3. Mark `.authoring/scene-art-direction.json` with `composition_stage: "intent"`. Preserve scene voice, token hash, components, layout zones, bindings and front/back relations. Component ownership is `{kind:"authored"}` or `{kind:"compiler",locator:"..."}`.
4. Supported compiler locators: `character:<entity-id>` for existing cast; `environment:<cue-id>` for a cue selected by that scene's environment profile; `meme-effect:<effect-id>` for the scene's selected adapter; `meme-prop:<asset-id>` for its bound asset requirement. A registered item not selected by that scene cannot bypass missing-component checks. Authored props must exist in source before compile.
5. Motion-only changes reuse the same SVG. Changing pose/expression/crop may need another key; run character `--plan-only` before SVG write. Default maximum is 3 unique character assets; larger budgets need the existing exception reason. Never create SVG per sentence or deduplicate finished character artwork.
6. Before selecting a meme effect, write its choreography beat with scene_id, entity_id, semantic_role, voice_anchor, release_anchor and max_distance_px. If an anchor repeats, specify enter_occurrence/release_occurrence. Compiler resolves owner through the adapter's role binding; do not invent timing or substitute a static overlay.

## Execute and review

`phase02-execute.mjs --workspace <workspace> --source-root <plugin-root> --run` runs native compilation and genuine validator receipts. In current releases it invokes meme effects when `meme_selected` is true. Native write CLIs use transactional staging/ownership; pure APIs are for composition/testing and need the transaction wrapper for production writes.

After all native compilers and semantic assets:

```bash
node orchestration/resolve-scene-composition.mjs <workspace> --write
node orchestration/run-director-v2-review.mjs <workspace>
```

Resolved geometry goes to `.authoring/scene-composition-resolved.json`; it does not overwrite narrative reasons/anchors in intent. Director reruns the resolved check after its adjustments, before native endpoints. Visual Review still needs actual user approval. Phase 3 validates the snapshot again before ZIP; local runner alone verifies audio timing, frames and MP4.

## Fix the source that owns the failure

| Diagnostic | Edit | Re-run |
| --- | --- | --- |
| Identity/outfit/pose mismatch | character assembly plan and design intent | Character plan/write + identity/style gates |
| Locator missing or unplanned component | scene Art Direction and actual selected profile/adapter | intent precompile + affected native compiler |
| Geometry/contact/layer problem | environment frame or scene direction; explicit depth/binding decisions | scene direction + contact + resolved + preview |
| Effect lifecycle/anchor/owner | story-beat choreography and meme role binding | meme effect write + choreography + scene events + preview |
| CSS/paint/style drift | native master or compiler, preserving token | style/library validation + affected previews |
| Stale context/resolved snapshot | reload canonical plans/hashes; correct authored source if necessary | resolved + affected validators, never edit PASS by hand |
| Unowned-path/hash conflict | inspect ownership vs changed bytes | explicit migration or restore; do not force overwrite |

Changing narration reopens content and visuals, including voice anchors/timing. Changing an identity reopens relevant character/native/visual checks. Changing cover copy alone should not recreate character SVGs. Use `assess-revision-impact.mjs` for required revalidation; it cannot grant approvals.

## Current source and recovery

Current authoring selects only current registry IDs. Removed source lives outside
the plugin; continuity requiring it restores a pinned recovery snapshot. Do not
reintroduce retired geometry through aliases, source copying or context examples.
A useful retired idea requires a new identity, re-authoring and visual review.
