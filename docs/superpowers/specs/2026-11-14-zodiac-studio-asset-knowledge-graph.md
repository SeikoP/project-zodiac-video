# Zodiac Studio Asset Intelligence — Semantic Asset Graph and Agent Retrieval

> **Status: PROPOSED DESIGN / NO RUNTIME IMPLEMENTATION, 2026-11-14.** Companion to [Unified Zodiac Studio](./2026-11-14-agent-native-creative-studio-design.md), [Visual V5](./2026-11-14-zodiac-visual-v5-color-system-design.md) and [Compiler VNext](./2026-11-14-zodiac-compiler-refactor-design.md). This document specifies a small, local, source-derived **knowledge graph for retrieval**; it is **NOT** the asset/scene compilation DAG and it does **NOT** call for Neo4j, networked graph infrastructure or an online LLM/embedding service.

## 1. Current verified selection chain and limitations

Source audit on repository main (November 14, 2026):

- **Agent creative decision** is currently guided by the plugin's `references/asset-library-v4/selection-guide.md`, `selection-policy.json`, `props/index.json`, `mechanics/index.json`, `memes/index.json`, character catalog, shot layouts and `features/visual-composition` authoring contracts. The guidance says story first, select actor identity/hair, action, real physical props and optional meme/context/effect. It specifically says **Narrative Visual is scene-specific authored art**, not an ordinary catalog item.
- `core/policy/select-asset-guidance.mjs::selectAssetGuidance` **validates preselected IDs**, excludes retired IDs, resolves small `asset_needs` via `coverage-matrix.json` / `capability-index.json`, and returns the plugin reference files to load. It **does not infer needs from narration, perform broad semantic search, rank props, propose an actor+prop+mechanic bundle, or manage visual variety across an episode**.
- The present `features/asset-selection/build-current-asset-review.mjs` generates a **standalone static HTML list** and hash receipt, filters by group and ID text, and downloads `zodiac-asset-selection@1`. Its HTML currently serializes `environment_mode:"scene_set"` while the latest fresh authoring guidance requires canvas-native Scene Accent. It has no Studio API, semantic search, ranked alternatives, actor compatibility proof or automatic source revision/preview round-trip. This must be cleaned during migration; do not reuse that HTML unchanged as the new Studio asset picker.
- Several catalogs **already contain usable graph edges**: `props/index.json` has `contexts`, `role`, `compatible_mechanics`, `contact_sockets`, `state_of`; `mechanics/index.json` has required role capabilities; `memes/index.json` has participant role bindings, mechanic and optional assets; `selection-policy.json` has extension refs and retired IDs; `character/components/catalog.json` has body/hair/pose/expression and silhouette families; `selection-guide.md` has character identity diversity and Narrative Visual special handling.
- `compile-visual-grammar.mjs` validates the **already selected** frame/mechanic/meme/role bindings and generates scene composition; it does **not** choose which visually relevant objects to add.
- `tools/studio_v2/` and current `tools/studio_qt/screens/` provide voice, stage/job, render and package/media UI, but the inspected source has **no agent-facing ranked semantic asset service or full HyperFrames-embedded Studio selection UI**. The one-window agent/asset experience is planned, not delivered.
- Existing unrelated DAGs are **build graphs and provenance caches**, not a creative-semantic selection graph. Do not conflate them.

**Consequence:** the agent effectively uses plugin instructions + available catalogs to decide selections, then compiler/validators reject invalid choices. The catalog knows many individual capabilities but doesn't help proactively **compose a meaningful scene**. It can repeatedly fall back to obvious hair, phone, generic props or stock meme even where story demands a unique visual.

## 2. Decision: source-derived local Asset Knowledge Graph + typed agent API

Choose a **hybrid typed graph and deterministic candidate finder**, backed by the existing JSON catalogs. Store a small **incrementally generated local index** (SQLite tables + FTS5 text search if available; otherwise a bounded JSON/in-memory index), **not** another manually authored asset catalog. Use graph edges and typed filters to resolve a small set of coherent options, then a scene-aware scorer and an agent/human creative decision. Both agent and user Studio UI query **the same source/version**.

Rejected alternatives:
1. **Prompt-only plugin context**: simplest but repeatedly loads long text, misses relationships/retired capabilities and needs many repair turns.
2. **Embedding-only semantic vector search**: can retrieve superficially related objects but doesn't guarantee physical contact, role fit, artist approval or retired-ID exclusion; requires model/storage without clear benefit at current catalog scale.
3. **Dedicated Neo4j/network graph database**: disproportionate complexity and memory on a low-resource Windows laptop for a catalog numbering in the hundreds, not millions.

The graph is a **knowledge index**, not a second compiler, source-of-truth, vector memory, graph database service, scene authoring format or permission system.

## 3. Node and edge contract

