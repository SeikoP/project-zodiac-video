import type { AgentTask } from "./backend";
import { Paged, PagedText } from "./Paged";

export default function AgentProposal({ task }: { task: AgentTask }) {
  const text = task.suggestion || task.preview;
  let description: string[] = [];
  try {
    const change = JSON.parse(task.suggestion);
    if (change.kind === "source.replace") description = (change.payload.intent.scenes as { id: string; semantic_goal: string }[]).map(s => `${s.id} · ${s.semantic_goal}`);
    else if (change.kind === "scene.patch") description = [`${change.payload.scene_id} · ${change.payload.entity_id} / ${change.payload.state_id}`, ...Object.entries(change.payload.changes).map(([k, v]) => `${k}: ${v}`)];
    else if (change.kind === "scene.performance") description = [`${change.payload.scene_id} · ${change.payload.events.length} nhịp diễn theo lời kể`];
    else if (change.kind === "asset.select") description = [`${change.payload.scene_id} · Chọn composition ${change.payload.candidate_id}`];
  } catch { /* Streaming output may still be incomplete. */ }
  return <div className="agent-proposal"><small>{task.status} · {task.scene_id ? `Cảnh ${task.scene_id}` : task.kind === "episode.propose" ? "Bản dựng ban đầu" : "Kiểm tra episode"}</small>
    {task.status === "COMPLETED" && !task.write_applied && <strong>Đã có đề xuất · Chưa áp dụng</strong>}
    {task.write_applied && <small>Đã áp dụng · {task.applied_command_id}</small>}
    {task.error && <p className="voice-warning" role="alert">{task.error}</p>}
    {description.length ? <Paged size={2} label="Đề xuất agent">{description.map((s, i) => <p key={i}>{s}</p>)}</Paged> : <p>{task.status === "RUNNING" || task.status === "STARTING" ? `Agent đang soạn đề xuất… ${text.length} ký tự đã nhận` : task.kind === "project.inspect" ? text : "Chưa có đề xuất hợp lệ."}</p>}
    {text && <details><summary>Chi tiết tác vụ</summary><small>Task {task.task_id} · Thread {task.thread_id ?? "đang tạo"}</small><PagedText size={400} text={text}/></details>}
  </div>;
}
