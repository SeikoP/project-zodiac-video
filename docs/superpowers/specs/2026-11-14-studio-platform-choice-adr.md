# ADR — Zodiac Studio platform choice: PySide6, Remotion Studio, or HyperFrames

- Status: **PROPOSED / SPIKE REQUIRED**, 2026-11-14
- Parent design: [Agent-Native Creative Studio](./2026-11-14-agent-native-creative-studio-design.md).
- Main baseline: `fa457a9351c33ace1da66bd089af8a1861e53838`.
- Scope: platform selection **only**. This ADR does not authorize migration, removal, implementation, plugin version changes or release.

## 1. Problem

The `zodiac` executable enters `tools.zodiac_qt:main` via `pyproject.toml` and uses PySide6 screens, Studio V2 and the existing control plane. The actual render path is Remotion, with pinned `runtime/zodiac-renderer/2.0.x`. The new goal is an editable story-driven, agent-driven video project, not simply a more attractive job runner.

We must decide which interface/rendering base to use without invalidating Phase 1 approved source, `zodiac-visual-intent@1`, existing asset compilers, voice/timing caches, Job@5 and real parity tests.

## 2. Verified technology baseline (as of 2026-11-14)

### Zodiac Qt

`pyproject.toml` declares `zodiac = "tools.zodiac_qt:main"`; `tools/studio_qt` is the current PySide6 workbench/media GUI. It is directly integrated with Python application and Studio V2 execution. Strengths: existing functionality, compatible project runtime and no migration for current producers. Gap: lacks a semantic, bidirectionally editable timeline and agent-event protocol. A full custom Qt timeline would be a new large frontend implementation.

### Remotion

- Zodiac's current Remotion renderer is already exercised and pinned, so retaining it has lower migration risk.
- **Remotion Studio** is the developer-oriented environment for compositions; its interaction features are improving but it is not equivalent to the commercial **Editor Starter**, a foundation for a JSON-state visual video editor.
- Current Remotion is source-available under its own license, not an OSI-approved permissive open-source license. Forking the Studio to become a distributable/editor product has licensing and ongoing upstream-merge implications; check the applicable 4.x license and obtain legal review before shipping a fork. Merely being public on GitHub is not a permission to treat it as MIT.
- The official Editor Starter was advertised at US$600 one-time on 2026-11-14, plus applicable Remotion licensing, if the team prefers a Remotion-native application base.
- Relevant links:
  - https://www.remotion.dev/docs/editor-starter/vs-studio
  - https://www.remotion.dev/docs/terminology/studio
  - https://www.remotion.dev/docs/license/pricing
  - https://www.remotion.dev/docs/terms-4-0

### HyperFrames by HeyGen

- Official repository https://github.com/heygen-com/hyperframes, **Apache-2.0**. Its release **v0.9.42** was published November 13, 2026 (recent Studio fixes include live drag feedback and better locked-file error reporting).
- Its open-source monorepo contains `@hyperframes/studio`, `@hyperframes/sdk`, `@hyperframes/engine`, `@hyperframes/player`, and producer packages. Uses browser/HTML/CSS/JS seekable animation and Puppeteer+FFmpeg for frame capture/encode.
- Browser Studio has timeline move/trim/split, preview/canvas editing and assets/catalog. SDK supports stable `hf-id` targets, typed `EditOp`, batching, JSON patch events, undo/redo and template overrides. These are concrete integration affordances, not proof of Zodiac compatibility.
- HyperFrames additionally distributes a standalone desktop app with built-in agent chat, but the documentation distinguishes this desktop app from `@hyperframes/studio` browser-editor package. The public monorepo must not be assumed to contain an equivalent, ready-to-fork version of the entire HeyGen desktop agent product or its cloud services.
- The desktop app's Script panel primarily describes transcript-based edits to existing audio/video (including cloud transcription), **not** reapproval of an immutable narrative handoff followed by rebuilding VieNeu TTS and visual callbacks.
- The framework is rapidly evolving. The recent v0.9.x release cadence increases integration churn risk. Its runtime needs independent benchmarks on the target low-power Windows laptop.
- Relevant links:
  - https://github.com/heygen-com/hyperframes/releases/tag/v0.9.42
  - https://github.com/heygen-com/hyperframes/blob/main/LICENSE
  - https://hyperframes.heygen.com/packages/studio
  - https://hyperframes.heygen.com/sdk/guides/querying-and-editing
  - https://hyperframes.heygen.com/sdk/guides/undo-redo-and-patches
  - https://hyperframes.heygen.com/sdk/guides/embedded-override-mode
  - https://hyperframes.heygen.com/studio/index
  - https://hyperframes.heygen.com/studio-app/connect-your-agent

