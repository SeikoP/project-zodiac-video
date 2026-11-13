# Zodiac Studio Asset Intelligence — Constraint-First Asset Decision Engine

> **Status: REVISED DESIGN / NOT IMPLEMENTED · 2026-11-14.** Replaces the premature **graph-first** architecture previously proposed in this document. Follows [Unified Studio](./2026-11-14-agent-native-creative-studio-design.md), [Visual V5](./2026-11-14-zodiac-visual-v5-color-system-design.md), and [Compiler VNext](./2026-11-14-zodiac-compiler-refactor-design.md). The source-derived relations remain usable but a knowledge graph / SQLite FTS index is **NOT a prerequisite**.

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



**Catalog size check:** the inspected current V4 main catalog contains 57 props, 30 meme compositions, 21 mechanics, 34 poses, 19 expressions, 6 shot frames, 18 hair options, 6 body profiles, and 13 legacy-linked scene accents. This is a modest catalog. There are many *possible combinations*, but no demonstrated lookup throughput problem requiring a separate graph index or vector database. Selection-quality and authoring-repair problems should be measured, not inferred from these counts.

## 2. Critical reconsideration and decision

**Primary question:** is the visual wrong because the asset was hard to *find*, or because the agent interpreted the **story action/payoff** incorrectly? The latter can remain wrong even when graph traversal returns perfect compatible props. Graph edges cannot by themselves choose a compelling story image, calculate a punchline's reveal timing, or create an unseen object.

| Architecture | Real benefit | Failure/overhead | Current decision |
| --- | --- | --- | --- |
| Prompt-only plugin manuals | Flexible authoring, no new code | Repeat long context, incompatible/retired IDs, unpredictable repairs | Keep as guidance/fallback, NOT the deterministic selector |
| Graph-first Knowledge Graph / Neo4j | Traverse known compatibility edges | New index ownership and persistence, doesn't understand story or prove scene, weak incremental value at present catalog scale | **Do not implement as a separate subsystem** |
| Embedding/vector retrieval | Free-text recall and synonym search at scale | Similarity is not role compatibility; model/runtime/index overhead; narrative hallucination | Defer until catalog/search test proves gap |
| **Semantic intent planner + hard typed constraints + bounded candidate search + story-aware ranking + cheap visual feasibility check** | Separates creative meaning from physical feasibility and build cost; uses existing catalogs; compact API for agent | Requires a reliable beat contract and human review of ranking quality | **Recommended primary approach** |
| Full constraint solver / CP-SAT | Useful if complex coupled cross-scene optimal selection dominates | Extra dependency/integration/solver modeling; unnecessary for ~hundreds of catalog entries | **Defer**; first use direct filters/backtracking/beam search |
| Freely generate all missing SVG with LLM | Unlimited novel visuals | Cost, consistency, latency, approval and traceability problems | Distinct on-demand creative asset request only |

**Decision:** implement **Asset Decision Engine** with small **typed capability maps** (which form a graph conceptually), not a graph database or elaborate persisted graph model. Graph traversal can be added as an internal derived query only when a proven query cannot be handled by simple joins/maps. The *compiler build DAG* is still a separate concept for dirty dependency execution.

## 3. Five layers with single ownership

### 3.1 Episode semantic planning (creative)

The agent reads the approved Phase 1 narration, selected measured voice anchors, concept and cast continuity. **Once per episode** where possible, it proposes explicit per-beat requirements:

- intended audience insight/visual payoff and why an image is needed (not all narration needs a prop);
- performing actors and their relations; action, target, attention/gaze and before→after reaction;
- physical vs symbolic vs text depiction; optional scene context and appropriate complexity;
- when exactly the visual reveal may first appear relative to spoken words;
- identity continuity, repeated motifs and what must **not** appear.

A typed `BeatVisualRequirement`/episode draft becomes the intermediate planning envelope. It does **not** independently become a second editable creative source: committing an approved choice writes canonical `.authoring/visual-intent.json` through Studio commands. Strong requirement: no stock prop substituted merely because narration says a word.

### 3.2 Source-derived capability index (deterministic, small)

