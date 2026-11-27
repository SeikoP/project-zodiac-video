import { useCallback, useState, useSyncExternalStore } from "react";
import { Check, Clock, Hand, LoaderCircle, Lock, OctagonX, Play, RotateCcw, type LucideIcon } from "lucide-react";
import type { PipelineStore } from "./pipeline-store";
import { groupByPhase, phasePrimary, runnableScenes, phaseProgress, RUNNABLE, STATUS_LABEL } from "./status";
import type { NodeStatus, PipelineNode } from "./types";
import "./pipeline.css";

const ICON: Record<NodeStatus, LucideIcon> = {
  DONE: Check, READY: Play, RUNNING: LoaderCircle, STALE: RotateCcw, FAILED: OctagonX, BLOCKED: Lock, AWAITING_USER: Hand, PENDING: Clock,
};

function Row({ node, selected, onSelect, onRun, blocker }: { node: PipelineNode; selected: boolean; onSelect: (id: string) => void; onRun: (id: string) => void; blocker?: string }) {
  const Icon = ICON[node.status];
  const runnable = node.kind !== "gate" && RUNNABLE.includes(node.status);
  const canRun = runnable && !blocker; // the backend refuses a step whose inputs are not DONE: do not offer a button that cannot work
  return (
    <li className="step-row" data-node-id={node.id} data-status={node.status} data-kind={node.kind} aria-current={selected ? "true" : undefined}>
      <button className="step-main" onClick={() => onSelect(node.id)} aria-label={`${node.title}, ${STATUS_LABEL[node.status]}`}>
        <span className={"step-icon pipe-" + node.status.toLowerCase().replace("_", "-")} aria-hidden="true">
          <Icon size={14} strokeWidth={2} className={node.status === "RUNNING" ? "pipe-spin" : undefined} /></span>
        <span className="step-text"><strong>{node.title}</strong><small>{STATUS_LABEL[node.status]}{node.detail && node.detail !== STATUS_LABEL[node.status] && node.detail !== "Chờ bước trước" ? ` · ${node.detail}` : ""}</small></span>
      </button>
      {runnable && blocker && <small className="step-blocker">Cần xong: {blocker}</small>}
      {canRun && <button className="outline-btn step-run" onClick={() => onRun(node.id)}>{node.status === "READY" ? "Chạy" : "Chạy lại"}</button>}
    </li>
  );
}

/** The visual phase at a glance: one bar, one button, the frames, and any question for the owner. */
function Compact({ all, store, onRun, blockerOf }: { all: PipelineNode[]; store: PipelineStore; onRun: (id: string) => void; blockerOf: (n: PipelineNode) => string | undefined }) {
  const { done, total, percent } = phaseProgress(all);
  const primary = phasePrimary(all.filter((n) => !blockerOf(n)));
  const running = all.some((n) => n.status === "RUNNING");
  const [confirming, setConfirming] = useState(false);
  // Only a step that failed or is waiting can have half-finished authoring behind it; "Chạy lại" keeps that work, this drops it.
  const authoring = all.find((n) => n.id === "visual");
  const canRestart = !!authoring && !running && ["FAILED", "STALE", "READY"].includes(authoring.status) && !blockerOf(authoring);
  // A finished episode can be authored again from the script: the current Visual Intent is archived, never deleted.
  const canRedo = !!authoring && !running && authoring.status === "DONE";
  return (
    <div className="phase-compact" data-phase="visual">
      <div className="phase-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Tiến độ hình ảnh"><span style={{ width: `${percent}%` }} /></div>
      <div className="phase-actions"><small>{done}/{total} bước xong · các cảnh và câu hỏi ở khung bên phải</small>
        {primary && !running && <button className="outline-btn phase-primary" onClick={() => onRun(primary.id)}>{primary.status === "READY" ? "Chạy" : "Chạy lại"}: {primary.title}</button>}
        {(canRestart || canRedo) && !confirming && <button className="subtle-btn phase-restart" onClick={() => setConfirming(true)}>{canRedo ? "Soạn lại hình ảnh" : "Soạn lại từ đầu"}</button>}
        {(canRestart || canRedo) && confirming && <span className="phase-restart-confirm" role="alert">
          <small>{canRedo ? "Lưu bản hình ảnh hiện tại vào kho lưu và soạn lại từ kịch bản (tốn thêm tài nguyên; phải duyệt lại)?"
            : "Bỏ các cảnh đã soạn xong và soạn lại toàn bộ (tốn thêm tài nguyên)?"}</small>
          <button className="outline-btn" onClick={() => { setConfirming(false); void store.discardAuthoring(canRedo); }}>Bỏ và soạn lại</button>
          <button className="subtle-btn" onClick={() => setConfirming(false)}>Giữ lại</button></span>}
        {!primary && !running && runnableScenes(all).length > 0 && <button className="outline-btn phase-primary" onClick={() => { void store.runScenes(); }}>Dựng các cảnh ({runnableScenes(all).length})</button>}
      </div>
    </div>
  );
}

