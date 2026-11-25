import type { AgentTask } from "./backend";
import { Paged, PagedText } from "./Paged";

export default function AgentProposal({ task }: { task: AgentTask }) {
  const text = task.suggestion || task.preview;
  let description: string[] = task.kind === "scene.revise" ? task.changes ?? [] : [];
  try {
    if (task.kind === "scene.revise") throw new Error("shown from changes");
    const change = JSON.parse(task.suggestion);
    if (change.kind === "source.replace") description = (change.payload.intent.scenes as { id: string; semantic_goal: string }[]).map(s => `${s.id} · ${s.semantic_goal}`);
    else if (change.kind === "scene.patch") description = [`${change.payload.scene_id} · ${change.payload.entity_id} / ${change.payload.state_id}`, ...Object.entries(change.payload.changes).map(([k, v]) => `${k}: ${v}`)];
    else if (change.kind === "scene.performance") description = [`${change.payload.scene_id} · ${change.payload.events.length} nhịp diễn theo lời kể`];
    else if (change.kind === "asset.select") description = [`${change.payload.scene_id} · Chọn composition ${change.payload.candidate_id}`];
  } catch { /* Streaming output may still be incomplete. */ }
  const PART_LABEL = { RUNNING: "đang soạn", DONE: "xong", FAILED: "lỗi" } as const;
  const parts = task.parts?.length ? <ul className="agent-parts" aria-label="Tiến độ từng cảnh">{task.parts.map(p =>
    <li key={p.id} data-status={p.status}><strong>{p.id === "skeleton" ? "Khung nhân vật" : `Cảnh ${p.id}`}</strong> · {PART_LABEL[p.status]}{p.seconds ? ` · ${p.seconds}s` : ""}{p.attempt && p.attempt > 1 ? ` · lần ${p.attempt}` : ""}{p.error ? ` · ${p.error}` : ""}</li>)}</ul> : null;
  return <div className="agent-proposal">{task.model && <small>Model: {task.model}</small>}{parts}<small>{task.status} · {task.scene_id ? `Cảnh ${task.scene_id}` : task.kind === "episode.propose" ? "Bản dựng ban đầu" : "Kiểm tra episode"}</small>
    {task.status === "COMPLETED" && !task.write_applied && <strong>Đã có đề xuất · Chưa áp dụng</strong>}
    {task.write_applied && <small>Đã áp dụng · {task.applied_command_id}</small>}
    {task.error && <p className="voice-warning" role="alert">{task.status === "CANCELLED" ? "Đã dừng theo yêu cầu. Bạn có thể gửi yêu cầu mới." : "Chưa tạo được đề xuất hợp lệ. Thử lại hoặc mở chi tiết để xem nguyên nhân."}</p>}
    {description.length ? <Paged size={2} label="Đề xuất agent">{description.map((s, i) => <p key={i}>{s}</p>)}</Paged> : <p>{task.status === "RUNNING" || task.status === "STARTING" ? `Agent đang ${task.validation_attempts?.length ? "sửa theo kiểm tra" : "soạn đề xuất"}… ${text.length} ký tự đã nhận` : task.kind === "project.inspect" ? text : "Chưa có đề xuất hợp lệ."}</p>}
    {(text || task.error) && <details><summary>Chi tiết tác vụ</summary>{!!task.validation_attempts?.length && <small>Đã dùng {task.validation_attempts.length} lượt sửa theo validator.</small>}{!!task.bound_fields?.length && <small>Core gắn metadata nguồn: {task.bound_fields.join(", ")}</small>}{task.error && <p>{task.error}</p>}<small>Task {task.task_id} · Thread {task.thread_id ?? "đang tạo"}</small><PagedText size={400} text={text}/></details>}
  </div>;
}
