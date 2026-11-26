import { Activity, ArrowRight, Bot, Home, Layers3, Lightbulb, Settings, type LucideIcon } from "lucide-react";
import type { Project } from "./backend";

export type View = "overview" | "progress" | "assets" | "activity" | "agent" | "editor" | "voice" | "ideas" | "review" | "settings";
export type Group = "ideas" | "overview" | "assets" | "settings";

export const SECTIONS: { label: string; view: Group; icon: LucideIcon }[] = [
  { label: "Kế hoạch", view: "ideas", icon: Lightbulb },
  { label: "Episode", view: "overview", icon: Home },
  { label: "Tài nguyên", view: "assets", icon: Layers3 },
  { label: "Cài đặt", view: "settings", icon: Settings },
];
export const EPISODE_TABS: [View, string][] = [
  ["editor", "Quy trình"], ["overview", "Danh sách episode"],
];

export function groupFor(view: View): Group {
  return view === "ideas" || view === "progress" ? "ideas" : view === "assets" ? "assets" : view === "settings" ? "settings" : "overview";
}

export function nextEpisodeStep(project: Project | null, buildReady: boolean): [View, string] {
  if (!project) return ["overview", "Nhập hoặc chọn episode"];
  if (project.status.content !== "APPROVED") return ["overview", "Kiểm tra nguồn Phase 1"];
  if (project.status.voice !== "USER_LISTENED_APPROVED") return ["voice", "Nghe và duyệt giọng đọc"];
  if (buildReady || project.status.video === "EXPORTED") return ["review", "Xuất, nghe và xem video"];
  return ["editor", "Soạn và dựng hình ảnh"];
}

export function StudioNavigation({ view, projectCount, onNavigate }: {
  view: View; projectCount: number; onNavigate: (view: Group) => void;
}) {
  const group = groupFor(view);
  return <>
    <div className="brand"><span className="brand-glyph">✦</span><span>
      <span className="brand-name">ZODIAC<span>STUDIO</span></span>
      <span className="brand-caption">LOCAL · SOURCE-LOCKED</span>
    </span></div>
    <nav className="primary-nav" aria-label="Điều hướng chính">{SECTIONS.map(item =>
      <button key={item.view} className={"nav-item " + (group === item.view ? "active" : "")}
        aria-label={item.label} aria-current={group === item.view ? "page" : undefined} onClick={() => onNavigate(item.view)}>
        <item.icon size={16} strokeWidth={1.8}/><span>{item.label}</span>
        {item.view === "overview" && projectCount > 0 && <span className="nav-count">{projectCount}</span>}
      </button>)}</nav>
  </>;
}

export function WorkflowBar({ view, activeEpisodeView, projects, selectedId, onNavigate, onChoose, nextStep }: {
  view: View; activeEpisodeView: View; projects: Project[]; selectedId: string | null;
  onNavigate: (view: View) => void; onChoose: (id: string | null) => void; nextStep: [View, string];
}) {
  const group = groupFor(view);
  const tabs: [View, string][] = group === "ideas" ? [["ideas", "Concept & tiến độ"]]
    : group === "overview" ? [] : group === "settings" ? [["settings", "Cài đặt chung"]] : [["assets", "Kho tài nguyên"]];
  return <div className="workflow-bar">
    <nav className="workspace-tabs workflow-tabs" aria-label="Các bước làm việc">
      {tabs.length > 1 && tabs.map(([id, label]) => <button key={id} aria-pressed={(id === "overview" || id === "voice" || id === "editor" || id === "review")
        ? (id === "editor" ? view === "editor" : activeEpisodeView === id) && group === "overview" : view === id} onClick={() => onNavigate(id)}>{label}</button>)}
      {group === "overview" && <div className="episode-tools">
        <button aria-pressed={view === "editor"} onClick={() => onNavigate("editor")}>Quy trình</button>
        <button aria-pressed={view === "overview"} onClick={() => onNavigate("overview")}>Danh sách</button>
        <button aria-pressed={view === "agent"} onClick={() => onNavigate("agent")}><Bot size={13}/> Agent</button>
        <button aria-pressed={view === "activity"} onClick={() => onNavigate("activity")}><Activity size={13}/> Nhật ký</button>
      </div>}
    </nav>
    {group === "overview" && <div className="episode-context">
      <select aria-label="Episode đang làm" value={selectedId ?? ""} onChange={e => onChoose(e.target.value || null)}>
        {!projects.length && <option value="">Chưa có episode</option>}
        {projects.map(p => <option key={p.project_id} value={p.project_id}>{(p.sign && !(p.display_title || "").startsWith(p.sign) ? p.sign + " · " : "") + (p.display_title || p.episode_id)}</option>)}
      </select>
      <button className="text-link" onClick={() => onNavigate(nextStep[0])}title={`Tiếp theo: ${nextStep[1]}`}>Đi tới bước tiếp <ArrowRight size={13}/></button>
    </div>}
  </div>;
}
