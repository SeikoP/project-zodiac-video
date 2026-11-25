import type { NodeStatus, PipelineNode } from "./types";

export const STATUS_LABEL: Record<NodeStatus, string> = {
  DONE: "Xong", READY: "Sẵn sàng", RUNNING: "Đang chạy", STALE: "Cần làm lại", FAILED: "Lỗi",
  BLOCKED: "Bị chặn", AWAITING_USER: "Chờ bạn duyệt", PENDING: "Chờ bước trước",
};

export const RUNNABLE: NodeStatus[] = ["READY", "STALE", "FAILED"];

export type Phase = { id: string; title: string; ids: string[] };

/** The four things a person thinks in. Node ids not listed here fall into the last phase that precedes them, so a new node never disappears. */
export const PHASES: Phase[] = [
  { id: "content", title: "1 · Nội dung", ids: ["content"] },
  { id: "voice", title: "2 · Giọng đọc", ids: ["voice", "voice_review", "timing"] },
  { id: "visual", title: "3 · Hình ảnh", ids: ["visual", "checks", "assets", "cover", "publish", "scene", "build", "inspect", "visual_review"] },
  { id: "export", title: "4 · Xuất video", ids: ["export"] },
];

export const nodeKey = (node: PipelineNode) => node.id.split(":")[0];

/** Group nodes by phase, keeping the store's order. Scenes are returned separately so they can be one compact row. */
export function groupByPhase(nodes: PipelineNode[]) {
  const phaseOf = (node: PipelineNode) => {
    const key = nodeKey(node);
    const hit = PHASES.find((phase) => phase.ids.includes(key));
    return hit ? hit.id : PHASES[PHASES.length - 2].id;
  };
  return PHASES.map((phase) => {
    const inPhase = nodes.filter((node) => phaseOf(node) === phase.id);
    return { phase, steps: inPhase.filter((node) => !node.scene_id || !node.id.startsWith("scene:")), scenes: inPhase.filter((node) => node.id.startsWith("scene:")) };
  }).filter((group) => group.steps.length + group.scenes.length > 0);
}

export function phaseSummary(nodes: PipelineNode[]): { done: number; total: number } {
  return { done: nodes.filter((node) => node.status === "DONE").length, total: nodes.length };
}
