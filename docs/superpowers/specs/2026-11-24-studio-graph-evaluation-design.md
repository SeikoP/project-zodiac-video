# Studio Graph evaluation — independent audit and proposed design

Status: phase-by-phase implementation authorized by user on 2026-11-24. Start with R0 and retain the existing editor; bounded optional Graph/tree experiment follows its gate. A default switch and human acceptance remain unapproved. Audited HEAD: `6f4dbe2b147d7e71c8fbe9c8b771be6c766bd48f`.

## Judgment

Do not make Graph the default yet. Recommend a scene-focused relationship graph alongside the existing preview/Inspector and compact measured Timeline. Compare it against the current editor and a cheaper structure-tree option before adoption. This is the author's recommendation, not an accepted user decision.

Graph can clarify entity/state/event/anchor relationships. It cannot repair agent reliability, improve acting automatically, or accelerate compilation merely by drawing compiler dependencies. ComfyUI is a workflow/execution graph; this editor needs an authored relationship projection. These graphs have different semantics.

## Audit, observed in current files

| Area | Evidence | Implication |
| --- | --- | --- |
| GUI | `apps/zodiac-studio/src/App.tsx`, `VisualEditor.tsx`, `EpisodeTimeline.tsx`, `workbench-state.ts` | Titlebar navigation; shared project/scene/entity/time selection; retained tool state. Timeline owns playback and measured words; preserve it. Existing selection lacks state/event/anchor IDs. |
| Canonical owner | `tools/studio_project/visual_workspace.py`, `command()` | Only source.replace, scene.patch, scene.performance, theme.select, asset.select, undo, redo. Revision, idempotency, source lock, validation, journal and durable history already exist. |
| Editing limits | same file, scene.patch/asset.select | Patch changes transform/layer/visibility only. Bound contact transforms are explicitly rejected. Asset selection recomputes candidates. No granular pose/expression/contact/scene-create command today. |
| Schema/projection | `features/visual-composition/compile-visual-intent.mjs` in pipeline plugin | Intent cast states contain pose/expression; scene entities reference assets and states; events reference target/state chain/trigger. Story Visual taxonomy projects into transport roles. Preserve authored taxonomy and fields; never reconstruct source from a lossy GUI graph. |
| Compiler | `tools/studio_project/visual_compiler.mjs` | Existing geometry:character, geometry:asset, scene and appearance DAG nodes, source hashes, semantic graph and cache events. scene.compile still enters an episode build; normal build loops over scenes and writes outputs while cache may reuse computation. Do not label it single-node execution. |
| Agent | `tools/studio_project/agent_bridge.py`, `agent_authoring.py` | Bounded proposals, canonical validation/retry, human confirm/apply, source and voice dependency checks. Initial proposal may use source.replace through Core; model never owns the file writer. Scene proposals limited to patch/asset/performance. |
| Dependencies | `apps/zodiac-studio/package.json` | React/Tauri/HyperFrames present; @xyflow/react absent. Resolve/pin/test compatibility during an approved spike, not in this audit. No Vue/LiteGraph integration needed. |
| Loading | `docs/audits/2026-11-24-studio-titlebar-performance.md` | Deferred tool is ~34.49 kB; preview SDK ~1055.12 kB; initial entry ~267.95 kB. These are recorded bundle sizes, not startup latency. Graph can add load and rerenders. |
| Status | `tools/studio_project/status.py:derive_status` | visual remains UNKNOWN. A local MP4 concept checkbox is not a source-bound visual approval receipt. |
| Native acceptance | `docs/audits/2026-11-24-studio-workbench-evidence.json` | Reused real voice edit/undo/redo/export/restart technically passed, muted playback. Initial source needed GUI role-label repair; uninterrupted fresh-agent acceptance open. |
| CI | `.github/workflows/studio-v5-tauri-p1.yml` | P2 discover command lacks its own immediate exit check, so a later successful Python command can mask its failure. Browser scripts are not executed by this workflow. Treat as audit findings to fix later. |

Remote check: installed `gh` unavailable. GitHub connector returned `statuses: []` for HEAD and no PR-triggered workflow runs; the latter endpoint filters to PR events. This does NOT establish green CI or absence of push runs. Retrieve push/check-run evidence in phase R0.

