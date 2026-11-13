# Zodiac Compiler Core VNext — Modular, Incremental and Quality-Gated Refactor

> **Status: DESIGN ADDENDUM / NOT IMPLEMENTED · 2026-11-14.** Part of [Unified Zodiac Studio](./2026-11-14-agent-native-creative-studio-design.md) and [the phased roadmap](../plans/2026-11-14-unified-zodiac-studio-roadmap.md), PR #221. Source audit only; **not** a new speed benchmark or claim of improved quality.
>
> **Goal:** Make compilation predictable, fast to update after small scene edits, maintainable by a new agent, visually faithful to the approved story, and suitable for both the HyperFrames embedded editor and either export backend.

## 1. Why this needs its own medium-sized phase

The compiler is not one function. Zodiac currently has the canonical `.authoring/visual-intent.json` → projection compiler; V4 character/meme/environment builders; scene-direction placement; native scene workers; preview-pair generators; multiple validator/preflight entrypoints; several overlapping caches; a Phase 02 coordinator; legacy Job@5 projection and Remotion rendering. Replacing the renderer does not remove these costs.

A November 11 audit [docs/audits/2026-11-11-phase02-performance.md](../../audits/2026-11-11-phase02-performance.md) recorded **historical** last-receipt native-step sums of ~19–21 seconds for two workspaces, explicitly excluding agent authoring, retries, review, full wall time and video rendering. It does not prove that native compilation is the biggest end-to-end bottleneck. Never promise a fixed acceleration before baseline profiling.

Three routes were considered:

1. **Keep the current scattered orchestration and only add cache patches:** small immediate risk but keeps multiple source owners and makes Studio integration harder.
2. **Refactor around the existing V4 compilers, unified build graph and output adapters (chosen):** preserve working code, consolidate ownership, measure and improve incremental throughput, add visual quality gates.
3. **Rewrite all artwork compilation as HyperFrames-only HTML/components:** broad contract churn, risk of dropping existing V4 poses/memes and doubling development time; reject.

**Decision:** retain the proven V4 source/geometry and incrementally modularize around an explicit pipeline and typed/validated contracts. Do not add a second authoring format, a separate agent-only graphics engine, or a mandatory new renderer.

## 2. Verified source owners and pre-existing optimizations

| Current component | Evidence in repository | Retain/reshape |
| --- | --- | --- |
| Canonical authoring and projection | `features/visual-composition/compile-visual-intent.mjs`, `write-phase02-authoring.mjs` | Keep `zodiac-visual-intent@1` as ONLY editable visual source, hard-lock narration SHA/UTF-8 ranges; separate pure compile from transactional persistence |
| Character Assembly | `references/asset-library-v4/characters/compile-character-assembly.mjs` | Reuse identity signature and identity+pose+expression+crop dedup; add cross-scene/episode content-addressed reuse only with proof of equal bytes |
| Semantic graph | `core/cache/phase02-semantic-cache.mjs` | Already has scene/asset/preview dirty nodes and propagation; strengthen build planning and source ownership, don't replace with blind full rebuild |
| Checkpoint cache, hashes and tamper protection | `core/cache/incremental-cache.mjs`, `phases/phase02/phase02-execute.mjs`, `phase02-selected-dependencies.mjs` | Keep exact compiler/dependency/output hash verification; reduce unnecessary scan/re-hash by persistent versioned dependency manifests |
| Scene execution | `features/scene-production/native-scene-executor.mjs` | Already caches per scene, uses in-process path for <=3 scenes and bounded process workers for larger runs; profile before changing worker strategy |
| Source dependency collection | `phase02-execute.mjs` | Selected dependency path exists but full-tree collection fallback still exists. Map precisely why fallback triggers; no unsafe omission of executable imports |
| Native preview | `features/visual-composition/build-native-preview-pairs.mjs` | Already has per-scene SHA and output verification; add on-demand current-scene/frame API, preserve complete review-pair generation at review gate |
| Existing performance evidence | `core/performance/critical-path.mjs`, `diagnose-phase02.mjs`, `episode-profiler.mjs`, `core/audit/episode-utilization-report.mjs` | Reuse existing telemetry rather than inventing a parallel profiler |
| Human/native QC | `validate-phase02-progressive-preflight.mjs`, `validate-scene-experience.mjs`, `validate-visual-quality.mjs`, preview lineage and source-bound receipts | Preserve genuine approvals and technically verified receipts; augment quality checks, not replace them with AI subjective scores |

**Do not confuse:** a historical PASS receipt, code inspection, user review, image-quality judgment and a recent timed benchmark are different kinds of evidence.

## 3. Target compiler architecture and boundaries

