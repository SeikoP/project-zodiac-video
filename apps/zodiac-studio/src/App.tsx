import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Activity, ArrowRight, Bot, Check, CheckCircle2, CircleAlert, CircleDot,
  Clapperboard, Clock3, Compass, FileArchive, FileClock, Folder, FolderOpen,
  Headphones, Layers3, LoaderCircle, Lock, Plus, RefreshCcw,
  Search, Send, ShieldCheck, Minus, Square, X, type LucideIcon,
} from "lucide-react";
import { backend, type AgentHealth, type AgentTask, type BackendHealth, type Project, type StudioEvent } from "./backend";

import { Paged, PagedText } from "./Paged";
import AgentProposal from "./AgentProposal";
import EditingWorkbench from "./EditingWorkbench";
import type { WorkbenchSelection } from "./workbench-state";
import { StudioSidebar, WorkflowBar, SECTIONS, groupFor, nextEpisodeStep, type View } from "./studio-navigation";

const AssetGallery = lazy(() => import("./AssetGallery"));
const Ideas = lazy(() => import("./Ideas"));
const EpisodeExport = lazy(() => import("./EpisodeExport"));
const HyperframesWorkspace = lazy(() => import("./HyperframesWorkspace"));
const VoiceLab = lazy(() => import("./VoiceLab"));
type Alert = { message: string; error: boolean } | null;
const FIELDS = [
  { key: "content", label: "Nội dung" }, { key: "voice", label: "Giọng đọc" },
  { key: "visual", label: "Hình ảnh" }, { key: "video", label: "Video" },
  { key: "published", label: "Đăng tải" },
] as const;
const STAGE_VIEWS: Record<(typeof FIELDS)[number]["key"], View> = {
  content: "overview", voice: "voice", visual: "editor", video: "review", published: "review",
};
function readableStatus(status: string) {
  if (status === "APPROVED" || status === "REVIEWED") return "Đã duyệt";
  if (status === "USER_LISTENED_APPROVED") return "Đã nghe & duyệt";
  if (status === "TECHNICAL_VALID") return "Hợp lệ kỹ thuật";
  if (status === "COMPAT_MIGRATED") return "Bản tương thích";
  if (status === "BLOCKED") return "Bị chặn";
  if (status === "STALE") return "Nguồn đã thay đổi";
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
  const [selection, setSelection] = useState<WorkbenchSelection>({projectId: "", sceneId: null, entityId: null, timeMs: 0});
  const [expanded, setExpanded] = useState(false);
  const [overviewTab, setOverviewTab] = useState("projects");
  const [view, changeView] = useState<View>("editor");
  const [visited, setVisited] = useState<Set<View>>(new Set(["editor"]));
  function setView(next: View) { setVisited(previous => new Set([...previous, next])); changeView(next); }
  const group = groupFor(view);
  const [reviewConceptId, setReviewConceptId] = useState("");
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [builtProjectId, setBuiltProjectId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [note, setNote] = useState("");
  const [alert, setAlert] = useState<Alert>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
  const [agentTask, setAgentTask] = useState<AgentTask | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const activeProjectRef = useRef<string | null>(null);
  const chooseProject = useCallback((id: string | null) => {
    if (activeProjectRef.current !== id) {
      activeProjectRef.current = id;
      setSelectedId(id);
      let restored: WorkbenchSelection={projectId:id ?? "",sceneId:null,entityId:null,timeMs:0};
      try {
        const saved=JSON.parse(localStorage.getItem(`studio-selection:${id}`) || "null");
        if(saved?.projectId===id && typeof saved.sceneId==="string" && Number.isFinite(saved.timeMs) && saved.timeMs>=0) restored={projectId:id!,sceneId:saved.sceneId,entityId:typeof saved.entityId==="string"?saved.entityId:null,timeMs:saved.timeMs};
        if(id)localStorage.setItem("studio-last-project",id);
      } catch { /* Storage is optional; editing remains available. */ }
      setSelection(restored);
      setSelected(null);
      setEvents([]);
      setNote("");
      setBuiltProjectId(null);
    }
  }, []);
  useEffect(() => {
    if(!selection.projectId)return;
    const save=()=>{try{localStorage.setItem(`studio-selection:${selection.projectId}`,JSON.stringify(selection));}catch {/* optional */}};
    const timer=setTimeout(save,400); window.addEventListener("beforeunload",save);
    return ()=>{clearTimeout(timer);window.removeEventListener("beforeunload",save);};
  },[selection]);
  const updateBuildReady = useCallback((projectId: string, ready: boolean) => {
    if (activeProjectRef.current === projectId) setBuiltProjectId(ready ? projectId : null);
  }, []);
  const currentProject = selected?.project_id === selectedId ? selected : null;
  const currentAgentTask = agentTask?.project_id === selectedId ? agentTask : null;
  const agentRunning = currentAgentTask?.status === "STARTING" || currentAgentTask?.status === "RUNNING";
  const nextStep = nextEpisodeStep(currentProject, builtProjectId === selectedId);

  const notifyError = useCallback((error: unknown, fallback: string) => {
    setAlert({ message: error instanceof Error ? error.message : fallback, error: true });
  }, []);
  async function windowAction(action: "minimize" | "toggleMaximize" | "close") {
    try { await getCurrentWindow()[action](); }
    catch (error) { notifyError(error, "Không thể điều khiển cửa sổ."); }
  }
  const loadProjects = useCallback(async () => {
    try {
      const [up, list] = await Promise.all([backend.health(), backend.projects()]);
      setHealth(up);
      setProjects(list);
      let previous = activeProjectRef.current;
      if(!previous) {try {previous=localStorage.getItem("studio-last-project");}catch {/* optional */}}
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
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try { await refreshSelected(selectedId); } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, refreshSelected]);

  useEffect(() => {
    if (view !== "agent" || !selectedId) {
      setAgentTask(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [health, tasks] = await Promise.all([
          backend.agentHealth(), backend.agentTasks(selectedId),
        ]);
        if (!cancelled) {
          setAgentHealth(health);
          setAgentTask(tasks[0] ?? null);
        }
      } catch (error) {
        if (!cancelled) notifyError(error, "Không thể kết nối Agent.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [view, selectedId, notifyError]);
  useEffect(() => {
    if (view !== "agent" || !currentAgentTask ||
        (currentAgentTask.status !== "STARTING" && currentAgentTask.status !== "RUNNING")) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const task = await backend.agentTask(currentAgentTask.task_id);
        if (!cancelled && activeProjectRef.current === task.project_id) setAgentTask(task);
      } catch (error) {
        if (!cancelled) notifyError(error, "Mất kết nối với phiên Agent.");
      }
    }, 900);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [view, currentAgentTask?.task_id, currentAgentTask?.status, notifyError]);

  async function agentInspect() {
    if (!currentProject || agentBusy) return;
    setAgentBusy(true);
    try {
      setAgentTask(await backend.agentStart(currentProject.project_id));
      setAlert(null);
    } catch (error) { notifyError(error, "Không thể khởi động Agent."); }
    finally { setAgentBusy(false); }
  }
  async function agentCancel() {
    if (!currentAgentTask || !agentRunning || agentBusy) return;
    setAgentBusy(true);
    try { setAgentTask(await backend.agentCancel(currentAgentTask.task_id)); }
    catch (error) { notifyError(error, "Không thể hủy Agent."); }
    finally { setAgentBusy(false); }
  }
  async function agentApply() {
    if (!currentProject || !currentAgentTask ||
        currentAgentTask.status !== "COMPLETED" || currentAgentTask.kind !== "project.inspect" || currentAgentTask.write_applied ||
        agentBusy) return;
    setAgentBusy(true);
    try {
      const event = await backend.agentApply(currentAgentTask.task_id, currentProject.revision);
      setAgentTask(await backend.agentTask(currentAgentTask.task_id));
      await refreshSelected(currentProject.project_id);
      await loadProjects();
      setAlert({ message: "Đã xác nhận và lưu đề xuất vào metadata revision " + event.revision +
        ". Nội dung đã duyệt giữ nguyên.", error: false });
    } catch (error) { notifyError(error, "Không thể lưu đề xuất Agent."); }
    finally { setAgentBusy(false); }
  }

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
      setView("editor");
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

  return <div className={"app-shell " + (expanded ? "nav-expanded" : "nav-compact")}>
    <StudioSidebar expanded={expanded} toggle={() => setExpanded(!expanded)} view={view}
      projectCount={projects.length} onNavigate={setView}/>

    <div className="main-shell">
      <header className="topbar" data-tauri-drag-region>
        <div className="breadcrumbs"><span>Zodiac Studio</span><ArrowRight size={13}/>
          <strong>{SECTIONS.find(section => section.view === group)?.label}</strong>
          {currentProject && <span className="titlebar-project">{currentProject.display_title || currentProject.episode_id}</span>}
        </div>
        <div className="top-actions">
          <span className={"connection " + (health ? "connected" : "offline")}>
            <span className="conn-dot"/>{health ? "Project Core kết nối" : "Chưa kết nối"}
          </span>
          <span className="header-divider"/>
          <button className="icon-btn" onClick={() => void loadProjects()} title="Làm mới" aria-label="Làm mới"><RefreshCcw size={17}/></button>
          {isTauri() && <div className="window-controls" aria-label="Điều khiển cửa sổ">
            <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => void windowAction("minimize")}><Minus size={15}/></button>
            <button type="button" aria-label="Phóng to hoặc khôi phục" title="Phóng to / khôi phục" onClick={() => void windowAction("toggleMaximize")}><Square size={13}/></button>
            <button type="button" className="window-close" aria-label="Đóng cửa sổ" title="Đóng cửa sổ" onClick={() => void windowAction("close")}><X size={17}/></button>
          </div>}
        </div>
      </header>
      <main className={"content view-" + view}>
        <WorkflowBar view={view} projects={projects} selectedId={selectedId}
          onNavigate={setView} onChoose={chooseProject} nextStep={nextStep}/>
        {(view === "ideas" || view === "progress") && <Suspense fallback={<p>Đang mở thư viện ý tưởng…</p>}><Ideas mode={view} onReview={conceptId => { setReviewConceptId(conceptId); setView("review"); }}/></Suspense>}
        {visited.has("review") && <div className="workflow-screen" hidden={view !== "review"}><Suspense fallback={<p>Đang mở trình xem MP4…</p>}><EpisodeExport key={selectedId ?? "empty"} project={currentProject} initialConceptId={reviewConceptId} active={view === "review"}/></Suspense></div>}
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

          <div className="workspace-tabs"><button aria-pressed={overviewTab === "projects"} onClick={() => setOverviewTab("projects")}>Episode & trạng thái</button><button aria-pressed={overviewTab === "notes"} onClick={() => setOverviewTab("notes")}>Ghi chú & hoạt động</button></div>
          <div className="dashboard-grid" hidden={overviewTab !== "projects"}>
            <section className="panel episodes-panel">
              <PanelHeading icon={FolderOpen} title="Dự án gần đây"
                action={<button className="subtle-btn" onClick={() => void loadProjects()}>
                  <RefreshCcw size={14}/> Làm mới</button>}/>
              {projects.length === 0 ? <EmptyState icon={Folder}
                title={loading ? "Đang đọc dữ liệu…" : "Chưa có episode"}
                detail="Nhập ZIP Phase 1 v2 đã được duyệt. Không tự tạo dữ liệu mẫu."/> :
                <div className="episode-list"><Paged label="Episode">{projects.map(project =>
                  <button key={project.project_id}
                    className={"episode-item " + (selectedId === project.project_id ? "selected" : "")}
                    onClick={() => chooseProject(project.project_id)}>
                    <span className="episode-mark"><FileArchive size={20}/></span>
                    <span className="episode-info"><strong>{project.display_title || project.episode_id}</strong>
                      <small>Project {project.project_id.slice(0, 19)}… · Revision {project.revision}</small></span>
                    <StatusChip status={project.status.content}/><ArrowRight size={16} className="episode-arrow"/>
                  </button>)}</Paged></div>}
              <div className="panel-footer">Đọc trực tiếp từ SQLite Project Registry, không phải nội dung demo.</div>
            </section>
            <section className="panel status-panel">
              <PanelHeading icon={Compass} title="Episode inspector"
                action={currentProject && <span className="revision-mark">R{currentProject.revision}</span>}/>
              {!currentProject ? <EmptyState icon={Search} title="Chọn một episode"
                detail="Trạng thái và bằng chứng sẽ hiển thị tại đây."/> : <>
                <div className="inspector-head"><span className="overline">ĐANG CHỌN</span>
                  <h2>{currentProject.display_title || currentProject.episode_id}</h2>
                  <small className="panel-meta">{currentProject.sign || "Episode"}</small>
                  <code>{currentProject.source_sha256.slice(0, 24)}…</code></div>
                <div className="stage-list">{FIELDS.map(({ key, label }) => {
                  const status = currentProject.status[key];
                  const ready = /^(APPROVED|REVIEWED|USER_LISTENED_APPROVED|EXPORTED|CONFIRMED)$/.test(status);
                  return <button type="button" className="stage-row" key={key} aria-label={"Mở bước " + label} onClick={() => setView(STAGE_VIEWS[key])}><div className="stage-name">
                    <span className={"stage-icon " + (ready ? "is-ready" : "")}>
                      {ready ? <Check size={13}/> : <CircleDot size={12}/>}
                    </span>{label}</div><StatusChip status={status}/><ArrowRight size={13}/></button>;
                })}</div>
                <div className="source-note"><Lock size={16}/>
                  <span>Approved narration & receipt được giữ nguyên. Ghi chú không duyệt nội dung.</span></div>
              </>}
            </section>
          </div>
          <div className="dashboard-grid lower-grid" hidden={overviewTab !== "notes"}>
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

        {view === "assets" && <Suspense fallback={<p>Đang đọc thư viện hình ảnh…</p>}>
          <AssetGallery projectId={selectedId}/>
        </Suspense>}

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
              <div className="full-event-list"><Paged size={2} label="Hoạt động">{events.map(event =>
                <div className="full-event" key={event.event_seq}><div className="timeline-dot"/>
                  <div className="full-event-main"><strong>{event.kind}</strong>
                    <PagedText size={240} text={typeof event.payload.text === "string" ? event.payload.text : JSON.stringify(event.payload)}/></div>
                  <span>r{event.revision} · #{event.event_seq}</span></div>)}</Paged></div>}
          </section>
        </>}

        {visited.has("voice") && <div className="workflow-screen" hidden={view !== "voice"}><Suspense fallback={<p>Đang mở Voice Lab…</p>}>
          <VoiceLab key={selectedId ?? "empty"} project={currentProject} active={view === "voice"} onChanged={() => {
            setBuiltProjectId(null);
            void loadProjects(); if (selectedId) void refreshSelected(selectedId);
          }}/>
        </Suspense></div>}

        {visited.has("editor") && <div className="workflow-screen" hidden={view !== "editor"}>
          <Suspense fallback={<EmptyState icon={Clapperboard} title="Đang tải HyperFrames"
            detail="Nạp module riêng khi mở Visual Workspace."/>}>
            <EditingWorkbench title={currentProject?.display_title || currentProject?.episode_id} onVoice={() => setView("voice")} onExport={() => setView("review")} onImport={() => void importCapsule()}>
              <HyperframesWorkspace key={selectedId ?? "empty"} project={currentProject} active={view === "editor"} onBuildReady={updateBuildReady} selection={selection} onSelectionChange={setSelection} onVoice={() => setView("voice")} onImport={() => void importCapsule()}/>
            </EditingWorkbench>
          </Suspense>
        </div>}

        {view === "agent" && <>
          <section className="page-header"><div><p className="eyebrow">MANAGED CODEX APP SERVER <span> / </span> 04</p>
            <h1>Agent của episode<span className="star">✦</span></h1>
            <p className="page-subtitle">Đọc dự án qua Project Core, chạy Codex trong sandbox chỉ đọc và duyệt ghi chú trước khi lưu.</p></div>
            <span className={"source-pill " + (!agentHealth?.available ? "offline" : "")}>
              <ShieldCheck size={15}/>{agentHealth?.available ? "CODEX AVAILABLE" : "CODEX OFFLINE"}
            </span>
          </section>
          <section className="panel agent-workspace">
            <PanelHeading icon={Bot} title="Agent Task" action={
              <span className="panel-meta">{currentAgentTask ? currentAgentTask.status : "Chưa bắt đầu"}</span>}/>
            <div className="agent-command">
              <div><strong>Kiểm tra episode</strong>
                <p>{currentProject ? currentProject.display_title || currentProject.episode_id : "Hãy chọn episode ở Tổng quan trước."}</p>
                <small>Capability: project.inspect · Read-only · Approval: never</small>
              </div>
              <div className="agent-actions">
                <button className="outline-btn" disabled={!currentProject} onClick={() => setView("editor")}>Soạn hoặc chỉnh hình</button>
                <button className="primary-btn" disabled={!currentProject || agentRunning || agentBusy || !agentHealth?.available}
                  onClick={() => void agentInspect()}>
                  {agentBusy || agentRunning ? <LoaderCircle className="spin" size={16}/> : <Bot size={16}/>}
                  {agentRunning ? "Đang phân tích" : "Phân tích dự án"}
                </button>
                {agentRunning && <button className="outline-btn" disabled={agentBusy}
                  onClick={() => void agentCancel()}>Hủy tác vụ</button>}
              </div>
            </div>
            <div className="agent-terminal">
              <div className="agent-terminal-title"><Activity size={15}/> LIVE TASK OUTPUT
                <span>{currentAgentTask ? currentAgentTask.status : "IDLE"}</span></div>
              {!currentAgentTask ? <div className="agent-terminal-empty">
                <Bot size={30} strokeWidth={1.4}/>
                <p>{agentHealth?.available ? "Sẵn sàng kiểm tra bằng Codex App Server."
                  : "Không tìm thấy Codex. Studio vẫn hoạt động thủ công."}</p></div>
                : <div className="agent-output">
                  <span className="agent-task-id">Task {currentAgentTask.task_id.slice(0, 12)} · Project revision {currentAgentTask.project_revision}</span>
                  <AgentProposal task={currentAgentTask}/>
                  {currentAgentTask.error && <div className="agent-error">{currentAgentTask.error}</div>}
                </div>}
            </div>
            <div className="agent-approval">
              <div><ShieldCheck size={19}/><span><strong>Người dùng quyết định ghi chú</strong>
                <small>Agent không thể phê duyệt Voice, Visual hay thay đổi bản kể đã duyệt.</small></span></div>
              <button className="send-btn" disabled={!currentProject || !currentAgentTask ||
                  currentAgentTask.status !== "COMPLETED" || currentAgentTask.kind !== "project.inspect" || currentAgentTask.write_applied || agentBusy}
                onClick={() => void agentApply()}>
                <Check size={15}/>{currentAgentTask?.write_applied ? "Đã lưu" : "Xác nhận & lưu ghi chú"}
              </button>
            </div>
          </section>
          <div className="agent-capabilities agent-summary">
            <div><CheckCircle2 size={16}/> Verified project read</div>
            <div><CheckCircle2 size={16}/> Real Codex streaming</div>
            <div><CheckCircle2 size={16}/> Cancel / retry / restore receipt</div>
            <div><Lock size={16}/> Human creative approval protected</div>
          </div>
        </>}

        <footer className="content-footer"><span>✦ &nbsp; ZODIAC STUDIO <strong>V5 PREVIEW</strong></span>
          <span>Dev app · Chất lượng giọng, hình và video cần người dùng duyệt</span></footer>
      </main>
    </div>
  </div>;
}
