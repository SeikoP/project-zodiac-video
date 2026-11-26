# Studio GUI Refactor — Graph workspace audit and restructure plan

> Use superpowers:executing-plans. Status: PROPOSED 2026-11-25, awaiting user approval. Supersedes the layout parts of `2026-11-24-studio-graph-workspace-implementation.md`; does not change canonical commands, approvals, or R5/R6 scope of `2026-11-24-studio-graph-roadmap.md`.

## 1. Audit (observed in current files, HEAD of experiment/main-2 worktree, 2026-11-25)

### 1.1 Roadmap / process

| # | Finding | Evidence |
| --- | --- | --- |
| P1 | Two plans contradict each other. Graph roadmap: R0 gate → read-only optional R1 → no default switch. Workspace plan: "user correction supersedes", Graph becomes the management surface now. Code follows the second; roadmap still says "R0 IN PROGRESS" and all R1 boxes empty. | `2026-11-24-studio-graph-roadmap.md`, `2026-11-24-studio-graph-workspace-implementation.md` |
| P2 | Workspace plan has zero checked boxes and no evidence file, yet `StudioWorkspace.tsx`, `SceneGraph.tsx`, `scene-graph.ts`, `studio_graph_browser.mjs`, `studio_scene_graph.test.mjs` exist. State of truth is unclear. | file mtimes 2026-11-24 |
| P3 | Design said "workflow graph and relationship graph have different semantics; never share editable edges". Implementation puts both into one `GraphView` (stage nodes + scene nodes). | `scene-graph.ts` lines 1–40 |

### 1.2 Graph (management) problems

| # | Problem | Effect |
| --- | --- | --- |
| G1 | Graph is a mode switcher, not a relationship map. Clicking stage `voice` replaces nodes with voice units; `content`/`export` produce an **empty canvas** ("Chọn Giọng đọc hoặc một cảnh…"). | User loses the map whenever they leave Visual. |
| G2 | Stage nodes are rendered as buttons above the canvas and their edges are filtered out; the `workflow` edges are computed then discarded. | Dead data; confusing "Graph" that is half buttons. |
| G3 | Hard-coded coordinates: state `y=270+j*250`, asset `y=380+j*250`, cast `y=450+j*250`, next state `y=520`. Nodes are ~80–95 px tall → asset/cast/state rows overlap. Events placed by event index `x=280+i*280`, not under their target entity, so `targets` edges cross the whole graph. | Unreadable spaghetti for scenes with >2 entities. |
| G4 | Node explosion: every state spawns asset + cast-state nodes; every event spawns an anchor node. Asset/cast/anchor are facets, not things the user manages. | ~3× more nodes than needed. |
| G5 | `fitView` only on the first 4 scene/entity/unit nodes. | Part of the graph is off-screen on open. |
| G6 | `SceneGraph` resets nodes on every new `view` object. `view` is recomputed whenever `VisualEditor` pushes data via `onData`, i.e. every 1.5 s poll. `memo(ReferenceNode)` is defeated because `data.item` is a new object each time. | Whole graph re-renders every 1.5 s; jank, drag interrupted. |
| G7 | Layout storage key `studio-graph-layout@1:<project>` is shared across scenes and stages, never pruned, no schema version per design. | Dragged positions leak between scenes; stale IDs accumulate. |
| G8 | Anchor resolution re-implements compiler byte matching in the frontend (`TextEncoder` over unit source ranges). | Two implementations can drift; graph can show an anchor time the compiler does not use. |
| G9 | Tree mode prints raw `kind` (`cast-state`, `anchor`) and the same flat list; no hierarchy. | Not a real accessible alternative. |
| G10 | Status label translation duplicated (`readableStatus` in App, `replaceAll` chains in SceneGraph). | Inconsistent text. |

### 1.3 GUI architecture problems

