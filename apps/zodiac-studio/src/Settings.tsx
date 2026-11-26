import { useEffect, useRef, useState } from "react";
import { backend, type AudioAsset, type StudioPreferences, type StudioSettings } from "./backend";
import "./settings.css";

const ROLES: Record<string, string> = { creative: "Soạn hình / sửa theo yêu cầu", repair: "Sửa lỗi tự động", review: "Đánh giá nội dung", vision: "Xem khung hình" };
export default function Settings() {
  const [snapshot, setSnapshot] = useState<StudioSettings | null>(null), [values, setValues] = useState<StudioPreferences | null>(null);
  const [items, setItems] = useState<AudioAsset[]>([]), [tab, setTab] = useState("audio"), [playing, setPlaying] = useState<AudioAsset | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const player = useRef<HTMLAudioElement>(null);
  async function load() {
    setBusy(true); setError("");
    try { const [next, catalog] = await Promise.all([backend.settings(), backend.audioCatalog()]); setSnapshot(next); setValues(structuredClone(next.values)); setItems(catalog.items); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { const sound = player.current; return () => sound?.pause(); }, [playing]);
  if (!values || !snapshot) return <section className="studio-settings"><h1>Cài đặt chung</h1>{error ? <p role="alert">{error}<button onClick={() => void load()}>Thử lại</button></p> : <p>Đang đọc cấu hình…</p>}</section>;
  const update = (work: (draft: StudioPreferences) => void) => setValues(previous => { const next = structuredClone(previous!); work(next); return next; });
  const audioField = (kind: "music" | "sfx", title: string) => {
    const choices = items.filter(item => item.kind === kind), selected = choices.find(item => item.id === values.audio[`${kind}_id`]);
    return <fieldset><legend>{title}</legend>
      <label className="settings-check"><input type="checkbox" checked={values.audio[`${kind}_enabled`]} onChange={e => update(v => { v.audio[`${kind}_enabled`] = e.target.checked; })}/>Bật {title.toLocaleLowerCase("vi")}</label>
      <label>Bản âm thanh<select aria-label={title} value={values.audio[`${kind}_id`]} onChange={e => update(v => { v.audio[`${kind}_id`] = e.target.value; })}>
        <option value="">Tự chọn từ kho</option>{choices.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Âm lượng · {Math.round(values.audio[`${kind}_volume`] * 100)}%<input aria-label={`Âm lượng ${title.toLocaleLowerCase("vi")}`} type="range" min={0} max={1} step={.01} value={values.audio[`${kind}_volume`]} onChange={e => update(v => { v.audio[`${kind}_volume`] = Number(e.target.value); })}/></label>
      <button className="outline-btn" disabled={!choices.length} onClick={() => { const item = selected ?? choices.find(x => x.title.includes(kind === "music" ? "comical 2" : "sfx 869")) ?? choices[0]; player.current?.pause(); setPlaying(item); }}>Nghe thử {title.toLocaleLowerCase("vi")}</button>
      <small>{choices.length} tệp trong kho{kind === "sfx" ? " · tối đa 0,55 giây tại mỗi chuyển cảnh" : " · lặp theo độ dài video, có fade đầu/cuối"}</small>
    </fieldset>;
  };
  return <section className="studio-settings">
    <header><div><h1>Cài đặt chung</h1><p>Cấu hình mới áp dụng cho lần chạy tiếp theo. Giọng và nguồn đã duyệt được giữ nguyên.</p></div>
      <button className="primary-btn" disabled={busy} onClick={async () => {
        setBusy(true); setError(""); setMessage(""); setPlaying(null);
        try { const next = await backend.saveSettings(snapshot.revision, values); setSnapshot(next); setValues(structuredClone(next.values)); setItems((await backend.audioCatalog()).items); setMessage("Đã lưu. Đổi nhạc/SFX cần xuất MP4 mới; không cần tạo lại giọng."); }
        catch (reason) { setError(String(reason)); } finally { setBusy(false); }
      }}>Lưu cài đặt</button><button className="outline-btn" disabled={busy} onClick={() => { setPlaying(null); setMessage(""); void load(); }}>Tải lại</button></header>
    <nav className="workspace-tabs" aria-label="Nhóm cài đặt">{[["audio", "Âm thanh"], ["agents", "Agent"], ["defaults", "Giọng & giao diện"], ["system", "Hệ thống & thư viện"]].map(([id, title]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setPlaying(null); }}>{title}</button>)}</nav>
    {(error || message) && <p role={error ? "alert" : "status"} className={error ? "pipe-error" : "voice-muted"}>{error || message}</p>}
    <div className="settings-body">
      {tab === "audio" && <><div className="settings-grid">{audioField("music", "Nhạc nền")}{audioField("sfx", "SFX")}</div>
        <label className="settings-check"><input type="checkbox" checked={values.audio.ducking} onChange={e => update(v => { v.audio.ducking = e.target.checked; })}/>Hạ nhạc khi có giọng đọc</label>
        <p>Giọng đọc luôn giữ mức gốc. Preview và MP4 dùng cùng bản mix. SFX hiện được gắn ở chuyển cảnh.</p>
        {playing && <div className="settings-audition"><strong>{playing.title}</strong><audio key={playing.url} ref={player} src={playing.url} controls autoPlay onLoadedMetadata={e => { e.currentTarget.volume = values.audio[`${playing.kind}_volume`]; }} onError={() => setError("Không phát được tệp âm thanh này.")}/></div>}</>}
      {tab === "agents" && <div className="settings-grid">{Object.entries(values.agents).map(([role, value]) => <fieldset key={role}><legend>{ROLES[role] ?? role}</legend>
        <label>Model<input aria-label={`Model ${role}`} value={snapshot.overrides[role]?.model ? snapshot.effective_agents[role].model : value.model} disabled={snapshot.overrides[role]?.model} onChange={e => update(v => { v.agents[role].model = e.target.value; })}/></label>
        <label>Độ suy luận<select aria-label={`Độ suy luận ${role}`} value={snapshot.overrides[role]?.effort ? snapshot.effective_agents[role].effort : value.effort} disabled={snapshot.overrides[role]?.effort} onChange={e => update(v => { v.agents[role].effort = e.target.value; })}>{["minimal", "low", "medium", "high", "xhigh"].map(e => <option key={e}>{e}</option>)}</select></label>
        {(snapshot.overrides[role]?.model || snapshot.overrides[role]?.effort) && <small>Biến môi trường đang ghi đè cấu hình của vai trò này.</small>}</fieldset>)}</div>}
      {tab === "defaults" && <div className="settings-grid"><fieldset><legend>Giọng mặc định cho episode mới</legend><select aria-label="Giọng mặc định" value={values.voice.default} onChange={e => update(v => { v.voice.default = e.target.value; })}><option value="">Theo danh sách giọng hiện có</option>{snapshot.voices.map(v => <option key={v}>{v}</option>)}</select><p>Đổi tại đây không thay take đang dùng trong các episode đã tạo.</p></fieldset>
        <fieldset><legend>Màu sắc mặc định cho episode mới</legend><select aria-label="Màu sắc mặc định" value={values.appearance.theme} onChange={e => update(v => { v.appearance.theme = e.target.value; })}>{snapshot.themes.map(t => <option key={t}>{t}</option>)}</select></fieldset></div>}
      {tab === "system" && <><div className="settings-grid">{([['music_dir', 'Thư mục nhạc nền'], ['sfx_dir', 'Thư mục SFX']] as const).map(([key, title]) => <label key={key}>{title}<input aria-label={title} value={values.libraries[key]} onChange={e => update(v => { v.libraries[key] = e.target.value; })}/></label>)}</div>
        <p>Lưu rồi tải lại danh sách để dùng thư mục mới. Chế độ Tự động/Từng bước được giữ theo từng episode.</p><dl>{Object.entries(snapshot.system).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p>Thông số renderer cố định theo hợp đồng xuất hiện tại; không chỉnh qua file JSON. Thông tin đăng nhập do Codex và bộ tạo giọng quản lý.</p></>}
    </div>
  </section>;
}