```text
APPROVED NARRATION (immutable bytes)       V4 CATALOG / ASSETS (versioned)
                |                                      |
                v                                      v
  Visual Intent contract + semantic scene planner -> Resolved asset references
                |                                      |
                +----------------+---------------------+
                                 v
                     Versioned Build Graph
                    (source -> asset -> scene)
                                 |
            +--------------------+---------------------+
            v                    v                     v
     Asset compilation     Scene composition     Audio anchor mapping
  (character/meme/props)  (layout/events/states) (measured speech units)
            |                    |                     |
            +--------------------+---------------------+
                                 v
                      Validated Scene Graph
                   (derived, immutable snapshot)
                                 |
                   +-------------+-------------+
                   v                           v
           Preview adapter               Export adapter(s)
     HyperFrames/thumbnail at           HyperFrames Producer /
         one scene/frame                 static fast path / legacy Remotion
                   |                           |
                   +---------- parity ----------+
```

**Ownership / contracts:**
- **Authoring:** `zodiac-visual-intent@1`, scene IDs, narrative meaning, immutable narration hash, `narration_range` as UTF-8 byte offsets. Human/agent edit this only via bounded Studio command/revision.
- **Build graph:** immutable node identities `source`, `asset:<id,state>`, `scene:<id>`, `preview:<id>`, `review:index`, `export:<revision>`; explicit dependency edges; canonical versioned fingerprints (compiler implementation, catalog, design tokens, font, selected SVG bytes, relevant scene).
- **Pure compile:** contract validation -> semantic/asset resolution -> V4 assembly -> scene layout/events. No approvals, ZIP staging, plugin task coordinator or UI side effects inside pure compiler modules.
- **Transactional output:** atomic revision compare/commit and verified content-hash artifacts. No partial production plan, SVG, preview or receipt published after an error. Preserve existing leases/rollback.
- **Adapters:** common scene graph drives editor preview and final render. HyperFrames visual DOM may be derived, but its override data is **not** canonical Zodiac intent; never allow renderer/editor to silently rewrite approved narration or sourced V4 identities.
- **Validators:** schema, asset refs, lineage/provenance, geometry, action/state transition, speech anchors, caption-safe area and rendered parity. Human Visual Review remains independent.
- **CLI/Studio/plugin compatibility:** existing script entrypoints remain adapters over one compiler owner until tests prove old Job@5 remains reproducible. Do not prematurely delete old modules.

**Recommended file direction (subject to detailed Phase 3 plan):** a focused `features/compiler-core/` module boundary for graph/planning, asset compile, scene compile, preview adapter and receipt types; keep underlying existing V4 geometry functions in place. Avoid a mega-module or a duplicate copy of the V4 catalogs. One function/contract owner per artifact; do not migrate merely to rename files.

## 3.1. One-shot scene completion contract — user request vs internal DAG

**Product-level requirement:** for any S03 with an authored visual plan, the agent/user submits ONE bounded command, and Studio either returns one validated, fully resolved scene package or an actionable BLOCKED result. It must not require the agent to remember a dozen compiler scripts, run a separate step for hair/pose/props/memes and then guess whether the scene is complete.

**Proposed public Studio command (NOT currently implemented):**

```json
{
  "kind": "scene.compile",
  "project_id": "episode-id",
  "scene_id": "S03",
  "base_revision": 7,
  "mode": "preview",
  "idempotency_key": "unique-client-request-id"
}
```

- `mode=preview`: compile all **required authored scene constituents** and their coherent preview; cheap technical validation and missing-dependency checks are blocking. No human Visual Review is implied.
- `mode=review`: same full scene closure, plus complete required native scene validators, visual/semantic before-and-after review evidence ready to be shown to a person. It **does not** automatically record user approval.
- A command is a single **logical transaction**, not a promise that Node runs only one process. Internally the engine may use in-process compiler calls, bounded workers, cache, resvg or a renderer adapter as measured.
- `base_revision` protects source against concurrent agent/user edits; repeated `idempotency_key` returns the same committed result. Newer revision means `REVISION_CONFLICT` with no stale scene publication.

**Automatically discover and close the exact required scene manifest:**
- Existing V4 actor identity, selected body/hair/outfit/accessory, pose/crop/expression and all required actor states.
- All physical props and explicit scene events; narrative visual **or** story text as authored, never silently insert generic visual filler. Add Scene Accents only if the scene actually requests them.
- Scene layout, transforms/occlusion/layer safety, spatial role bindings and before/after transitions including meme setup→reaction; approved narration UTF-8 byte spans and selected measured voice anchors.
- Selected simple motion, caption segments/font/safe-area and scene preview states (as applicable); **no** media generated for scene elements absent from the authored intent.
- Source provenance of every image/state and a required-present ledger: `required_nodes`, `satisfied_nodes`, `blocked_nodes`; check cardinality and IDs of actors/props/states/events against the authored manifest, not only `production.json` structural validity.

