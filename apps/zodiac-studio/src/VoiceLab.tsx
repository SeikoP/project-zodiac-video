import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Headphones, LoaderCircle, Lock, Mic2, RefreshCcw, Waves } from "lucide-react";
import { backend, type Project, type SpeechUnit, type VoiceScene, type VoiceState, type VoiceTake } from "./backend";
import { approvalNoteText } from "./voice-approval";

import { Paged } from "./Paged";
import "./voice-layout.css";

/** The backend reports job progress in English; show plain Vietnamese and keep the raw status code for scripts. */
const JOB_MESSAGES: [RegExp, string][] = [
  [/^Preparing audio.*/, "Đang chuẩn bị audio…"],
  [/^Reusing (\d+) existing takes/, "Dùng lại $1 đoạn giọng đã có."],
  [/^Generating audio /, "Đang tạo giọng đọc: "],
  [/^Audio ready.*/, "Audio đã sẵn sàng. Hãy nghe trước khi duyệt."],
  [/^Audio needs review.*/, "Có đoạn cần xem lại. Các take đã tạo vẫn được giữ."],
  [/^Measuring word timing.*/, "Đang đo thời gian từng từ bằng ASR (khoảng 40 giây cho tập ngắn)…"],
  [/^Measured word timing ready.*/, "Đã đo xong thời gian từng từ."],
  [/^Measured alignment: /, "Đang đo timing: "],
];
const jobMessage = (message: string) => { const hit = JOB_MESSAGES.find(([pattern]) => pattern.test(message)); return hit ? message.replace(hit[0], hit[1]) : message; };

