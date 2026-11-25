import { useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import type { PipelineStore } from "./pipeline-store";
import type { NodeStatus, PipelineNode } from "./types";

const STEP_LABEL: Record<NodeStatus, string> = {
  PENDING: "Chưa tới lượt", READY: "Sẵn sàng", RUNNING: "Đang chạy", DONE: "Xong", FAILED: "Lỗi",
  STALE: "Cần làm lại", BLOCKED: "Đang bị chặn", AWAITING_USER: "Chờ bạn duyệt",
};

export type NextAction = { tone: "you" | "busy" | "ready" | "done"; text: string; detail: string; nodeId: string | null; button: string | null };

/** One sentence that answers "what do I do now?" from the pipeline snapshot. Pure so it can be tested without React. */
export function nextAction(nodes: PipelineNode[], needsYou: { node_id: string; title: string; kind: string }[], runningTitle: string | null): NextAction {
  if (nodes.length === 0) return { tone: "ready", text: "Đang đọc trạng thái episode…", detail: "", nodeId: null, button: null };
  const first = needsYou[0];
  if (first) {
    const verb = first.kind === "gate" ? "Cần bạn nghe/xem và duyệt" : first.kind === "failed" ? "Có bước bị lỗi" : "Có bước đang bị chặn";
    const title = first.title.replace(/^(Cần bạn duyệt|Bị chặn|Không tự xử lý được): /, ""); // the queue already prefixes its titles
    const detail = first.kind === "gate" ? "Chỉ bạn mới duyệt được bước này; máy không tự duyệt thay." : "Mở bước này để xem lý do và cách xử lý.";
    return { tone: "you", text: `${verb}: ${title}`, detail, nodeId: first.node_id, button: first.kind === "gate" ? "Mở và duyệt" : "Xem chi tiết" };
  }
  const waiting = nodes.find((node) => node.status === "AWAITING_USER");
  if (waiting) return { tone: "you", text: `Cần bạn nghe/xem và duyệt: ${waiting.title}`, detail: "Chỉ bạn mới duyệt được bước này; máy không tự duyệt thay.", nodeId: waiting.id, button: "Mở và duyệt" };
  if (runningTitle) return { tone: "busy", text: `Đang chạy: ${runningTitle}`, detail: "Bạn có thể đợi hoặc xem các cảnh khác trong lúc này.", nodeId: null, button: null };
  const stale = nodes.find((n) => n.status === "STALE");
  if (stale) return { tone: "ready", text: `Cần làm lại: ${stale.title}`, detail: "Nội dung trước đó đã đổi nên kết quả này đã cũ.", nodeId: stale.id, button: "Mở" };
  const ready = nodes.find((n) => n.status === "READY");
  if (ready) return { tone: "ready", text: `Bước tiếp theo: ${ready.title}`, detail: ready.detail || "Bấm nút chạy trên thẻ bước này.", nodeId: ready.id, button: "Mở" };
  if (nodes.every((n) => n.status === "DONE")) return { tone: "done", text: "Mọi bước đã xong", detail: "Xem video xuất ra rồi quyết định duyệt cuối cùng.", nodeId: null, button: null };
  const pending = nodes.find((n) => n.status !== "DONE");
  return { tone: "ready", text: `Đang chờ: ${pending?.title ?? "bước trước"}`, detail: STEP_LABEL[pending?.status ?? "PENDING"], nodeId: pending?.id ?? null, button: pending ? "Mở" : null };
}

export default function NextActionBanner({ store, onOpen }: { store: PipelineStore; onOpen: (nodeId: string) => void }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const running = snap.run?.state === "RUNNING" ? snap.nodes.find((n) => n.id === snap.run?.node)?.title ?? "bước hiện tại" : null;
  const action = nextAction(snap.nodes, snap.needsYou, running);
  return (
    <div className="next-action" data-tone={action.tone} role="status" aria-live="polite">
      <div><strong>{action.text}</strong>{action.detail && <small>{action.detail}</small>}</div>
      {action.nodeId && action.button && (
        <button className="primary-btn" onClick={() => onOpen(action.nodeId!)}>{action.button} <ArrowRight size={13} aria-hidden="true" /></button>)}
    </div>
  );
}