/** One column, top to bottom. This replaces the node graph: the order of work is fixed, so a list says it with less. */
export default function StepList({ store, onOpen }: { store: PipelineStore; onOpen: (nodeId: string) => void }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { nodes, selection } = snap;
  const select = useCallback((id: string) => { store.select(id); onOpen(id); }, [store, onOpen]);
  const run = useCallback((id: string) => { void store.run(id).catch(() => undefined); }, [store]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const blockerOf = (node: PipelineNode) => { const bad = node.inputs.map((i) => byId.get(i)).find((i) => i && i.status !== "DONE"); return bad?.title; };
  if (!nodes.length) {
    return <section className="step-list" aria-label="Quy trình sản xuất"><p className="pipe-empty">
      {snap.error ? `Không tải được quy trình: ${snap.error}` : "Đang đọc trạng thái episode…"}</p></section>;
  }
  const rows = (steps: PipelineNode[], scenes: PipelineNode[]) => (
    <ol>
      {steps.map((node) => <Row key={node.id} node={node} selected={selection.nodeId === node.id} onSelect={select} onRun={run} blocker={blockerOf(node)} />)}
      {scenes.length > 0 && (
        <li className="step-scenes"><details open={scenes.some((s) => s.id === selection.nodeId || s.status === "RUNNING" || s.status === "FAILED")}>
          <summary>Các cảnh · {scenes.filter((s) => s.status === "DONE").length}/{scenes.length} xong</summary>
          <ol>{scenes.map((node) => <Row key={node.id} node={node} selected={selection.nodeId === node.id} onSelect={select} onRun={run} blocker={blockerOf(node)} />)}</ol>
        </details></li>)}
    </ol>);
  return (
    <section className="step-list" aria-label="Quy trình sản xuất">
      {snap.error && <div role="alert" className="inline-alert error"><span>{snap.error}</span></div>}
      {groupByPhase(nodes).map(({ phase, steps, scenes }) => {
        const all = [...steps, ...scenes];
        const finished = all.filter((n) => n.status === "DONE").length;
        // A finished phase folds away; the one you are on, or one that needs attention, stays open.
        const current = all.some((n) => n.id === selection.nodeId || ["AWAITING_USER", "RUNNING", "FAILED", "READY", "STALE"].includes(n.status));
        return (
        <details className="step-phase" key={phase.id} data-phase={phase.id} open={current}>
          <summary><span>{phase.title}</span><small>{finished}/{all.length}</small></summary>
          {phase.id === "visual" && <Compact all={all} store={store} onRun={run} blockerOf={blockerOf} />}
          {phase.id === "visual"
            ? <>{rows(steps.filter(n => n.kind === "gate"), [])}<details className="phase-detail"><summary>Chi tiết kỹ thuật</summary>{rows(steps.filter(n => n.kind !== "gate"), scenes)}</details></>
            : rows(steps, scenes)}
        </details>);
      })}
    </section>
  );
}
