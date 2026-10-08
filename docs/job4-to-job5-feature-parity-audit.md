# Job@4 → Job@5 parity audit (evidence-based; 2026-10-09)

Baseline: Job@4 runtime `runtime/zodiac-remotion/1.21.0/renderer`. Target: Job@5 `runtime/zodiac-renderer/2.0.0/renderer` at the corresponding audited main commit.

| Capability | Job@4 source | Job@5 source | Audit status | Gate |
| --- | --- | --- | --- | --- |
| Cover PNG | `src/ZodiacCover.tsx`; `src/Root.tsx` registers `<Still id="ZodiacCover">` | This PR adds `src/ZodiacCover.tsx`, registers `<Still>`, `scripts/render-cover.mjs` | Restored in source; require actual 1080×1920 PNG still test with real Job@5 | P0 |
| Publish copy | Package `publish.json` consumed by cover | `contracts/publish-v1.schema.json`; Job@5 package `publish/`; prepare hydrates metadata | Metadata retained; runner export downstream needs E2E | P0 |
| Visual semantic anchors | Runtime performance/semantic modules | `spatial_bindings` in Authoring IR, timeline, render plan and prepare | Geometry validated, narrative correctness not automatically proven | P0 |
| Preview parity | Runtime-local composition | `scripts/preview.mjs` uses Remotion stills of final composition | Implemented; require human/visual review with full Bọ Cạp 12 scenes | P0 |
| Animation breadth | `semantic-animation.mjs`, `performance-animation.mjs`, `ZodiacComposition.tsx` | `ZodiacRenderPlan.tsx` state swaps and selective prop/effect entrance | Not equivalent: full motion catalog still needs classification/port | P0 |
| Font | Legacy cover used Be Vietnam Pro, video caption Patrick Hand | Job@5 renderer embeds verified Patrick Hand, cover reuses same font verification hook | Shared font loading path; visual comparison still needed | P1 |
| Subtitle alignment | Legacy runtime caption styling | `tools/control_plane/timeline.py` semantic segments; `ZodiacRenderPlan.tsx` | Partially migrated, timing, line-fit and clipping need real audio tests | P1 |
| SFX | `scripts/generate-sfx.mjs` | No corresponding file in renderer 2.0 directory | MISSING at renderer level, check whether outer runner mixes SFX before claiming feature removal | P0/P1 |
| Transition | Legacy semantic/performance animation modules | `ZodiacRenderPlan.tsx` | State swap and limited reveal; camera/event transition equivalence unproven | P1 |
| GUI | Local runner UI evolved separately | `tools/studio/app.py` and studio_v2 | Not inherently Job@5 contract functionality; test import/render route separately | P1 |
| Watermark | `src/BrandOverlay.tsx` | `src/ZodiacRenderPlan.tsx` | Implemented; font positioning to verify visually | P1 |

Acceptance requirements:
1. Real Job@5 import, compile, and render plan including audio alignment. No synthetic-only smoke evidence.
2. Produce a real cover.png using same hydrated assets, design token and renderer as video. Verify dimensions, Vietnamese glyph coverage, identity.
3. Every scene: render three temporal frames and inspect prop/effect spatial semantics; reject a scene that geometrically passes but communicates wrong actor or action.
4. Compare old/new feature behaviors, not necessarily pixel identity; preserve V4 style and semantic narrative.
5. Do not mark parity COMPLETE until P0/P1 gates pass. No rearchitecture to Job@6 and no additional agent-generated SVG to compensate for renderer deficits.

Status: **PARTIAL MIGRATION / NOT PRODUCTION PARITY**.