## 3. Options

| Option | Reuse existing Zodiac execution | Visual timeline and editing | Agent-first edit integration | Migration/parity risk | Licensing/forkability |
| --- | --- | --- | --- | --- | --- |
| A. Expand current PySide6 as full editor | High | Must build much ourselves | Must build bridge ourselves | Low for renderer; high for new UI scope | Zodiac-owned UI |
| B. Fork Remotion Studio itself | High at renderer level | Growing controls; still tailored to code compositions | Requires Zodiac source mapping and protocol | Medium-high UI coupling and maintenance | Remotion proprietary/source-available; consult current license |
| C. Use Remotion Player + custom Zodiac web editor or purchased Editor Starter | High | Starter provides NLE foundation; custom still needs work | Zodiac bridge required | Medium | Remotion license; Editor Starter purchase if used |
| D. Adopt HyperFrames browser Studio/SDK as editing base and migrate rendering | Medium, requires adapters | Strong existing timeline/canvas/asset editing | Typed operations and patches available | High for renderer and motion parity | Apache-2.0, favorable to fork/modify |
| E. Keep Zodiac domain/CLI, build **isolated HyperFrames adapter pilot**, choose editor/renderer later | High for existing production | Prove Studio edit mapping first | Prove event/patch adapter on a real scene | Controlled, reversible | No production migration required during test |

## 4. Provisional recommendation

**Choose E as the next engineering step, not immediate A/B/D migration.**

- Keep `zodiac` as a user-facing **command name**, not necessarily forever as a PySide6 implementation. Keep Qt available during migration.
- Keep Python Studio V2 / Control Plane, Phase 1 handoff v2, Visual Intent, semantic cache, TTS and review receipt logic as domain authority.
- Do **not** fork Remotion Studio. Continue using the existing pinned renderer for production during the pilot.
- Evaluate HyperFrames **open-source browser editor and SDK**, not presume the whole HeyGen desktop assistant is forkable. Prototype a `zodiac-visual-intent@1 → HyperFrames composition` adapter and a constrained `HyperFrames EditOp → Zodiac semantic command` adapter.
- For the spike, run a real Remotion and HyperFrames render side by side with identical generated asset/input provenance. Do not have two production renderer sources of truth.
- After benchmark, if HyperFrames yields better true editability/agent work at acceptable memory, parity, and maintenance cost, **select HyperFrames as vNext editor/render core**; else retain Remotion and build a smaller Zodiac-specific editor (or evaluate Editor Starter).
- Never choose only by star counts, release cadence, promised “determinism,” or UI screenshots.

## 5. Critical adapter seam

Canonical `visual-intent.json` must remain owned by Zodiac. HyperFrames DOM/composition/SDK is initially **a presentation-derived view**, not a replacement canonical source.

Required initial mappings:

| Zodiac owner | HyperFrames surface | Round-trip condition |
| --- | --- | --- |
| scene.id and timeline range | nested composition / track timing | stable `hf-id` source map |
| entity.id / visual role | HTML/SVG layer | preserves entity role and asset identity |
| state asset and transform | media reference, position/scale/rotation | edits return canonical transform to Visual Intent |
| start/end events with voice anchors | timed element and animation | preserve semantic voice anchor; reject unsupported edits |
| captions | text/caption tracks | font/text/timing must pass parity |
| Narrative Visual or Story Text decision | authored symbolic layer | cannot auto-create prohibited simultaneous roles |
| physical prop/contact relations | object composition | geometric plus semantic validation retained |