/** Optional listening aid: approval is the single "Duyệt giọng" button, so playing here proves nothing and is never required. */
function WavePlayer({ projectId, unitId, take, onError }: {
  projectId: string; unitId: string; take: VoiceTake; onError: (error: unknown) => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true, localUrl = "";
    void backend.voiceAudio(projectId, unitId, take.take_id).then(blob => {
      localUrl = URL.createObjectURL(blob);
      if (live) setUrl(localUrl); else URL.revokeObjectURL(localUrl);
    }).catch(error => { if (live) onError(error); });
    return () => { live = false; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [projectId, unitId, take.take_id, onError]);
  return <div className="voice-player">
    <svg className="voice-waveform" viewBox="0 0 512 72" role="img" aria-label="Biên độ đo từ audio thực tế">
      <line x1="0" x2="512" y1="36" y2="36" stroke="currentColor" opacity=".15"/>
      {take.peaks.map((height, i) => <line key={i} x1={i * 512 / take.peaks.length} x2={i * 512 / take.peaks.length}
        y1={36 - height * 34} y2={36 + height * 34} stroke="currentColor" strokeWidth="2"/>)}</svg>
    <div className="voice-player-caption"><span>{take.duration_seconds.toFixed(2)} giây · WAV thật</span>
      <span>Nghe thử, không bắt buộc</span></div>
    {url ? <audio controls src={url} preload="metadata"/>
      : <p className="voice-muted"><LoaderCircle size={15} className="spin"/> Đang nạp audio…</p>}
    {take.warnings.length > 0 && <p className="voice-warning">Cần nghe kiểm tra: {take.warnings.join(" · ")}</p>}
  </div>;
}

function SentenceRow({ unit, disabled, onRetake, onSelect }: {
  unit: SpeechUnit; disabled: boolean; onRetake: () => void; onSelect: (takeId: string, gapMs: number) => void;
}) {
  const [gap, setGap] = useState(unit.gap_after_ms);
  useEffect(() => setGap(unit.gap_after_ms), [unit.id, unit.gap_after_ms]);
  const selected = unit.takes.find(take => take.take_id === unit.selected_take);
  return <div className="voice-sentence">
    <p title={unit.text}>{unit.text.trim()}</p>
    {selected ? <div className="voice-pause">
      <label>Take<select value={selected.take_id} disabled={disabled} onChange={event => onSelect(event.target.value, unit.gap_after_ms)}>
        {unit.takes.map((take, i) => <option value={take.take_id} key={take.take_id} disabled={take.valid === false}>Take {i+1} · {take.valid === false ? "cần tạo lại" : take.duration_seconds.toFixed(2)+"s"}</option>)}</select></label>
      <label>Nghỉ sau (ms)<input type="number" min={0} max={1000} step={50} value={gap} disabled={disabled} onChange={event => setGap(Number(event.target.value))}/></label>
      <button className="outline-btn" disabled={disabled || gap === unit.gap_after_ms} onClick={() => onSelect(selected.take_id, gap)}>Lưu nghỉ</button>
      <button className="subtle-btn" disabled={disabled} onClick={onRetake}><RefreshCcw size={14}/> Tạo take khác</button>
    </div> : <small className="voice-muted">Chưa có audio.</small>}
  </div>;
}

export default function VoiceLab({ project, onChanged, active = true, embedded = false, selectedUnitId }: {
  project: Project | null; onChanged: () => void; active?: boolean; embedded?: boolean; selectedUnitId?: string;
}) {
  const [tab, setTab] = useState("takes");
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => { workspace.current?.querySelectorAll("audio").forEach(audio => audio.pause()); }, [tab]);
  useEffect(() => { if (!active) workspace.current?.querySelectorAll("audio").forEach(audio => audio.pause()); }, [active]);
  const [state, setState] = useState<VoiceState | null>(null);
  const [activeId, setActiveId] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [intent, setIntent] = useState("NORMAL");
  const [pronunciation, setPronunciation] = useState("{}");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  const projectId = project?.project_id;
  useEffect(() => {
    initialized.current = false;
    setState(null);
    setActiveId(selectedUnitId ?? "");
  }, [projectId]);
  useEffect(() => {
    if (selectedUnitId) { setActiveId(selectedUnitId); setTab("takes"); }
  }, [selectedUnitId]);
  useEffect(() => {
    if (!embedded) workspace.current?.querySelector('.voice-unit[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeId, state?.units.length, embedded]);
  const report = useCallback((value: unknown) => setError(value instanceof Error ? value.message : String(value)), []);
  const changed = (value: VoiceState) => { setState(value); onChanged(); };
  useEffect(() => {
    if (!projectId || !active) return;
    let live = true, pending = false;
    const refresh = async () => {
      if (pending || !live) return;
      pending = true;
      try {
        const value = await backend.voiceOpen(projectId);
        if (live) {
          setState(value);
          setSpeaker(previous => value.voices.includes(previous) ? previous :
            value.voices.includes(value.voice) ? value.voice : value.voices[0]);
          if (!initialized.current) { setActiveId(previous => previous || value.units[0]?.id || ""); initialized.current = true; }
        }
      } catch (problem) { if (live) report(problem); }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [projectId, active, report]);
  const unit = state?.units.find(item => item.id === activeId) ?? state?.units[0];
  const running = state?.job?.status === "RUNNING";
  const count = state?.units.filter(item => item.selected_take).length ?? 0;
  const approved = state?.status === "USER_LISTENED_APPROVED";
  const total = state?.units.length ?? 0;
  // 1 tạo audio, 2 ghép, 3 đo timing, 4 nghe & duyệt (bước của người). Máy làm 1-3 bằng một nút duy nhất.
  const step = !state ? 1 : count < total ? 1 : !state.assembly ? 2 : !state.timing ? 3 : 4;
  // An older backend sends no scenes: fall back to one group per sentence so the list still works.
  const scenes: VoiceScene[] = state?.scenes ?? state?.units.map(item => ({ id: item.id, title: item.text, unit_ids: [item.id], take: null })) ?? [];
  const scene = scenes.find(item => unit && item.unit_ids.includes(unit.id)) ?? scenes[0];
  const sceneUnits = scene ? state?.units.filter(item => scene.unit_ids.includes(item.id)) ?? [] : [];
  async function action(run: () => Promise<VoiceState>) {
    setBusy(true); setError("");
    try { changed(await run()); }
    catch (problem) { report(problem); }
    finally { setBusy(false); }
  }
  function generate(ids: string[], kind: "generate" | "align" = "generate") {
    if (!projectId || !state) return;
    void action(() => backend.voiceStart(projectId, state.revision, kind, ids, speaker, intent,
      JSON.parse(pronunciation) as Record<string, string>));
  }
  function runNext() {
    if (!projectId || !state) return;
    if (step === 2) void action(() => backend.voiceAssemble(projectId, state.revision));
    else if (step === 3) generate([], "align");
    else generate([]);
  }
  // "Chuẩn bị giọng": one click chains generate → assemble → align. Each stage is tried once; a failed job or a stage that did not advance stops it.
  const [preparing, setPreparing] = useState(false);
  const tried = useRef<number[]>([]);
  const baseJob = useRef<string | undefined>(undefined);
  function prepare() {
    tried.current = []; baseJob.current = state?.job?.id; setError(""); setPreparing(true);
  }
  useEffect(() => {
    if (!preparing || !state || running || busy) return;
    if (step === 4 || (state.job?.error && state.job.id !== baseJob.current) || tried.current.includes(step)) { setPreparing(false); return; }
    tried.current.push(step);
    runNext();
  }, [preparing, state, running, busy, step]);
  const approve = () => projectId && state && void action(() => backend.voiceConfirm(projectId, state.revision, "episode", "", ""));
  if (!project) return <section className="panel voice-empty"><Headphones size={30}/><h2>Chọn episode để mở Voice Lab</h2>
    <p>Nhập gói Phase 1 đã duyệt ở Tổng quan. Bản kể được giữ nguyên trong suốt quá trình tạo giọng.</p></section>;
  return <div ref={workspace} className={"voice-workspace voice-tab-" + tab + (embedded ? " voice-embedded" : "")}>
    <section className={embedded ? "voice-controls" : "page-header"}>{!embedded && <div><p className="eyebrow">VOICE FIRST / PHASE 2</p>
      <h1>Voice Lab<span className="star">✦</span></h1><p className="page-subtitle">Nghe giọng thật trước khi dựng hình. {project.display_title}</p></div>}
      <div className="voice-header-actions">      <div className="voice-primary-actions">
        {step < 4 && <button className="primary-btn" disabled={!state || running || busy || preparing} onClick={prepare}><Mic2 size={15}/> {preparing ? "Đang chuẩn bị giọng…" : "Chuẩn bị giọng"}</button>}
        {step === 4 && !approved && <button className="primary-btn" disabled={busy} onClick={approve}><CheckCircle2 size={15}/> Duyệt giọng</button>}
        {running && <button className="outline-btn" onClick={() => { setPreparing(false); if (projectId) void action(() => backend.voiceCancel(projectId)); }}>Dừng tạo audio</button>}</div>
      <span className={"source-pill " + (approved ? "" : "offline")}><Headphones size={15}/>
        {approved ? "Đã duyệt giọng" : "Chưa duyệt giọng"}</span></div></section>
    {state && <ol className="voice-steps" aria-label="Các bước làm giọng">{["Tạo audio", "Ghép audio", "Đo timing", "Duyệt giọng"].map((label, index) => (
      <li key={label} data-state={approved || index + 1 < step ? "done" : index + 1 === step ? "current" : "todo"}><span>{index + 1}</span>{label}</li>))}</ol>}
    {state && step === 4 && !approved && approvalNoteText(state) && <p className="voice-warning" role="status">{approvalNoteText(state)}</p>}
    {state && step === 4 && !approved && <p className="voice-next-hint" role="status">Máy đã làm xong. Bấm “Duyệt giọng” để tiếp tục. Muốn nghe thử thì dùng tab “Nghe toàn bài &amp; timing”; không nghe cũng được.</p>}
    {error && <div className="inline-alert error" role="alert">{error}<button aria-label="Đóng thông báo" onClick={() => setError("")}>×</button></div>}

    <div className="workspace-tabs">{[["takes", "Theo cảnh"], ["episode", "Nghe toàn bài & timing"], ["settings", "Thiết lập giọng"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <section className="panel voice-settings">
      <label>Giọng VieNeu<select value={speaker} disabled={!state || running || busy} onChange={event => setSpeaker(event.target.value)}>
        {state?.voices.map(voice => <option key={voice} value={voice}>{voice}</option>)}
      </select></label>
      <label>Chỉ dẫn đọc<select value={intent} disabled={running || busy} onChange={event => setIntent(event.target.value)}>
        <option value="NORMAL">Bình thường</option><option value="SHARP">Sắc / nhấn rõ</option></select></label>

      <small>Chỉ dẫn đọc là ý định, chưa phải kết quả đã nghe. Backend hiện thực thi text và giọng; kiểm tra âm thanh để đánh giá nhịp.</small>
      <details><summary>Cách đọc từ đặc biệt</summary><label>Ánh xạ từ → cách đọc (JSON, áp dụng khi tạo take mới)
        <textarea value={pronunciation} onChange={event => setPronunciation(event.target.value)} spellCheck={false}/></label>
        <small>Chỉ thay đầu vào TTS; chữ đã duyệt và caption gốc không đổi.</small></details>
    </section>
    {state?.job && <section className={"voice-job " + (state.job.error ? "voice-warning" : "")} role="status" data-job-id={state.job.id} data-job-action={state.job.action}>
      {running && <LoaderCircle size={16} className="spin"/>}<span>{jobMessage(state.job.message)}</span>
      <strong>{state.job.status} · {state.job.completed}/{state.job.total}</strong>
      {state.job.error && <p>{state.job.error}</p>}</section>}
    {!state ? <p className="voice-muted"><LoaderCircle size={17} className="spin"/> Đang đọc bản kể đã duyệt…</p> : <>
      {embedded && !selectedUnitId && <label className="voice-unit-picker">Đoạn đọc<select aria-label="Đoạn đọc" value={unit?.id ?? ""} onChange={event => { setActiveId(event.target.value); setTab("takes"); }}>
        {state.units.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.text}</option>)}
      </select></label>}
      <div className="voice-layout"><section className="panel voice-units">
        <div className="panel-heading"><span className="panel-title"><Lock size={15}/> Bản kể đã khóa</span><span className="panel-meta">{scenes.length} cảnh · {count}/{state.units.length} câu có audio</span></div>
        <div className="voice-unit-list" role="region" aria-label="Danh sách cảnh">{scenes.map((item, index) => <button key={item.id} className={"voice-unit " + (scene?.id === item.id ? "active" : "")}
          onClick={() => setActiveId(item.unit_ids[0])} aria-pressed={scene?.id === item.id}>
          <span className="voice-unit-number">{String(index+1).padStart(2, "0")}</span><span className="voice-unit-text" title={item.title}>{item.title}</span>
          <span className="voice-unit-state">{item.take ? "Có audio" : "Chưa đủ audio"} ·{item.unit_ids.length} câu</span>
        </button>)}</div>
      </section><section className="panel voice-takes">
        <div className="panel-heading"><span className="panel-title"><Waves size={16}/> {scene?.title ?? "Cảnh"}</span></div>
        <div className="voice-take-body">{scene && <>
          {scene.take ? <WavePlayer key={scene.id + scene.take.take_id} projectId={project.project_id} unitId={"scene:" + scene.id} take={scene.take} onError={report}/>
            : <div className="voice-empty"><Mic2 size={30}/><p>Cảnh này còn câu chưa có audio. Bấm “Chuẩn bị giọng” ở trên.</p></div>}
          <details className="voice-sentences"><summary>Chi tiết từng câu ({sceneUnits.length}) · đổi take, tạo lại, chỉnh khoảng nghỉ</summary>
            {sceneUnits.map(item => <SentenceRow key={item.id} unit={item} disabled={running || busy}
              onRetake={() => generate([item.id])}
              onSelect={(takeId, gapMs) => void action(() => backend.voiceSelect(project.project_id, state.revision, item.id, takeId, gapMs))}/>)}
          </details>
        </>}</div>
      </section></div>
      <section className="panel voice-episode"><div className="panel-heading"><span className="panel-title"><Headphones size={16}/> Nghe toàn bài & kiểm tra nối đoạn</span>
        </div>
        <div className="voice-take-body">{state.assembly ? active && tab === "episode" && <WavePlayer key={state.assembly.take_id} projectId={project.project_id}
          unitId="episode" take={state.assembly} onError={report}/>
          : <p className="voice-muted">Bấm “Chuẩn bị giọng” để tạo và ghép audio.</p>}
          <p className="voice-muted">Nghe thử là tuỳ bạn; duyệt bằng nút “Duyệt giọng” ở trên. Đổi take hoặc khoảng nghỉ sau đó sẽ cần duyệt lại một lần. ASR là bằng chứng timing, không phải duyệt giọng.</p>
          {state.timing && <details className="voice-timing"><summary>{state.timing.words.length} từ có thời gian đo thực tế · {state.timing.duration_seconds.toFixed(2)} giây</summary>
            <Paged size={3} label="Timing">{state.timing.words.map(word => <div className="timing-word" key={word.anchor_id}>{word.text} · {(word.startMs/1000).toFixed(2)}s → {(word.endMs/1000).toFixed(2)}s</div>)}</Paged></details>}
        </div></section>
    </>}
  </div>;
}