| # | Problem | Evidence |
| --- | --- | --- |
| A1 | **Inverted data ownership.** `VisualEditor` fetches visual+voice, pushes up via `onData`; `StudioWorkspace` builds the graph and pushes `graphTarget` back down; `VisualEditor` mirrors it into local `sceneId/entityId/stateId/tab` via effect and pushes selection up again to `App`. Three copies of selection (App `selection`, Workspace `target`, Editor local state). | `StudioWorkspace.tsx`, `VisualEditor.tsx` L24–51, L214–223 |
| A2 | **VisualEditor is a god component**: 402 lines / 41 KB, ~30 `useState`, ~25 `useEffect`. Owns polling, SDK/iframe preview, audio playhead, drag overlay, 4 inspector tabs, 2 agent flows, gallery, JSON source editor, events JSON editor, build log, timeline. | `VisualEditor.tsx` |
| A3 | **Voice and Export are injected into VisualEditor's inspector** through `contextPanel`; Export hides the preview with CSS (`[data-stage=export] .visual-stage {display:none}`). The "unified workspace" is VisualEditor plus CSS overrides. | `StudioWorkspace.tsx`, `studio-workspace.css` |
| A4 | Three scene lists: Workspace `scene-strip`, VisualEditor `visual-scenes` (hidden by CSS), graph scene node. | same |
| A5 | Nested grids: Workspace (graph \| editor) → VisualEditor (stage \| inspector) → timeline. At 1060 px: 260 graph + ≥160 preview + 250 inspector; preview is squeezed first. | `studio-workspace.css` media queries |
| A6 | Four mutually exclusive overlays implemented as four booleans with manual resets (`galleryOpen`, `sourceOpen`, `logOpen`, `eventsOpen`). | `VisualEditor.tsx` L300+ |
| A7 | Two/three agent surfaces: App "Agent" page (project.inspect), Inspector "Agent" tab (scene.propose), initial authoring block (episode.propose). Each polls separately. | `App.tsx`, `VisualEditor.tsx` |
| A8 | Uncoordinated polling: App project 5 s, VisualEditor 1.5 s, VoiceLab own polling, agent 0.9 s / 1 s. Voice state fetched by both VisualEditor and VoiceLab. | — |
| A9 | `tool` prop → `setTarget` effect only fires when `tool` changes; "Tiếp theo" to the same tool does nothing. | `StudioWorkspace.tsx` |
| A10 | App.tsx still carries the old dashboard (metric cards, overview tabs), Agent page and Activity page — 511 lines — while navigation sends "Episode" to the graph workspace. | `App.tsx`, `studio-navigation.tsx` |
| A11 | CSS: `style.css` 730 lines / 58 KB plus override files using specificity hacks (`.voice-workspace.voice-workspace`, `.production-editor .visual-*`). | `style.css`, `voice-layout.css`, `studio-workspace.css` |

## 2. Target structure

```text
App (shell, routing only)
└─ EpisodeProvider            one store: project, visual, voice, job, agentTask; one poll loop
   └─ EpisodeShell            CSS grid areas, container queries, collapsible side panes
      ├─ HeaderBar            episode picker · pipeline status strip (Nội dung → Giọng → Hình → Xuất) · build/job
      ├─ Navigator (left)     [Graph | Cấu trúc] of the ACTIVE SCENE + scene strip; never empty
      ├─ Stage (center)       PreviewStage (always mounted) + TransformOverlay
      ├─ Inspector (right)    tabs driven by selection kind and pipeline step:
      │                        Đối tượng · Sự kiện · Hình ảnh · Giọng · Xuất · Agent
      ├─ Timeline (bottom)    EpisodeTimeline, single playhead owner
      └─ Drawer (overlay)     one enum: gallery | source | events-json | log | activity
```

Rules:

1. **Single source of truth.** `EpisodeProvider` owns fetched state and `selection` (`{sceneId, entityId, stateId, eventId, unitId, timeMs}`) via a reducer. Components read with selectors (`useSyncExternalStore`); no `onData` callbacks, no mirrored local selection.
2. **Pipeline ≠ graph.** Workflow stages live in the HeaderBar status strip. Clicking a stage switches the Inspector tab; it never changes Navigator content.
3. **Graph = active scene relationships only.** Nodes: scene, entity, state, event. Asset / cast pose-expression / anchor become **facets** on state and event nodes (chips + diagnostics). Edges: contains, before/after, targets. ~5–15 nodes per scene.
4. **Deterministic layered layout**: column per entity; states stacked under it; events in a lane under the entity they target. Measured node height (fixed CSS height) so rows cannot overlap. Layout key `studio-graph-layout@2:<project>:<scene>`; prune unknown IDs on load.
5. **Stable projection.** Recompute graph only when `(visual.revision, source_hash, timing_hash)` changes; node `data` keyed by ID with structural sharing so `memo` works. Polls that return identical revision do not re-render.
6. **Anchors from backend.** Add resolved anchors (event_id → word anchor_id, start_ms, ambiguous flag) to the visual state/build receipt produced by the compiler; delete frontend byte matching.
7. **Preview is never hidden.** Export and Voice are Inspector tabs; preview + timeline stay visible (export shows the MP4 player in the Stage only when user picks "Xem MP4").
8. **One Agent panel** in the Inspector with capability selector (project.inspect / episode.propose / scene.propose); one task poller in the store.
9. **CSS**: one `layout.css` with grid areas and container queries, tokens file, components scoped by class prefix; delete double-class hacks and dead dashboard rules.

