# HyperFrames migration inventory — modules, assets, contracts

> Status: PROPOSED / PLANNING ONLY; 2026-11-14. No migration code in this PR.
> Parent: [Studio platform ADR](./2026-11-14-studio-platform-choice-adr.md) and [Agent-native Studio design](./2026-11-14-agent-native-creative-studio-design.md).
> Repository baseline: `fa457a9351c33ace1da66bd089af8a1861e53838`.

## 1. Answer: this impacts the asset library, but not its authored artwork

HyperFrames migration is primarily a **presentation/render/runtime replacement**. It must not be a wipe/rebuild of Zodiac's canonical creative library. Zodiac's V4 Character Assembly bakes SVG per planned identity, pose, expression and crop into production assets. The current renderer receives baked SVG, not the character assembly metadata. HyperFrames can initially consume those baked assets through stable paths and rendered HTML/SVG elements.

The source library is not the same as its runtime presentation. To prevent mismatch, preserve the canonical source and test a new adapter.

## 2. Module-level inventory

| Area | Concrete source | Change | Explanation |
| --- | --- | --- | --- |
| Phase 1 Web, narration/concept/review | `orchestration/phases/01-content.md`; `contracts/phase1-handoff.mjs` | KEEP | Phase 1 is renderer independent; preserve immutable approved v2 handoff. |
| Local handoff import | `phases/local/import-phase1-handoff.mjs` | KEEP + ADD integration | Import into revisioned Studio project; no direct source overwrites. |
| Visual Intent canonical source | `features/visual-composition/compile-visual-intent.mjs`; `.authoring/visual-intent.json` | KEEP | Fresh source stays one; compiler-owned projections remain immutable. |
| Visual Grammar/Scene Direction | `references/asset-library-v4/compile-visual-grammar.mjs`, `scene-direction/compile-scene-direction.mjs` | KEEP / adapter impact | Continue to produce Zodiac entities/transforms/state refs; translate into HyperFrames. |
| Character SVG compiler | `references/asset-library-v4/characters/compile-character-assembly.mjs` | KEEP | SVG state baking is renderer independent; retain identity and component IDs. |
| Meme/props/environment compilers | `references/asset-library-v4/memes/compile-meme-props.mjs`, `environments/compile-environment.mjs`, `scene-set/...` | KEEP, test output compatibility | Consume generated SVG/assets; never re-enable retired fresh Scene Set through migration. |
| Asset registry and provenance | `references/asset-library-v4/manifest.json`, `characters/components/catalog.json`, `props/index.json`, `memes/index.json`, `creative/library-catalog.json` | KEEP + EXTEND index | Add materialization metadata, preview thumbs, hash and source-to-renderer refs; don't duplicate catalogs. |
| Native render-plan validation | `tools/control_plane/render_plan.py`; `contracts/render-plan-v1.schema.json` | KEEP as input validation, ADD adapter | Allow render-plan@1 as intermediate for migration; emit versioned HyperFrames project. |
| Timeline/audio alignment | `tools/control_plane/timeline.py`; `tools/studio_v2/timing.py` | KEEP core logic, ADAPT display and render schema | Measured word/phrase alignment remains authoritative; retain voice anchors and scene ranges. |
| Original Remotion renderer | `runtime/zodiac-renderer/2.0.2/renderer/src/Root.tsx`, `ZodiacRenderPlan.tsx` | REPLACE for HyperFrames path | React Remotion hooks/Sequence/Img depend on Remotion; translate behavior to HTML, CSS, seekable animation. |
| Preview/render process | `runtime/zodiac-renderer/2.0.2/renderer/scripts/preview.mjs`, CLI render | ADD sibling runtime, not in-place overwrite | Ship `runtime/zodiac-hyperframes/<pinned-version>/...`; keep old renderer for rollback. |
| Local executor | `tools/studio_v2/executor.py`, `tools/studio_v2/controller.py`, `tools/control_plane/segments.py` | ADAPT | Renderer adapter dispatch, artifact graph, segment render, progress and error mapping. |
| TTS and per-scene audio | `tools/studio_v2/voice.py`, `tools/studio_v2/timing.py` | KEEP | Voice generation, scene cache and measured timing are independent from video renderer. |
| Audio mix and final export | `tools/studio_v2/executor.py` plus FFmpeg calls | KEEP audio semantics, VERIFY mux | Avoid rebuilding unaffected audio; test voice/music levels, drift and MP4 metadata. |
| GUI launcher | `pyproject.toml` command `zodiac = tools.zodiac_qt:main` | KEEP until UI replacement | Name can be retained as launcher to a future web/desktop editor. |
| New editor/agent | new HyperFrames editor integration and Studio project/revision engine | NEW | Bidirectional editing, source maps, transaction conflict detection, trusted approvals; do not let UI write projections. |
| Semantic cache | `core/cache/phase02-semantic-cache.mjs`, Studio V2 artifact graph | KEEP + extend cache keys | Include renderer identity and adapter ABI in render fingerprints; reuse unchanged baked assets and voice. |
| QA parity | renderer tests, visual reviews, native preview pairs, control-plane tests | EXPAND | Compare actors/captions/occlusion/motion/audio across Remotion and HyperFrames on real episodes. |

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
| Effects/transitions/motion | motion semantics, renderer `ZodiacRenderPlan.tsx`, events | HIGH | Translate motion semantics and verify intermediate frames, not only before/after stills. |
| Music/SFX/TTS | audio paths, waveform/cache metadata | LOW for files; MEDIUM for timing/mux | Reuse WAV/MP3 but validate audio trim, gain, timeline offsets, final peak and sync. |
| Asset source/provenance | inventory, hashes, semantic role IDs and scene references | MEDIUM | Keep original content hashes and usage trace; add media materialization map to HyperFrames path/ref. |

