import { useEffect, useRef, useState } from "react";
import { backend, type VideoExport } from "./backend";
import { statusFor, type IdeaBoard } from "./idea-board";

export default function VideoReview({ initialConceptId, output = null, active = true, lockedSign = null, onReveal }: { initialConceptId: string; output?: VideoExport | null; active?: boolean; lockedSign?: string | null; onReveal?: () => void }) {
  const [board, setBoard] = useState<IdeaBoard | null>(null);
  const [conceptId, setConceptId] = useState(initialConceptId);
  const [sign, setSign] = useState(lockedSign ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const changes = useRef(0);
  const player = useRef<HTMLVideoElement>(null);
  const playerSource = url || output?.url || "";
  useEffect(() => { if (!active) player.current?.pause(); }, [active]);
  useEffect(() => { setConceptId(initialConceptId); }, [initialConceptId]);
  useEffect(() => { if (lockedSign) setSign(lockedSign); }, [lockedSign]);
  useEffect(() => { setReady(false); }, [playerSource]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const version = changes.current;
      try { const next = await backend.ideas(); if (active && version === changes.current) setBoard(next); }
      catch (e) { if (active) setError(String(e)); }
    };
    void refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const concept = board?.groups.flatMap(g => g.concepts).find(c => c.id === conceptId);
  // An episode already knows its concept and sign: the export step shows them instead of asking again.
  const locked = !!(concept && lockedSign);
  const approved = !!(board && concept && sign && statusFor(board, concept.id, sign) === "mp4_approved");
  async function approve(checked: boolean) {
    if (!ready || !concept || !sign || (!file && output?.stale)) return;
    changes.current++;
    setSaving(true); setError(""); setMessage("Đang lưu kết quả duyệt…");
    try {
      const row = await backend.ideaUpdate(concept.id, sign, checked ? "mp4_approved" : "not_started");
      setBoard(previous => previous && ({ ...previous, progress: [
        ...previous.progress.filter(p => !(p.concept_id === row.concept_id && p.sign === row.sign)),
        ...(checked ? [row] : []),
      ] }));
      setMessage(checked ? `Đã duyệt MP4 cho ${sign}. Tiến độ concept đã được cập nhật.` : `Đã bỏ dấu duyệt của ${sign}.`);
    } catch (e) { setMessage(""); setError(e instanceof Error ? e.message : "Không lưu được kết quả duyệt."); }
    finally { changes.current++; setSaving(false); }
  }
  return <section className="video-review" aria-label="Xem và duyệt MP4">
    <header className="ideas-heading"><h1>Xem & duyệt MP4</h1>{output?.file_path && onReveal && <button className="primary-btn" onClick={onReveal}>Mở thư mục MP4</button>}<label className={(output?.file_path && onReveal ? "outline-btn" : "primary-btn") + " review-file"}>{output?.file_path && onReveal ? "Chọn MP4 khác…" : "Mở MP4"}
      <input aria-label="Mở MP4" type="file" accept=".mp4,video/mp4" disabled={saving} onChange={e => {
        const next = e.target.files?.[0]; if (!next) return;
        setReady(false); setMessage("");
        if (!/\.mp4$/i.test(next.name)) { setError("Hãy chọn file MP4."); setFile(null); setUrl(""); return; }
        setError(""); setFile(next);
      }}/></label></header>
    {file && output && <button className="outline-btn" onClick={() => { setFile(null); setUrl(""); setError(""); setMessage(""); }}>Dùng MP4 của episode</button>}
    {error && <div role="alert" className="inline-alert error">{error}</div>}
    {locked ? <div className="review-assignment locked"><span>Concept: <strong>{concept!.title}</strong></span><span>Cung: <strong>{sign}</strong></span></div>
    : <div className="review-assignment">
      <label>Concept<select aria-label="Concept của MP4" value={concept?.id ?? ""} disabled={saving || !board} onChange={e => { setConceptId(e.target.value); setMessage(""); }}>
        <option value="">Chọn concept của video…</option>{board?.groups.map(g => <optgroup key={g.id} label={g.title}>{g.concepts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}</select></label>
      <label>Cung<select aria-label="Cung của MP4" value={sign} disabled={saving || !board} onChange={e => { setSign(e.target.value); setMessage(""); }}>
        <option value="">Chọn cung…</option>{board?.signs.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
    </div>}
    <div className="review-stage">{playerSource ? <video ref={player} key={playerSource} aria-label="MP4 cuối" src={playerSource} controls playsInline preload="metadata"
      onLoadedMetadata={e => {
        const video = e.currentTarget;
        const valid = Number.isFinite(video.duration) && video.duration > 0 && video.videoWidth > 0 && video.videoHeight > 0;
        setReady(valid);
        if (!valid) setError("MP4 không chứa hình ảnh hoặc thời lượng video hợp lệ.");
      }} onError={() => { setReady(false); setError("Không phát được MP4 này. Hãy chọn file video hợp lệ."); }}/>
      : <p>Mở file MP4 cuối để xem và duyệt.</p>}</div>
    <label className="review-approval"><input type="checkbox" aria-label="MP4 đã được tôi xem và duyệt" checked={approved}
      disabled={!ready || !concept || !sign || saving || (!file && !!output?.stale)} onChange={e => void approve(e.target.checked)}/>
      <span>Cung này đã có MP4 được tôi xem và duyệt{sign ? `: ${sign}` : ""}.</span></label>
    <div className="review-message" role="status">{message || (file ? file.name : output ? "MP4 của episode đang chọn. Duyệt đúng concept và cung của episode này." : "Chọn đúng concept và cung trước khi đánh dấu duyệt.")}</div>
  </section>;
}