CodeGraph was attempted first and reported another-worktree index; current files were read directly. No index created. Tests were not rerun for this documentation audit; referenced passes are dated receipts.

## Alternatives

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| A: whole-episode Graph-first | Full relationship overview | Edge density, navigation effort, small preview; unsupported editing appears possible | Do not adopt before comparative evidence |
| B: scene graph + compact Timeline | Bounded relationships and existing playback | New projection/selection layer and small dependency | Recommended experiment |
| C: structure tree + relationship inspector | Lowest integration and learning cost | Less spatial relationship visibility | Required cheaper comparison/fallback |

## Proposed graph projection contract

`studio-graph-view@1` is a disposable frontend view model, not an authoring file. Inputs are VisualState.intent/source_hash/revision, VoiceState.timing and build receipts. Keep authoring references separate from compiler provenance; the two graphs never share editable edges.

Node identity: JSON-encoded tuple `[projectId, sceneId|null, kind, ...canonicalIds]`, never array indices, label text or ambiguous concatenation. Selection extends current context with `stateId`, `eventId`, `anchorId` (nullable). Cast identities may be global references; scene instances remain distinct. Missing references become diagnostics and blocked edits, not synthesized source.

| Node kind | Authoritative reference | Edit policy in first prototype |
| --- | --- | --- |
| scene group | intent.scenes[id] | Select/expand only; cannot reorder narration |
| entity | scene.entities[id], kind/visual_role | Select instance; Inspector preserves canonical role |
| state | entity.states[stateId] | Existing scene.patch transform/visible/layer/opacity only |
| asset/cast-state | intent.assets[assetId], intent.cast[entity_id].states | Read-only pose/expression facets; asset.select only for eligible candidate bundles |
| event | scene.events[eventId] | Edit complete scene event list via scene.performance |
| voice anchor | event.trigger + matched measured words | Current compiler uses first text occurrence inside scene. Project that same occurrence; flag repeated text. Do not offer later-occurrence selection until a separate canonical schema/validator change supports it. Unresolved anchors block edits. |
| diagnostic | missing/stale source or validation result | Explain; never serialized to Intent |

Character, prop, Story Visual and effect are entity variants, not independent executable plugins. Pose/expression display only when explicitly present in cast/state metadata. Do not infer a physical contact from visual proximity or a story role from asset filenames. Unsupported fields remain in untouched Intent.

Edges: `contains` scene→entity→state; `usesAsset` state→asset; `usesCastState` explicit asset/cast binding; `targets` event→entity; `before`/`after` event→states; `triggeredBy` event→anchor; `contact` only from explicit spatial/frame bindings. Scene order is a separate dotted read-only relationship. Label edge semantics and distinguish read-only by icon/text, not color alone. No arbitrary connect/delete callbacks in prototype. Cycles in relationship edges are allowed; compiler DAG rules apply only to compiler dependencies.

Graph node drag changes layout coordinates only. Canonical video transform changes happen in Inspector/preview via commands. Layout/zoom/collapse is optional local UI state keyed by project and schema version; reconcile stale IDs on reopen. Layout changes cause zero canonical revision, zero compiler calls, zero approval changes. Core undo/redo concerns canonical edits; layout reset is a separate UI operation.

Command matrix:

| User action | Core operation | Failure behavior |
| --- | --- | --- |
| select node | selection only, seek scene/event when measured | Keep preview and selection coherent |
| move node / collapse scene | local view state | Storage failure cannot block editing |
| change transform | scene.patch with target IDs and current visual revision | Contact/stale revision rejection visible; restore canonical snapshot |
| swap eligible prop | fresh candidate query then asset.select | Stale/no-fit stays blocked; no arbitrary asset IDs |
| change existing event anchor/state | scene.performance, complete current scene events | Validate measured timing and chain; failed command leaves source unchanged |
| change pose/expression/contact/create entity | disabled with explanation | Separate future command design; no generic source.replace shortcut |
| accept Agent | existing confirmed agent.apply | Revalidate target/source/voice/revision and refresh projection |
| build/export | existing episode.build / video.export | Receipt freshness and source/voice hashes required |

## Proposed one-window layout