Unsupported round-trip edits must produce `EDIT_NOT_SUPPORTED` or an explicit proposal for a new canonical Zodiac source feature, never silently append code/DOM overrides outside Visual Intent. `hf-id` is a presentation ID; use a separate source-map to stable Zodiac IDs.

A visual editor PATCH should be a single transactional change against `base_revision`, pass structural validation, and return new revision / dirty closure. Content approval remains a trusted human action; SDK undo/history is not a substitute for project revision ledger.

## 6. Pilot: one representative Zodiac episode

Fixture: one approved Phase 1 handoff; a 5-scene vertical episode with character/cast identity, Scene Accent, at least one physical prop, caption-safe layout, event state transition, one optional Narrative Visual or Story Text (never both), a callback and measured narration.

Two controlled runs (separate workspaces):

1. **Remotion baseline:** compile real Job@5, run faithful event preview, production MP4 and measure CPU/RAM/elapsed time.
2. **HyperFrames pilot:** generate equivalent scene HTML from Visual Intent, present in browser Studio, drag actor, trim one visual event, change one asset; map typed operations back into Visual Intent; rebuild preview and final MP4; compare to baseline.

Human-agent co-edit experiment: agent edits S03 concurrently with user moving S03 actor. Verify optimistic revision conflicts, rejected stale patch and undo. Narration edit experiment: change one sentence after handoff, create new revision and trusted approval, regenerate only dependent audio/scene data; preserve unaffected assets and TTS cache. HyperFrames script-editor features alone do not satisfy this.

Record:

- time until **first visible** scene, per-edit p50/p95 to preview, final end-to-end time,
- peak resident RAM on target Windows laptop while editing and rendering,
- render-frame/timing/caption/occlusion regression diffs, visual review outcome,
- number of model turns/tool calls and repair loops,
- percent of supported Zodiac edits that round-trip without manual file edits,
- steps and code required to keep adapter compatible with upstream HyperFrames updates.

### Go/no-go rules

**Adopt HyperFrames** only after the pilot meets minimum gates: no approval/lineage breach, native content/visual review preserved, real frame parity on key story interactions, all required edits map to canonical Zodiac sources, no unacceptable RAM regression, and better edit/review workflow than existing CLI+Remotion baseline. Do not set arbitrary performance percentages before baseline exists.

**Otherwise**, preserve existing Remotion production and implement a smaller, Zodiac-owned web timeline/player. If required editor features are mostly generic, separately weigh the current Remotion Editor Starter license, cost, and integration rather than forking Studio.

## 7. Follow-on design changes if pilot passes

Amend the parent Studio spec's renderer technology decision; add version-pinned HyperFrames project/materialization artifact, stable source map schema, edit operation support table, preview/production parity harness, migration of Remotion-specific motion semantics, old Job@5 import compatibility and rollback plan. Do not delete runtime/zodiac-renderer until a real completed episode passes E2E and old ZIP support is covered.

## 8. Unresolved questions for spike (no assumptions)

1. Exact source availability and redistribution conditions for the separate HyperFrames **desktop app** versus published Apache-licensed browser-editor packages.
2. Browser Studio's API stability when embedded in another application's project/revision engine.
3. Translation limits for Remotion-specific animation/effect semantics and voice-anchored states.
4. Performance of two frame-capture systems on the user's real Windows machine.
5. Whether HyperFrames player can provide preview/render parity for Zodiac's current caption fonts, SVG props and transitions without unacceptable changes.
6. Security and licensing of cloud models, hosted MCP and HeyGen account are independent from local Apache-2.0 renderer; do not assume they are required for local editing or included when forking.