Create a compact **in-memory normalized index** or generated JSON read-through of existing **authoritative** catalogs: V4/V5 character states, mechanic requirements, physical props with grip sockets, meme role bindings, context accents, approved theme capabilities and retirement/scope policy. Refresh on SHA/version change. No duplicate manually maintained graph database, no mandatory SQLite FTS for this catalog size. Project Core's existing SQLite is sufficient for *usage history/provenance*, not automatically a new graph store.

Expose `assets.describe` and `assets.search` as typed read-only Studio service commands. The agent sees compact current capabilities and source hashes instead of reading the full plugin manuals repeatedly. Free text matching is optional convenience; use explicit action/role fields for actual candidate selection.

### 3.3 Hard constraints and candidate generation (deterministic)

Start from authored requirements then filter out impossible/undesirable combinations **before** ranking:

- unknown, retired, fresh-forbidden Scene Sets; invalid source hash or unsupported V5 theme;
- incompatible actor pose/state/expression, missing grip/contact sockets, unbound giver/receiver/target/mechanic/meme role;
- no approved/measured voice anchor where an exact reveal is required, text/visual mutual exclusion and caption safe region conflicts;
- character ID/actor continuity, prop ownership/state at each beat, cross-scene stable motif;
- a Narrative Visual that requires **new original scene artwork** cannot be satisfied with an unrelated icon.

Generate bounded **bundles** `(actor, pose, expression, action, prop?, meme?, context?, state transition?)` using indexed maps + deterministic rule checking. For complex multi-actor interactions, use bounded backtracking or small beam search; don't enumerate an unrestricted character × pose × theme × prop cross-product.

If nothing satisfies the requirements: return `NO_FIT_ASSET` plus typed **new scene-specific asset/illustration request**, not an irrelevant generic substitute or rewritten approved script.

### 3.4 Soft story ranking (human-testable, not fake quality score)

Only feasible candidates are ranked by *relative* evidence: narrative causal relevance/payoff clarity, action/prop interaction readability, cast/scene continuity, meaningful variation across the episode, production/reuse cost, visual density and whether the candidate delays the reveal correctly. It may use an agent/LLM to compare **small candidate sets** and explain tradeoffs, but deterministic hard constraints must not be overridden by subjective LLM preference.

Return 2–3 candidates with **source IDs, required acting states, feature reasons, proof of constraints, cost/reuse estimate, real thumbnail reference if available** and `not_approved`. Do not invent probabilities such as '94% viral' or rank from unverified prior clicks.

### 3.5 Cheap visual proof and learn from human corrections

Before full episode render, run a low-cost layout/contact/occlusion/caption/reveal-timing check for the chosen bundle, followed by a real preview of significant story beats. User Visual Review remains authoritative. Track **reasoned user rejection, not ungrounded likes**. Record e.g. 'prop unrelated to punchline', 'face hidden', 'wrong hair', 'reaction too early', and use this to update authoring guidance and tested rank features, not to auto-approve visuals. Derived feedback is not another editable creative canon.

## 4. Studio/agent interfaces

```text
APPROVED WHOLE EPISODE + MEASURED VOICE + CONCEPT
                   |
                   v
      Agent proposes BeatVisualRequirement[] once
                   |
                   v
        Studio Asset Decision Engine
          A. Capability lookup
          B. HARD constraint filter
          C. bounded bundle generation
          D. story-aware ranking + rationale
                   |
             +-----+------+
             |            |
       viable 2–3      NO_FIT_ASSET
             |            |
             |      asset creation task/review
             v
      canonical Visual Intent commit
                   |
                   v
       episode.build / scene.compile
                   |
                   v
       actual Studio preview + human review
```

- `assets.describe({scope})`: compact source-defined catalog and capabilities;
- `assets.find_candidates({project_id,beat_id,requirements,limit:3,catalog_revision})`: deterministic feasibility + bounded ranked bundles with reasons and exclusions;
- `assets.inspect({component_id})`: real source/hash, ability/contact constraints and verified preview if available;
- `assets.request_new({scene_id,desired_visual,reason})`: no-fit authored asset task, distinct from automatic compilation;
- `visual_intent.apply_selection({base_revision,scene_id,candidate_id})`: **the separate authorized Studio write path**; cannot imply user approval.

