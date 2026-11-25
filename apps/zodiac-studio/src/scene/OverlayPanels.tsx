import { Paged, PagedText } from "../Paged";
import type { VisualScene, VisualState } from "../backend";

/** Full-width panels that replace the stage: events JSON, Visual Intent source, build log. Each is self-contained. */

export function EventsEditor({ scene, text, onText, disabled, onClose, onSave }: {
  scene: VisualScene | undefined; text: string; onText: (text: string) => void; disabled: boolean; onClose: () => void; onSave: (text: string) => void;
}) {
  return (
    <div className="panel visual-source"><strong>Nhịp diễn · {scene?.id}</strong>
      <small>Dùng state và đạo cụ có sẵn: ý định → hành động/tiếp xúc → phản ứng → giữ đủ đọc. Voice anchor phải đúng lời đã duyệt; giữ tiếp xúc tay–đạo cụ khi chuyển động.</small>
      <PagedText label="Sự kiện diễn xuất" size={600} text={text} onChange={onText} />
      <div className="agent-actions"><button className="outline-btn" onClick={onClose}>Đóng</button>
        <button className="primary-btn" disabled={disabled || !scene} onClick={() => onSave(text)}>Kiểm tra & lưu nhịp diễn</button></div></div>
  );
}

export function SourcePanel({ state, text, onText, disabled, onFile, onSave }: {
  state: VisualState | null; text: string; onText: (text: string) => void; disabled: boolean; onFile: (file: File) => void; onSave: (text: string) => void;
}) {
  return (
    <div className="panel visual-source"><label>Nhập nguồn zodiac-visual-intent@1<input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
      <PagedText label="Canonical Visual Intent" size={900} text={text} onChange={onText} />
      <div className="agent-actions"><button className="outline-btn" onClick={() => onText("")}>Soạn nguồn thay thế</button>
        <button className="outline-btn" onClick={() => onText(JSON.stringify(state?.intent, null, 2) ?? "")}>Đọc nguồn hiện tại</button>
        <button className="primary-btn" disabled={disabled || !text.trim()} onClick={() => onSave(text)}>Lưu nguồn có kiểm tra</button></div>
      <small>Sửa từng trang nguồn. Để dán thay toàn bộ JSON, chọn “Soạn nguồn thay thế” trước hoặc nhập tệp JSON. Narration, receipt và voice giữ nguyên.</small></div>
  );
}

export function BuildLog({ events }: { events: NonNullable<VisualState["events"]> }) {
  return (
    <div className="panel visual-log"><Paged size={5} label="Nhật ký build">{events.slice().reverse().map((e) => (
      <p key={e.event_seq}>R{e.revision} · {e.kind} · {String(e.payload.scene_id ?? e.payload.build_id ?? "")}</p>))}</Paged></div>
  );
}
