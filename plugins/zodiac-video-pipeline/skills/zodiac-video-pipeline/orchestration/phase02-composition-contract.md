# Phase 02 composition contract — 2.4.44

Keep the existing phases. Phase 02 executes four responsibilities in order:
1. Read approved narration and canonical `references/design.md`; copy its complete STYLE_TOKEN to workspace `design.md`. Choose cast identity, environment and action.
2. Before SVG writes, inventory each scene's narrative components in the existing `.authoring/scene-art-direction.json`. Set `design_token_sha256` to `compositionHash(designToken(designMarkdown))` exported by `phase02-composition.mjs`. The hash uses sorted object keys; it is not the raw file hash. Compare workspace token to canonical source on entry; choosing an arbitrary locally edited token is not a design decision.
3. Native compilers materialize that design. Run existing validators and precompile gate. Review generated compiler-owned environment/depth entities after compilation; add their final explicit role/geometry to the inventory before accepting changed composition. Preserve all authored component requirements and reasons. Changes to geometry, state or dependencies invalidate corresponding receipts and previews.
4. Review source-backed native endpoints, Publish Prep and existing human Visual Review. Timing and actual temporal QA stay in runner.

Each existing Art Direction scene gains `components`, `occlusion_relations`, `spatial_bindings`, `layout_contract`. Each component declares `id`, `reason`, exact `voice_anchor`, `visual_role`, `initial_state`, and `states` (per-state `transform`, integer `layer`, boolean `visible`). The inventory must match the precompile production entities and their state geometry. Geometry uses top-left canvas pixels at 1080×1920; supply x/y/width/height. Do not scale body proportions by transform.

Roles: background, character, interactive_prop, foreground_environment, effect, caption, overlay. Environment remains structural ambiance; story furniture is an interactive_prop. Front/back edges are `{front,back}` entity IDs, independent of numeric layers. Use explicit empty arrays when no occlusion/contact applies. Cycles and missing anchors fail. Use spatial bindings for held/pointing/emitted/on-surface interactions, with max_distance_px; lifecycle remains enforced by native event validators.

`components` is the intended inventory, not a list filled by reading a rendered frame. First list the entities needed by each narration beat, then implement them in production. If you deliberately omit a narrated visual, record why in Art Direction's semantic_goal. This deterministic validator cannot judge whether that creative omission is convincing; Director Review still does that.

Resume / scene switch:
```bash
node orchestration/phase02-composition.mjs <workspace> --context <scene-id>
```
For routine work use `derive-scene-context.mjs <workspace> <scene-id>`; full token/scene mode is explicit recovery. Fix all diagnostics in one pass before drawing. This context is not an approval. The existing precompile validator enforces composition for states >=2.4.44; sealed older jobs are not rewritten.

Transport now preserves entity kind/visual_role/role/layer and scene occlusion_relations through Job@5 IR and measured render plan. Update local runner to the matching branch/release before importing new schema jobs; old schema fingerprints remain accepted by the updated runner. No claims of final pixel parity from producer tests.

## Intent/resolved mode — 2.4.46
Fresh plans set `composition_stage: "intent"`. Components keep reasons, exact voice anchors, roles, initial/state keys and ownership; transforms are materialized by native Scene Direction. Authored source entities must exist; only scene-selected compiler locators may be pending. Resolved report `.authoring/scene-composition-resolved.json` stores actual geometry and source/intent/token hashes, never overwrites intent or grants approval. Final gate requires complete actual native roles/states/relations and a fresh resolved snapshot. Re-run resolver after compilation and Director changes. See `references/asset-use-playbook.md` for routing and explicit migration.
