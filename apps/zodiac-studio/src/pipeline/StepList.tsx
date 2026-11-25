import { useCallback, useSyncExternalStore } from "react";
import { Check, Clock, Hand, LoaderCircle, Lock, OctagonX, Play, RotateCcw, type LucideIcon } from "lucide-react";
import type { PipelineStore } from "./pipeline-store";
import { groupByPhase, phaseSummary, RUNNABLE, STATUS_LABEL } from "./status";
import type { NodeStatus, PipelineNode } from "./types";
import "./pipeline.css";

const ICON: Record<NodeStatus, LucideIcon> = {
  DONE: Check, READY: Play, RUNNING: LoaderCircle, STALE: RotateCcw, FAILED: OctagonX, BLOCKED: Lock, AWAITING_USER: Hand, PENDING: Clock,
};

function Row({ node, selected, onSelect, onRun }: { node: PipelineNode; selected: boolean; onSelect: (id: string) => void; onRun: (id: string) => void }) {
  const Icon = ICON[node.status];
  const canRun = node.kind !== "gate" && RUNNABLE.includes(node.status);
  return (
    <li className="step-row" data-node-id={node.id} data-status={node.status} data-kind={node.kind} aria-current={selected ? "true" : undefined}>
      <button className="step-main" onClick={() => onSelect(node.id)} aria-label={`${node.title}, ${STATUS_LABEL[node.status]}`}>
        <span className={"step-icon pipe-" + node.status.toLowerCase().replace("_", "-")} aria-hidden="true">
          <Icon size={14} strokeWidth={2} className={node.status === "RUNNING" ? "pipe-spin" : undefined} /></span>
        <span className="step-text"><strong>{node.title}</strong><small>{STATUS_LABEL[node.status]}{node.detail && node.detail !== STATUS_LABEL[node.status] && node.detail !== "Chờ bước trước" ? ` · ${node.detail}` : ""}</small></span>
      </button>
      {canRun && <button className="outline-btn step-run" onClick={() => onRun(node.id)}>{node.status === "READY" ? "Chạy" : "Chạy lại"}</button>}
    </li>
  );
}

/** One column, top to bottom. This replaces the node graph: the order of work is fixed, so a list says it with less. */
export default function StepList({ store, onOpen }: { store: PipelineStore; onOpen: (nodeId: string) => void }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { nodes, selection } = snap;
  const select = useCallback((id: string) => { store.select(id); onOpen(id); }, [store, onOpen]);
  const run = useCallback((id: string) => { void store.run(id).catch(() => undefined); }, [store]);
  if (!nodes.length) {
    return <section className="step-list" aria-label="Quy trình sản xuất"><p className="pipe-empty">
      {snap.error ? `Không tải được quy trình: ${snap.error}` : "Đang đọc trạng thái episode…"}</p></section>;
  }
  const { done, total } = phaseSummary(nodes);
  return (
    <section className="step-list" aria-label="Quy trình sản xuất">
      <header className="step-head"><strong>Quy trình</strong><small>{done}/{total} bước xong</small></header>
      {groupByPhase(nodes).map(({ phase, steps, scenes }) => {
        const all = [...steps, ...scenes];
        const finished = all.filter((n) => n.status === "DONE").length;
        // A finished phase folds away; the one you are on, or one that needs attention, stays open.
        const current = all.some((n) => n.id === selection.nodeId || ["AWAITING_USER", "RUNNING", "FAILED", "READY", "STALE"].includes(n.status));
        return (
        <details className="step-phase" key={phase.id} data-phase={phase.id} open={current}>
          <summary><span>{phase.title}</span><small>{finished}/{all.length}</small></summary>
          <ol>
            {steps.map((node) => <Row key={node.id} node={node} selected={selection.nodeId === node.id} onSelect={select} onRun={run} />)}
            {scenes.length > 0 && (
              <li className="step-scenes"><details open={scenes.some((s) => s.id === selection.nodeId || s.status === "RUNNING" || s.status === "FAILED")}>
                <summary>Các cảnh · {scenes.filter((s) => s.status === "DONE").length}/{scenes.length} xong</summary>
                <ol>{scenes.map((node) => <Row key={node.id} node={node} selected={selection.nodeId === node.id} onSelect={select} onRun={run} />)}</ol>
              </details></li>)}
          </ol>
        </details>);
      })}
    </section>
  );
}
