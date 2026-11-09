# Zodiac Video Local bottleneck fixes — 2026-11-09

Status: implemented on PR #214; no release/merge implied.

## Fixed in this branch

- Removed CodeGraph from the production runtime and made exact path / scoped ripgrep the exceptional source lookup path.
- Phase-2 finalization no longer implies `--force`; exact native checkpoints remain reusable and only the final director review is forced fresh.
- Production performance spans now carry stable run/revision identity and monotonic intervals across Phase 1/2/3. Failed repair attempts stay inside wall-clock accounting but no longer invalidate a revision that later obtains a PASS for every phase. The Phase-2 structural success state is normalized to telemetry PASS while its real state is preserved in metadata.
- Native step cache fingerprints are scoped to files owned by that step instead of making unrelated environment/scene validators depend on narration and character-plan bytes.
- Raw SVG invalidation is limited to asset-consuming owners. Structural scene-event, motion and publish validators no longer depend on unrelated library SVGs.
- Post-step input/output signatures are each captured once and reused for the receipt/checkpoint. Concurrent input change fails closed.
- Scene-native asset hashing deduplicates shared files within the initial pass and within the final integrity pass. It does not memoize across revisions.
- Draft context defers exit-only compiler/validator references; review restores them. Existing explicit references still win.
- `resume-brief --context` reuses its already verified internal step plan instead of planning/hashing the same reference selection twice. Current policy and reference hashes are still revalidated before delivery.

## Verification

Local clean checkout verification on this branch:
- complete Zodiac Node plugin test glob: PASS;
- plugin/split/source-bundle and Web→Local handoff Python tests: PASS;
- orchestration benchmark: Phase-2 `visual_compile` and `assets` both fit the default 16k draft transport budget with zero pending references;
- phase02 simplification and incremental-cache benchmark scripts execute successfully.

The previous benchmark had 7 pending references for `visual_compile` and 5 for `assets`; both are now 0 under the same synthetic orchestration benchmark contract. This is a context-delivery result, not an LLM or complete-video speed claim.

## Deliberately not parallelized

The main native writer loop is not blindly parallelized. Character, environment, scene-direction and projection owners can mutate shared production/assets and checkpoints. Parallelizing these before write ownership/staging is separated would trade latency for race conditions and non-deterministic receipts.

Independent read-only preflight is already bounded-parallel. After the invalidation fixes above, warm repair/finalization work should skip unrelated native steps. A future parallel-native change must first prove disjoint reads/writes from the authoritative dependency graph and use one checkpoint commit owner.

## Remaining acceptance before merge/release

- Run a representative real episode through Local Phase 2 → genuine Visual Review → Phase 3 on the user's CLI environment and collect the new E2E profile.
- Compare cold, no-change warm, one-scene repair, shared-cast repair and finalization workloads.
- Inspect actual preview/review output; CI/native PASS is not creative approval or MP4 acceptance.
