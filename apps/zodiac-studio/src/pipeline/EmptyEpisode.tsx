import { FileArchive } from "lucide-react";

const STEPS = [
  { title: "Nhập nội dung đã duyệt", text: "Chọn file ZIP Phase 1 (nội dung, lời dẫn đã được duyệt). Studio chỉ đọc, không sửa file gốc." },
  { title: "Tạo giọng đọc và nghe", text: "Máy đọc từng câu. Bạn nghe và bấm duyệt; chưa duyệt giọng thì chưa dựng hình." },
  { title: "Dựng hình các cảnh", text: "Trợ lý đề xuất cảnh, nhân vật, đồ vật theo lời dẫn. Bạn xem trước và chỉnh nếu cần." },
  { title: "Xuất và duyệt video", text: "Xuất MP4 kèm phụ đề, xem lại toàn bộ rồi mới duyệt cuối." },
];

/** Shown instead of an empty graph, so the first screen says what to do and why nothing else is clickable yet. */
export default function EmptyEpisode({ onImport }: { onImport: () => void }) {
  return (
    <section className="empty-episode" aria-label="Bắt đầu một episode">
      <h2>Bắt đầu một episode</h2>
      <p>Làm lần lượt 4 bước. Mỗi lúc chỉ có một việc cần bạn làm, Studio sẽ nói rõ ở thanh “Tiếp theo”.</p>
      <ol>{STEPS.map((step, index) => (
        <li key={step.title} data-current={index === 0}><span aria-hidden="true">{index + 1}</span>
          <div><strong>{step.title}</strong><small>{step.text}</small></div></li>))}</ol>
      <button className="primary-btn" onClick={onImport}><FileArchive size={14} aria-hidden="true" /> Nhập nội dung đã duyệt (ZIP)</button>
    </section>
  );
}
