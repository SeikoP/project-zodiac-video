import type { InspectorProps } from "../inspector-registry";

export default function ContentInspector({ project, onImport }: InspectorProps) {
  return (
    <div className="source-context">
      <h2>Nội dung của episode</h2>
      <p>{project?.display_title || "Nhập gói nội dung để bắt đầu."}</p>
      <dl>
        <dt>Nội dung</dt><dd>{project?.status.content ?? "Chưa nhập"}</dd>
        <dt>Giọng</dt><dd>{project?.status.voice ?? "Chưa có"}</dd>
        <dt>Hình ảnh</dt><dd>{project?.status.visual ?? "Chưa có bằng chứng"}</dd>
      </dl>
      <p>Duyệt nội dung là việc của bạn ở Phase 1; Studio không tự duyệt thay.</p>
      <button className="outline-btn" onClick={onImport}>Nhập episode</button>
    </div>
  );
}
