import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Copy, Lightbulb, RefreshCcw } from "lucide-react";
import { backend } from "./backend";
import { buildIdeaPrompt, statusFor, type IdeaBoard, type IdeaConcept } from "./idea-board";
import { Paged, PagedText } from "./Paged";

export default function Ideas({ onReview, mode = "ideas" }: { onReview: (conceptId: string) => void; mode?: "ideas" | "progress" }) {
  const [board, setBoard] = useState<IdeaBoard | null>(null);
  const [groupId, setGroupId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const promptArea = useRef<HTMLDivElement>(null);
  async function load() {
    try { setBoard(await backend.ideas()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Không đọc được thư viện concept."); }
  }
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const all = board?.groups.flatMap(g => g.concepts) ?? [];
  const selected = all.find(c => c.id === selectedId);
  const concepts = all.filter(c => (!groupId || board?.groups.find(g => g.id === groupId)?.concepts.some(x => x.id === c.id)) &&
    (c.title + " " + c.direction).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const count = (concept: IdeaConcept) => board?.signs.filter(sign => statusFor(board, concept.id, sign) === "mp4_approved").length ?? 0;
  const prompt = board && selected ? buildIdeaPrompt(board, selected) : null;
  async function copy(concept: IdeaConcept) {
    if (!board) return;
    setSelectedId(concept.id); setFeedback(""); setError(""); setShowPrompt(false);
    const text = buildIdeaPrompt(board, concept);
    if (!text) { setFeedback("Concept đã đủ 12 MP4 duyệt. Chọn concept khác để làm tập mới."); return; }
    setBusy(true);
    try { await navigator.clipboard.writeText(text); setFeedback("Đã copy. Trong ChatGPT, chọn @Zodiac-Video-Web rồi dán và gửi. Copy văn bản không tự gắn plugin."); }
    catch { setShowPrompt(true); setError("Không copy được clipboard. Bấm chọn toàn bộ rồi Ctrl+C để copy thủ công."); }
    finally { setBusy(false); }
  }
  return <section className="ideas-workspace" aria-label="Ý tưởng và tiến độ">
    <header className="ideas-heading"><h1><Lightbulb size={23}/> {mode === "progress" ? "Tiến độ 12 cung" : "Thư viện ý tưởng"}</h1>
      <span className="panel-meta">{board ? `${all.length} concept` : "Đang đọc…"}</span>
      <button className="subtle-btn" disabled={busy} onClick={() => void load()} aria-label="Đọc lại tiến độ"><RefreshCcw size={15}/> Làm mới</button></header>
    {error && <div role="alert" className="inline-alert error">{error}</div>}
    <div className="ideas-feedback" role="status">{mode === "progress" ? "Chọn concept để xem tình trạng 12 cung. Chỉ MP4 được người dùng duyệt mới được đánh dấu hoàn thành." : feedback || "Chọn concept để copy prompt. Trong ChatGPT, chọn @Zodiac-Video-Web trước khi gửi. Duyệt MP4 ở tab riêng."}</div>
    <section className="panel ideas-catalog" hidden={!!selected} aria-label="Danh sách concept">
      <div className="ideas-toolbar"><label>Nhóm <select aria-label="Nhóm ý tưởng" value={groupId} onChange={e => setGroupId(e.target.value)}>
        <option value="">Tất cả nhóm</option>{board?.groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
        <input aria-label="Tìm concept" value={query} maxLength={120} onChange={e => setQuery(e.target.value)} placeholder="Tìm concept…"/></div>
      <Paged key={groupId + query} size={4} label="Concept">{concepts.map(concept =>
        <button className="idea-card" key={concept.id} disabled={busy} onClick={() => mode === "progress" ? (setSelectedId(concept.id), setShowPrompt(false)) : void copy(concept)}>
          <span className="idea-card-title"><strong>{concept.title}</strong><span>{count(concept)}/12 MP4 duyệt</span></span>
          <span className="idea-direction">{concept.direction}</span><span className="idea-card-action">{mode === "progress" ? <><CheckCircle2 size={12}/> Xem tiến độ 12 cung</> : <><Copy size={12}/> Chọn & copy prompt</>}</span>
        </button>)}</Paged>
      {board && !concepts.length && <p className="panel-meta">Không có concept phù hợp.</p>}
    </section>
    {board && selected && <section className="panel ideas-detail" aria-label="Chi tiết concept">
      <div className="ideas-toolbar"><button className="subtle-btn" disabled={busy} onClick={() => { setSelectedId(""); setFeedback(""); setError(""); }}><ArrowLeft size={14}/> Danh sách concept</button>
        <span className="panel-meta">{count(selected)}/12 MP4 đã duyệt</span></div>
      <div className="idea-detail-heading"><h2>{selected.title}</h2><p>{selected.direction}</p></div>
      <div className="ideas-actions">{mode === "ideas" && <button className="primary-btn" disabled={busy || !prompt} onClick={() => void copy(selected)}><Copy size={15}/> Copy prompt</button>}
        <button className="subtle-btn" onClick={() => onReview(selected.id)}>Xem & duyệt MP4</button>
        {mode === "ideas" && <button className="text-link" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? "Xem tiến độ 12 cung" : "Xem nội dung prompt"}</button>}</div>
      {mode === "ideas" && showPrompt ? <div className="idea-prompt" ref={promptArea} tabIndex={0} onCopy={e => {
        if (prompt) { e.clipboardData.setData("text/plain", prompt); e.preventDefault(); }
      }}><PagedText key={selected.id} text={prompt ?? "Đã đủ 12 MP4 được duyệt. Không tạo prompt lặp."} label="Prompt cho agent"/>
        {prompt && <button className="subtle-btn" onClick={() => { if (promptArea.current) { promptArea.current.focus(); window.getSelection()?.selectAllChildren(promptArea.current); } }}>Chọn toàn bộ prompt để Ctrl+C</button>}</div>
        : <div className="idea-signs" aria-label="Tiến độ 12 cung">{board.signs.map(sign => {
          const status = statusFor(board, selected.id, sign);
          return <div key={sign} className={"idea-sign " + status}>{status === "mp4_approved" ? <CheckCircle2 size={18}/> : <Circle size={18}/>}<div><strong>{sign}</strong><small>{status === "mp4_approved" ? "MP4 đã duyệt" : status === "in_progress" ? "Đang làm" : "Chưa duyệt MP4"}</small></div></div>;
        })}</div>}
    </section>}
  </section>;
}