**Node types:** `beat` (approved narration source range and scene goal, query-scoped), `asset` (V4/V5 catalog ID and exact source hash), `character_profile`, `pose`, `expression`, `outfit`, `prop_state`, `mechanic`, `meme_template`, `context_accent`, `theme`, `contact_socket`, `capability`, `validated_scene_usage` and `generated_asset_request`.

**Stable edges:** `supports_action`, `requires_role`, `compatible_with`, `connects_to`, `has_state`, `shares_identity_with`, `requires_contact`, `allowed_as`, `incompatible_with`, `excluded_in_fresh`, `inherited_from`, `used_in`, `provided_by_catalog`. Each edge is derived from a specific source file and carries `source_file`, `source_sha256`, `schema_version`, scope (fresh/legacy) and optional confidence/validation data. A missing relation does **not** become an invented relation just because an LLM finds it plausible.

**Example relationships grounded in current catalog** (illustrative, all independently verified at index build):
- `prop:magnifying-glass` → contexts `inspection`, `doubt`, `discovery`; `compatible_mechanic:show-object` where recorded, with grip sockets.
- `mechanic:pass-object` → requires giver, receiver, physical prop and explicit hand/prop contact contract.
- `meme:receipt-in-face` → requires `show-object` and particular bound scene roles.
- `character:lean_tall` + `hair:shoulder-wave` + `pose:raise-evidence` → viable **only** after compatibility checks; not auto-selected just because these IDs exist.
- `scene-set-*` → legacy/retired-for-fresh, **not** a fresh scene recommendation.
- An authored `Narrative Visual` is **not** an ordinary graph retrieval result: its abstract need may be indexed, but actual artwork must be created or approved as scene-specific imagery. No arbitrary zodiac glyph filler.

## 4. Agent selection workflow: plan beat → find → compose → explain → preview

```text
Phase 1 approved story + measured voice/beat anchors
  -> Agent: propose whole-episode scene/beat intent (no source rewriting)
  -> Studio Asset Intelligence: scene requirements / intent shape
  -> Local graph: asset candidates + compatible mechanic/state/context edges
  -> Hard filters: active/versioned, role match, physical contact, fresh mode,
      visual exclusivity, existing rights, asset path/hash, cast and caption-safe constraints
  -> Rank viable **bundles**, not isolated tags
  -> Agent chooses/justifies a bundle or issues a typed new-art request
  -> Studio: bounded canonical Visual Intent commit (revision checked)
  -> episode.build / scene.compile resolves and validates actual V4/V5 geometry
  -> Studio receives actual thumbnails/preview + alternatives + errors
```

**Proposed read-only commands** (to be versioned on P1 service seam/P3 working candidate resolver):

- `assets.describe_catalog({project_id, filters})` gives compact vocab and catalog revision; no 100-page plugin context dump.
- `assets.search({project_id, query, scene_goal, required_roles, mode:"fresh", limit:8})` returns grounded candidates with ID/source hash/tags/roles/contact support and exclusion reasons; text/FTS lookup is an entrypoint, not final ranking.
- `assets.suggest_bundle({project_id, scene_id, beat_ids, action, cast, existing_scene_assets, creative_constraints, limit:3})` returns **coherent bundles** of actor states/props/mechanics/accents/meme (if justified), with reasons, unsupported requirements and rough asset-compile cost.
- `assets.inspect({asset_id, revision})` returns native preview/media ref and exact capability/provenance/reuse info; no unverified third-party URL guessed.
- `assets.request_new({project_id, scene_id, purpose, required_visual_behavior, rationale})` creates an **asset creation task**, not silently fabricated artwork or an approved choice.
- Studio project writing stays on the existing authorized **Visual Intent edit command**. These retrieval endpoints may NOT directly write canonical authoring or record human approval.

**Result fields:** `catalog_revision`, `candidate_id`, `component_ids`, `source_hashes`, `supports`, `required_contact_checks`, `missing_requirements`, `reasons`, `alternatives`, `expected_dependencies`, `rejected_candidates` with codes, `preview_ref` when actually available. `recommended` is not `approved`; it is a candidate.

**Ranking rules:** mandatory compatibility and source legitimacy constraints are **hard gates**, never soft scoring. Only surviving bundles rank by story-role clarity (not literal word match), performed action/spatial fit, reader clarity, coherent character identity/hair diversity, whether the prop is genuinely used, continuity/reuse cost, novelty vs episode overuse and generated-asset complexity. Record per-reason explanation. Candidate weights require fixtures/measurement and human review, not magic “AI quality 98%” numbers. Exclude repetitive generic stock props when an actual scene-specific visual is needed.

**Important creative flexibility:** if no asset truly fits, return `NO_FIT_ASSET` + a concrete `new_asset_request`, **never rewrite the story to match available masters**, pick a wrong prop to satisfy quotas or label a decorative symbol as Narrative Visual. Agent then seeks a new authored V5 SVG/procedural asset with an explicit review task and source lineage.

## 5. Performance and data ownership