**Internal orchestration:** resolve scene/asset closure -> validate source and exact active asset references -> plan reused/rebuilt nodes -> compile V4 assets -> compile scene state/layout/voice timing -> build on-demand scene/frame preview -> run scope-appropriate quality checks -> atomically publish verified scene artifact inventory and record one result. The engine may short-circuit unchanged nodes by verified SHA, but **not** skip required validators on a dirty dependency.

**Transaction behavior:** stage outputs under a per-request isolated workdir; never overwrite last healthy scene/preview until all required outputs and references verify; atomic publish and a monotonically ordered project event. On failure or cancel: `BLOCKED` with exact missing component/owner/code and recommended fix; no partial green `READY`, no spoofed review receipt, no half-updated visual projection. Recover safely after crash and don't lose original approved source.

**Proposed return envelope (fields will be locked in P3 tests):**

```json
{
  "status": "READY",
  "scene_id": "S03",
  "project_revision": 7,
  "scene_revision": "sha256:...",
  "required_nodes": ["actor:lead:neutral", "actor:lead:react", "prop:phone", "event:reveal"],
  "compiled_nodes": ["actor:lead:react", "event:reveal"],
  "reused_nodes": ["actor:lead:neutral", "prop:phone"],
  "missing_nodes": [],
  "artifacts": [{"role": "scene_preview", "path": ".studio/previews/S03/...", "sha256": "..."}],
  "validation": {"technical": "PASS", "visual_review": "PENDING"},
  "event": "scene.preview_ready"
}
```

These IDs and files are **illustrative shape**, not a claim that such artifacts or APIs exist now. A real result must include authoritative verified output refs, not merely a JSON response naming missing files.

**Agent-to-Studio relationship:**

```text
Human requests scene S03
  -> Studio Agent reads narration, approved storyboard and V4 catalog (read-only)
  -> agent proposes/commits one semantic scene intent revision via Studio command API
  -> agent requests scene.compile(project, S03, revision)
  -> Zodiac Core builds + validates actual SVG/scene/preview in its own workspace
  -> Zodiac Core commits immutable artifact refs/hashes and emits scene.preview_ready
  -> Studio event subscription loads that result from local artifact service
  -> human sees S03 and optionally authorizes Visual Review; agent may receive structured errors and propose a bounded fix
```

**Important distinction:** the agent does **not** send image bytes “up to Studio”, write compiler-owned JSON/ZIP directly, or fake approval. Studio owns the state and media, compiler owns the build. The agent authors scene **instructions** through allowed commands and reads result/repair feedback. When an art element cannot be assembled from V4 or a permitted procedural tool, the command must return `ASSET_CREATION_REQUIRED` or invoke an explicitly authorized asset generator; the compiler cannot invent arbitrary new drawings by merely being asked to compile.

**Scene S03 acceptance tests** (must be real end-to-end integration, not mocked UI): full component closure from intent; one command with all asset families; missing prop or acting state blocks rather than shipping partial; unchanged repeated command reuses outputs; edit only S03 rebuilds its dependency closure; shared V4 asset mutation invalidates all consuming scenes; stale revision rejected; renderer/preview loads verified S03 revision without export ZIP or full video render; interruption preserves previous preview; idempotent retry; no fake Visual Review.

## 4. Work units, size and outputs — Phase 3

Four reviewable tasks (not ten micro-phases; not one giant rewrite):

**3.1 Contract/ownership and pure compiler seam, including the proposed `scene.compile` request/result contract and required-component manifest.** Freeze golden representative input/output scenes and schema; map the current V4 owner, create one API for pure compile and plan, move no assets by default. Keep original entrypoints calling the new seam. Prove byte/semantic parity of scene IDs, actor states, event order, source hashes, post-review locks and generated artifact references.

**3.2 Dependency-accurate incremental build and worker scheduling.** Consolidate cache/step planning around existing semantic+checkpoint+native scene caches; use selected dependency graph, bounded worker concurrency, persistent source-version hashes and atomic output validation; remove redundant subprocess startups only where measurement supports doing so. Editing scene S03 must not rebuild S01/S02 unless the exact shared asset or global source changed. Missing/tampered outputs invalidate correctly.

**3.3 One-command scene transaction, one-scene preview and integrated visual QA.** Expose on-demand scene/frame preview using real V4 SVG outputs and versioned snapshot; run cheap static checks first and expensive full-scene/review checks at explicit boundaries. Add *non-fake* checks for face/hand occlusion, prop/actor interaction, legible caption safe-area, accidental Scene Set containment, clip/crop mismatches, absent state swap, meme setup->reaction, lost Narrative Visual/Story Text contract and speech-anchor drift. Check visual meaning against approved beats and actual image review; static rules cannot alone prove narrative quality.

