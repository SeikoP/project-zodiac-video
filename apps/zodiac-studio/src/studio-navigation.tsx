import { Activity, ArrowRight, Bot, Home, Layers3, Lightbulb, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Project } from "./backend";

export type View = "overview" | "progress" | "assets" | "activity" | "agent" | "editor" | "voice" | "ideas" | "review";
export type Group = "ideas" | "overview" | "assets";

export const SECTIONS: { label: string; view: Group; icon: LucideIcon }[] = [
  { label: "Kế hoạch", view: "ideas", icon: Lightbulb },
  { label: "Episode", view: "overview", icon: Home },
  { label: "Tài nguyên", view: "assets", icon: Layers3 },
];
export const EPISODE_TABS: [View, string][] = [
  ["overview", "Tổng quan"], ["voice", "Giọng đọc"], ["editor", "Hình ảnh"], ["review", "Xuất & duyệt"],
];

export function groupFor(view: View): Group {
  return view === "ideas" || view === "progress" ? "ideas" : view === "assets" ? "assets" : "overview";
}

export function nextEpisodeStep(project: Project | null, buildReady: boolean): [View, string] {
  if (!project) return ["overview", "Nhập hoặc chọn episode"];
  if (project.status.content !== "APPROVED") return ["overview", "Kiểm tra nguồn Phase 1"];
  if (project.status.voice !== "USER_LISTENED_APPROVED") return ["voice", "Nghe và duyệt giọng đọc"];
  if (buildReady || project.status.video === "EXPORTED") return ["review", "Xuất, nghe và xem video"];
  return ["editor", "Soạn và dựng hình ảnh"];
}

export function StudioSidebar({ expanded, toggle, view, projectCount, onNavigate }: {
  expanded: boolean; toggle: () => void; view: View; projectCount: number; onNavigate: (view: View) => void;
}) {
  const group = groupFor(view);
  return <aside className="sidebar">
    <button className="nav-toggle" aria-label={expanded ? "Thu gọn menu" : "Mở rộng menu"} onClick={toggle}>☰</button>
    <div className="brand"><div className="brand-glyph">✦</div><div>
      <div className="brand-name">ZODIAC<span>STUDIO</span></div>
      <div className="brand-caption">CREATIVE WORKSPACE</div></div>
    </div>
    <div className="sidebar-label">WORKSPACE</div>
    <nav className="sidebar-nav" aria-label="Điều hướng chính">{SECTIONS.map(item =>
      <button key={item.view} className={"nav-item " + (group === item.view ? "active" : "")}
        title={item.label} aria-label={item.label} onClick={() => onNavigate(item.view)}><item.icon size={18} strokeWidth={1.8}/>
        <span>{item.label}</span>
        {item.view === "overview" && projectCount > 0 && <span className="nav-count">{projectCount}</span>}
      </button>)}</nav>
    <div className="sidebar-bottom">
      <div className="phase-meter"><div className="phase-top"><span>ĐANG MỞ</span><b>{EPISODE_TABS.find(([id]) => id === view)?.[1] ?? SECTIONS.find(s => s.view === group)?.label}</b></div>
        <p>Trạng thái hoàn tất theo bằng chứng.</p></div>
      <div className="sidebar-footnote"><ShieldCheck size={15}/> Local-first · Source-locked</div>
    </div>
  </aside>;
}

export function WorkflowBar({ view, projects, selectedId, onNavigate, onChoose, nextStep }: {
  view: View; projects: Project[]; selectedId: string | null;
  onNavigate: (view: View) => void; onChoose: (id: string | null) => void; nextStep: [View, string];
}) {
  const group = groupFor(view);
  const tabs: [View, string][] = group === "ideas" ? [["ideas", "Ý tưởng"], ["progress", "Tiến độ"]]
    : group === "overview" ? EPISODE_TABS : [["assets", "Kho tài nguyên"]];
  return <>
    <nav className="workspace-tabs workflow-tabs" aria-label="Các bước làm việc">
      {tabs.map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => onNavigate(id)}>{label}</button>)}
      {group === "overview" && <span className="episode-tools">
        <button aria-pressed={view === "agent"} onClick={() => onNavigate("agent")}><Bot size={13}/> Agent</button>
        <button aria-pressed={view === "activity"} onClick={() => onNavigate("activity")}><Activity size={13}/> Nhật ký</button>
      </span>}
    </nav>
    {group === "overview" && <div className="episode-context">
      <select aria-label="Episode đang làm" value={selectedId ?? ""} onChange={e => onChoose(e.target.value || null)}>
        {!projects.length && <option value="">Chưa có episode</option>}
        {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.display_title || p.episode_id}</option>)}
      </select>
      <button className="text-link" onClick={() => onNavigate(nextStep[0])}>Tiếp theo: {nextStep[1]} <ArrowRight size={13}/></button>
    </div>}
  </>;
}