- Generate index from **existing canonical registries**, not maintained duplicates; an initial disk-backed normalized index can be `asset_nodes`, `asset_edges`, `asset_text_fts`, `catalog_sources`, `asset_usage`. Keep schema tiny, source-specific, replaceable; no Neo4j, remote service, GPU or mandatory embedding weights.
- Rebuild only changed source catalog entries on source digest changes, not on every agent question. Cache top-k searches and bundle suggestions keyed by `catalog_revision` + beat/constraints + actor IDs, not whole episode as text.
- Query-scoped beat nodes are ephemeral/revisioned, not permanently duplicated into the asset catalog. Reuse previous accepted selections only as **examples with reason and context**, not unverified “viral winners”.
- Keep **asset knowledge graph separate from compiler build DAG**: asset graph answers *which artwork/action fits and why*; build DAG answers *what to compile and invalidate*. They meet at the manifest of selected canonical IDs and source hashes.
- Asset/preview retrieval is read-only and should fit small Windows memory: lazy thumbnail generation, bounded result set and no eager cross-product of actor×pose×theme. Measure median/p95 lookup time, index size and source refresh cost before choosing a vector ANN component.
- If user later brings thousands of free-text assets and retrieval recall is inadequate, add **optional semantic embedding reranking** of top candidates, after hard filters, with offline cache/versioning and no network requirement. This is not a first-phase dependency.

## 6. Studio / phased refactor ownership and right-sized task gates

Keep the eight-phase roadmap; no independent nine-phase “asset network project”.

- **P0: inventory + fixture.** Freeze current selection guide, policy, catalog variants and known disallowed stale Scene Set IDs; record current first-choice tendency and number of agent/context/repair turns for real episodes where evidence exists. Build fixture queries for Gemini social reversal, Scorpio discovery/evidence, Libra scale state changes and a real unknown missing prop.
- **P1: lightweight catalog API seam.** Add typed read-only catalog/asset lookup to existing Project Core/agent command transport, with source revision and permission scope. It can expose IDs, roles and exact provenance without pretending a ranked semantic suggestion engine already exists.
- **P3: first working **candidate resolver**.** With the whole-episode compiler, index V4/V5 catalogs into a typed graph, provide hard filters + bounded bundle suggestions and `NO_FIT_ASSET` requests, and pass selected source IDs/roles/dependency manifest to `episode.build`. Test old selected IDs/legacy decode and no shadow authoring registry.
- **P4: Studio agent/editor round-trip.** Agent searches and proposes through Studio, user can inspect 2–3 candidates/why, selected option changes canonical Visual Intent and rebuilds only the right scene; both see same index and catalog revisions.
- **P5: full V5 catalog & visual gallery.** Extend graph with V5 palettes, actor hand/gaze anchors/prop mechanics, source-specific thumbnail view and feedback on reviewed outcomes; deprecate static plugin HTML selection from fresh flow. No forced embedding/vector server.
- **P7: E2E validation.** Compare agent selection/repair turns and wall-clock vs old plugin-only flow across scene fixtures; real human grades story relevance, interaction geometry, hairstyle diversity and preview fidelity. Fail if graph selects an inappropriate but tag-matching asset as final, repeats identical generic decor across the episode, or omits unique authored illustration.

**Acceptance tests (minimum):**
1. Search returns `magnifying-glass` for discovery/inspection only when matching role, with real source/compatibility evidence; no fabricated source.
2. A pass-object candidate must bind actual giver/receiver/prop and contact points, else rejection with typed missing role/contact code.
3. Fresh mode never returns `scene-set-home` or stale standalone HTML `environment_mode:scene_set` as a valid canvas-native selection.
4. Gemini female protagonist retains approved identity and differentiated hair from simultaneous cast across scenes; selection isn't “first sorted catalog row”.
5. Libra 3-state scale above actor is recognized as **scene-specific Narrative Visual**, not substituted with a magnifying glass or unrelated generic prop.
6. Missing suitable art yields `NO_FIT_ASSET` and request path, not an invented or repeated random symbol.
7. Catalog source update or asset retirement invalidates only affected index records and dependent scene build nodes; unchanged query fast path reuses cache.
8. A candidate suggestion alone must not create generated SVG, mark complete, mark human Visual Review PASS or rewrite Phase 1 approved narration.
9. Studio UI and agent see same exact candidate IDs/availability/preview; crash/restart and stale index revision are safe.
10. Bench real episode: count authoring turns, unnecessary full catalog reads, invalid ID repairs, duplicate assets, user rejected proposals, time-to-reviewed-frame and RAM/disk. Claim speed/quality improvement only when independently observed.

**Stop conditions:** another required app/database for local Studio, duplicate catalog ownership, fallback to retired Scene Set, LLM auto-approval of artwork, hidden prompt-only source rewriting, arbitrary “asset relevance” scores without geometry verification, or wrong image selected just because keywords match.