**3.4 Benchmarks, fixtures, compatibility and failure recovery.** Measure cold/unchanged warm/single-scene-edit/character-change/review and CPU/RAM/disk on the user's Windows machine. Compare the same work with old and new builds; report agent authoring, tooling, compilation, review and render separately. Preserve deterministic hashes and existing Job@5 adapters. Update developer guide: one route for adding a new hair/pose/meme/context asset, one for adding a validator, one for diagnosing a cache miss. Rollback switch without data loss.

## 5. Mandatory regression corpus and scene-quality acceptance

Freeze these cases as machine-repeatable fixtures and viewable golden frames, recording version/source SHA, not as generically labeled “looks good”:

1. **Libra 3-state scale:** story-specific symbolic scale above the actor; left/balanced/right transitions and correct positioning.
2. **Gemini relationship reversal:** actor identity continuity, prop positions and the intended change of stance; no unrelated scene rerender on one-scene edit.
3. **Scorpio detective / meme:** normal setup then exact voice-anchored reaction, correct before/after expressions, asset states; no decorative “effect” returning from retired adapter.
4. **Aries ghosting or similar voice-twist:** actual Vietnamese audio anchor maps to visual reveal, caption stays <=2 lines without preempting punchline.
5. **Negative cases:** missing asset, modified SVG after PASS, corrupted cache, retired Scene Set as actor enclosure, source-approval drift, font/caption collision, cancellation/concurrent writes, unsupported HyperFrames override, malicious SVG/path traversal.

For parity compare at least one **opening, state-change, final/payoff frame** per case across native preview and candidate renderer, plus the audio/caption sync for a real measured take. Pixel differences may be attributable to fonts/antialiasing; explicit tolerances and manual signoff should be established during baseline, never blind pixel identity alone.

Quality targets are **non-regression on existing reviewed scenes plus fewer visible errors**, not “creative approval inferred from an AI score.” Show failure images, before/after and per-rule receipts.

## 6. Performance contract and no-fake-speedup rule

**Baseline in Phase 0:** capture end-to-end observed spans for real episode if available and at least synthetic repeatable fixture; collect full wall time, agent authoring time, number of retries, native step durations, startup cost, file hashing time, reused/rebuilt counts, preview-ready latency, Windows peak memory, disk/temp bytes, final render time. Existing audit data is historical context, not a current baseline. Missing span remains NULL.

**Execution in Phase 3:** run repeated (e.g. 3–5) comparable measurements using same machine, source commit, episode, input audio, cache state, worker count and output settings. Distinguish cold (no reused cache), warm (no edits), single-scene edit, shared-actor change, review-only. Report median and max, not best single sample; include cache hit/miss reasons and full compile correctness.

**Proposed go/no-go:** no material cold-run regression; measured warm and one-scene-edit latency improve over baseline; single-scene edit only rebuilds its dependent closure; output bytes/source hashes valid, no lost states/events, no degradation on golden frames or review. If the target speedup does not materialize, retain optimized subset and diagnose before further code removal. Do not invent a percentage gain before hardware baseline.

**Separate export study (Phase 7):** benchmark HyperFrames Producer against pinned Remotion and optional **static frame/state + FFmpeg** fast path for mostly static scenes. A static fast path must reproduce exact scene/voice/caption semantics and final quality; don't replace 150-frame export with 2 stills if captions or effects change during the interval. Renderer selection belongs in a pluggable backend, not inside character compiler.

## 7. Phase dependencies, stop conditions and maintenance

- **Phase 0** adds compiler map, baseline performance and quality golden fixtures; it does not rewrite compiler.
- **Phases 1–2** build the one-window host and measured audio anchors.
- **Phase 3** implements modular compiler core and proves on-demand V4 preview with command-compatible authoring and real QA, **before** Phase 4 uses it for HyperFrames editor round-trip.
- **Phase 4** uses the stable new compiler seam to integrate HyperFrames editing; it is not another compiler refactor.
- **Phase 5** gallery uses the same asset preview compiler, not another SVG-to-PNG subsystem.
- **Phase 7** chooses export renderer via real benchmark and compatibility. Keep pinned Remotion until replacement is proven.

**BLOCK:** any silent loss of an approved beat/event, unreadable SVG, wrong actor identity/hair/pose, false native PASS, review waiver, unrecoverable workspace mutation, unbounded Windows memory/disk pressure, or stale preview after a scene edit.

**Exit gate:** `scene.compile` builds every required S03 component in one request, produces one validated scene package and one preview-ready event, blocks without partial publication when incomplete; typed stable API and ownership guide; existing V4 contracts still work; cold/warm/single-edit logs; actual visual parity and golden scene screenshots; source-bound receipts and review boundary intact; reproducible deterministic test plan; fallback tested. This phase is not PASS merely because new module files exist.
