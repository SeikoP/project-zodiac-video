import { useState } from "react";
import { backend } from "../../backend";
import type { InspectorProps } from "../inspector-registry";
import { useEvidence } from "./useEvidence";

/** The user-only Visual Review gate: shows the evidence, then needs a backend-issued playback before confirming. */
export default function ReviewInspector({ project, node, onChanged }: InspectorProps) {
  const { evidence, error: loadError } = useEvidence(project?.project_id, node.status);
  const [playback, setPlayback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = node.status === "AWAITING_USER";
  const done = node.status === "DONE";
  const buildId = evidence?.build_id ?? null;
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  return (
    <div className="source-context review-inspector">
      <h2>Duyệt hình ảnh</h2>
      {done && <p role="status">Đã duyệt bản dựng này. Sửa nguồn hoặc dựng lại sẽ cần duyệt lại.</p>}
      {!ready && !done && <p role="status">Agent đang hoàn thiện; chưa thể duyệt. Trạng thái: {node.status}.</p>}
      <h3>Bằng chứng từ agent</h3>
      <ul>
        <li>Kiểm tra bản soạn: {evidence?.checks ? (evidence.checks.ok ? "đạt" : `${evidence.checks.issues.length} vấn đề`) : "chưa có"}</li>
        <li>Kiểm khung hình: {evidence?.inspect ? `${evidence.inspect.findings.length} nhận xét (${evidence.inspect.method === "visual" ? "nhìn khung hình" : "cấu trúc"})` : "chưa có"}</li>
        <li>Ảnh bìa: {evidence?.cover?.headline ?? "chưa có"}</li>
        <li>Nội dung đăng: {evidence?.publish?.title ?? "chưa có"}</li>
      </ul>
      {ready && <>
        <p>Xem toàn bộ video ở khung xem trước, rồi duyệt. Agent và autopilot không thể duyệt thay bạn.</p>
        <button className="outline-btn" disabled={busy || !buildId || playback !== null}
          onClick={() => act(async () => { setPlayback((await backend.pipelinePlayback(project!.project_id, buildId!)).playback_id); })}>
          Bắt đầu xem bản dựng</button>
        <button className="primary-btn" disabled={busy || !playback || !buildId || evidence?.revision == null}
          onClick={() => act(async () => {
            await backend.pipelineConfirmVisual(project!.project_id, evidence!.revision!, buildId!, playback!);
            setPlayback(null); onChanged();
          })}>Duyệt hình ảnh</button>
      </>}
      {(error || loadError) && <p role="alert" className="pipe-error">{error || loadError}</p>}
    </div>
  );
}