The agent does not write direct plugin source, generated SVG, renderer JSON or approve human QA; no separate asset database is required for those actions. A candidate score or one screenshot is not proof of story quality.

## 5. Why this is faster / how to measure honestly

Hypothesized savings are in **agent/context/rework loops**, not raw index traversal latency. Record with comparable approved episodes:

- number of catalog/docs tokens loaded and repeated per episode;
- number of asset selection turns, invalid ID/role/contact repairs, unrelated prop/meme choices, no-fit inventions and user rejections;
- time from episode narration to first whole-episode Visual Intent and first reviewable preview;
- time spent on heavy compiler/repreview after unsuitable selections;
- diversity and actual payoff readability from genuine user reviews;
- first-query latency, memory/index size and shutdown time on the low-resource Windows machine.

Implement the simplest in-memory indexed selector first. If free-text retrieval misses assets even though the underlying compatibility exists, trial SQLite FTS5 next; it supports full-text matching/ranking but **not** geometric or story validity. If the catalog becomes thousands of rich, unstructured user assets and recall is still poor, add optional local embedding reranking **after** hard constraint checks. A CP-SAT solver only becomes worthwhile if manual bounded search fails on real tightly coupled cross-scene constraints.

## 6. Same eight-phase plan (no graph-specific architecture milestone)

- **P0:** freeze selection catalog/policy and baseline 57 props/30 memes/21 mechanics; negative fixtures where tag-matching object is narratively wrong, Scene Set legacy picker exports wrong mode, and no-fit art is required.
- **P1:** Studio read-only `assets.describe` source/revision API, no pretend semantic recommender.
- **P3:** implement BeatVisualRequirement type, typed capability map, hard filters, bounded bundle generation and minimal rank rationale **alongside** one `episode.build` manifest owner. Unit/negative tests for constraints and action/prop correctness. The selector is not the build DAG.
- **P4:** agent receives structured scene/episode selection suggestions; Studio shows rationale and preview, user selection commits canonical intent via one revisioned command.
- **P5:** use same capability map for V5 asset/theme/interaction gallery, incremental source refresh, previous episode usage and new asset creation review. No second graph, gallery DB or plugin HTML for fresh flow.
- **P7:** A/B with existing plugin-based selection and same sample scenes; ship only if candidate feasibility, Visual Review and end-to-end agent repair time improve with no regression.

## 7. Acceptance criteria (behavior, not diagram presence)

1. A Bọ Cạp evidence beat proposes a plausible physical act and role-compatible phone/receipt/magnifier only when the story calls for it; no 'detective' keyword→mandatory magnifier rule.
2. Gemini changing an opinion does not become a random dual-face icon; cast action/state/reversal timing follow the approved beat. All accepted candidates honor source role/contact.
3. Libra above-head, left/balanced/right scale remains **scene-specific Narrative Visual** and cannot be replaced by a random catalog symbol; if not drawable, `NO_FIT_ASSET` with authored-art task.
4. A different-but-contact-compatible prop that is causally unrelated to the punchline can be rejected at the semantic ranking/Visual Review stage and its reason recorded.
5. Retired Scene Set IDs and stale `environment_mode:scene_set` fresh selection cannot pass. Source hash drift invalidates candidate source/recommendation deterministically.
6. No prop/effect/SFX quota: a scene may have actor + expression only if that best serves the story. Agent cannot alter approved narration to fit the catalog.
7. No mocked image-review PASS, source lineage false claim, approval from ranking or deleted old packages. Source and catalog legacy remain readable.
8. Compare selection agent turns and reviewable whole-episode wall time across a real multi-scene fixture, plus valid selected bundles/preview identity, CPU/RAM/disk and whether generated unique art actually fulfilled beat.

**Stop:** engineering a separate persisted knowledge graph before the first constraint/ranking evaluation, equating search relevance with visual narrative quality, adding an always-on graph service, or claiming performance gains from fewer index queries without counting agent repair loops.