### Important existing policy

Current fresh `compile-visual-intent.mjs` checks `FRESH_SCENE_SET_RETIRED` and normalizes legacy roles into Job@5 transport roles. Older asset README/manifest still mention scene-set paths, so a migration must follow **fresh compiler behavior**, not reactivate all directory names listed in a registry. Narrative Visual is scene-specific meaning, **not** a catalog pick, and may not coexist with Story Text in one scene.

## 4. Migration adapter contract (proposed)

Use an intermediate output from existing production compiler for pilot:

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
HyperFrames Studio preview → HyperFrames MP4 export
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

**A. Inventory + contract tests:** map every used production entity role/state/events and all relevant asset refs. Pin HyperFrames version; no install as rolling latest in production.

**B. Read-only HTML prototype:** one actual S01/episode, same existing baked SVG assets, frame sizes 1080x1920, transforms, layers and captions; test viewBox, effects, fonts, transparent SVG and asset path resolver. No edits back yet.

**C. Deterministic playback:** translate scene/event state changes, cover frame and semantic caption layouts; compare keyframes and motion segments to Remotion reference.

**D. Reverse editing:** allow a narrow set of HF SDK operations (move actor, adjust timing of non-speech event, replace asset ref) and map to Zodiac Visual Intent via transactional commands. Unsupported operations must fail visibly.

**E. Voice/timing and script revision:** import approved handoff, new narration working revision, scoped reapproval, regenerate affected TTS/timing, update caption/scene offsets, reuse unaffected assets.

**F. Production pilot:** final MP4, audio QA, rendering segmentation/resume, resource usage on target Windows laptop, back-compat, no approval drift.

**G. Decision gate:** only after round-trip, quality and performance gates pass should a feature flag switch production default from Remotion to HyperFrames. Keep Remotion runtime and original Job@5 recovery until legacy projects are reproducible.

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
- Replacing per-scene TTS, voice review, Phase 1 creative process or every compiler at once.
- Declaring a benchmark victory without running the same episode on both systems.