```text
Titlebar: Episode / project / build status / tools
Scene strip: s01 ... s08 (collapsed overview)
┌──────────────────┬────────────────┬───────────────────┐
│ Active scene     │ 9:16 preview   │ Inspector / Agent │
│ relationship map │ persistent     │ selected reference│
└──────────────────┴────────────────┴───────────────────┘
Compact transport + waveform + current caption; expand timing on demand
```

No resurrected sidebar or dashboard cards: thin outlines and connectors, square compact nodes, readable labels, no shadows. At 1060x650, show one scene graph and keep preview >=190px tall; Inspector tabs avoid growing the window. Keyboard scene/node selection, visible focus and a linear list alternative are mandatory. Preview is never replaced by a full-screen graph. With no build show a source-aware empty frame, never a stale preview pretending to match selection.

Open one scene by default. Eight groups appear collapsed in overview; expose full detail on demand. Do not create thousands of word nodes or include SVG/audio blobs in graph data. Memoize node renderers/callbacks; subscribe to selected IDs, not the whole moving graph. Layout movement must not cause Python polling or preview reload. No layout-engine dependency initially: deterministic columns suffice for the measured small fixture.

## Baseline episode and experiment

Verified local source: `.runtime/workbench-e2e-final/projects/episodes/studio-2b0c3a549a069efd273809f2/.authoring/visual-intent.json`.
Byte SHA256 `1ef5646b7c9c4e502194e238be2cb4b5ec53c64bd7ba4f578e98ef1d1ce7c2a9`.
Eight scenes s01–s08; 21 entities, 28 states, 7 events. Counts are source inventory, not expected graph totals (asset/cast/anchor nodes add references).
Use a verified isolated copy through supported project import/copy procedure; preserve source+voice+timing+last MP4 and project identity consistency. Never benchmark edits in the original project. Hash and identify the actual copied baseline again before running; original may change after this audit.

Tasks for A/B/C: find actor and triggering line; change allowed unbound transform; change event to another valid existing measured anchor; select eligible prop or explain no-fit/contact block; review/apply scoped agent proposal; undo/redo; preview across boundary; export MP4; reopen. Do not force a replacement prop into the story to complete a benchmark.

Same machine, viewport, episode revision, model/config, selected voice/timing and renderer for comparisons. At least five cold/warm repeats where applicable; record samples, median, range and p95 only with enough samples (>=20 for p95). Separate SDK/module load, RPC, validation, graph projection, compiler cache, preview, agent and render. Cold isolated cache and warm cache runs must be labeled. A full export may rerender the video even when scene computation is reused; never claim incremental MP4 rendering without evidence.

Proposed adoption gates (targets, not measured results): zero data/approval regressions; graph layout/select causes no canonical writes; unaffected cache node outputs/hashes reused after scoped edit; no stale preview; preview >=190px tall at three standard sizes; input-to-selection p95 <=100ms on >=20 samples; warm interaction/startup <=10% slower than baseline; <=15% additional idle memory (record absolute bytes too). For usability, user completes same tasks in counterbalanced order, errors do not increase and median task time improves >=20% for relationship tasks. If a single user/session, call it formative, not a general usability result. A gain only in relationship tasks supports an optional graph, not default replacement. If C performs as well with less complexity, prefer C. If targets fail, retain current editor and record why.

## References checked 2026-11-24

- [ComfyUI repository](https://github.com/Comfy-Org/ComfyUI): inspiration for visible relationships; no backend/frontend code copied.
- [React Flow subflows](https://reactflow.dev/learn/layouting/sub-flows): parentId groups relative positioning; this alone does not implement canonical scene semantics.
- [React Flow performance](https://reactflow.dev/learn/advanced-use/performance): memoization, selected-state subscriptions and collapsed trees. Verify selected package version/API/React compatibility in the spike; current docs are not a pinned dependency contract.

## Approval boundary

The earlier request covered evaluation without refactoring. The subsequent user instruction "@Superpowers triển khai roadmap mới theo từng phase" authorizes phased implementation, starting at R0, then the bounded optional Graph/tree experiment when its gate passes. New default additionally requires comparative evidence and user acceptance. Technical verification never grants listening, visual or final-video approval.
