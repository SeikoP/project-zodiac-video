import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Activity, ArrowRight, Bot, Check, CheckCircle2, CircleAlert, CircleDot,
  Clapperboard, Clock3, Compass, FileArchive, FileClock, Folder, FolderOpen,
  Headphones, Home, Image, Layers3, LoaderCircle, Lock, Mic2, Plus, RefreshCcw,
  Search, Send, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { backend, type AssetCatalog, type BackendHealth, type Project, type StudioEvent } from "./backend";

type View = "overview" | "assets" | "activity" | "agent";
type Alert = { message: string; error: boolean } | null;
const FIELDS = [
  { key: "content", label: "Nội dung" }, { key: "voice", label: "Giọng đọc" },
  { key: "visual", label: "Hình ảnh" }, { key: "video", label: "Video" },
  { key: "published", label: "Đăng tải" },
] as const;
const SECTIONS: { label: string; view: View; icon: LucideIcon }[] = [
  { label: "Tổng quan", view: "overview", icon: Home },
  { label: "Kho tài nguyên", view: "assets", icon: Layers3 },
  { label: "Nhật ký hoạt động", view: "activity", icon: Activity },
  { label: "Agent", view: "agent", icon: Bot },
];
function readableStatus(status: string) {
  if (status === "APPROVED" || status === "REVIEWED") return "Đã duyệt";
  if (status === "USER_LISTENED_APPROVED") return "Đã nghe & duyệt";
  if (status === "TECHNICAL_VALID") return "Hợp lệ kỹ thuật";
  if (status === "COMPAT_MIGRATED") return "Bản tương thích";
  if (status === "BLOCKED") return "Bị chặn";
  if (status === "EXPORTED") return "Đã xuất";
  if (status === "CONFIRMED") return "Đã xác nhận";
  return "Chưa có bằng chứng";
}
function StatusChip({ status }: { status: string }) {
  const color = /^(APPROVED|REVIEWED|EXPORTED|CONFIRMED|USER_LISTENED_APPROVED)$/.test(status)
    ? "success" : status === "BLOCKED" ? "danger" :
    status === "TECHNICAL_VALID" ? "accent" : "neutral";
  return <span className={"status-chip status-" + color}><span className="status-dot"/>
    {readableStatus(status)}</span>;
}
function PanelHeading({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return <div className="panel-heading">
    <span className="panel-title"><Icon size={16} strokeWidth={1.9}/>{title}</span>{action}
  </div>;
}
function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="empty-state">
    <span className="empty-icon"><Icon size={27} strokeWidth={1.5}/></span>
    <strong>{title}</strong><p>{detail}</p>
  </div>;
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [catalog, setCatalog] = useState<AssetCatalog | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [note, setNote] = useState("");
  const [alert, setAlert] = useState<Alert>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeProjectRef = useRef<string | null>(null);
  const chooseProject = useCallback((id: string | null) => {
    if (activeProjectRef.current !== id) {
      activeProjectRef.current = id;
      setSelectedId(id);
      setSelected(null);
      setEvents([]);
      setNote("");
    }
  }, []);
  const currentProject = selected?.project_id === selectedId ? selected : null;

  const notifyError = useCallback((error: unknown, fallback: string) => {
    setAlert({ message: error instanceof Error ? error.message : fallback, error: true });
  }, []);
  const loadProjects = useCallback(async () => {
    try {
      const [up, list] = await Promise.all([backend.health(), backend.projects()]);
      setHealth(up);
      setProjects(list);
      const previous = activeProjectRef.current;
      const next = previous && list.some(item => item.project_id === previous)
        ? previous : list[0]?.project_id ?? null;
      chooseProject(next);
      setAlert(null);
    } catch (error) {
      setHealth(null);
      notifyError(error, "Không thể kết nối Project Core.");
    } finally {
      setLoading(false);
    }
  }, [notifyError, chooseProject]);

  const refreshSelected = useCallback(async (projectId: string) => {
    try {
      const [project, history] = await Promise.all([
        backend.project(projectId), backend.recentEvents(projectId),
      ]);
      if (activeProjectRef.current === projectId) {
        setSelected(project);
        setEvents(history);
      }
    } catch (error) {
      if (activeProjectRef.current === projectId) notifyError(error, "Không thể đọc episode.");
    }
  }, [notifyError]);
  useEffect(() => { void loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (!selectedId) { setSelected(null); setEvents([]); return; }
    void refreshSelected(selectedId);
    const timer = window.setInterval(() => void refreshSelected(selectedId), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, refreshSelected]);
  useEffect(() => {
    if (view !== "assets") return;
    const timer = window.setTimeout(async () => {
      try { setCatalog(await backend.assets(assetQuery, 120)); }
      catch (error) { notifyError(error, "Không thể đọc catalog."); }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [view, assetQuery, notifyError]);

  const approved = useMemo(() => projects.filter(p => p.status.content === "APPROVED").length, [projects]);
  const awaitingVoice = useMemo(() => projects.filter(p =>
    p.status.content === "APPROVED" && p.status.voice !== "USER_LISTENED_APPROVED").length, [projects]);

  async function importCapsule() {
    try {
      const file = await open({ multiple: false, directory: false,
        filters: [{ name: "Approved Phase 1 v2", extensions: ["zip"] }],
      });
      if (typeof file !== "string") return;
      setImporting(true);
      const project = await backend.importZip(file);
      await loadProjects();
      chooseProject(project.project_id);
      setView("overview");
      setAlert({ message: "Đã xác minh và nhập handoff, không thay đổi nguồn gốc.", error: false });
    } catch (error) {
      notifyError(error, "Import bị chặn.");
    } finally { setImporting(false); }
  }

  async function saveNote() {
    const editing = currentProject;
    if (!editing || activeProjectRef.current !== editing.project_id || !note.trim()) return;
    setSaving(true);
    try {
      const submitted = note.trim();
      await backend.note(editing.project_id, editing.revision, submitted);
      if (activeProjectRef.current === editing.project_id) {
        setNote(current => current.trim() === submitted ? "" : current);
        await refreshSelected(editing.project_id);
      }
      await loadProjects();
      setAlert({ message: "Ghi chú đã lưu như metadata, không thay đổi approval.", error: false });
    } catch (error) {
      notifyError(error, "Không thể lưu ghi chú.");
      if (activeProjectRef.current === editing.project_id) {
        await refreshSelected(editing.project_id);
      }
    } finally { setSaving(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-glyph">✦</div><div>
        <div className="brand-name">ZODIAC<span>STUDIO</span></div>
        <div className="brand-caption">CREATIVE WORKSPACE</div></div>
      </div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav">{SECTIONS.map(item =>
        <button key={item.view} className={"nav-item " + (view === item.view ? "active" : "")}
          onClick={() => setView(item.view)}><item.icon size={18} strokeWidth={1.8}/>
          <span>{item.label}</span>
          {item.view === "overview" && projects.length > 0 && <span className="nav-count">{projects.length}</span>}
        </button>)}</nav>
      <div className="sidebar-label sidebar-section">PRODUCTION · PHASE SAU</div>
      <div className="locked-nav"><Mic2 size={17}/> Voice Lab <Lock size={13}/></div>
      <div className="locked-nav"><Clapperboard size={17}/> Visual Editor <Lock size={13}/></div>
      <div className="locked-nav"><FileArchive size={17}/> Export <Lock size={13}/></div>
      <div className="sidebar-bottom">
        <div className="phase-meter"><div className="phase-top"><span>STUDIO V5</span><b>PHASE 1</b></div>
          <div className="phase-track"><span/></div>
          <p>Project shell · Import · Events</p></div>
        <div className="sidebar-footnote"><ShieldCheck size={15}/> Local-first · Source-locked</div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumbs"><span>Zodiac Studio</span><ArrowRight size={13}/>
          <strong>{view === "overview" ? "Tổng quan" : view === "assets" ? "Kho tài nguyên" :
            view === "activity" ? "Nhật ký" : "Agent"}</strong></div>
        <div className="top-actions">
          <span className={"connection " + (health ? "connected" : "offline")}>
            <span className="conn-dot"/>{health ? "Project Core kết nối" : "Chưa kết nối"}
          </span>
          <span className="header-divider"/>
          <button className="icon-btn" onClick={() => void loadProjects()} title="Làm mới"><RefreshCcw size={17}/></button>
          <div className="avatar">✦</div>
        </div>
      </header>
      <main className="content">
        {alert && <div className={"inline-alert " + (alert.error ? "error" : "success")}>
          {alert.error ? <CircleAlert size={16}/> : <CheckCircle2 size={16}/>}
          <span>{alert.message}</span><button onClick={() => setAlert(null)}>×</button>
        </div>}

        {view === "overview" && <>
          <section className="page-header">
            <div><p className="eyebrow">CREATIVE CONTROL CENTER <span> / </span> 01</p>
              <h1>Không gian sáng tạo<span className="star">✦</span></h1>
              <p className="page-subtitle">Một nơi cho toàn bộ câu chuyện. Đúng nguồn, đúng trạng thái, không PASS giả.</p>
            </div>
            <button className="primary-btn" onClick={() => void importCapsule()} disabled={importing}>
              {importing ? <LoaderCircle className="spin" size={17}/> : <Plus size={19}/>}
              {importing ? "Đang kiểm tra…" : "Nhập episode"}</button>
          </section>
          <section className="metrics-grid">
            <div className="metric-card"><div className="metric-top"><span>TỔNG EPISODE</span><Layers3 size={17}/></div>
              <div className="metric-value">{loading ? "··" : String(projects.length).padStart(2, "0")}</div>
              <div className="metric-bottom"><span className="metric-mini-dot blue"/>Project Registry</div></div>
            <div className="metric-card"><div className="metric-top"><span>ĐÃ DUYỆT NỘI DUNG</span><ShieldCheck size={17}/></div>
              <div className="metric-value">{loading ? "··" : String(approved).padStart(2, "0")}</div>
              <div className="metric-bottom"><span className="metric-mini-dot green"/>Receipt & source hash</div></div>
            <div className="metric-card"><div className="metric-top"><span>CHỜ VOICE LAB</span><Headphones size={17}/></div>
              <div className="metric-value">{loading ? "··" : String(awaitingVoice).padStart(2, "0")}</div>
              <div className="metric-bottom"><span className="metric-mini-dot orange"/>Chưa được nghe & duyệt</div></div>
            <div className="metric-card featured-metric"><div className="metric-top"><span>BACKEND</span><Activity size={17}/></div>
              <div className="metric-value small-value">{health ? "READY" : "OFFLINE"}</div>
              <div className="metric-bottom">{health ? "Source-bound · Revisioned" : "Chờ kết nối Tauri"}</div></div>
          </section>

          <div className="dashboard-grid">
            <section className="panel episodes-panel">
              <PanelHeading icon={FolderOpen} title="Dự án gần đây"
                action={<button className="subtle-btn" onClick={() => void loadProjects()}>
                  <RefreshCcw size={14}/> Làm mới</button>}/>
              {projects.length === 0 ? <EmptyState icon={Folder}
                title={loading ? "Đang đọc dữ liệu…" : "Chưa có episode"}
                detail="Nhập ZIP Phase 1 v2 đã được duyệt. Không tự tạo dữ liệu mẫu."/> :
                <div className="episode-list">{projects.map(project =>
                  <button key={project.project_id}
                    className={"episode-item " + (selectedId === project.project_id ? "selected" : "")}
                    onClick={() => chooseProject(project.project_id)}>
                    <span className="episode-mark"><FileArchive size={20}/></span>
                    <span className="episode-info"><strong>{project.episode_id}</strong>
                      <small>Project {project.project_id.slice(0, 19)}… · Revision {project.revision}</small></span>
                    <StatusChip status={project.status.content}/><ArrowRight size={16} className="episode-arrow"/>
                  </button>)}</div>}
              <div className="panel-footer">Đọc trực tiếp từ SQLite Project Registry, không phải nội dung demo.</div>
            </section>
            <section className="panel status-panel">
              <PanelHeading icon={Compass} title="Episode inspector"
                action={currentProject && <span className="revision-mark">R{currentProject.revision}</span>}/>
              {!currentProject ? <EmptyState icon={Search} title="Chọn một episode"
                detail="Trạng thái và bằng chứng sẽ hiển thị tại đây."/> : <>
                <div className="inspector-head"><span className="overline">ĐANG CHỌN</span>
                  <h2>{currentProject.episode_id}</h2><code>{currentProject.source_sha256.slice(0, 24)}…</code></div>
                <div className="stage-list">{FIELDS.map(({ key, label }) => {
                  const status = currentProject.status[key];
                  return <div className="stage-row" key={key}><div className="stage-name">
                    <span className={"stage-icon " + (status === "APPROVED" ? "is-ready" : "")}>
                      {status === "APPROVED" ? <Check size={13}/> : <CircleDot size={12}/>}
                    </span>{label}</div><StatusChip status={status}/></div>;
                })}</div>
                <div className="source-note"><Lock size={16}/>
                  <span>Approved narration & receipt được giữ nguyên. Ghi chú không duyệt nội dung.</span></div>
              </>}
            </section>
          </div>
          <div className="dashboard-grid lower-grid">
            <section className="panel notes-panel">
              <PanelHeading icon={ShieldCheck} title="Ghi chú cho episode"
                action={<span className="panel-meta">Metadata / revisioned</span>}/>
              <textarea value={note} onChange={event => setNote(event.target.value)}
                disabled={!currentProject || saving} maxLength={2000}
                placeholder={currentProject ? "Ghi lại lưu ý về nhịp kể, hình ảnh hoặc kiểm thử…" : "Chọn episode trước khi ghi chú"}/>
              <div className="note-bottom"><span>{note.length}/2000 · Không sửa narration</span>
                <button className="send-btn" onClick={() => void saveNote()}
                  disabled={!currentProject || !note.trim() || saving}>
                  {saving ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>} Lưu ghi chú
                </button></div>
            </section>
            <section className="panel events-panel">
              <PanelHeading icon={Clock3} title="Hoạt động gần đây"
                action={<button className="text-link" onClick={() => setView("activity")}>
                  Xem tất cả <ArrowRight size={13}/></button>}/>
              {events.length === 0 ? <EmptyState icon={FileClock} title="Chưa có sự kiện"
                detail="Các thao tác an toàn sẽ xuất hiện ở đây."/> :
                <div className="event-list">{[...events].reverse().slice(0, 4).map(event =>
                  <div className="event-item" key={event.event_seq}>
                    <span className="event-icon"><Check size={14}/></span>
                    <div><strong>{event.kind}</strong><small>Revision {event.revision} · #{event.event_seq}</small></div>
                  </div>)}</div>}
            </section>
          </div>
        </>}

        {view === "assets" && <>
          <section className="page-header"><div><p className="eyebrow">REAL ASSET INVENTORY <span> / </span> 02</p>
            <h1>Kho tài nguyên<span className="star">✦</span></h1>
            <p className="page-subtitle">Đọc trực tiếp từ V4, có SHA-256. Không giả lập xếp hạng thông minh.</p></div>
            <div className="source-pill"><ShieldCheck size={15}/> SOURCE VERIFIED</div></section>
          <section className="panel asset-panel">
            <div className="asset-toolbar"><div className="search-field"><Search size={17}/>
              <input value={assetQuery} onChange={e => setAssetQuery(e.target.value)}
                placeholder="Tìm theo asset ID, ví dụ: phone…"/></div>
              <span className="asset-count">{catalog?.total ?? "…"} kết quả</span></div>
            {!catalog ? <EmptyState icon={Layers3} title="Đang đọc catalog"
              detail="Đang xác minh asset ID và hash từ Python backend."/> :
              catalog.items.length === 0 ? <EmptyState icon={Search} title="Không tìm thấy"
                detail="Không có asset nào trong catalog phù hợp truy vấn."/> :
                <div className="asset-grid">{catalog.items.map(asset =>
                  <div className="asset-card" key={asset.id}><div className="asset-visual">
                    <Image size={28} strokeWidth={1.2}/><span className="asset-type">SVG</span></div>
                    <strong>{asset.id}</strong><span className="asset-role">{asset.role}</span>
                    <code>{asset.sha256.slice(0, 12)}…</code></div>)}</div>}
            <div className="panel-footer">Hiện chỉ lọc theo ID. Semantic ranking và biến thể hình thể thuộc P3/P5.</div>
          </section>
        </>}

        {view === "activity" && <>
          <section className="page-header"><div><p className="eyebrow">PROJECT EVENT JOURNAL <span> / </span> 03</p>
            <h1>Nhật ký hoạt động<span className="star">✦</span></h1>
            <p className="page-subtitle">Hiển thị 100 sự kiện mới nhất; lịch sử đầy đủ vẫn đọc được qua API cursor.</p></div>
            <button className="outline-btn" onClick={() => selectedId && void refreshSelected(selectedId)}>
              <RefreshCcw size={15}/> Đồng bộ</button></section>
          <section className="panel activity-panel">
            <PanelHeading icon={Activity} title={currentProject ? currentProject.episode_id : "Chưa có episode"}
              action={<span className="panel-meta">{events.length} sự kiện gần nhất</span>}/>
            {events.length === 0 ? <EmptyState icon={FileClock} title="Chưa có sự kiện"
              detail="Ghi chú metadata sẽ được lưu vào ledger."/> :
              <div className="full-event-list">{events.map(event =>
                <div className="full-event" key={event.event_seq}><div className="timeline-dot"/>
                  <div className="full-event-main"><strong>{event.kind}</strong>
                    <p>{typeof event.payload.text === "string" ? event.payload.text :
                      JSON.stringify(event.payload)}</p></div>
                  <span>r{event.revision} · #{event.event_seq}</span></div>)}</div>}
          </section>
        </>}

        {view === "agent" && <>
          <section className="page-header"><div><p className="eyebrow">AGENT WORKSPACE <span> / </span> 04</p>
            <h1>Điều phối Agent<span className="star">✦</span></h1>
            <p className="page-subtitle">Đường lệnh an toàn đã có. Codex App Server sẽ nối ở bước tiếp theo.</p></div>
          </section>
          <div className="agent-setup"><div className="agent-art"><Bot size={52} strokeWidth={1.2}/>
            <span className="agent-spark">✦</span></div>
            <h2>Chưa kích hoạt Agent</h2>
            <p>Studio Core đã cho phép đọc project và ghi metadata có kiểm soát.
              Chúng tôi không giả vờ rằng Agent đã hoàn tất công việc.</p>
            <div className="agent-capabilities">
              <div><CheckCircle2 size={16}/> Project read / inspect</div>
              <div><CheckCircle2 size={16}/> Revisioned project.note</div>
              <div><Lock size={16}/> Creative approval bị khóa</div>
              <div><Clock3 size={16}/> Task streaming: chưa tích hợp</div>
            </div>
          </div>
        </>}

        <footer className="content-footer"><span>✦ &nbsp; ZODIAC STUDIO <strong>V5 PREVIEW</strong></span>
          <span>Phase 1 · Tauri / React · Project Core: Python</span></footer>
      </main>
    </div>
  </div>;
}
