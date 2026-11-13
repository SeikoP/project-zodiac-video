# HyperFrames migration inventory — modules, assets, contracts

> Status: **REVISED / EMBEDDED EDITOR FIRST / PLANNING ONLY**, 2026-11-14. No implementation, migration or full-video benchmark in this PR.
> Parent: [Studio platform ADR](./2026-11-14-studio-platform-choice-adr.md), [Agent-native Studio design](./2026-11-14-agent-native-creative-studio-design.md) and [Compiler VNext addendum](./2026-11-14-zodiac-compiler-refactor-design.md).
> Repository baseline: `fa457a9351c33ace1da66bd089af8a1861e53838`.

## 1. Answer: this impacts the asset library, but not its authored artwork

**First product goal is a unified Studio with a reliable modular V4 compiler, NOT a compulsory rendering-engine replacement.** Use HyperFrames's embedded React Studio components and SDK inside the one-window Zodiac app. Keep Zodiac Core, voice pipeline and V4 library. Only after working voice-first editor preview, reverse edits and a benchmark should HyperFrames final rendering replace pinned Remotion. The existing V4 Character Assembly bakes SVG per planned identity, pose, expression and crop. The current renderer receives those baked SVG assets; HyperFrames can initially consume the exact output with stable paths and rendered HTML/SVG elements.

The source library is not the same as its runtime presentation. To prevent mismatch, preserve the canonical source and test a new adapter.

## 2. Module-level inventory

