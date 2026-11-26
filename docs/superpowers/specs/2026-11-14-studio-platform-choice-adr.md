# ADR — Zodiac Studio platform choice: PySide6, Remotion Studio, or HyperFrames

- Status: **REVISED TARGET CHOICE / SPIKE REQUIRED**, 2026-11-14. The editor integration direction is selected; migration of final rendering is NOT selected.
- Parent design: [Agent-Native Creative Studio](./2026-11-14-agent-native-creative-studio-design.md).
- Main baseline: `fa457a9351c33ace1da66bd089af8a1861e53838`.
- Scope: platform selection **only**. This ADR does not authorize migration, removal, implementation, plugin version changes or release.

## 1. Problem

The `zodiac` executable enters `tools.zodiac_qt:main` via `pyproject.toml` and uses PySide6 screens, Studio V2 and the existing control plane. The actual render path is Remotion, with pinned `runtime/zodiac-renderer/2.0.x`. The new goal is ONE Zodiac application window for Voice Lab, concept × 12 signs, packages/media, V4 asset previews and an embedded story-driven, agent-driven editor, not a second separate Studio app or merely a more attractive job runner.

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

## 4. Selected direction for the NEW EDITOR; renderer remains a separate choice

**Target UX decision:** make HyperFrames browser-editor **React components and SDK** part of the single Zodiac Studio application. The user runs `zodiac` and manages all screens inside one window. Zodiac owns the top-level UI and project; the embedded editor does not open another desktop app.

- Use `@hyperframes/studio` (`EditorShell`, `Player`, `NLEPreview`, `Timeline`, `PropertyPanel`) and `@hyperframes/sdk` as the editor foundation. These require host project-state/API contexts; they cannot simply be mounted without integration. **Do not fork the separate HeyGen desktop application.**
- Keep Python Zodiac Core/Studio V2/Control Plane, Phase 1 handoff v2, Visual Intent/V4 compilers, semantic cache, VieNeu and review receipts as authoritative services. It is a backend/managed sidecar, not an extra user-facing app.
- **Voice Lab first:** after Phase 1 narration approval, natural Vietnamese audio/take audition and measured timing precede visual scene design. A post-approval script editor and complex animation timeline are NOT first-release priorities.
- Embed concept×12 coverage, native V4 asset preview gallery, episode/package/media manager, lightweight storyboard and agent activity in the same React shell. Reuse existing Qt checklist/concept/library data scanners and native preview generators.
- **Pilot first:** build a bounded S01 read-only composition + SDK move/edit round-trip to canonical Visual Intent, then integrate user voice audition, metadata and one view. The pilot validates this *editor* direction before irreversible UI migration.
- Keep the existing pinned Remotion renderer for production/legacy while evaluating whether HyperFrames Producer should eventually replace it. A HyperFrames **editor** is not a commitment to HyperFrames **final renderer**.
- Retain the `zodiac` command. Decommission Qt screens only when the new single-window UI has feature parity, recovery and low-RAM startup on the target machine.
- Do not choose by release cadence, star counts, generic AI marketing claims or animated demo smoothness. Verify native story scenes and voice alignment.

This is a cohesive app-host integration, not Option D interpreted as “launch both existing GUIs.” Option E remains the **safe delivery mechanism** for the selected embedded editor direction, not an open-ended debate about which UX to build.

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

Human-agent co-edit experiment: agent edits S03 concurrently with user moving S03 actor. Verify optimistic revision conflicts, rejected stale patch and undo. **Voice-first experiment:** keep approved script bytes locked; generate/listen/select a distinct take, align to actual selected WAV, rebuild only affected timing/preview and preserve unaffected V4 asset/cache. Real human listening approval must not be inferred from a compatibility-tagged technical VoiceArtifactStore entry. Post-handoff text editing is explicitly deferred.

Record:

- time until **first visible** scene, per-edit p50/p95 to preview, final end-to-end time,
- peak resident RAM on target Windows laptop while editing and rendering,
- render-frame/timing/caption/occlusion regression diffs, visual review outcome,
- number of model turns/tool calls and repair loops,
- percent of supported Zodiac edits that round-trip without manual file edits,
- steps and code required to keep adapter compatible with upstream HyperFrames updates.

### Go/no-go rules

**Ship embedded HyperFrames editor** only after the pilot meets minimum gates: one Zodiac window (no separate user-managed HyperFrames GUI), no source/approval lineage breach, native voice/visual review preserved, representative actor/prop/caption preview, selected SDK edits round-trip to canonical Zodiac sources, acceptable RAM, and a demonstrably usable voice-to-scene workflow. **Switch final rendering to HyperFrames** only after a separate full-video fidelity, output, benchmark and rollback gate. Do not set arbitrary speedup percentages before baseline exists.

**Otherwise**, keep the single-window Zodiac UX requirement and use a smaller Zodiac-owned frontend/Remotion Player or assess Editor Starter. Do not fall back to two manually launched GUIs. Preserve pinned Remotion production regardless of editor pilot outcome until renderer migration independently passes.

## 7. Follow-on implementation changes if the embedded-editor pilot passes

Implement one Zodiac shell containing Voice Lab, concept coverage, native V4 preview gallery, episode package management and the embedded HyperFrames components. Add version-pinned HyperFrames materialization, stable source map, edit operation support table and voice-first schedule. The renderer selection remains separate; keep old Job@5 import and Remotion runtime until full E2E and rollback are covered. Motion migration is intentionally a small vocabulary: hold/cut, show/hide, state swap, optional fade/slide/zoom, not generic VFX reproduction.

## 8. Unresolved questions for spike (no assumptions)

1. Exact source availability and redistribution conditions for the separate HyperFrames **desktop app** versus published Apache-licensed browser-editor packages.
2. Browser Studio's API stability when embedded in another application's project/revision engine.
3. Translation limits for Remotion-specific animation/effect semantics and voice-anchored states.
4. Performance of two frame-capture systems on the user's real Windows machine.
5. Whether HyperFrames player can provide preview/render parity for Zodiac's current caption fonts, SVG props and transitions without unacceptable changes.
6. Security and licensing of cloud models, hosted MCP and HeyGen account are independent from local Apache-2.0 renderer; do not assume they are required for local editing or included when forking.
