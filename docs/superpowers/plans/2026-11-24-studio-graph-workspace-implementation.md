# Unified Graph Workspace Implementation Plan

> **SUPERSEDED 2026-11-25** by [studio-production-graph](2026-11-25-studio-production-graph.md). The relationship Graph (`SceneGraph`, `StudioWorkspace`) was removed; `EpisodeShell` + production-flow graph replace it.

> Use superpowers:executing-plans. User authorized this implementation and corrected the earlier layout on 2026-11-24.

**Design:** One episode workspace, relationship Graph, persistent preview/timeline, contextual voice/visual/export controls. Reuse canonical commands and existing voice/export components. Merge duplicate navigation instead of mounting three separate full-page tools. Graph is the requested management surface; structure list remains an accessible alternative. It projects source and never writes graph coordinates into artwork.

**User correction supersedes earlier experiment gate:** implement Graph now while recording unresolved R0 CI/agent diagnostics. Human listening, visual/video approval and production release gates remain unchanged. Default desktop window is maximized with restore controls; narrowing a window compacts/reflows panes. No page-level scroll at normal sizes; long lists/details use bounded internal scroll. Fixed two-row pagination leaving empty space is rejected.

## Task 1: Relationship projection and Graph

- [ ] RED: deterministic project/scene/entity/state/event/anchor IDs, matching references, sparse scenes, dangling references, duplicate anchor text, unknown fields and immutable input.
- [ ] GREEN: `scene-graph.ts` projects workflow stages plus scene-focused source relationships; read-only `SceneGraph.tsx` uses pinned MIT React Flow, keyboard selection and structure alternative. No graph-write backend or second player.
- [ ] Verify projection, TypeScript/Vite, graph pan/selection/reload generates zero canonical writes.

## Task 2: Merge episode tools and responsive layout

- [ ] Replace separate voice/editor/export full-page mounts with `StudioWorkspace.tsx`; stage/node selection changes contextual controls inside persistent VisualEditor/Timeline. Wire state/event/anchor selection through existing commands and measured timing.
- [ ] VoiceLab embedded mode selects graph unit; replace fixed unit pagination with bounded internal scroll. Preserve take/whole-track listening confirmations and cancellation. Keep existing inspector actions and export review reachable.
- [ ] Default Tauri maximized; responsive graph/preview/inspector panes with explicit collapse controls, no clipping at 1366×768, 1060×650, 1093×614 and narrow 800×960. Preview retains useful size; visible keyboard focus. Graph coordinates stay separate from canonical transform.
- [ ] Browser asserts graph→voice unit, scene/entity/state/event selection, contextual export, resized controls, source identity, no duplicate tools, real SVG edge rendering and persistent preview/timeline. Update affected existing browser checks to the merged navigation.

## Task 3: Verify and hand off

- [ ] Run affected Python/Node, frontend build, fixture browser; native maximize/restore/graph inspection when available. Record remote CI honestly, leaving genuine human gates pending.
- [ ] Independent read-only review; fix important findings with regression checks. Update roadmap/evidence, commit/push scoped task changes; preserve existing runtime/media and user work.

Graph projection interfaces use existing VisualState/VoiceState and optional WorkbenchSelection state/event/anchor IDs. Inspector scene.patch/performance/asset actions retain revision checks. UI selection and viewport storage are project-local preferences only. Full new granular pose/contact editing and audio mix remain later roadmap work.
