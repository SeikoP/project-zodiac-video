# Prop families (Visual V5, P3 slice) — plan and ledger

Spec: [v5-prop-variant-diversity](../specs/2026-11-14-v5-prop-variant-diversity.md) §2–§6 (P3 only: typed
family/model/state/view resolver, one source-derived manifest, compatibility adapter, diversity features in ranking).
Owner decision 2026-11-25: follow the spec. That means no fabricated art (`NEW_VARIANT_MASTER_REQUIRED`), no asset
deleted, states are not models. Out of scope here: P4 UI, P5 new master art, P7 benchmarks.

## Tasks (inline, TDD)
1. `tools/studio_project/prop_families.py`: manifest derived from `props/index.json` (family → model → state),
   compatibility adapter (every V4 id maps to exactly one family/model/state), `distinct_geometry` proven from the SVG body
   path, never from the id. Spec tests 1, 2.
2. Resolver `resolve()` with typed `PropVariantRequired` (`NEW_VARIANT_MASTER_REQUIRED`) for a model or state the library
   does not have; no substitution across models. Spec test 6.
3. Prompt catalog grouped by family (states are not listed as separate props), lossless against V4. Fewer entries for the
   agent, no file touched.
4. Visual Reuse Profile from other episodes' accepted intents (bounded lookback) plus a scarcity/alternative hint when one
   model+family repeats across distinct episodes. Soft signal only. Spec test 5.
5. Wire 3 and 4 into the authoring capsule; run the studio suite.

Not done by this slice (spec tests 3, 4, 7, 9, 10): owner-consistent model within a scene, cache invalidation scopes,
render parity, measured reuse benchmarks.

## Ledger
- Task 1-2: tools/studio_project/prop_families.py (manifest, resolve, PropVariantRequired) — tests/test_studio_prop_families.py 10 passed. Ruling: tests were written before the module but I did not run them before it existed, so RED was not observed. Costs: weaker proof that the tests can fail.
- Task 3: compact_props groups by family (97 files -> 60 entries + 30 meme slugs); prompt 17,257 -> 9,505 chars. Lossless proven by listed_prop_ids test.
- Task 4-5: visual_reuse() in agent_authoring, wired into the capsule as "visual_reuse" (None when no hints). Ruling: only OTHER episodes with video EXPORTED count (spec: accepted/rendered manifests, not drafts). 248 passed (agent, pipeline, catalog, families).
- Owner+cache slice: check_model_consistency() (spec test 3) hooked into proposal() via assert_prop_model_consistency; schema text tells the agent the rule. RED observed (ImportError) before implementation. Ruling: owner_id is optional on entities (compiler accepts it); an entity with no owner_id is only held to the within-entity rule. Adjacent-scene drift without owner_id is NOT checked (entity ids repeat across scenes without meaning the same prop). Cost if wrong: a swapped device between scenes of a story with no declared owner passes.
- Cache (spec test 7): tests/studio_prop_model_cache.test.mjs — model swap and state swap in one scene rebuild exactly appearance/geometry/scene nodes of that scene; voice/timing hashes and other scenes byte-identical; warm build 0 rebuilds. These passed on first run: the V4 compiler already scopes caches per scene and per asset, so no compiler change was needed.
- Frame review loop: agent_frame_review.py (plan/prompt/validate), VisualWorkspace.review_frames (export composition + hyperframes snapshot, one browser start), agent_bridge.start_frame_review (role vision = sol medium, localImage input), pipeline/vision.py + Autopilot._vision_review (after _autofix_geometry, max 2 rounds, repairs via luna _revise_scenes with VISION_REPAIR_HINT), inspect draft merges the saved review as method=visual. Switch: ZODIAC_STUDIO_VISION_REVIEW=off. Verified by hand: prepareExport + hyperframes snapshot on a fixture build produced a real 1080x1920 PNG (~13 s for 2 frames). NOT verified: a real sol call on real frames (needs the owner account/quota). Ruling: tests/pipeline_fakes.py defaults the review off so scheduling tests never reach a model.
- Authoring robustness audit (2026-11-26): every mechanical model slip is now repaired by Core instead of re-asking the model: cast pose/expression (swap/synonym/neutral), undeclared props (library exact/nearest/dressing alias), enter events, loose numbers, layer clamp, trigger text case/space snap, transition frame clamp, missing/wrong opening. Reuse of a failed run also rebuilds from child tasks and re-validates reused parts with current validators; an unscoped error repairs the skeleton only. Verified on the real failed run (8 scenes + skeleton): cast valid, assets valid, validate_authoring VALID. Ruling: unknown cast values become neutral (reported in bound_fields) rather than failing the run, cost: a lost nuance in a pose/expression.
