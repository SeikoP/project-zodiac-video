import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { pipelineApi, type Project } from "../backend";
import type { WorkbenchSelection, GraphTarget } from "../workbench-state";
import VisualEditor from "../VisualEditor";
import AutopilotBar from "./AutopilotBar";
import EmptyEpisode from "./EmptyEpisode";
import EpisodeIdentity from "./EpisodeIdentity";
import NeedsYou from "./NeedsYou";
import NextActionBanner from "./NextAction";
import StepList from "./StepList";
import { inspectorFor } from "./inspector-registry";
import { createPipelineStore, type Visibility } from "./pipeline-store";
import type { PipelineNode } from "./types";
import "./episode-shell.css";

/** Which VisualEditor behaviour a pipeline node needs (kept until the editor is split into src/scene/*). */
function targetFor(node: PipelineNode | undefined, tool: "voice" | "editor" | "review"): GraphTarget {
  // Until the graph has loaded, the app-level shortcut (Nghe giọng / Xem video) decides the stage.
  if (!node) return { stage: tool === "voice" ? "voice" : tool === "review" ? "export" : "visual" };
  const key = node.id.split(":")[0];
  if (key === "voice" || key === "voice_review" || key === "timing") return { stage: "voice" };
  if (key === "export") return { stage: "export" };
  if (key === "content") return { stage: "content" };
  return node.scene_id ? { stage: "visual", sceneId: node.scene_id } : { stage: "visual" };
}

export default function EpisodeShell({ project, active, tool, toolTick, selection, onSelectionChange, onBuildReady, onImport, onChanged, onPlan, initialConceptId }: {
  project: Project | null; active: boolean; tool: "voice" | "editor" | "review"; toolTick: number; selection: WorkbenchSelection;
  onSelectionChange: (selection: WorkbenchSelection) => void; onBuildReady: (projectId: string, ready: boolean) => void;
  onImport: () => void; onChanged: () => void; onPlan: () => void; initialConceptId: string;
}) {
  const projectId = project?.project_id ?? "";
  const activeRef = useRef(active);
  activeRef.current = active;
  const store = useMemo(() => {
    const visibility: Visibility = {
      isHidden: () => document.hidden || !activeRef.current,
      subscribe: (cb) => { document.addEventListener("visibilitychange", cb); return () => document.removeEventListener("visibilitychange", cb); },
    };
    return createPipelineStore(pipelineApi, { projectId, visibility });
  }, [projectId]);
  useEffect(() => store.connect(), [store]); // StrictMode-safe: disconnect on unmount or project change, reconnect on remount
  useEffect(() => { if (projectId && active) void store.refresh(); }, [store, projectId, active]); // polling pauses while inactive (visibility) and resumes here
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const toolNode = tool === "voice" ? "voice" : tool === "review" ? "visual_review" : null;
  const ready = snapshot.nodes.length > 0;
  useEffect(() => { if (ready) store.select(toolNode); }, [store, toolNode, toolTick, ready]); // the app's "Nghe giọng"/"Xem video" shortcuts pick a node
  const [voiceRefresh, setVoiceRefresh] = useState(0);
  const node = snapshot.nodes.find((n) => n.id === snapshot.selection.nodeId);
  const target = useMemo(() => targetFor(node, tool), [node?.id, node?.scene_id, tool]); // eslint-disable-line react-hooks/exhaustive-deps
  const Inspector = node ? inspectorFor(node) : null;
  const changed = useCallback(() => { setVoiceRefresh((n) => n + 1); void store.refresh(); onChanged(); }, [store, onChanged]);
  const open = useCallback((id: string) => { store.select(id); }, [store]);
  // Voice, export and content have their own full-width panel; the visual steps keep the stage + scene inspector.
  const fullStage = target.stage === "voice" || target.stage === "export" || target.stage === "content";
  const panel = node && Inspector
    ? <Suspense fallback={<p>Đang mở phần đang chọn…</p>}>
        <Inspector project={project} node={node} active={active} initialConceptId={initialConceptId} onChanged={changed} onImport={onImport} />
      </Suspense>
    : undefined;

  if (!project) return (
    <section className="production-manager" aria-label="Quản lý tổng thể episode">
      <EmptyEpisode onImport={onImport} />
    </section>);

  return (
    <section className="production-manager" aria-label="Quản lý tổng thể episode">
      <div className="episode-bar">
        <EpisodeIdentity project={project} onPlan={onPlan} onImport={onImport} />
        <NextActionBanner store={store} onOpen={open} />
        <AutopilotBar store={store} />
      </div>
      <div className="production-workspace" data-stage={target.stage}>
        <div className="production-side">
          <StepList store={store} onOpen={open} projectId={projectId} />
          <NeedsYou store={store} onOpen={open} />
        </div>
        {fullStage && <div className="stage-panel">{panel}</div>}
        <div className="production-editor" style={fullStage ? { display: "none" } : undefined}>
          <Suspense fallback={<p>Đang mở phần đang chọn…</p>}>
            <VisualEditor project={project} active={active} selection={selection} onSelectionChange={onSelectionChange} onBuildReady={onBuildReady}
              onVoice={() => open("voice")} graphTarget={target} contextPanel={fullStage ? undefined : panel} voiceRefresh={voiceRefresh}
              agentRunning={snapshot.nodes.some((n) => n.status === "RUNNING" && n.id.split(":")[0] === "visual")} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