## 3. Phases

Each phase: run checks, update this plan with evidence, scoped commit + push (AGENTS.md). Human voice/visual/video gates stay PENDING.

### G0 — Freeze and reconcile (docs only)
- [ ] Mark `2026-11-24-studio-graph-workspace-implementation.md` as superseded by this plan for layout; record what of it shipped.
- [ ] Update graph roadmap status line: R1 delivered as unified workspace (not optional), R0 still open.
- [ ] Capture baseline screenshots at 1366×768, 1060×650, 1093×614, 800×960 and current re-render count per 10 s (React Profiler) on fixture.

### G1 — Store and selection (no visual change)
- [ ] `episode-store.ts`: reducer, selection actions, single poll loop with backoff, pause when window hidden, dedupe voice fetch.
- [ ] Move VisualEditor/VoiceLab/EpisodeExport/agent fetches to the store; delete `onData`, `graphTarget`, `contextPanel`, mirrored selection effects.
- [ ] Tests: `tests/studio_episode_store.test.mjs` — selection transitions, stale revision ignored, identical poll causes no state change.

### G2 — Split VisualEditor
- [ ] `usePreviewPlayer` (SDK, iframes, audio, playhead), `PreviewStage`, `TransformOverlay`, `InspectorObject`, `InspectorEvents`, `InspectorAssets`, `AgentPanel`, `Drawer` (enum).
- [ ] Target: no file > 250 lines; VisualEditor removed or a thin composer.
- [ ] Existing `studio_workbench_browser.mjs`, `studio_p34_visual.test.mjs` stay green.

### G3 — Shell layout
- [ ] `EpisodeShell` with grid areas; Navigator/Inspector collapsible; preview min 190 px tall and ≥ 30 % width at 1060×650; no page scroll.
- [ ] HeaderBar pipeline strip replaces graph stage buttons and App dashboard metrics; Agent and Activity pages become Inspector tab / Drawer. App.tsx < 150 lines.
- [ ] Replace `style.css` override layers with `tokens.css` + `layout.css`; delete unused rules (verify via coverage).

### G4 — Graph rebuild
- [ ] `scene-graph.ts` v2: scene/entity/state/event nodes, facets, layered layout, diagnostics; stage nodes removed.
- [ ] Backend: resolved anchors in visual state (Python + compiler test); frontend consumes, byte matcher deleted.
- [ ] Tree mode as real hierarchy (scene ▸ entity ▸ state, events grouped), keyboard arrows.
- [ ] Tests: update `studio_scene_graph.test.mjs` (no overlap: every node rect disjoint; events under target column; stable IDs; immutable input), `studio_graph_browser.mjs` (no re-render on identical poll, drag persists per scene, zero canonical writes).

### G5 — Verify and hand off
- [ ] `pnpm -C apps/zodiac-studio build`, all `tests/studio_*` node/browser checks, affected Python tests, native maximize/restore smoke.
- [ ] Compare G0 baseline: screenshots, re-render counts, bundle sizes.
- [ ] Independent read-only review; update roadmap; commit/push.

## 4. Out of scope
New canonical commands (pose/expression/contact/scene create), Audio Mix V2, R5/R6 library work, default approvals, release builds.

## Status 2026-11-26 (actual, not roadmap)

Done: node graph replaced by `pipeline/StepList.tsx` (4 phases, one row per step, scenes collapsed); `NextAction` banner and `EmptyEpisode` first screen; graph files (`PipelineGraph`, `NodeCard`, `layout.ts`) removed; `VisualEditor` overlays and inspector tabs moved to `src/scene/` (41.6 KB to 34.6 KB), JSON parse errors still reported through the editor. Checks: `pnpm build` (tsc + vite) PASS; `node --test tests/studio_pipeline_layout.test.mjs tests/studio_acting.test.mjs` 22/22. Empty state seen in the native app.

Not done / not verified: preview player hook (`usePreviewPlayer`) and CSS consolidation (G2/G5 remainder); browser tests updated for the new selectors but not run (Playwright not installed here); the loaded-episode view was not seen in a real window; `@xyflow/react` still listed in package.json. Human voice/visual/video gates remain PENDING.