| Area | Concrete source | Change | Explanation |
| --- | --- | --- | --- |
| One-window Zodiac shell (new frontend) | new Zodiac React host, `@hyperframes/studio`, `@hyperframes/sdk` | NEW FRONTEND | One `zodiac` app, single project selector; embedded preview/inspector/timeline, not separate HyperFrames desktop app | 
| Voice-first Studio entrypoint | `tools/studio_v2/session.py`, `executor.py`, `voice.py`, `timing.py` | NEW ADAPTER + REORDER | Import approved Phase 1 directly into local Episode Project, audio take selection/measurement BEFORE scene timing and visuals | 
| Concept/series checklist | `tools/studio_qt/production_checklist.py`, `screens/concepts.py` | KEEP LOGIC, REPLACE UI | Unified concept × 12 sign × episode evidence projection, migrate planned-concepts.json and series checklist; no duplicate manual tracker | 
| Packages/media/library | `tools/application/library.py`, `screens/library.py` | KEEP LOGIC, REPLACE UI | Scan old ZIP and workspaces, safe reversible archive/restore; index source lineage and actual exported assets | 
| V4 thumbnails/gallery | `features/asset-selection/build-current-asset-review.mjs`, `characters/build-identity-preview.mjs`, `core/audit/preview-meme-acting.mjs` | REUSE + EMBED | Preview each selectable component and generated variant on demand; not a second V4 catalog | 
| Phase 1 Web, narration/concept/review | `orchestration/phases/01-content.md`; `contracts/phase1-handoff.mjs` | KEEP | Phase 1 is renderer independent; preserve immutable approved v2 handoff. |
| Local handoff import | `phases/local/import-phase1-handoff.mjs` | KEEP + ADD integration | Import into revisioned Studio project; no direct source overwrites. |
| Visual Intent canonical source | `features/visual-composition/compile-visual-intent.mjs`; `.authoring/visual-intent.json` | KEEP | Fresh source stays one; compiler-owned projections remain immutable. |
| Visual Grammar/Scene Direction | `references/asset-library-v4/compile-visual-grammar.mjs`, `scene-direction/compile-scene-direction.mjs` | KEEP / adapter impact | Continue to produce Zodiac entities/transforms/state refs; translate into HyperFrames. |
| Complete scene build/transaction | `phases/phase02/phase02-execute.mjs`, `core/cache/{incremental-cache,phase02-semantic-cache}.mjs`, `features/scene-production/native-scene-executor.mjs`, `build-native-preview-pairs.mjs` | COMPILER VNEXT PHASE 3 | Add one revision-scoped `scene.compile` command that resolves and verifies **every** S03 component, reuses valid cached nodes, stages an atomic scene package and emits `scene.preview_ready`; preserve old entrypoints during transition. |
| Character SVG compiler | `references/asset-library-v4/characters/compile-character-assembly.mjs` | KEEP | SVG state baking is renderer independent; retain identity and component IDs. |
| Meme/props/environment compilers | `references/asset-library-v4/memes/compile-meme-props.mjs`, `environments/compile-environment.mjs`, `scene-set/...` | KEEP, test output compatibility | Consume generated SVG/assets; never re-enable retired fresh Scene Set through migration. |
| Asset registry and provenance | `references/asset-library-v4/manifest.json`, `characters/components/catalog.json`, `props/index.json`, `memes/index.json`, `creative/library-catalog.json` | KEEP + EXTEND index | Add materialization metadata, preview thumbs, hash and source-to-renderer refs; don't duplicate catalogs. |
| Native render-plan validation | `tools/control_plane/render_plan.py`; `contracts/render-plan-v1.schema.json` | KEEP as input validation, ADD adapter | Allow render-plan@1 as intermediate for migration; emit versioned HyperFrames project. |
| Timeline/audio alignment | `tools/control_plane/timeline.py`; `tools/studio_v2/timing.py` | KEEP core logic, ADAPT display and render schema | Measured word/phrase alignment remains authoritative; retain voice anchors and scene ranges. |
| Original Remotion renderer | `runtime/zodiac-renderer/2.0.2/renderer/src/Root.tsx`, `ZodiacRenderPlan.tsx` | **KEEP for production/legacy until independent renderer pilot passes** | Do not rewrite Remotion to embed a HyperFrames editor. Translate simple story rendering behavior only if final backend migration is later approved. |
| Preview/render process | `runtime/zodiac-renderer/2.0.2/renderer/scripts/preview.mjs`, CLI render | **NEW embedded browser preview adapter**; later optional sibling renderer | Preview S01 progressively inside the same Zodiac UI. A future `runtime/zodiac-hyperframes/<pinned-version>` is gated by E2E fidelity. |
| Local executor | `tools/studio_v2/executor.py`, `tools/studio_v2/controller.py`, `tools/control_plane/segments.py` | ADAPT | Renderer adapter dispatch, artifact graph, segment render, progress and error mapping. |
| TTS and per-scene audio | `tools/studio_v2/voice.py`, `tools/studio_v2/timing.py` | KEEP | Voice generation, scene cache and measured timing are independent from video renderer. |
| Audio mix and final export | `tools/studio_v2/executor.py` plus FFmpeg calls | KEEP audio semantics, VERIFY mux | Avoid rebuilding unaffected audio; test voice/music levels, drift and MP4 metadata. |
| GUI launcher | `pyproject.toml` command `zodiac = tools.zodiac_qt:main` | KEEP command, progressively redirect | The user must start a **single Zodiac window**. Replace Qt screens only after editor/voice/gallery/package/checklist parity. Python core is managed backend, not separate GUI. |
| New editor/agent | embedded HyperFrames React editor/SDK inside Zodiac Studio, Zodiac domain engine | NEW | One app, one active episode, voice-first timeline, source maps, semantic transactions, agent tools; trusted approval is a UI action only. |
| Semantic cache | `core/cache/phase02-semantic-cache.mjs`, Studio V2 artifact graph | KEEP + extend cache keys | Include renderer identity and adapter ABI in render fingerprints; reuse unchanged baked assets and voice. |
| QA parity | renderer tests, visual reviews, native preview pairs, control-plane tests | EXPAND | Compare actors/captions/occlusion/motion/audio across Remotion and HyperFrames on real episodes. |

## 2.1 Essential existing functionality not to rewrite

The source audit confirmed **working building blocks, not a complete unified product**:

- **Voice take/caching:** `tools/studio/artifacts.py` provides immutable job-local take storage and restoring selected WAV; `studio_v2/voice.py` reuses TTS by scene; `studio_v2/timing.py` has measured timing and scene caches. Existing compatibility code may register a take as `APPROVED` without genuine user-listening evidence. Separate TECHNICALLY_VALID, COMPAT_IMPORTED and USER_LISTENED_APPROVED, then give the user a take audition/approval UI. This is a correctness fix, not a library rewrite.
- **Artifact cache, scene render resume and crash recovery:** `tools/control_plane/artifact_graph.py`, `segments.py`, `studio_v2/state.py`, `studio_v2/session.py` handle validated hash tracking, grouped scene render segments and persisted job state. Keep these primitives and generalize their project adapters; do not replace with basic file-exists checks.
- **Checklist and concept data:** `tools/studio_qt/production_checklist.py` already reads real Phase manifests and an optional 12-sign `done/todo` series tracker, while `screens/concepts.py` stores independent plans. Merge identities into one concept × sign × episode status view. Published requires real evidence, not a bare checkbox.
- **Project/package management:** `tools/application/library.py` scans ZIP/workspaces/video and supports **reversible archive with moved.json restore**, not immediate deletion. Preserve this safety model and do not lose old episode artifacts during migration.
- **Asset previews:** the V4 current asset gallery, character identity preview, meme acting gallery and native SVGs already generate real examples. Reuse their compiler output and show per-category/item/state thumbnails inside the same UI. Existing catalogs do not automatically imply every possible combinatorial variant exists; synthesize previews only on demand.
- **Voice service lifecycle:** Qt's `vieneu_service.py` already distinguishes a server it owns from external VieNeu service. Preserve ownership, readiness and clean shutdown in the new single launcher.
- **Quality boundaries:** content approval, Visual Review and final audiovisual checks are separate. Existing Job@5 export does preflight, hash and ZIP checks. Retain source lineage rather than copying raw ZIP contents into a mutable editor.

## 3. Asset library risk by category

| Asset family | Source | Migration impact | Guardrail |
| --- | --- | --- | --- |
| Character parts and identity | `characters/components/catalog.json`; geometry and SVG compiler | LOW for source, MEDIUM for output compatibility | Preserve body/hair/outfit/color/face IDs and state hash; do not regenerate all states by default. |
| Render-ready SVG pose/face/state | baked character SVG files | LOW–MEDIUM | Test inline SVG vs <img>, viewBox, clip/mask/filter/stroke, stroke order and text appearance. |
| Physical props and character contacts | `props/index.json`, contact and attachment contracts | MEDIUM–HIGH | Keep anchor/contact meaning; map positions and transforms, not just pixels. |
| Meme acting and reaction templates | `memes/index.json`, 30 semantic situations + compiled asset data | MEDIUM | Keep semantic state and actor bindings; map reaction timeline and event transitions. |
| Scene Accent / backgrounds | `scene-set/accents/`, `environments/`, frame SVG | LOW–MEDIUM | Rear layer must not constrain actors; fresh Scene Set remains retired by fresh compiler. |
| Narrative Visual and Story Text | `creative/README.md`, per-scene authored objects | HIGH semantic-risk, not necessarily asset format risk | Preserve mutually exclusive rule and source-bounded visual provenance, no decorative fallback. |
| Fonts/captions | renderer/fonts, caption rendering contracts, measured timing | HIGH parity risk | Verify Vietnamese glyphs, line wraps, two-line captions, watermark, glyph paths, font loading and collision. |
| Effects/transitions/motion | motion semantics, renderer `ZodiacRenderPlan.tsx`, events | **LOW creative priority** / MEDIUM technical if switching renderer | New work uses hold/cut/show-hide/state swap and optional short fade/slide/zoom. Preserve old pinned Remotion compatibility for legacy complex motion; verify visible state endpoints, timing and story payoff. |
| Music/SFX/TTS | audio paths, waveform/cache metadata | LOW for files; MEDIUM for timing/mux | Reuse WAV/MP3 but validate audio trim, gain, timeline offsets, final peak and sync. |
| Asset source/provenance | inventory, hashes, semantic role IDs and scene references | MEDIUM | Keep original content hashes and usage trace; add media materialization map to HyperFrames path/ref. |

### Important existing policy

Current fresh `compile-visual-intent.mjs` checks `FRESH_SCENE_SET_RETIRED` and normalizes legacy roles into Job@5 transport roles. Older asset README/manifest still mention scene-set paths, so a migration must follow **fresh compiler behavior**, not reactivate all directory names listed in a registry. Narrative Visual is scene-specific meaning, **not** a catalog pick, and may not coexist with Story Text in one scene.

## 4. Migration adapter contract (proposed)

For the first **embedded-editor** pilot, use existing production compiler output; final HyperFrames MP4 is an independent later experiment. The new Studio voice-first entrypoint precedes Visual Intent authoring. A later read-only compatibility fixture may start from a completed existing render-plan:

```
Web Phase 1 approved snapshot
     ↓ import into Studio revision ledger
zodiac-visual-intent@1 (canonical authoring source)
     ↓ existing visual grammar / character / meme / prop compilers
production.json + baked SVG, fonts and media
     ↓ existing local timeline / caption / voice alignment
validated zodiac-render-plan@1
     ↓ NEW zodiac-to-hyperframes adapter + content-hash asset resolver
HyperFrames HTML/CSS/JS composition + provenance map
     ↕ HF SDK edits -> Zodiac semantic authoring commands
Embedded HyperFrames Preview inside Zodiac
     ↓ final output: Remotion fallback until independent HyperFrames encoder parity succeeds
```

**Source mapping example** (illustrative; not a final schema):

```json
{
  "adapter_format": "zodiac-hf-source-map@1",
  "source_revision": "rev-001",
  "renderer": "hyperframes@0.9.42",
  "entities": {
    "hf-scene-S03_actor-main": {
      "scene_id": "S03",
      "entity_id": "actor-main",
      "source_owner": "visual-intent",
      "allowed_ops": ["move", "scale", "rotate", "set_state_event"]
    }
  }
}
```

Never patch a rendered `<img>` source or generated HTML and call the resulting state canonical unless that patch round-trips into the correct `visual-intent` domain field and passes validation. Human override may be stored as an explicit separate canonical source with provenance, not in unnamed ad-hoc HTML.

## 5. Work sequence and blocking pilot

**A. Phase 0 — compatibility/baseline:** map native V4/scene compiler owners, asset/preview dependency caches, approved handoffs, Job@5 and known quality scene examples; record real vs unmeasured wall time, warm and one-scene edit behavior.

**B. Phase 1 — one-window host and managed agent:** `zodiac` opens one Zodiac UI and a project-backed event/command API, with embedded HyperFrames SDK compatibility spike; no second GUI. Define the command envelope early, but do **not** claim the S03 compiler command works before Phase 3.

**C. Phase 2 — Voice Lab first:** audibly approve a selected take and derive actual speech anchors, preserving immutable Phase 1 narration.

**D. Phase 3 — Compiler VNext refactor:** keep V4 geometry and all native gates; implement **single logical `scene.compile`** that builds the complete S03 actor/pose/expression/prop/Narrative Visual-or-Story Text/event/voice/caption/preview dependency closure, with exact manifest inventory. Missing elements BLOCK; atomic publication; old valid preview and source preserved. Benchmark cold/warm/scene edit and negative cases. [Compiler architecture and acceptance](./2026-11-14-zodiac-compiler-refactor-design.md).

**E. Phase 4 — scene editor:** SDK semantic edit → Studio source revision → `scene.compile` → committed scene artifact refs + `scene.preview_ready` → React/HyperFrames UI displays actual output. Agent requests the build but neither directly writes compiler-owned SVG/ZIP nor uploads result bytes into Studio.

**F. Phases 5–6 — gallery and evidence registry:** search and preview actual lazily-compiled asset components, concept×12 and archives from existing scanners with no second data owner.

**G. Phase 7 — independent render gate:** same episode through HyperFrames Producer, pinned Remotion, and conditional static-state-frame+FFmpeg; compare full audio/caption/visual parity, performance and disk/memory. Prefer proven path, keep old ZIP recovery and Remotion until the replacement really passes.

**Decision:** all green UI/preview statuses must point to a real immutable source/hash/artifact revision; the agent's acknowledgement is never a compiler receipt or a human review.

## 6. What must NOT be thrown away

- V4 character components/geometry, meme semantic assets, actual SVGs, asset identities and versioned provenance.
- Native Validation and semantic scene completeness checks.
- Approved voice and exact narration content, scene references, measured timing, SRT/2-line caption decisions.
- Incremental asset/scene cache and audio/TTS artifacts.
- Production input validators and source-bound review/approval receipts.
- Old completed ZIPs and pinned Remotion renderer for reproducibility.

## 7. Explicit non-goals of the first pilot

- Full automatic migration of every past asset pack and legacy Scene Set.
- Regenerating all character SVG variants as HyperFrames-native DOM components.
- Forking HeyGen's desktop assistant app or relying on HeyGen cloud services.
- Removing per-scene TTS/take storage during speech-unit refactor, discarding voice review, Phase 1 creative process or every compiler at once.
- Declaring a benchmark victory without running the same episode on both systems.
